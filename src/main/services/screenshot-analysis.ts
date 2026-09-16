import OpenAI from "openai";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { config, type ImageDetail } from "../config";
import { createLogger, errorMessage } from "../logger";
import {
  buildInstructions,
  buildTranscriptInstructions,
} from "../analysis-presets";
import { resizeDataUrlToPatchBudget } from "./image-budget";
import type { AnalysisResult, TranscriptAnswerProvider } from "../shared/ipc";

const log = createLogger("screenshot-analysis");

let client: OpenAI | null = null;
let clientKey = "";

/**
 * Built lazily and rebuilt if the key changes, so a key written to
 * `<userData>/.env` after launch is picked up. The old code constructed the
 * client at module scope with `apiKey: process.env.OPENAI_API_KEY || ""`,
 * which froze an empty key in place for the process lifetime.
 */
function getClient(): OpenAI {
  const apiKey = config.openaiApiKey;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local (development) or to the .env file in the app's user-data directory.",
    );
  }
  if (!client || clientKey !== apiKey) {
    client = new OpenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

let geminiClient: GoogleGenAI | null = null;
let geminiClientKey = "";

/** Same lazy-rebuild reasoning as `getClient()` above, for the Gemini side. */
function getGeminiClient(): GoogleGenAI {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (development) or to the .env file in the app's user-data directory.",
    );
  }
  if (!geminiClient || geminiClientKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    geminiClientKey = apiKey;
  }
  return geminiClient;
}

export type AnalysisDeltaHandler = (delta: string) => void;

/**
 * Below this many patches per image, "original" detail buys nothing over
 * "high" (the API's own high-detail resizing lands in the same range anyway),
 * so a multi-image request that would squeeze images smaller than this steps
 * down to "high" globally instead of sending needlessly degraded images.
 */
const MIN_USEFUL_ORIGINAL_PATCHES = 4000;

/**
 * Analyze one or more screenshots as a single question.
 *
 * Multiple images are sent as one user turn with several `input_image` parts
 * plus a short note that they're one task -- not as separate requests. Each
 * image individually respects the API's per-image patch ceiling already
 * (screen-capture.ts sizes at capture time), but sending several native
 * captures together multiplies token cost linearly with count, so this
 * divides the per-image patch budget across the set before sending.
 *
 * THROWS on failure -- see `runStream` below. A bad model id or an API error
 * must surface as a rejected promise, never as response text, or it renders
 * as a legitimate-looking answer.
 */
export async function analyzeScreenshot(
  dataUrls: string[],
  presetId: string,
  onDelta: AnalysisDeltaHandler,
): Promise<AnalysisResult> {
  if (dataUrls.length === 0) {
    throw new Error("No screenshots to analyze.");
  }

  const detail = resolveBatchDetail(dataUrls.length);
  const images = prepareImages(dataUrls, detail);

  log.info(
    `analyzing ${images.length} screenshot(s) with ${config.analysisModel} (preset=${presetId}, detail=${detail})`,
  );

  const content: AnalysisContentPart[] = images.map((image) => ({
    type: "input_image",
    detail,
    image_url: image,
  }));

  if (images.length > 1) {
    content.push({
      type: "input_text",
      text: "These screenshots are all part of one task -- treat them together, not as separate questions.",
    });
  }

  return runStream(
    {
      model: config.analysisModel,
      instructions: buildInstructions(presetId),
      input: [{ role: "user", content }],
    },
    onDelta,
  );
}

/**
 * Continue a prior analysis without resending the image(s). `previous_response_id`
 * gives server-side threading, so a follow-up costs a fraction of the first
 * call -- this is what makes follow-ups viable given Phase 1 raises the cost
 * of the initial image.
 */
export async function askFollowUp(
  previousResponseId: string,
  question: string,
  presetId: string,
  onDelta: AnalysisDeltaHandler,
): Promise<AnalysisResult> {
  log.info(`follow-up on ${previousResponseId} (preset=${presetId})`);

  return runStream(
    {
      model: config.analysisModel,
      instructions: buildInstructions(presetId),
      input: question,
      previous_response_id: previousResponseId,
    },
    onDelta,
  );
}

/**
 * Answer one line of a live transcript, standalone -- no image, and no
 * `previous_response_id` since each line is its own question rather than a
 * thread the way screenshot follow-ups are.
 *
 * THROWS on failure, same contract as `analyzeScreenshot` above.
 */
export async function answerTranscriptLine(
  question: string,
  presetId: string,
  provider: TranscriptAnswerProvider,
  onDelta: AnalysisDeltaHandler,
): Promise<AnalysisResult> {
  return provider === "gemini"
    ? answerTranscriptLineWithGemini(question, presetId, onDelta)
    : answerTranscriptLineWithOpenAI(question, presetId, onDelta);
}

async function answerTranscriptLineWithOpenAI(
  question: string,
  presetId: string,
  onDelta: AnalysisDeltaHandler,
): Promise<AnalysisResult> {
  const model = config.openaiTranscriptAnswerModel;
  log.info(`answering transcript line with ${model} (preset=${presetId})`);

  return runStream(
    {
      model,
      instructions: buildTranscriptInstructions(presetId),
      input: question,
    },
    onDelta,
  );
}

/**
 * Same job as the OpenAI path above, over the Gemini API instead. LOW
 * thinking effort for the same reason `DEFAULT_OPENAI_TRANSCRIPT_ANSWER_MODEL`
 * defaults to the cheapest OpenAI tier: this is a latency-sensitive live
 * back-and-forth, not a one-off screenshot analysis.
 */
async function answerTranscriptLineWithGemini(
  question: string,
  presetId: string,
  onDelta: AnalysisDeltaHandler,
): Promise<AnalysisResult> {
  const model = config.geminiTranscriptAnswerModel;
  log.info(`answering transcript line with ${model} (preset=${presetId})`);

  const stream = await getGeminiClient().models.generateContentStream({
    model,
    contents: question,
    config: {
      systemInstruction: buildTranscriptInstructions(presetId),
      maxOutputTokens: config.maxOutputTokens,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  let text = "";
  let responseId = "";
  for await (const chunk of stream) {
    if (chunk.text) {
      text += chunk.text;
      onDelta(chunk.text);
    }
    if (chunk.responseId) responseId = chunk.responseId;
  }

  text = text.trim();
  if (!text) {
    throw new Error(`${model} returned an empty response.`);
  }

  log.debug(
    `analysis complete, ${text.length} chars, responseId=${responseId || "none"}`,
  );
  return { responseId, text };
}

/** Structurally matches the SDK's response-content union; kept local to avoid a deep import. */
type AnalysisContentPart =
  | { type: "input_image"; detail: ImageDetail; image_url: string }
  | { type: "input_text"; text: string };

interface StreamParams {
  model: string;
  instructions: string;
  input: string | Array<{ role: "user"; content: AnalysisContentPart[] }>;
  previous_response_id?: string;
}

async function runStream(
  params: StreamParams,
  onDelta: AnalysisDeltaHandler,
): Promise<AnalysisResult> {
  const { model } = params;

  const stream = getClient().responses.stream({
    model,
    instructions: params.instructions,
    input: params.input,
    previous_response_id: params.previous_response_id,
    store: true, // required for a later askFollowUp() to thread from this response
    max_output_tokens: config.maxOutputTokens,
  });

  stream.on("response.output_text.delta", (event) => onDelta(event.delta));
  // finalResponse() below rejects on stream errors; this just gets it logged
  // with a stack trace intact rather than only surfacing as a generic message.
  stream.on("error", (error) =>
    log.debug("stream error event:", errorMessage(error)),
  );

  const response = await stream.finalResponse();

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error(
      `${model} returned an empty response (status: ${response.status ?? "unknown"}).`,
    );
  }

  log.debug(
    `analysis complete, ${text.length} chars, responseId=${response.id}`,
  );
  return { responseId: response.id, text };
}

/**
 * Single image: use the configured detail level as-is (already sized to
 * CAPTURE_MAX_PATCHES at capture time). Multiple images at "original": split
 * the same budget across the set, falling back to "high" if that would shrink
 * each image past the point "original" is worth using at all.
 */
function resolveBatchDetail(imageCount: number): ImageDetail {
  const configured = config.captureDetail;
  if (imageCount <= 1 || configured !== "original") return configured;

  const perImageBudget = Math.floor(config.captureMaxPatches / imageCount);
  return perImageBudget >= MIN_USEFUL_ORIGINAL_PATCHES ? "original" : "high";
}

function prepareImages(dataUrls: string[], detail: ImageDetail): string[] {
  if (dataUrls.length <= 1 || detail !== "original") return dataUrls;

  const perImageBudget = Math.floor(config.captureMaxPatches / dataUrls.length);
  return dataUrls.map((url) => resizeDataUrlToPatchBudget(url, perImageBudget));
}

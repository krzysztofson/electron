import OpenAI from "openai";
import { config } from "../config";
import { createLogger } from "../logger";

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

/**
 * Analyze a screenshot and return the model's markdown response.
 *
 * This function THROWS on failure, and that is load-bearing. The previous
 * version was typed `Promise<string>` and *returned* its error text, so the
 * renderer's catch block was unreachable and a 401, a rate limit, or an
 * invalid model id was fed through `marked.parse()` and rendered as a
 * perfectly legitimate-looking "OpenAI Analysis" card.
 */
export async function analyzeScreenshot(
  screenshotDataUrl: string,
): Promise<string> {
  const model = config.analysisModel;
  log.info(`analyzing screenshot with ${model}`);

  const response = await getClient().responses.create({
    model,
    // The persona belongs here, not jammed into the user turn as it was before.
    instructions: config.analysisPrompt,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_image",
            // "high" matters: the whole point is reading code off a screenshot,
            // and the old call sent no detail hint at all.
            detail: "high",
            image_url: screenshotDataUrl,
          },
        ],
      },
    ],
    max_output_tokens: config.maxOutputTokens,
  });

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error(
      `${model} returned an empty response (finish reason: ${response.status ?? "unknown"}).`,
    );
  }

  log.debug(`analysis complete, ${text.length} chars`);
  return text;
}

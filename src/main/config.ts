import { app } from "electron";
import { join } from "path";
import { config as loadDotenv } from "dotenv";
import { createLogger, refreshLogLevel } from "./logger";

const log = createLogger("config");

/** Latest cost/capability-balanced OpenAI vision model. Override: OPENAI_MODEL. */
export const DEFAULT_ANALYSIS_MODEL = "gpt-5.6-terra";

/**
 * Answering a live-transcription line is latency-sensitive in a way
 * screenshot analysis is not -- it's a back-and-forth during a live
 * conversation, not a one-off F5 press -- and never needs vision, so this
 * defaults to the cheapest/fastest tier rather than reusing the screenshot
 * model. Used when the transcript answer provider is "openai".
 * Override: OPENAI_TRANSCRIPT_MODEL.
 */
export const DEFAULT_OPENAI_TRANSCRIPT_ANSWER_MODEL = "gpt-5.6-luna";

/**
 * Gemini alternative for the same job, for the "gemini" transcript answer
 * provider. Paired with a LOW thinking level (see screenshot-analysis.ts) for
 * the same reason: a live back-and-forth values speed over the deeper
 * reasoning a transcript one-liner rarely needs. Override: GEMINI_TRANSCRIPT_MODEL.
 */
export const DEFAULT_GEMINI_TRANSCRIPT_ANSWER_MODEL = "gemini-3.8-flash";

/** One of the Responses API's `ImageDetail` values, checked at read time. */
const VALID_IMAGE_DETAILS = ["original", "high", "low", "auto"] as const;
export type ImageDetail = (typeof VALID_IMAGE_DETAILS)[number];

/**
 * "original" skips the API's own resizing, which is the point of capturing at
 * native resolution in screen-capture.ts -- with "high" the API refits
 * everything to a 2048px long edge regardless of what we send, so native
 * pixels would be wasted bandwidth. "original" is documented as being for
 * "large, dense, or spatially-sensitive images", which a screenshot of small
 * code is. Override: CAPTURE_DETAIL.
 */
export const DEFAULT_CAPTURE_DETAIL: ImageDetail = "original";

/**
 * Per-image patch ceiling the API enforces (~30,000). Kept comfortably under
 * it as a default so we have room to fall back once rather than guess exactly
 * where the real limit sits. Override: CAPTURE_MAX_PATCHES.
 */
export const DEFAULT_CAPTURE_MAX_PATCHES = 24_000;

/** Preset problem-type prompts. See analysis-presets.ts. Override: ANALYSIS_PRESET. */
export const DEFAULT_ANALYSIS_PRESET = "coding";

/**
 * Panic-hide and click-through accelerators. Configurable because macOS
 * treats F7/F8 as media keys unless "Use F1-F12 as standard function keys" is
 * enabled -- F5/F6 already work by default here, but that's not a guarantee
 * every function key does.
 */
export const DEFAULT_HIDE_SHOW_SHORTCUT = "F7";
export const DEFAULT_CLICK_THROUGH_SHORTCUT = "F8";

/**
 * The Live API transcription model. This one is chosen deliberately: it
 * supports `responseModalities: [TEXT]` directly, whereas the native-audio
 * dialogue models only emit AUDIO -- spoken output would be exactly wrong for
 * a silent meeting overlay.
 * Override: GEMINI_TRANSCRIBE_MODEL.
 */
export const DEFAULT_TRANSCRIPTION_MODEL = "gemini-3.5-transcribe-live";

/**
 * In development `__dirname` is `build/main`, so `../../` is the repo root and
 * `.env.local` is found. In a packaged app `__dirname` is inside `app.asar`,
 * where that path does not exist -- and `dotenv` reports a missing file by
 * returning `{ error }` rather than throwing, so the old code silently ran
 * with an empty API key. Packaged builds read `<userData>/.env` instead.
 *
 * Note we deliberately do not fall back to the ambient shell environment in a
 * packaged build: a launch from Finder or the Dock inherits no shell profile.
 */
export function loadEnvironment(): void {
  const envPath = app.isPackaged
    ? join(app.getPath("userData"), ".env")
    : join(__dirname, "../../.env.local");

  const result = loadDotenv({ path: envPath, quiet: true });
  refreshLogLevel();

  if (result.error) {
    log.warn(`no environment file at ${envPath}`);
  } else {
    log.info(`loaded environment from ${envPath}`);
  }
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Getters, not captured values: `loadEnvironment()` runs after this module is
 * imported, and a key can be added to `<userData>/.env` while the app is open.
 */
export const config = {
  get openaiApiKey(): string {
    return process.env.OPENAI_API_KEY?.trim() ?? "";
  },
  get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY?.trim() ?? "";
  },
  get analysisModel(): string {
    return process.env.OPENAI_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
  },
  get openaiTranscriptAnswerModel(): string {
    return (
      process.env.OPENAI_TRANSCRIPT_MODEL?.trim() ||
      DEFAULT_OPENAI_TRANSCRIPT_ANSWER_MODEL
    );
  },
  get geminiTranscriptAnswerModel(): string {
    return (
      process.env.GEMINI_TRANSCRIPT_MODEL?.trim() ||
      DEFAULT_GEMINI_TRANSCRIPT_ANSWER_MODEL
    );
  },
  get transcriptionModel(): string {
    return (
      process.env.GEMINI_TRANSCRIBE_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL
    );
  },
  get analysisPrompt(): string | null {
    return process.env.ANALYSIS_PROMPT?.trim() || null;
  },
  get analysisPreset(): string {
    return process.env.ANALYSIS_PRESET?.trim() || DEFAULT_ANALYSIS_PRESET;
  },
  get maxOutputTokens(): number {
    return readInt("OPENAI_MAX_OUTPUT_TOKENS", 4096);
  },
  get captureDetail(): ImageDetail {
    const raw = process.env.CAPTURE_DETAIL?.trim().toLowerCase();
    if (raw && (VALID_IMAGE_DETAILS as readonly string[]).includes(raw)) {
      return raw as ImageDetail;
    }
    return DEFAULT_CAPTURE_DETAIL;
  },
  get captureMaxPatches(): number {
    return readInt("CAPTURE_MAX_PATCHES", DEFAULT_CAPTURE_MAX_PATCHES);
  },
  /** Explicit override; null means "use native display resolution". */
  get captureSizeOverride(): { width: number; height: number } | null {
    const width = readInt("CAPTURE_WIDTH", 0);
    const height = readInt("CAPTURE_HEIGHT", 0);
    return width > 0 && height > 0 ? { width, height } : null;
  },
  get hideShowShortcut(): string {
    return process.env.HIDE_SHOW_SHORTCUT?.trim() || DEFAULT_HIDE_SHOW_SHORTCUT;
  },
  get clickThroughShortcut(): string {
    return (
      process.env.CLICK_THROUGH_SHORTCUT?.trim() ||
      DEFAULT_CLICK_THROUGH_SHORTCUT
    );
  },
};

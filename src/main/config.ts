import { app } from "electron";
import { join } from "path";
import { config as loadDotenv } from "dotenv";
import { createLogger, refreshLogLevel } from "./logger";

const log = createLogger("config");

/** Latest cost/capability-balanced OpenAI vision model. Override: OPENAI_MODEL. */
export const DEFAULT_ANALYSIS_MODEL = "gpt-5.6-terra";

/**
 * The Live API transcription model. This one is chosen deliberately: it
 * supports `responseModalities: [TEXT]` directly, whereas the native-audio
 * dialogue models only emit AUDIO -- spoken output would be exactly wrong for
 * a silent meeting overlay.
 * Override: GEMINI_TRANSCRIBE_MODEL.
 */
export const DEFAULT_TRANSCRIPTION_MODEL = "gemini-3.5-transcribe-live";

/** Override: ANALYSIS_PROMPT. */
export const DEFAULT_ANALYSIS_PROMPT = [
  "You are being interviewed for a front-end developer position.",
  "Solve the task visible in the screenshot, or answer the questions shown.",
  "Write the code solution first (only for coding tasks), then a short explanation.",
].join(" ");

/**
 * Screenshots are downscaled to this before being sent to the model. Kept at
 * the historical default so behaviour is unchanged; raise it (with
 * CAPTURE_WIDTH / CAPTURE_HEIGHT) if the model struggles to read small code.
 */
const DEFAULT_CAPTURE_WIDTH = 1200;
const DEFAULT_CAPTURE_HEIGHT = 800;

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
  get transcriptionModel(): string {
    return (
      process.env.GEMINI_TRANSCRIBE_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL
    );
  },
  get analysisPrompt(): string {
    return process.env.ANALYSIS_PROMPT?.trim() || DEFAULT_ANALYSIS_PROMPT;
  },
  get maxOutputTokens(): number {
    return readInt("OPENAI_MAX_OUTPUT_TOKENS", 4096);
  },
  get captureSize(): { width: number; height: number } {
    return {
      width: readInt("CAPTURE_WIDTH", DEFAULT_CAPTURE_WIDTH),
      height: readInt("CAPTURE_HEIGHT", DEFAULT_CAPTURE_HEIGHT),
    };
  },
};

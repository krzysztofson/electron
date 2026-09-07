import {
  AudioTranscriptionConfigMode,
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { config } from "../../config";
import { createLogger, errorMessage } from "../../logger";
import type { TranscriptionChunk, TranscriptionStatus } from "../../shared/ipc";

const log = createLogger("gemini-live");

/** Live API input format is fixed: raw 16-bit PCM, 16 kHz, mono, little-endian. */
const AUDIO_MIME_TYPE = "audio/pcm;rate=16000";

const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 8000;

export interface TranscriptionHandlers {
  onChunk(chunk: TranscriptionChunk): void;
  onStatus(status: TranscriptionStatus): void;
}

/**
 * Streaming transcription over the Gemini Live API.
 *
 * Replaces the previous Google Cloud Speech integration, which needed a
 * service-account JSON file (and, in this repo, had one hardcoded into source
 * and committed). Gemini needs only an API key.
 *
 * Sessions do not last forever -- the server sends `goAway` shortly before
 * dropping the connection, roughly ten minutes in. The old Cloud Speech code
 * had no restart logic at all and simply went silent past its own ~5 minute
 * cap, which looked exactly like a broken microphone. Here we keep the latest
 * resumption handle and reconnect through that boundary.
 */
export class TranscriptionService {
  private session: Session | null = null;
  private handlers: TranscriptionHandlers | null = null;
  /** Distinguishes "the user stopped it" from "the socket dropped". */
  private active = false;
  private connecting = false;
  private resumptionHandle: string | undefined;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  get isActive(): boolean {
    return this.active;
  }

  async start(handlers: TranscriptionHandlers): Promise<void> {
    if (this.active) {
      log.info("transcription already running");
      return;
    }
    if (!config.geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local (development) or to the .env file in the app's user-data directory.",
      );
    }

    this.handlers = handlers;
    this.active = true;
    this.resumptionHandle = undefined;
    this.reconnectAttempts = 0;

    this.emitStatus({ state: "starting" });
    await this.connect();
  }

  stop(): void {
    if (!this.active) return;
    log.info("stopping transcription");

    this.active = false;
    this.clearReconnectTimer();

    try {
      this.session?.close();
    } catch (error) {
      log.debug("error while closing session:", errorMessage(error));
    }

    this.session = null;
    this.resumptionHandle = undefined;
    this.emitStatus({ state: "idle" });
    this.handlers = null;
  }

  /**
   * Forward one chunk of PCM audio. Dropped silently when no session is up --
   * during a reconnect the renderer keeps streaming, and a few hundred
   * milliseconds of lost audio is better than tearing down the pipeline.
   */
  sendAudio(chunk: Uint8Array): void {
    if (!this.active || !this.session) return;

    try {
      this.session.sendRealtimeInput({
        audio: {
          data: Buffer.from(chunk).toString("base64"),
          mimeType: AUDIO_MIME_TYPE,
        },
      });
    } catch (error) {
      log.warn("failed to send audio chunk:", errorMessage(error));
    }
  }

  private async connect(): Promise<void> {
    if (this.connecting || !this.active) return;
    this.connecting = true;

    const model = config.transcriptionModel;
    log.info(
      `connecting to ${model}${this.resumptionHandle ? " (resuming)" : ""}`,
    );

    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

      this.session = await ai.live.connect({
        model,
        config: {
          // TEXT is why this model was chosen. The native-audio dialogue models
          // only support AUDIO output, which would mean spoken answers in a
          // meeting overlay that exists to be silent.
          responseModalities: [Modality.TEXT],
          inputAudioTranscription: {
            // SMART strips filler words and false starts and adds light
            // formatting; VERBATIM is the default.
            mode: AudioTranscriptionConfigMode.SMART,
          },
          sessionResumption: this.resumptionHandle
            ? { handle: this.resumptionHandle }
            : {},
        },
        callbacks: {
          onopen: () => {
            log.info("live session open");
            this.reconnectAttempts = 0;
            this.emitStatus({ state: "listening" });
          },
          onmessage: (message) => this.handleMessage(message),
          onerror: (error: unknown) => {
            log.warn("live session error:", errorMessage(error));
            this.scheduleReconnect(errorMessage(error));
          },
          onclose: () => {
            log.info("live session closed");
            this.session = null;
            if (this.active) this.scheduleReconnect();
          },
        },
      });
    } catch (error) {
      this.session = null;
      const message = errorMessage(error);
      log.error("failed to open live session:", message);

      // A bad key or model id will fail identically on every retry, so surface
      // it instead of hiding it behind an endless reconnect loop.
      if (this.reconnectAttempts === 0) {
        this.active = false;
        this.emitStatus({ state: "error", message });
        this.handlers = null;
        throw error;
      }
      this.scheduleReconnect(message);
    } finally {
      this.connecting = false;
    }
  }

  private handleMessage(message: LiveServerMessage): void {
    // Issued a few seconds before the server drops us. Reconnecting now, while
    // we still hold a valid handle, keeps the gap short.
    if (message.goAway) {
      log.info(
        `server goAway (${message.goAway.timeLeft ?? "unknown"} left), reconnecting`,
      );
      this.scheduleReconnect();
      return;
    }

    if (message.sessionResumptionUpdate?.resumable) {
      this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
    }

    const content = message.serverContent;
    if (!content) return;

    const interim = content.interimInputTranscription?.text;
    if (interim) {
      this.emitChunk(interim, false);
    }

    const final = content.inputTranscription?.text;
    if (final) {
      this.emitChunk(final, true);
    }
  }

  private scheduleReconnect(errorText?: string): void {
    if (!this.active || this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts += 1;

    this.emitStatus({
      state: "reconnecting",
      message: errorText ?? "Session limit reached, reconnecting…",
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emitChunk(transcript: string, isFinal: boolean): void {
    this.handlers?.onChunk({
      transcript,
      isFinal,
      timestamp: new Date().toISOString(),
    });
  }

  private emitStatus(status: TranscriptionStatus): void {
    this.handlers?.onStatus(status);
  }
}

export const transcriptionService = new TranscriptionService();

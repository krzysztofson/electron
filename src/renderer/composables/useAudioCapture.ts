import type { AudioSourceKind } from "@/ipc-types";

/** The Live API expects raw 16-bit PCM at 16 kHz mono. */
const TARGET_SAMPLE_RATE = 16000;
const WORKLET_NAME = "pcm-encoder";
const WORKLET_URL = "./pcm-worklet.js";

/** How long to wait for non-silent audio before falling back. */
const SILENCE_PROBE_MS = 2500;
/** Peak amplitude above which we consider a chunk to contain real audio. */
const SILENCE_THRESHOLD = 0.001;

export interface AudioCaptureResult {
  source: AudioSourceKind;
}

/**
 * Captures meeting audio and streams 16 kHz PCM to the main process.
 *
 * All node references live in this closure. The old implementation stashed the
 * AudioContext, ScriptProcessorNode and MediaStreamSource on `window` as
 * `(window as any).audioContext` etc. purely to pass them between its start
 * and stop functions.
 */
export function useAudioCapture() {
  let context: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let sawAudio = false;

  /**
   * Preferred path: system audio via Electron's screen-share pipeline, which
   * needs no BlackHole install. We ask for video because macOS only exposes
   * system audio through `getDisplayMedia`, then drop the video track
   * immediately -- we never look at the pixels.
   */
  async function openLoopbackStream(): Promise<MediaStream | null> {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      for (const track of displayStream.getVideoTracks()) {
        track.stop();
        displayStream.removeTrack(track);
      }

      return displayStream.getAudioTracks().length > 0 ? displayStream : null;
    } catch {
      // Permission denied, macOS older than 13.2, or one of the open Electron
      // loopback bugs -- all handled identically, by falling back.
      return null;
    }
  }

  /**
   * Fallback: an input device, preferring BlackHole if the user has it. Kept
   * from the original implementation because loopback capture is still young.
   */
  async function openInputStream(): Promise<{
    stream: MediaStream;
    source: AudioSourceKind;
  }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const blackHole = devices.find(
      (device) =>
        device.kind === "audioinput" && /black\s?hole/i.test(device.label),
    );

    const constraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    if (blackHole) {
      constraints.deviceId = { exact: blackHole.deviceId };
    }

    return {
      stream: await navigator.mediaDevices.getUserMedia({
        audio: constraints,
      }),
      source: blackHole ? "blackhole" : "default-input",
    };
  }

  /** Build the processing graph around the currently open `stream`. */
  async function attachGraph(): Promise<void> {
    if (!stream) throw new Error("No audio stream to attach");

    // Asking for 16 kHz lets the browser handle resampling for us.
    context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    await context.audioWorklet.addModule(WORKLET_URL);

    sourceNode = context.createMediaStreamSource(stream);
    workletNode = new AudioWorkletNode(context, WORKLET_NAME);

    workletNode.port.onmessage = (event: MessageEvent) => {
      const { pcm, peak } = event.data as { pcm: ArrayBuffer; peak: number };
      if (peak > SILENCE_THRESHOLD) sawAudio = true;
      window.electronAPI.sendAudioChunk(pcm);
    };

    // Deliberately not connected to `context.destination`: that would echo the
    // meeting audio back out of the speakers and into the call.
    sourceNode.connect(workletNode);
  }

  /**
   * Loopback can report success and still deliver pure silence when the OS
   * feature flags are unavailable, which is indistinguishable from working at
   * the API level. The only reliable check is to listen for a moment.
   */
  function isStillSilent(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(!sawAudio), SILENCE_PROBE_MS);
    });
  }

  async function start(): Promise<AudioCaptureResult> {
    if (context) throw new Error("Audio capture is already running");
    sawAudio = false;

    let source: AudioSourceKind = "loopback";
    stream = await openLoopbackStream();

    if (!stream) {
      const fallback = await openInputStream();
      stream = fallback.stream;
      source = fallback.source;
    }

    await attachGraph();

    if (source === "loopback" && (await isStillSilent())) {
      await stop();
      const fallback = await openInputStream();
      stream = fallback.stream;
      source = fallback.source;
      await attachGraph();
    }

    return { source };
  }

  async function stop(): Promise<void> {
    workletNode?.disconnect();
    sourceNode?.disconnect();

    if (context && context.state !== "closed") {
      await context.close();
    }
    stream?.getTracks().forEach((track) => track.stop());

    workletNode = null;
    sourceNode = null;
    context = null;
    stream = null;
  }

  return { start, stop };
}

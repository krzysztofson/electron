/**
 * AudioWorklet that converts Float32 samples to 16-bit little-endian PCM.
 *
 * Replaces a `ScriptProcessorNode`, which has been deprecated for years and
 * ran this conversion on the main thread -- it competed with Vue rendering and
 * was the reason the old code sampled its own logging with `Math.random()`.
 *
 * Plain JavaScript in `public/` on purpose: Vite does not transform files
 * fetched by `audioWorklet.addModule()`, and serving it from the same origin
 * avoids having to allow `blob:` in the script CSP.
 *
 * The AudioContext is created at 16 kHz, so the browser has already resampled
 * by the time samples reach here -- exactly the rate the Gemini Live API wants.
 */
class PcmEncoderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;

    const samples = channels[0];
    if (!samples || samples.length === 0) return true;

    const pcm = new Int16Array(samples.length);
    let peak = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      const magnitude = clamped < 0 ? -clamped : clamped;
      if (magnitude > peak) peak = magnitude;
      pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Transfer rather than copy; this runs a few times a second forever.
    this.port.postMessage({ pcm: pcm.buffer, peak }, [pcm.buffer]);
    return true;
  }
}

registerProcessor("pcm-encoder", PcmEncoderProcessor);

# Screen Analyzer

A desktop overlay for online meetings. It floats above your other windows, reads
your screen with an AI model on a keypress, and transcribes call audio live —
while staying **invisible to anyone you are screen-sharing with**.

Two independent features:

| Feature            | Trigger                  | Provider                                  |
| ------------------ | ------------------------ | ----------------------------------------- |
| Screen analysis    | <kbd>F5</kbd> or Capture | OpenAI, `gpt-5.6-terra` by default        |
| Live transcription | Start button             | Gemini Live, `gemini-3.5-transcribe-live` |

They share no state and neither feeds the other.

## The invisible layer

The core of this app is one line in
[`src/main/window/overlay-window.ts`](src/main/window/overlay-window.ts):

```ts
window.setContentProtection(true);
```

That maps to `NSWindowSharingNone` on macOS and `WDA_EXCLUDEFROMCAPTURE` on
Windows, which excludes the window from every screen-capture path — Zoom, Meet,
Teams, QuickTime, `screencapture`, and the app's own `desktopCapturer` calls.
The overlay stays visible on your physical display only.

**If you change anything in `src/main/window/`, re-verify against a real screen
share before trusting it.** That file documents four traps that have already
caused regressions once; read its header comment first.

## Setup

Requires Node 22+ and macOS 13.2+ for driver-free system-audio capture.

```bash
npm install
cp .env.example .env.local   # then add your keys
npm run dev
```

You need at least one key; each feature degrades independently if its key is
missing, and the UI tells you which one.

- `OPENAI_API_KEY` — https://platform.openai.com/api-keys
- `GEMINI_API_KEY` — https://aistudio.google.com/apikey (a plain API key; no
  service account or JSON credentials file)

See [`.env.example`](.env.example) for the optional model, prompt, resolution
and log-level overrides.

### macOS permissions

Both features need permission grants under **System Settings › Privacy &
Security**:

- **Screen Recording** — for screenshots _and_ for system-audio capture, which
  macOS only exposes through the screen-sharing pipeline.
- **Microphone** — only for the fallback audio path.

Without Screen Recording, captures come back empty and transcription falls back
to a microphone.

### Audio capture

System audio is captured natively via `getDisplayMedia({ audio: 'loopback' })`,
so **BlackHole is not required**. If loopback is unavailable or returns silence
the app automatically falls back to a BlackHole virtual device, then to the
default input. The transcription panel shows which path is live.

## Shortcuts

| Key                           | Action                           |
| ----------------------------- | -------------------------------- |
| <kbd>F5</kbd>                 | Capture and analyze              |
| <kbd>F6</kbd>                 | Move overlay right 200px         |
| <kbd>Ctrl</kbd>+<kbd>F6</kbd> | Move overlay left 200px          |
| <kbd>Ctrl</kbd>+arrows        | Move overlay 50px (when focused) |

<kbd>F5</kbd>, <kbd>F6</kbd> and <kbd>Ctrl</kbd>+<kbd>F6</kbd> are global and
claimed while the app runs. The title bar is draggable.

## Commands

```bash
npm run dev          # Vite HMR for the renderer, auto-restart for main
npm run typecheck    # tsc over main, vue-tsc over renderer
npm run lint         # ESLint
npm run format       # Prettier
npm run build        # typecheck, then build, then electron-builder
npm run build:mac    # or :win / :linux
```

## Layout

```
src/
  main/
    main.ts                    app lifecycle and wiring only
    config.ts                  env loading, models, prompts, tunables
    paths.ts                   preload path (see its comment before moving it)
    logger.ts                  leveled logging
    shared/ipc.ts              channel constants + payload types
    window/
      overlay-window.ts        the invisible layer
      shortcuts.ts             global and window-local keys
      security.ts              CSP, permissions, navigation guards
    ipc/register.ts            all ipcMain handlers
    services/
      screen-capture.ts        desktopCapturer
      screenshot-analysis.ts   OpenAI Responses API
      transcription/           Gemini Live session + loopback handler
    preload.ts                 contextBridge surface
  renderer/
    components/{ui,screenshots,transcription}/
    composables/               state and side effects
    styles/                    tokens.css + base.css
    public/pcm-worklet.js      Float32 to 16-bit PCM, off the main thread
```

### Notes for future changes

- **The preload is bundled by Vite**, not emitted by tsc
  ([`vite.preload.config.mjs`](vite.preload.config.mjs)). It runs sandboxed, and
  a sandboxed preload cannot `require` a relative file — bundling is what lets
  it share `shared/ipc.ts` with the main process. `src/main/tsconfig.build.json`
  excludes it for exactly this reason.
- **`shared/ipc.ts` lives under `src/main/` on purpose.** Moving it to a sibling
  `src/shared/` widens the `rootDir` tsc infers and silently relocates output to
  `build/main/main/main.js` — no compiler error, but the dev server and the
  packaged entry point both break.
- **The renderer's `window.electronAPI` type is derived** from `typeof api` in
  the preload, so it cannot drift from the implementation.
- Model output is rendered as HTML through DOMPurify in
  `composables/useMarkdown.ts`. That is the only `v-html` site, and
  `vue/no-v-html` is an error everywhere else.
- API keys never reach the renderer; all provider calls happen in the main
  process.
- Packaged builds read `<userData>/.env`, not `.env.local` — a GUI launch
  inherits no shell environment, and `app.asar` is not writable.

## License

MIT

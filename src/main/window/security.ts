import { shell, session, type Session } from "electron";
import { createLogger } from "../logger";

const log = createLogger("security");

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * One policy, one header.
 *
 * The old code passed `["script-src 'self'", "img-src 'self' data:"]`, and an
 * array emits two *separate* CSP headers -- i.e. two independently enforced
 * policies, each missing what the other declared -- rather than the single
 * semicolon-joined policy that was intended. Neither set `default-src`, so
 * `connect-src`, `style-src` and `object-src` were wide open.
 *
 * `img-src ... data:` is load-bearing: screenshots are rendered straight from
 * `desktopCapturer` thumbnails as `data:` URLs.
 */
function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'none'"],
    "script-src": ["'self'"],
    // Vue injects component styles as <style> tags at runtime in dev, and
    // sanitized markdown can carry style attributes.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'", "data:"],
    // AudioWorklet module loading is checked against worker-src in some
    // Chromium versions and script-src in others.
    "worker-src": ["'self'", "blob:"],
    // The renderer never talks to OpenAI or Gemini directly -- both live in the
    // main process -- so 'self' is enough outside of Vite's HMR socket.
    "connect-src": ["'self'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
    "object-src": ["'none'"],
  };

  if (isDevelopment) {
    directives["connect-src"].push("ws://localhost:*", "http://localhost:*");
    directives["script-src"].push("http://localhost:*");
  }

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}

/**
 * The app asks for microphone/system-audio access, so it needs an explicit
 * allowlist here. Previously there was no handler at all, which means Electron
 * granted whatever the renderer asked for.
 */
function applyPermissionHandlers(target: Session): void {
  const allowed = new Set(["media", "display-capture"]);

  target.setPermissionRequestHandler((_contents, permission, callback) => {
    const granted = allowed.has(permission);
    if (!granted) log.warn(`denied permission request: ${permission}`);
    callback(granted);
  });

  target.setPermissionCheckHandler((_contents, permission) =>
    allowed.has(permission),
  );
}

export function applySessionSecurity(): void {
  const target = session.defaultSession;
  const policy = contentSecurityPolicy();

  target.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [policy],
      },
    });
  });

  applyPermissionHandlers(target);
}

/**
 * Keep the renderer pinned to its own origin. A prompt-injected link in model
 * output should not be able to navigate the overlay somewhere else, and
 * `window.open` should go to the real browser instead of an unguarded window.
 */
export function applyNavigationGuards(contents: Electron.WebContents): void {
  const allowedOrigin = isDevelopment
    ? `http://localhost:${process.argv[2]}`
    : null;

  contents.on("will-navigate", (event, url) => {
    if (allowedOrigin && url.startsWith(allowedOrigin)) return;
    if (!allowedOrigin && url.startsWith("file://")) return;
    log.warn(`blocked navigation to ${url}`);
    event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}

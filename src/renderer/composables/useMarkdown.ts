import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

/**
 * Render model output to HTML that is safe to pass to `v-html`.
 *
 * The sanitiser is not optional. The analysis text comes from a model reading
 * whatever happens to be on screen, so it is attacker-influenceable content,
 * and `marked` v15 removed its built-in `sanitize` option -- the old code
 * piped `marked.parse()` straight into `v-html` with nothing in between.
 */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return DOMPurify.sanitize(html, {
    // No SVG or MathML: nothing in a code answer needs them, and they carry
    // the more awkward sanitiser bypasses.
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button"],
    FORBID_ATTR: ["style", "srcset", "formaction"],
  });
}

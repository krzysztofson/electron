/**
 * Problem-type presets for screenshot analysis.
 *
 * The old prompt was one hardcoded front-end-interview persona, only
 * changeable by setting ANALYSIS_PROMPT and restarting the app. This gives a
 * base set of instructions shared by every preset, plus a short addendum that
 * shapes the answer for the kind of problem actually on screen.
 *
 * Only the `id` and `label` ever reach the renderer (see ipc/register.ts's
 * GetStatus handler) -- the instructions text stays in the main process, same
 * as the rest of the prompt.
 */

export interface AnalysisPreset {
  id: string;
  label: string;
  addendum: string;
}

/**
 * Shared by every preset. Fixes concrete gaps in the old prompt: no verbosity
 * limit, no anti-preamble rule, and no guidance for a screen showing several
 * things at once (browser chrome, other tabs, an unrelated window).
 */
export const BASE_INSTRUCTIONS = [
  "You are a silent assistant during a live technical interview. Answer only",
  "from what is visible in the screenshot(s).",
  "",
  "- Lead with the answer. No preamble, no restating the question, never",
  '  "I can see...".',
  "- Be terse: your output renders in a narrow sidebar. Tight bullets over",
  "  prose.",
  "- Use fenced code blocks with a language tag.",
  "- If several things are on screen, answer the task in focus; ignore",
  "  browser chrome, tabs and unrelated windows.",
  "- If something is unreadable or ambiguous, say so in one line and state",
  "  your best assumption.",
  "- Never invent details you cannot see.",
].join("\n");

export const ANALYSIS_PRESETS: readonly AnalysisPreset[] = [
  {
    id: "coding",
    label: "Coding task",
    addendum:
      "Working code first, then up to 3 bullets on approach, then time/space " +
      "complexity. Match the language visible on screen; default to " +
      "TypeScript if none is evident.",
  },
  {
    id: "debug",
    label: "Debug / error",
    addendum:
      "Root cause in one line, then the corrected snippet or a diff, then a " +
      "short note on why it happened.",
  },
  {
    id: "design",
    label: "System design",
    addendum:
      "Components, then data flow, then the 2-3 key tradeoffs. Compact " +
      "bullet hierarchy, not prose.",
  },
  {
    id: "concept",
    label: "Concept / theory",
    addendum:
      "2-4 sentences, then a minimal example only if it clarifies. Phrase it " +
      "as something to say out loud.",
  },
  {
    id: "freeform",
    label: "Anything",
    addendum: "",
  },
];

const PRESET_BY_ID = new Map(
  ANALYSIS_PRESETS.map((preset) => [preset.id, preset]),
);

export function resolvePreset(id: string | undefined): AnalysisPreset {
  const found = id ? PRESET_BY_ID.get(id) : undefined;
  return found ?? ANALYSIS_PRESETS[0];
}

/** Full instructions for a preset: shared base plus its addendum. */
export function buildInstructions(presetId: string | undefined): string {
  const preset = resolvePreset(presetId);
  return preset.addendum
    ? `${BASE_INSTRUCTIONS}\n\n${preset.addendum}`
    : BASE_INSTRUCTIONS;
}

/** What the renderer is allowed to know about presets: id and label only. */
export function listPresetSummaries(): Array<{ id: string; label: string }> {
  return ANALYSIS_PRESETS.map(({ id, label }) => ({ id, label }));
}

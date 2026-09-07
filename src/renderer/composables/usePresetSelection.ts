import { ref, watch, type Ref } from "vue";
import type { AppStatus } from "@/ipc-types";

const STORAGE_KEY = "screen-analyzer:analysis-preset";

/**
 * Which problem-type preset is active, persisted across restarts.
 *
 * The preset *labels* come from the main process (`status.presets`) so the
 * prompt text never has to round-trip to the renderer, but *which one is
 * selected* is pure UI state, so it lives here rather than in `useAppStatus`.
 */
export function usePresetSelection(status: Ref<AppStatus | null>) {
  const presetId = ref(localStorage.getItem(STORAGE_KEY) ?? "");

  // Falls back to the main process's default once status loads, and again if
  // a stored preset id no longer matches any known preset (e.g. after an
  // update that renamed one).
  watch(
    status,
    (value) => {
      if (!value) return;
      const known = new Set(value.presets.map((preset) => preset.id));
      if (!presetId.value || !known.has(presetId.value)) {
        presetId.value = value.defaultPresetId;
      }
    },
    { immediate: true },
  );

  watch(presetId, (value) => {
    if (value) localStorage.setItem(STORAGE_KEY, value);
  });

  return { presetId };
}

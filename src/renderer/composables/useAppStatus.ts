import { onMounted, ref } from "vue";
import type { AppStatus } from "@/ipc-types";

/**
 * Which providers are actually configured, so the UI can say "add a key"
 * instead of failing on the first click.
 */
export function useAppStatus() {
  const status = ref<AppStatus | null>(null);

  onMounted(async () => {
    try {
      status.value = await window.electronAPI.getStatus();
    } catch {
      status.value = null;
    }
  });

  return { status };
}

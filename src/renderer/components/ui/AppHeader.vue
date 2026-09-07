<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { AppStatus } from "@/ipc-types";
import PresetSwitcher from "./PresetSwitcher.vue";
import ShortcutsCheatsheet from "./ShortcutsCheatsheet.vue";

/**
 * Draggable title bar: model badge, problem-type switcher, click-through
 * indicator, and the shortcuts cheatsheet trigger.
 */
const props = defineProps<{
  status: AppStatus | null;
  presetId: string;
}>();

defineEmits<{ "update:presetId": [value: string] }>();

const showCheatsheet = ref(false);
const clickThrough = ref(false);

let unsubscribeInteractionMode: (() => void) | null = null;

onMounted(() => {
  unsubscribeInteractionMode = window.electronAPI.onInteractionMode(
    (status) => {
      clickThrough.value = status.clickThrough;
    },
  );
});

onUnmounted(() => unsubscribeInteractionMode?.());
</script>

<template>
  <header class="titlebar">
    <span class="titlebar__name">Screen Analyzer</span>
    <span v-if="status" class="titlebar__model" :title="status.analysisModel">
      {{ status.analysisModel }}
    </span>
    <PresetSwitcher
      v-if="status"
      :presets="status.presets"
      :model-value="props.presetId"
      @update:model-value="$emit('update:presetId', $event)"
    />
    <!-- Only shown while active: the overlay is unclickable in this mode, so
         there is nothing else on screen to indicate it. -->
    <span
      v-if="clickThrough"
      class="titlebar__click-through"
      title="Clicks pass through to the window behind"
    >
      click-through
    </span>
    <button
      type="button"
      class="titlebar__help"
      aria-label="Show shortcuts"
      @click="showCheatsheet = true"
    >
      ?
    </button>
  </header>

  <ShortcutsCheatsheet v-if="showCheatsheet" @close="showCheatsheet = false" />
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  height: var(--header-height);
  padding: 0 var(--space-3);
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
  /* Lets you reposition the overlay by dragging anywhere along the bar. */
  -webkit-app-region: drag;
}

.titlebar__name {
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
}

.titlebar__model {
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.titlebar__click-through {
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  color: var(--warning);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.titlebar__help {
  margin-left: auto;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 1;
  /* The button itself must opt out of the drag region above, or clicks on it
     move the window instead of registering. */
  -webkit-app-region: no-drag;
}

.titlebar__help:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}
</style>

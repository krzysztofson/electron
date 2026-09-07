<script setup lang="ts">
import { ref } from "vue";
import type { AppStatus } from "@/ipc-types";
import ShortcutsCheatsheet from "./ShortcutsCheatsheet.vue";

/**
 * Draggable title bar.
 *
 * The old markup had a bare 30px `.drag-region` div that existed only to be
 * grabbed. Same job, but it now shows which model is answering -- useful when
 * OPENAI_MODEL is overridden and you want to confirm what you're actually
 * talking to -- and opens the shortcuts cheatsheet.
 */
defineProps<{ status: AppStatus | null }>();

const showCheatsheet = ref(false);
</script>

<template>
  <header class="titlebar">
    <span class="titlebar__name">Screen Analyzer</span>
    <span v-if="status" class="titlebar__model" :title="status.analysisModel">
      {{ status.analysisModel }}
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

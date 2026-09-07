<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

/**
 * Reference for every shortcut and action in the app, in one place.
 *
 * Kept as static data rather than sourced from `window/shortcuts.ts` -- the
 * main process has no reason to know its own accelerators are also displayed
 * as strings, and duplicating four short rows is cheaper than another IPC
 * round trip.
 */
const GLOBAL_SHORTCUTS = [
  { keys: ["F5"], label: "Capture screen and analyze" },
  { keys: ["F6"], label: "Move overlay right" },
  { keys: ["Ctrl", "F6"], label: "Move overlay left" },
  { keys: ["Ctrl", "↑↓←→"], label: "Nudge overlay (while focused)" },
  { keys: ["F7"], label: "Hide / show the overlay" },
  {
    keys: ["F8"],
    label: "Toggle click-through (clicks pass to what's behind)",
  },
];

const SCREEN_ACTIONS = [
  { label: "Capture", detail: "Take a screenshot without analyzing it" },
  {
    label: "Analyze",
    detail: "Send a screenshot to the AI for a written answer",
  },
  {
    label: "Checkbox + Analyze N together",
    detail: "Select 2+ screenshots and analyze them as one question",
  },
  {
    label: "Ask a follow-up",
    detail: "Continue an answered screenshot without resending the image",
  },
  {
    label: "Preset switcher (header)",
    detail: "Shapes the answer for the kind of problem on screen",
  },
  { label: "× (on a screenshot)", detail: "Delete just that screenshot" },
  { label: "Clear", detail: "Delete every screenshot" },
];

const TRANSCRIPTION_ACTIONS = [
  { label: "Start", detail: "Begin live transcription of meeting audio" },
  { label: "Stop", detail: "End transcription and release the microphone" },
  { label: "Clear", detail: "Empty the transcript history" },
];

const emit = defineEmits<{ close: [] }>();

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="backdrop" @click.self="$emit('close')">
    <div class="sheet" role="dialog" aria-label="Shortcuts">
      <header class="sheet__head">
        <h3>Shortcuts &amp; actions</h3>
        <button
          type="button"
          class="sheet__close"
          aria-label="Close"
          @click="$emit('close')"
        >
          ×
        </button>
      </header>

      <div class="sheet__body">
        <section class="group">
          <h4>Global keys</h4>
          <ul>
            <li v-for="item in GLOBAL_SHORTCUTS" :key="item.label" class="row">
              <span class="keys">
                <kbd v-for="key in item.keys" :key="key">{{ key }}</kbd>
              </span>
              <span class="desc">{{ item.label }}</span>
            </li>
          </ul>
        </section>

        <section class="group">
          <h4>Screen captures</h4>
          <ul>
            <li v-for="item in SCREEN_ACTIONS" :key="item.label" class="row">
              <span class="action">{{ item.label }}</span>
              <span class="desc">{{ item.detail }}</span>
            </li>
          </ul>
        </section>

        <section class="group">
          <h4>Live transcription</h4>
          <ul>
            <li
              v-for="item in TRANSCRIPTION_ACTIONS"
              :key="item.label"
              class="row"
            >
              <span class="action">{{ item.label }}</span>
              <span class="desc">{{ item.detail }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  padding-top: calc(var(--header-height) + var(--space-2));
  background: rgba(0, 0, 0, 0.35);
  /* Never let the picker itself become part of a share -- it lives inside the
     same content-protected window, but this keeps intent obvious. */
  -webkit-app-region: no-drag;
}

.sheet {
  width: calc(100% - var(--space-5));
  max-height: calc(100% - var(--header-height) - var(--space-5));
  overflow-y: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.sheet__head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-raised);
}

.sheet__head h3 {
  font-size: var(--text-sm);
}

.sheet__close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-lg);
  line-height: 1;
  padding: 0 var(--space-1);
}

.sheet__close:hover {
  color: var(--text-primary);
}

.sheet__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-3);
}

.group h4 {
  margin-bottom: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.group ul {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: 128px 1fr;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.keys {
  display: flex;
  gap: 3px;
}

kbd {
  padding: 1px 5px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-overlay);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.action {
  font-weight: 500;
  font-size: var(--text-sm);
}

.desc {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}
</style>

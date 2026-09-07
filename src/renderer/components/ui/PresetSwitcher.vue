<script setup lang="ts">
import { ref } from "vue";
import type { AnalysisPresetSummary } from "@/ipc-types";

/**
 * Deliberately NOT a native <select>. On macOS, Chromium renders an opened
 * <select> as a native Cocoa popup rather than ordinary window content, and
 * there's no guarantee that surface inherits this window's
 * `setContentProtection` -- an untested, and easy-to-miss, way to leak the
 * overlay into a screen share the moment someone opens the dropdown. A plain
 * DOM list has no such risk: it's pixels this window already owns.
 */
const props = defineProps<{
  presets: AnalysisPresetSummary[];
  modelValue: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const isOpen = ref(false);

function select(id: string): void {
  emit("update:modelValue", id);
  isOpen.value = false;
}

function currentLabel(): string {
  return (
    props.presets.find((preset) => preset.id === props.modelValue)?.label ??
    "Preset"
  );
}
</script>

<template>
  <div v-if="presets.length > 0" class="switcher">
    <button
      type="button"
      class="switcher__trigger"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      {{ currentLabel() }}
    </button>

    <div v-if="isOpen" class="switcher__backdrop" @click="isOpen = false" />
    <ul v-if="isOpen" class="switcher__menu" role="listbox">
      <li v-for="preset in presets" :key="preset.id">
        <button
          type="button"
          class="switcher__option"
          :class="{ 'switcher__option--active': preset.id === modelValue }"
          role="option"
          :aria-selected="preset.id === modelValue"
          @click="select(preset.id)"
        >
          {{ preset.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.switcher {
  position: relative;
  /* Sits in the draggable title bar; without this the click would drag the
     window instead of opening the menu -- same trap the "?" button hit. */
  -webkit-app-region: no-drag;
}

.switcher__trigger {
  padding: 1px var(--space-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-overlay);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--text-xs);
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.switcher__trigger:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.switcher__backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.switcher__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 41;
  min-width: 160px;
  margin: 0;
  padding: var(--space-1);
  list-style: none;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.switcher__option {
  display: block;
  width: 100%;
  padding: var(--space-1) var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  font-size: var(--text-sm);
}

.switcher__option:hover {
  background: var(--surface-overlay);
}

.switcher__option--active {
  color: var(--accent);
  font-weight: 600;
}
</style>

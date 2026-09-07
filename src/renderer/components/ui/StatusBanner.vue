<script setup lang="ts">
/**
 * Inline notice. Replaces four separately hand-styled panels
 * (`.transcription-error`, `.error-message`, `.current-transcription`,
 * `.audio-source-indicator`) that each invented their own colour pairing.
 */
withDefaults(
  defineProps<{
    tone?: "info" | "success" | "warning" | "danger";
  }>(),
  { tone: "info" },
);
</script>

<template>
  <div class="banner" :class="`banner--${tone}`">
    <slot />
  </div>
</template>

<style scoped>
.banner {
  padding: var(--space-2) var(--space-3);
  border-left: 2px solid;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.banner--info {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--text-primary);
}

.banner--success {
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
}

.banner--warning {
  background: var(--warning-soft);
  border-color: var(--warning);
  color: var(--warning);
}

.banner--danger {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}
</style>

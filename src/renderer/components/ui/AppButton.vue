<script setup lang="ts">
/**
 * One button, five looks. Replaces the three near-identical inline button
 * blocks and their six hand-written colour rules in the old god-component.
 */
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
    size?: "sm" | "md";
    disabled?: boolean;
    block?: boolean;
  }>(),
  { variant: "secondary", size: "md", disabled: false, block: false },
);
</script>

<template>
  <button
    type="button"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block }]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-overlay);
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    opacity 0.12s ease;
}

.btn--sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
}

.btn--md {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
}

.btn--block {
  width: 100%;
}

.btn:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--accent);
  border-color: transparent;
  color: var(--text-inverse);
}

.btn--primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn--success {
  background: var(--success-soft);
  border-color: transparent;
  color: var(--success);
}

.btn--danger {
  background: var(--danger-soft);
  border-color: transparent;
  color: var(--danger);
}

.btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-secondary);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--surface-overlay);
  color: var(--text-primary);
}
</style>

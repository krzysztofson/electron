<script setup lang="ts">
/** A titled, scrollable section. Both features are laid out with this. */
defineProps<{
  title: string;
  /** Small count/badge next to the title. */
  badge?: string | number;
  /** Let the body take remaining vertical space and scroll. */
  grow?: boolean;
}>();
</script>

<template>
  <section class="panel" :class="{ 'panel--grow': grow }">
    <header class="panel__head">
      <h3 class="panel__title">
        {{ title }}
        <span v-if="badge !== undefined" class="panel__badge">{{ badge }}</span>
      </h3>
      <div class="panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--border-subtle);
}

.panel--grow {
  flex: 1;
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}

.panel__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.panel__badge {
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--surface-overlay);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  letter-spacing: 0;
}

.panel__actions {
  display: flex;
  gap: var(--space-2);
}

.panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
  padding: 0 var(--space-3) var(--space-3);
  overflow-y: auto;
}
</style>

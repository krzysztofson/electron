<script setup lang="ts">
import type { TranscriptEntry } from "@/composables/useTranscription";

defineProps<{
  entries: TranscriptEntry[];
  /** In-progress phrase, shown last and de-emphasised. */
  interim: string;
}>();
</script>

<template>
  <ol class="transcript">
    <li v-for="entry in entries" :key="entry.id" class="transcript__row">
      <span class="transcript__time">{{ entry.at }}</span>
      <span class="transcript__text selectable">{{ entry.text }}</span>
    </li>
    <li v-if="interim" class="transcript__row transcript__row--interim">
      <span class="transcript__time">···</span>
      <span class="transcript__text">{{ interim }}</span>
    </li>
  </ol>
</template>

<style scoped>
.transcript {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.transcript__row {
  display: grid;
  grid-template-columns: 62px 1fr;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.transcript__row:nth-child(odd) {
  background: var(--surface-raised);
}

.transcript__row--interim {
  background: var(--accent-soft);
  color: var(--text-secondary);
  font-style: italic;
}

.transcript__time {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

.transcript__text {
  font-size: var(--text-sm);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
</style>

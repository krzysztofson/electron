<script setup lang="ts">
import type { TranscriptEntry } from "@/composables/useTranscription";
import AppButton from "@/components/ui/AppButton.vue";
import MarkdownView from "@/components/ui/MarkdownView.vue";
import StatusBanner from "@/components/ui/StatusBanner.vue";

defineProps<{
  entries: TranscriptEntry[];
  /** In-progress phrase, shown last and de-emphasised. */
  interim: string;
  /** Whether an API key is configured for answers -- disables the button rather than hiding it. */
  canAnswer: boolean;
}>();

defineEmits<{ getAnswer: [id: number] }>();
</script>

<template>
  <ol class="transcript">
    <li v-for="entry in entries" :key="entry.id" class="transcript__row">
      <div class="transcript__line">
        <span class="transcript__time">{{ entry.at }}</span>
        <span class="transcript__text selectable">{{ entry.text }}</span>
        <AppButton
          variant="ghost"
          size="sm"
          :disabled="!canAnswer || entry.isAnswering"
          @click="$emit('getAnswer', entry.id)"
        >
          {{ entry.isAnswering ? "Answering…" : "Get answer" }}
        </AppButton>
      </div>

      <StatusBanner v-if="entry.answerError" tone="danger">
        {{ entry.answerError }}
      </StatusBanner>
      <MarkdownView
        v-else-if="entry.answerHtml"
        class="transcript__answer"
        :html="entry.answerHtml"
      />
    </li>
    <li v-if="interim" class="transcript__row transcript__row--interim">
      <div class="transcript__line">
        <span class="transcript__time">···</span>
        <span class="transcript__text">{{ interim }}</span>
      </div>
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
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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

.transcript__line {
  display: grid;
  grid-template-columns: 62px 1fr auto;
  align-items: start;
  gap: var(--space-2);
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

.transcript__answer {
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--surface-input);
}
</style>

<script setup lang="ts">
import { ref } from "vue";
import type { Screenshot } from "@/composables/useScreenshots";
import AppButton from "@/components/ui/AppButton.vue";
import MarkdownView from "@/components/ui/MarkdownView.vue";
import StatusBanner from "@/components/ui/StatusBanner.vue";

const props = defineProps<{ screenshot: Screenshot }>();

const emit = defineEmits<{
  analyze: [id: number];
  remove: [id: number];
  toggleSelected: [id: number];
  followUp: [id: number, question: string];
}>();

const followUpText = ref("");

function submitFollowUp(): void {
  const question = followUpText.value.trim();
  if (!question) return;
  emit("followUp", props.screenshot.id, question);
  followUpText.value = "";
}

const capturedAtLabel = () => props.screenshot.capturedAt.toLocaleTimeString();
</script>

<template>
  <article class="shot" :class="{ 'shot--selected': screenshot.selected }">
    <header class="shot__head">
      <input
        type="checkbox"
        class="shot__select"
        :checked="screenshot.selected"
        aria-label="Select for combined analysis"
        @change="$emit('toggleSelected', screenshot.id)"
      />
      <span class="shot__time">{{ capturedAtLabel() }}</span>
      <AppButton
        variant="ghost"
        size="sm"
        aria-label="Delete screenshot"
        @click="$emit('remove', screenshot.id)"
      >
        ×
      </AppButton>
    </header>

    <img class="shot__image" :src="screenshot.dataUrl" alt="Screen capture" />

    <div v-if="screenshot.thread.length === 0" class="shot__actions">
      <AppButton
        variant="primary"
        size="sm"
        block
        :disabled="screenshot.isAnalyzing"
        @click="$emit('analyze', screenshot.id)"
      >
        {{ screenshot.isAnalyzing ? "Analyzing…" : "Analyze" }}
      </AppButton>
    </div>

    <!-- Reachable now that the main process throws instead of returning
         error text as a successful result. -->
    <StatusBanner v-if="screenshot.error" tone="danger">
      {{ screenshot.error }}
    </StatusBanner>

    <div v-if="screenshot.thread.length > 0" class="shot__thread">
      <div
        v-for="(turn, index) in screenshot.thread"
        :key="index"
        class="turn"
        :class="`turn--${turn.role}`"
      >
        <p v-if="turn.role === 'user'" class="turn__question selectable">
          {{ turn.text }}
        </p>
        <MarkdownView v-else :html="turn.html" />
      </div>
    </div>

    <form
      v-if="screenshot.lastResponseId && !screenshot.isAnalyzing"
      class="shot__followup"
      @submit.prevent="submitFollowUp"
    >
      <input
        v-model="followUpText"
        type="text"
        class="followup-input"
        placeholder="Ask a follow-up…"
      />
      <AppButton
        type="submit"
        size="sm"
        variant="secondary"
        :disabled="!followUpText.trim()"
      >
        Ask
      </AppButton>
    </form>
  </article>
</template>

<style scoped>
.shot {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.shot--selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.shot__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.shot__select {
  flex-shrink: 0;
  accent-color: var(--accent);
}

.shot__time {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.shot__image {
  display: block;
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.shot__actions {
  display: flex;
}

.shot__thread {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.turn {
  border-radius: var(--radius-md);
}

.turn--assistant {
  padding: var(--space-3);
  background: var(--surface-input);
}

.turn__question {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-overlay);
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--text-secondary);
}

.shot__followup {
  display: flex;
  gap: var(--space-2);
}

.followup-input {
  flex: 1;
  min-width: 0;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.followup-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
</style>

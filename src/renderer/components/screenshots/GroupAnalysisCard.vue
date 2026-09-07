<script setup lang="ts">
import { ref } from "vue";
import type { AnalysisGroup } from "@/composables/useScreenshots";
import AppButton from "@/components/ui/AppButton.vue";
import MarkdownView from "@/components/ui/MarkdownView.vue";
import StatusBanner from "@/components/ui/StatusBanner.vue";

const props = defineProps<{ group: AnalysisGroup }>();

const emit = defineEmits<{
  remove: [id: string];
  followUp: [id: string, question: string];
}>();

const followUpText = ref("");

function submitFollowUp(): void {
  const question = followUpText.value.trim();
  if (!question) return;
  emit("followUp", props.group.id, question);
  followUpText.value = "";
}
</script>

<template>
  <article class="group">
    <header class="group__head">
      <div class="group__thumbs">
        <img
          v-for="(thumb, index) in group.thumbnails"
          :key="index"
          :src="thumb"
          class="group__thumb"
          alt="Screen capture"
        />
      </div>
      <span class="group__count"
        >{{ group.screenshotIds.length }} screenshots, one question</span
      >
      <AppButton
        variant="ghost"
        size="sm"
        aria-label="Dismiss combined analysis"
        @click="$emit('remove', group.id)"
      >
        ×
      </AppButton>
    </header>

    <StatusBanner v-if="group.error" tone="danger">
      {{ group.error }}
    </StatusBanner>

    <div class="group__thread">
      <div
        v-for="(turn, index) in group.thread"
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
      v-if="group.lastResponseId && !group.isAnalyzing"
      class="group__followup"
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
.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--accent);
  border-radius: var(--radius-lg);
  background: var(--accent-soft);
}

.group__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.group__thumbs {
  display: flex;
  flex-shrink: 0;
}

.group__thumb {
  width: 28px;
  height: 20px;
  object-fit: cover;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  margin-left: -8px;
}

.group__thumb:first-child {
  margin-left: 0;
}

.group__count {
  flex: 1;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.group__thread {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.turn--assistant {
  padding: var(--space-3);
  border-radius: var(--radius-md);
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

.group__followup {
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

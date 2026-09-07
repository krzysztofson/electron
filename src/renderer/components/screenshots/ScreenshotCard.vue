<script setup lang="ts">
import type { Screenshot } from "@/composables/useScreenshots";
import AppButton from "@/components/ui/AppButton.vue";
import MarkdownView from "@/components/ui/MarkdownView.vue";
import StatusBanner from "@/components/ui/StatusBanner.vue";

const props = defineProps<{ screenshot: Screenshot }>();

defineEmits<{ analyze: [id: number]; remove: [id: number] }>();

const capturedAtLabel = () => props.screenshot.capturedAt.toLocaleTimeString();
</script>

<template>
  <article class="shot">
    <header class="shot__head">
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

    <div class="shot__actions">
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

    <div v-if="screenshot.analysisHtml" class="shot__analysis">
      <MarkdownView :html="screenshot.analysisHtml" />
    </div>
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

.shot__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shot__time {
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

.shot__analysis {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-input);
}
</style>

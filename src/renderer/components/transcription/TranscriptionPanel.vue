<script setup lang="ts">
import { computed, toRef } from "vue";
import { useTranscription } from "@/composables/useTranscription";
import AppButton from "@/components/ui/AppButton.vue";
import PanelSection from "@/components/ui/PanelSection.vue";
import StatusBanner from "@/components/ui/StatusBanner.vue";
import TranscriptList from "./TranscriptList.vue";

const props = defineProps<{
  configured: boolean;
  /** Whether OPENAI_API_KEY is set -- gates answering a line when that provider is selected. */
  openaiConfigured: boolean;
  presetId: string;
}>();

const {
  state,
  error,
  audioSource,
  interim,
  history,
  isRunning,
  isBusy,
  autoReply,
  answerProvider,
  start,
  stop,
  clear,
  getAnswer,
} = useTranscription(toRef(props, "presetId"));

const SOURCE_LABELS: Record<string, string> = {
  loopback: "System audio",
  blackhole: "BlackHole device",
  "default-input": "Default input device",
};

const sourceLabel = computed(() =>
  audioSource.value ? SOURCE_LABELS[audioSource.value] : null,
);

/**
 * `configured` above already reports GEMINI_API_KEY presence (transcription
 * needs it regardless), so the gemini answer provider reuses it rather than
 * asking main for the same fact twice.
 */
const answersConfigured = computed(() =>
  answerProvider.value === "gemini" ? props.configured : props.openaiConfigured,
);

function toggleAnswerProvider(): void {
  answerProvider.value =
    answerProvider.value === "openai" ? "gemini" : "openai";
}
</script>

<template>
  <PanelSection
    title="Live transcription"
    :badge="history.length"
    stick-to-bottom
  >
    <template #actions>
      <AppButton variant="ghost" size="sm" @click="toggleAnswerProvider">
        Model: {{ answerProvider === "gemini" ? "Gemini" : "OpenAI" }}
      </AppButton>
      <AppButton
        :variant="autoReply ? 'success' : 'ghost'"
        size="sm"
        :disabled="!answersConfigured"
        @click="autoReply = !autoReply"
      >
        Auto-reply: {{ autoReply ? "On" : "Off" }}
      </AppButton>
      <AppButton
        v-if="history.length > 0 || interim"
        variant="ghost"
        size="sm"
        @click="clear"
      >
        Clear
      </AppButton>
      <AppButton
        v-if="!isRunning"
        variant="success"
        size="sm"
        :disabled="!props.configured"
        @click="start"
      >
        Start
      </AppButton>
      <AppButton v-else variant="danger" size="sm" @click="stop">
        Stop
      </AppButton>
    </template>

    <StatusBanner v-if="!props.configured" tone="warning">
      Set <code>GEMINI_API_KEY</code> in <code>.env.local</code> to enable
      transcription.
    </StatusBanner>

    <StatusBanner v-else-if="!answersConfigured" tone="warning">
      Set
      <code>{{
        answerProvider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"
      }}</code>
      in <code>.env.local</code> to enable answers. Transcription still works.
    </StatusBanner>

    <StatusBanner v-if="error" tone="danger">{{ error }}</StatusBanner>

    <!-- `reconnecting` is expected roughly every ten minutes when the Live
         session hits its limit, so it reads as a notice, not a failure. -->
    <StatusBanner v-else-if="state === 'reconnecting'" tone="warning">
      Reconnecting…
    </StatusBanner>

    <StatusBanner v-else-if="isBusy" tone="info">
      Starting capture…
    </StatusBanner>

    <StatusBanner
      v-else-if="state === 'listening' && sourceLabel"
      tone="success"
    >
      Listening · {{ sourceLabel }}
    </StatusBanner>

    <p v-if="!isRunning && history.length === 0" class="empty">
      Not listening.
    </p>

    <TranscriptList
      v-if="history.length > 0 || interim"
      :entries="history"
      :interim="interim"
      :can-answer="answersConfigured"
      @get-answer="getAnswer"
    />
  </PanelSection>
</template>

<style scoped>
.empty {
  padding: var(--space-3) 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  text-align: center;
}

code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
</style>

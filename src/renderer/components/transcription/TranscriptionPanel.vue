<script setup lang="ts">
import { computed } from "vue";
import { useTranscription } from "@/composables/useTranscription";
import AppButton from "@/components/ui/AppButton.vue";
import PanelSection from "@/components/ui/PanelSection.vue";
import StatusBanner from "@/components/ui/StatusBanner.vue";
import TranscriptList from "./TranscriptList.vue";

const props = defineProps<{ configured: boolean }>();

const {
  state,
  error,
  audioSource,
  interim,
  history,
  isRunning,
  isBusy,
  start,
  stop,
  clear,
} = useTranscription();

const SOURCE_LABELS: Record<string, string> = {
  loopback: "System audio",
  blackhole: "BlackHole device",
  "default-input": "Default input device",
};

const sourceLabel = computed(() =>
  audioSource.value ? SOURCE_LABELS[audioSource.value] : null,
);
</script>

<template>
  <PanelSection title="Live transcription" :badge="history.length">
    <template #actions>
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

<script setup lang="ts">
import { useAppStatus } from "@/composables/useAppStatus";
import { usePresetSelection } from "@/composables/usePresetSelection";
import AppHeader from "@/components/ui/AppHeader.vue";
import ScreenshotPanel from "@/components/screenshots/ScreenshotPanel.vue";
import TranscriptionPanel from "@/components/transcription/TranscriptionPanel.vue";

/**
 * Layout shell only.
 *
 * Screen analysis and transcription are two independent features -- neither's
 * capture/analyze lifecycle feeds the other. `presetId` lives here because
 * the header (to select it) and both panels (to answer with it) need it.
 */
const { status } = useAppStatus();
const { presetId } = usePresetSelection(status);
</script>

<template>
  <AppHeader :status="status" v-model:preset-id="presetId" />

  <main class="layout">
    <ScreenshotPanel
      :configured="status?.analysisConfigured ?? false"
      :preset-id="presetId"
    />
    <div class="layout__transcription">
      <TranscriptionPanel
        :configured="status?.transcriptionConfigured ?? false"
        :openai-configured="status?.analysisConfigured ?? false"
        :preset-id="presetId"
      />
    </div>
  </main>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* Capped so a long meeting transcript cannot squeeze out the screenshots. */
.layout__transcription {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: 45%;
  min-height: 0;
}
</style>

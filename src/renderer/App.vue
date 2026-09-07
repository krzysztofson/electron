<script setup lang="ts">
import { useAppStatus } from "@/composables/useAppStatus";
import AppHeader from "@/components/ui/AppHeader.vue";
import ScreenshotPanel from "@/components/screenshots/ScreenshotPanel.vue";
import TranscriptionPanel from "@/components/transcription/TranscriptionPanel.vue";

/**
 * Layout shell only.
 *
 * Screen analysis and transcription are two independent features -- they share
 * no state and neither feeds the other.
 */
const { status } = useAppStatus();
</script>

<template>
  <AppHeader :status="status" />

  <main class="layout">
    <ScreenshotPanel :configured="status?.analysisConfigured ?? false" />
    <div class="layout__transcription">
      <TranscriptionPanel
        :configured="status?.transcriptionConfigured ?? false"
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

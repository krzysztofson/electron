<script setup lang="ts">
import { useScreenshots } from "@/composables/useScreenshots";
import AppButton from "@/components/ui/AppButton.vue";
import PanelSection from "@/components/ui/PanelSection.vue";
import StatusBanner from "@/components/ui/StatusBanner.vue";
import ScreenshotCard from "./ScreenshotCard.vue";

const props = defineProps<{ configured: boolean }>();

const {
  screenshots,
  isCapturing,
  captureError,
  total,
  capture,
  analyze,
  remove,
  clear,
} = useScreenshots();
</script>

<template>
  <PanelSection title="Screen captures" :badge="total" grow>
    <template #actions>
      <AppButton v-if="total > 0" variant="ghost" size="sm" @click="clear">
        Clear
      </AppButton>
      <AppButton
        variant="primary"
        size="sm"
        :disabled="isCapturing"
        @click="capture"
      >
        {{ isCapturing ? "Capturing…" : "Capture" }}
      </AppButton>
    </template>

    <StatusBanner v-if="!props.configured" tone="warning">
      Set <code>OPENAI_API_KEY</code> in <code>.env.local</code> to enable
      analysis. Capturing still works.
    </StatusBanner>

    <StatusBanner v-if="captureError" tone="danger">
      {{ captureError }}
    </StatusBanner>

    <p v-if="total === 0" class="empty">
      Press <kbd>F5</kbd> to capture and analyze in one step.
    </p>

    <ScreenshotCard
      v-for="screenshot in screenshots"
      :key="screenshot.id"
      :screenshot="screenshot"
      @analyze="analyze"
      @remove="remove"
    />
  </PanelSection>
</template>

<style scoped>
.empty {
  padding: var(--space-4) 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  text-align: center;
}

kbd {
  padding: 1px 5px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-overlay);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
</style>

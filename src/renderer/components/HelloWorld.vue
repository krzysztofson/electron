<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);
const screenshots = ref<{ id: number; dataUrl: string; timestamp: Date }[]>([]);
const errorMsg = ref<string | null>(null);
const isCapturing = ref(false);

// Function to capture screen
const captureScreen = async () => {
  count.value++;
  errorMsg.value = null;
  isCapturing.value = true;

  try {
    const dataUrl = await window.electronAPI.captureScreen();

    if (dataUrl) {
      // Add new screenshot to array instead of replacing
      screenshots.value.push({
        id: Date.now(),
        dataUrl,
        timestamp: new Date(),
      });
    } else {
      errorMsg.value = "No screenshot data returned";
    }
  } catch (error) {
    console.error("❌ Failed to capture screen:", error);
    errorMsg.value = `Error: ${
      error instanceof Error ? error.message : String(error)
    }`;
  } finally {
    isCapturing.value = false;
  }
};

// Function to delete a screenshot
const deleteScreenshot = (id: number) => {
  screenshots.value = screenshots.value.filter(
    (screenshot) => screenshot.id !== id
  );
};

// Function to clear all screenshots
const clearAllScreenshots = () => {
  screenshots.value = [];
};
</script>

<template>
  <div class="card">
    <button
      class="capture"
      type="button"
      @click="captureScreen"
      :disabled="isCapturing"
    >
      {{ isCapturing ? "Capturing..." : `Take Screenshot (${count})` }}
    </button>
    <button
      v-if="screenshots.length > 0"
      class="clear-all"
      type="button"
      @click="clearAllScreenshots"
    >
      Clear All Screenshots
    </button>
  </div>

  <div v-if="errorMsg" class="error-message">
    {{ errorMsg }}
  </div>

  <div v-if="screenshots.length > 0" class="screenshots-container">
    <h3>Screen Captures ({{ screenshots.length }}):</h3>
    <div class="screenshots-grid">
      <div
        v-for="screenshot in screenshots"
        :key="screenshot.id"
        class="screenshot-item"
      >
        <div class="screenshot-header">
          <span class="timestamp">{{
            screenshot.timestamp.toLocaleTimeString()
          }}</span>
          <button class="delete-btn" @click="deleteScreenshot(screenshot.id)">
            ×
          </button>
        </div>
        <img
          :src="screenshot.dataUrl"
          alt="Screen capture"
          class="screenshot"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}

.card {
  display: flex;
  gap: 10px;
}

.screenshots-container {
  margin-top: 20px;
}

.screenshots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.screenshot-item {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.screenshot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.timestamp {
  font-size: 0.8rem;
  color: #666;
}

.delete-btn {
  background: none;
  border: none;
  color: #e74c3c;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 5px;
}

.screenshot {
  width: 100%;
  display: block;
}

.clear-all {
  background-color: #f8d7da;
  color: #721c24;
}

.error-message {
  color: #e74c3c;
  margin: 10px 0;
  padding: 8px;
  background-color: #fadbd8;
  border-radius: 4px;
}

.api-status {
  margin: 10px 0;
  padding: 8px;
  background-color: #e3f2fd;
  border-radius: 4px;
  font-family: monospace;
}
</style>

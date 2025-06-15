<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { marked } from "marked";

const count = ref(0);
const screenshots = ref<
  {
    id: number;
    dataUrl: string;
    timestamp: Date;
    aiAnalysis?: string;
    renderedAnalysis?: string;
  }[]
>([]);
const errorMsg = ref<string | null>(null);
const isCapturing = ref(false);
const isAnalyzing = ref(false);
const selectedScreenshotId = ref<number | null>(null);

let cleanupF5Listener: (() => void) | null = null; // Added

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

// Function to render markdown to HTML
const renderMarkdown = (markdown: string): string => {
  try {
    // marked.parse returns string synchronously
    return marked.parse(markdown) as string;
  } catch (error) {
    console.error("Error rendering markdown:", error);
    return markdown;
  }
};

// Function to analyze screenshot with OpenAI
const analyzeScreenshot = async (id: number) => {
  const screenshot = screenshots.value.find((s) => s.id === id);
  if (!screenshot) return;

  selectedScreenshotId.value = id;
  isAnalyzing.value = true;
  errorMsg.value = null;

  try {
    const response = await window.electronAPI.analyzeScreenshot(
      screenshot.dataUrl
    );

    // Parse Markdown into HTML
    const renderedAnalysis = renderMarkdown(response);

    // Update the screenshot with AI analysis
    screenshots.value = screenshots.value.map((s) =>
      s.id === id ? { ...s, aiAnalysis: response, renderedAnalysis } : s
    );
  } catch (error) {
    console.error("❌ Failed to analyze screenshot:", error);
    errorMsg.value = `Analysis error: ${
      error instanceof Error ? error.message : String(error)
    }`;
  } finally {
    isAnalyzing.value = false;
    selectedScreenshotId.value = null;
  }
};

// Initialize marked
onMounted(() => {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
  console.log("Marked initialized with options:");

  // Listen for F5 press from main process
  if (window.electronAPI && window.electronAPI.onF5Press) {
    console.log("Setting up F5 listener in component");

    cleanupF5Listener = window.electronAPI.onF5Press(async () => {
      console.log("F5 pressed: triggering capture and analysis in component");
      clearAllScreenshots();
      await captureScreen(); // Call local captureScreen
      if (screenshots.value.length > 0 && !errorMsg.value) {
        // Get the ID of the most recently added screenshot
        const latestScreenshot =
          screenshots.value[screenshots.value.length - 1];
        if (latestScreenshot) {
          await analyzeScreenshot(latestScreenshot.id); // Call local analyzeScreenshot
        }
      }
    });
  }
});

onUnmounted(() => {
  if (cleanupF5Listener) {
    cleanupF5Listener();
  }
});
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
        <div class="screenshot-actions">
          <button
            class="analyze-btn"
            @click="analyzeScreenshot(screenshot.id)"
            :disabled="isAnalyzing && selectedScreenshotId === screenshot.id"
          >
            {{
              isAnalyzing && selectedScreenshotId === screenshot.id
                ? "Analyzing..."
                : "Analyze with OpenAI"
            }}
          </button>
        </div>
        <div v-if="screenshot.renderedAnalysis" class="ai-analysis">
          <h4>OpenAI Analysis</h4>
          <div v-html="screenshot.renderedAnalysis" class="markdown-body"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  cursor: default;
}
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

.screenshot-actions {
  padding: 10px;
  background-color: #f9f9f9;
  border-top: 1px solid #ddd;
}

.analyze-btn {
  width: 100%;
  padding: 6px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
}

.analyze-btn:hover {
  background-color: #3e8e41;
}

.ai-analysis {
  padding: 10px;
  background-color: #f0f8ff;
  border-top: 1px solid #ddd;
  max-height: 500px;
  text-align: left;
  overflow-y: auto;
}

.ai-analysis h4 {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 1rem;
  color: #333;
}

/* Style for the rendered markdown */
:deep(.markdown-body) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #333;
}

:deep(.markdown-body pre) {
  background-color: #f6f8fa;
  border-radius: 3px;
  padding: 12px;
  overflow-x: auto;
}

:deep(.markdown-body code) {
  font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  padding: 0.2em 0.4em;
  font-size: 0.85em;
}

:deep(.markdown-body pre code) {
  background-color: transparent;
  padding: 0;
}

:deep(.markdown-body a) {
  color: #0366d6;
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

:deep(.markdown-body p) {
  margin-bottom: 16px;
}
</style>

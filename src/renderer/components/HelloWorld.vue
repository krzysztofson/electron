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

// Transcription state
const isTranscribing = ref(false);
const transcriptionText = ref("");
const transcriptionHistory = ref<
  { transcript: string; timestamp: string; isFinal: boolean }[]
>([]);
const transcriptionError = ref<string | null>(null);

let mediaRecorder: MediaRecorder | null = null;
let audioStream: MediaStream | null = null;
let cleanupF5Listener: (() => void) | null = null;
let cleanupTranscriptionListeners: (() => void)[] = [];

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

// Transcription functions
const startTranscription = async () => {
  try {
    transcriptionError.value = null;

    console.log("Enumerating available audio devices...");

    // Enumerate audio input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(
      (device) => device.kind === "audioinput"
    );

    console.log("Available audio input devices:");
    audioInputs.forEach((device, index) => {
      console.log(
        `${index}: ${device.label || "Unknown Device"} (${device.deviceId})`
      );
    });

    // Look for BlackHole device
    const blackHoleDevice = audioInputs.find(
      (device) =>
        device.label.toLowerCase().includes("blackhole") ||
        device.label.toLowerCase().includes("black hole")
    );

    console.log("Attempting to capture system audio via BlackHole...");

    let audioConstraints: MediaStreamConstraints["audio"];

    if (blackHoleDevice) {
      console.log(`🎯 Found BlackHole device: ${blackHoleDevice.label}`);
      audioConstraints = {
        deviceId: { exact: blackHoleDevice.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
    } else {
      console.log("⚠️ BlackHole device not found, using default device");
      audioConstraints = {
        deviceId: "default",
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
    }

    // Use BlackHole virtual audio device for system audio capture
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    console.log("✅ System audio capture started via BlackHole");

    // Use Web Audio API to get raw PCM data instead of MediaRecorder
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(audioStream);

    // Create a ScriptProcessorNode to capture raw audio data
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = async (event) => {
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0); // Get mono channel

      // Calculate audio level for debugging
      let sum = 0;
      let max = 0;
      for (let i = 0; i < inputData.length; i++) {
        const abs = Math.abs(inputData[i]);
        sum += abs;
        max = Math.max(max, abs);
      }
      const average = sum / inputData.length;

      // Log audio levels periodically
      if (Math.random() < 0.1) {
        // Log ~10% of the time to avoid spam
        console.log(
          `🔊 Audio levels - Average: ${average.toFixed(
            4
          )}, Peak: ${max.toFixed(4)}`
        );
      }

      // Convert Float32 to Int16 (LINEAR16 format)
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      console.log(
        `📊 Captured ${pcmData.length} PCM samples (avg: ${average.toFixed(
          4
        )}, peak: ${max.toFixed(4)})`
      );

      try {
        await window.electronAPI.writeAudioData(pcmData.buffer);
        console.log(
          `📤 Sent ${pcmData.buffer.byteLength} bytes of LINEAR16 PCM data`
        );
      } catch (error) {
        console.error("❌ Error sending PCM data:", error);
      }
    };

    // Connect the audio processing chain
    source.connect(processor);
    processor.connect(audioContext.destination);

    // Store references for cleanup
    (window as any).audioContext = audioContext;
    (window as any).processor = processor;
    (window as any).source = source;

    // Start transcription in main process
    await window.electronAPI.startTranscription();

    isTranscribing.value = true;
    transcriptionText.value = "";
    console.log("Transcription started");
  } catch (error) {
    console.error("Error starting transcription:", error);
    let errorMessage = `Error starting transcription: ${
      error instanceof Error ? error.message : String(error)
    }`;

    // Provide helpful error messages for BlackHole audio issues
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        errorMessage =
          "Permission denied. Please allow microphone access for BlackHole audio capture.";
      } else if (error.name === "NotSupportedError") {
        errorMessage =
          "Audio capture not supported. Make sure BlackHole is properly installed and configured.";
      } else if (error.name === "NotFoundError") {
        errorMessage =
          "BlackHole audio device not found. Make sure BlackHole is installed and set as your default audio device.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage =
          "Audio constraints not supported. Check your BlackHole configuration.";
      }
    }

    transcriptionError.value = errorMessage;
  }
};

const stopTranscription = async () => {
  try {
    // Clean up Web Audio API resources
    const audioContext = (window as any).audioContext;
    const processor = (window as any).processor;
    const source = (window as any).source;

    if (processor) {
      processor.disconnect();
      (window as any).processor = null;
    }

    if (source) {
      source.disconnect();
      (window as any).source = null;
    }

    if (audioContext) {
      await audioContext.close();
      (window as any).audioContext = null;
    }

    // Stop audio stream
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
    }

    // Stop transcription in main process
    await window.electronAPI.stopTranscription();

    isTranscribing.value = false;
    mediaRecorder = null;
    console.log("Transcription stopped");
  } catch (error) {
    console.error("Error stopping transcription:", error);
    transcriptionError.value = `Error stopping transcription: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

const clearTranscription = () => {
  transcriptionHistory.value = [];
  transcriptionText.value = "";
  transcriptionError.value = null;
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

  // Set up transcription event listeners
  if (window.electronAPI) {
    // Listen for transcription data
    const cleanupTranscriptionData = window.electronAPI.onTranscriptionData(
      (data) => {
        console.log("📝 Received transcription data:", data);
        if (data.isFinal) {
          console.log("✅ Final transcript:", data.transcript);
          // Add final transcript to history
          transcriptionHistory.value.push({
            transcript: data.transcript,
            timestamp: new Date(data.timestamp).toLocaleTimeString(),
            isFinal: true,
          });
          transcriptionText.value = ""; // Clear current text for next phrase
        } else {
          console.log("⏳ Interim transcript:", data.transcript);
          // Update current text with interim results
          transcriptionText.value = data.transcript;
        }
      }
    );

    // Listen for transcription started
    const cleanupTranscriptionStarted =
      window.electronAPI.onTranscriptionStarted(() => {
        console.log("Transcription started event received");
        isTranscribing.value = true;
      });

    // Listen for transcription stopped
    const cleanupTranscriptionStopped =
      window.electronAPI.onTranscriptionStopped(() => {
        console.log("Transcription stopped event received");
        isTranscribing.value = false;
      });

    // Listen for transcription errors
    const cleanupTranscriptionError = window.electronAPI.onTranscriptionError(
      (error) => {
        console.error("Transcription error:", error);
        transcriptionError.value = error;
        isTranscribing.value = false;
      }
    );

    // Store cleanup functions
    cleanupTranscriptionListeners = [
      cleanupTranscriptionData,
      cleanupTranscriptionStarted,
      cleanupTranscriptionStopped,
      cleanupTranscriptionError,
    ];
  }
});

onUnmounted(() => {
  if (cleanupF5Listener) {
    cleanupF5Listener();
  }

  // Clean up transcription listeners
  cleanupTranscriptionListeners.forEach((cleanup) => cleanup());

  // Stop transcription if active
  if (isTranscribing.value) {
    stopTranscription();
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

  <!-- Transcription Controls -->
  <div class="transcription-section">
    <h3>Live Transcription</h3>
    <div class="transcription-controls">
      <button
        class="transcription-btn start"
        type="button"
        @click="startTranscription"
        :disabled="isTranscribing"
      >
        {{ isTranscribing ? "Recording..." : "Start Transcription" }}
      </button>
      <button
        class="transcription-btn stop"
        type="button"
        @click="stopTranscription"
        :disabled="!isTranscribing"
      >
        Stop Transcription
      </button>
      <button
        v-if="transcriptionHistory.length > 0"
        class="transcription-btn clear"
        type="button"
        @click="clearTranscription"
      >
        Clear Transcription
      </button>
    </div>

    <!-- Audio source indicator -->
    <div v-if="isTranscribing" class="audio-source-indicator">
      <span class="audio-source-label">
        📡 Capturing: <strong>System Audio (via BlackHole)</strong>
      </span>
    </div>

    <!-- Current transcription text -->
    <div
      v-if="isTranscribing && transcriptionText"
      class="current-transcription"
    >
      <h4>Current:</h4>
      <p class="interim-text">{{ transcriptionText }}</p>
    </div>

    <!-- Transcription history -->
    <div v-if="transcriptionHistory.length > 0" class="transcription-history">
      <h4>Transcription History:</h4>
      <div class="transcription-list">
        <div
          v-for="(item, index) in transcriptionHistory"
          :key="index"
          class="transcription-item"
        >
          <span class="timestamp">{{ item.timestamp }}</span>
          <span class="transcript">{{ item.transcript }}</span>
        </div>
      </div>
    </div>

    <!-- Transcription error -->
    <div v-if="transcriptionError" class="transcription-error">
      {{ transcriptionError }}
    </div>
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

/* Transcription styles */
.transcription-section {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.transcription-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.transcription-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.transcription-btn.start {
  background-color: #4caf50;
  color: white;
}

.transcription-btn.start:hover:not(:disabled) {
  background-color: #45a049;
}

.transcription-btn.stop {
  background-color: #f44336;
  color: white;
}

.transcription-btn.stop:hover:not(:disabled) {
  background-color: #da190b;
}

.transcription-btn.clear {
  background-color: #ff9800;
  color: white;
}

.transcription-btn.clear:hover:not(:disabled) {
  background-color: #e68900;
}

.transcription-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.audio-source-indicator {
  margin-bottom: 15px;
  padding: 8px 12px;
  background-color: #e8f5e8;
  border-radius: 4px;
  border-left: 4px solid #4caf50;
  font-size: 0.9rem;
}

.audio-source-label {
  color: #2e7d32;
}

.audio-source-label strong {
  color: #1b5e20;
}

.current-transcription {
  margin-bottom: 15px;
  padding: 10px;
  background-color: #e3f2fd;
  border-radius: 4px;
  border-left: 4px solid #2196f3;
}

.current-transcription h4 {
  margin: 0 0 8px 0;
  color: #1976d2;
}

.interim-text {
  margin: 0;
  font-style: italic;
  color: #666;
}

.transcription-history {
  max-height: 300px;
  overflow-y: auto;
}

.transcription-history h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.transcription-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transcription-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.transcription-item .timestamp {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
  min-width: 70px;
}

.transcription-item .transcript {
  flex: 1;
  line-height: 1.4;
}

.transcription-error {
  color: #f44336;
  background-color: #ffebee;
  padding: 8px;
  border-radius: 4px;
  margin-top: 10px;
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

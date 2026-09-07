import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  sendMessage: (message: string) => ipcRenderer.send("message", message),
  captureScreen: async () => {
    try {
      const result = await ipcRenderer.invoke("capture-screen");
      return result;
    } catch (error) {
      console.error("❌ Error in preload captureScreen:", error);
      throw error;
    }
  },
  analyzeScreenshot: async (screenshotDataUrl: string) => {
    try {
      const result = await ipcRenderer.invoke(
        "analyze-screenshot",
        screenshotDataUrl
      );
      return result;
    } catch (error) {
      console.error("❌ Error in preload analyzeScreenshot:", error);
      throw error;
    }
  },
  onF5Press: (callback: () => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => {
      callback();
    };
    ipcRenderer.on("f5-pressed", listener);
    return () => {
      ipcRenderer.removeListener("f5-pressed", listener);
    };
  },
  // Transcription API
  startTranscription: async () => {
    try {
      return await ipcRenderer.invoke("start-transcription");
    } catch (error) {
      console.error("❌ Error starting transcription:", error);
      throw error;
    }
  },
  stopTranscription: async () => {
    try {
      return await ipcRenderer.invoke("stop-transcription");
    } catch (error) {
      console.error("❌ Error stopping transcription:", error);
      throw error;
    }
  },
  writeAudioData: async (audioData: ArrayBuffer) => {
    try {
      return await ipcRenderer.invoke(
        "write-audio-data",
        Buffer.from(audioData)
      );
    } catch (error) {
      console.error("❌ Error writing audio data:", error);
      throw error;
    }
  },
  onTranscriptionData: (
    callback: (data: {
      transcript: string;
      isFinal: boolean;
      timestamp: string;
    }) => void
  ) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any) => {
      callback(data);
    };
    ipcRenderer.on("transcription-data", listener);
    return () => {
      ipcRenderer.removeListener("transcription-data", listener);
    };
  },
  onTranscriptionStarted: (callback: () => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => {
      callback();
    };
    ipcRenderer.on("transcription-started", listener);
    return () => {
      ipcRenderer.removeListener("transcription-started", listener);
    };
  },
  onTranscriptionStopped: (callback: () => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => {
      callback();
    };
    ipcRenderer.on("transcription-stopped", listener);
    return () => {
      ipcRenderer.removeListener("transcription-stopped", listener);
    };
  },
  onTranscriptionError: (callback: (error: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error: string) => {
      callback(error);
    };
    ipcRenderer.on("transcription-error", listener);
    return () => {
      ipcRenderer.removeListener("transcription-error", listener);
    };
  },
});

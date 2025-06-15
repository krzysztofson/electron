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
});

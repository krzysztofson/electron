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
});

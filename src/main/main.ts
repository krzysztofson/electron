import { app, BrowserWindow, ipcMain, session } from "electron";
import { join } from "path";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: "#000",
    frame: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    titleBarStyle: "hidden",
    titleBarOverlay: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setOpacity(0.9);
  mainWindow.setWindowButtonVisibility(false);
  mainWindow.setContentProtection(true);

  if (process.env.NODE_ENV === "development") {
    const rendererPort = process.argv[2];
    mainWindow.loadURL(`http://localhost:${rendererPort}`);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(app.getAppPath(), "renderer", "index.html"));
  }

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.control) {
      // Check if Control key is pressed
      const { x, y } = mainWindow.getBounds(); // Get current window position
      switch (input.key) {
        case "ArrowUp":
          mainWindow.setBounds({ x, y: y - 50, width: 1200, height: 600 });
          event.preventDefault();
          break;
        case "ArrowDown":
          mainWindow.setBounds({ x, y: y + 50, width: 1200, height: 600 });
          event.preventDefault();
          break;
        case "ArrowLeft":
          mainWindow.setBounds({ x: x - 50, y, width: 1200, height: 600 });
          event.preventDefault();
          break;
        case "ArrowRight":
          mainWindow.setBounds({ x: x + 50, y, width: 1200, height: 600 });
          event.preventDefault();
          break;
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["script-src 'self'"],
      },
    });
  });

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("message", (event, message) => {
  console.log(message);
});

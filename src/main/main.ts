import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  desktopCapturer,
  screen,
  globalShortcut,
} from "electron";
import OpenAI from "openai";
import { join } from "path";

// Initialize OpenAI client
const openai = new OpenAI({
  // apiKey: process.env.OPENAI_API_KEY || "",
  apiKey: "",
});

// Reusable function for capturing the screen
async function captureScreen(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 1200, height: 800 },
      fetchWindowIcons: false,
    });

    const screenSource =
      sources.find(
        (source) =>
          source.name.includes("Screen") ||
          source.name.includes("Display") ||
          source.name.includes("Entire")
      ) || sources[0];

    if (screenSource) {
      if (!screenSource.thumbnail) {
        console.error("❌ No thumbnail available on the source");
        return null;
      }
      try {
        const dataUrl = screenSource.thumbnail.toDataURL();
        return dataUrl;
      } catch (err) {
        console.error("❌ Error converting thumbnail to data URL:", err);
        return null;
      }
    }
    console.error("❌ No screen source found.");
    return null;
  } catch (error) {
    console.error("❌ Error capturing screen:", error);
    return null;
  }
}

// Reusable function for analyzing screenshots with OpenAI
async function analyzeScreenshotWithOpenAI(
  screenshotDataUrl: string
): Promise<string> {
  try {
    console.log("Analyzing screenshot with OpenAI...");

    if (!openai.apiKey) {
      return "Error: OpenAI API key is not set. Set the OPENAI_API_KEY environment variable.";
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // Ensure this model is appropriate and available
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "you are being intevied for front end dev posiotion. solve this task visible on screenshot or shortly respond to questions. first write code solution (if needed - only for code tasks) and after that short explanation.",
            },
            {
              type: "image_url",
              image_url: {
                url: screenshotDataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || "No response from OpenAI";
  } catch (error: any) {
    console.error("❌ Error analyzing screenshot with OpenAI:", error);
    return `Error analyzing screenshot: ${error.message || error}`;
  }
}

let mainWindowInstance: BrowserWindow | null = null;

function createWindow() {
  // Enhanced preload path verification
  const preloadPath = join(__dirname, "preload.js");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  const mainWindow = new BrowserWindow({
    width: screenWidth / 3, // Half screen width
    height: screenHeight, // Full screen height
    x: 50,
    y: 50,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: "#000",
    frame: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    // titleBarStyle: "hidden",
    // titleBarOverlay: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  mainWindowInstance = mainWindow; // Store the instance

  mainWindow.setOpacity(0.7);
  // mainWindow.setWindowButtonVisibility(false);
  // Disable content protection as it can interfere with screen capture
  mainWindow.setContentProtection(true);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, "floating");

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

  // Register IPC handler for screen capture
  ipcMain.handle("capture-screen", async () => {
    return captureScreen();
  });

  // Register IPC handler for analyzing screenshots with OpenAI
  ipcMain.handle("analyze-screenshot", async (_, screenshotDataUrl: string) => {
    return analyzeScreenshotWithOpenAI(screenshotDataUrl);
  });

  // Set permissions to allow screen capture
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "script-src 'self'",
          "img-src 'self' data:",
        ],
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

  globalShortcut.register("F5", async () => {
    console.log("F5 pressed, sending trigger to renderer...");
    if (mainWindowInstance) {
      mainWindowInstance.webContents.send("f5-pressed");
    }
  });

  globalShortcut.register("F6", () => {
    if (mainWindowInstance) {
      const { x, y } = mainWindowInstance.getBounds();
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workAreaSize;
      mainWindowInstance.setBounds({
        x: x + 200,
        y,
        width: screenWidth / 3,
        height: screenHeight,
      });
    }
  });

  globalShortcut.register("Control+F6", () => {
    if (mainWindowInstance) {
      const { x, y } = mainWindowInstance.getBounds();
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workAreaSize;
      mainWindowInstance.setBounds({
        x: x - 200,
        y,
        width: screenWidth / 3,
        height: screenHeight,
      });
    }
  });
});

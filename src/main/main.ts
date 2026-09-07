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
import * as speech from "@google-cloud/speech";
import { config as loadEnv } from "dotenv";

loadEnv({ path: join(__dirname, "../../.env.local") });

const credentials = {
  type: "service_account",
  project_id: "crack-producer-463313-v4",
  private_key_id: "2c15262b4074923f4b1b5d2860dcfad978a3b786",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCy6/jIJo4lrg9P\nVY9OdyTve+DrjOvmkVBVqOltTY3SgLRWpcmpowoD8b0uc7K0IwSpO+5CpUVD0KqM\nNAuZjwcGFrW3Vd73+qt2wirazQm9xMdK/+OLfj7hjaVuCrPHQbQbuP+cAItrCcC+\n3yM/Paz1LyWRI7FXA75nA5u3IbserzCrIt7ZCGx5r7Ox3mYkOs+jinGG75MR0FK+\nPh4qp/i9w92P6q8o+O8DKBRmi7OGvj4drPCsIMJ8yfzdmlF22GPSd6lcxWbyoi5O\nHODgrjMA3mMYBmtHOEyn0qTLXmyvy6dvnv4QOYCNXYb4RvquVCEyK3QzC17tnX2V\nfcHrBNcnAgMBAAECggEADvcIsGj1I7aqxiZwXY4+kx9H4TvAsWC/GOMPXxqI/a3R\nJ5wnQV6HJGxQN/XqYQG6zpLaK03afMETurVRsQ7S9hHpMgPnKdOYCs9TuUhEA9DV\nIHNFq3GsPb5Us18GyWg38cen7XroLlQ7AFv2fUAh2sIOQNT87Lu97azSFd+m4Hp/\n6NRthVP9twROXKMHWLaOHyulUL9e9NgaZHtCea7RR5ScLQCQzAuKzwDpl9mYxbH8\nHeF2xA3HO62XSrEMEoLHH2l5Claz77xubsOgP8Cjm4EITdUVhl1bhZsG09RvLWiW\nVIpESTKOTWgIIuwnPpdqFrljm46Ml4VEgqf595zwtQKBgQDW8dATK/njVdlq7RIz\nrtN9qxtHmsW0XDqb1/rvjDSjR6/nzf9lOwu/sSvxIQtNa2J5x6KQnz2HtcB1mHiZ\n5T38/byVwe+0ArgRYKt/hms99SeeuNN64iuTtqwDozX+dCxkquj60HzfH454WdC/\nQOgOoo9vlEGaSAKbCTduObJTHQKBgQDVGL6LnIwABVzXBwDs0FaJ0O9K+DRAcpxP\n0q/cZtxenqTvolw5lA4R/SmrEfrS6QBJEi2PCEMSu2qf2IJVEgTOpFGxy464uyuP\nCTppKFd9US1sgeF/GMQ+0QpmpTEX9RDIlq5ckbsE9C4GVNhYrNY4DoBUz6G2ue1c\nNi3fVD+cEwKBgQCiWcFdScEUajqvXeN6sBlEeWJAgnHEWklWfxslppP3pGUERH8c\nmi20m4DiP6BG2M5nx1dNv0l9YNW+vOyS6SkaFxlDUFnacJdRYOAIkaIdCTfk1hu+\nXGinyLlCght9V4hUfRc+ow0+hppY4xYd70uYCkcm8ydd/fgh3CNHGUNNLQKBgCxP\n5O+rMgGfG9sq/apA+H3YEKqKSnNMYezHZwJx8UlLvAiIvpzKiNJ8znlgV8Qb549K\nVGb11NzEVDvBDfkash02VjaemaMYaMpppNfRJ8BLbSKvL3D6eXSGi58korzUnRTZ\nIJDnTPiOvjNa2VI3PqSRf2YjdwFEUHNoYMmb/045AoGADqew4xN+JkPp514yrb4s\n1lzdW2ME3Sk2895/HblToiwYPKwj7y6eL4n/0F2NXfYowcrOJKyaUQMmwutU1C2M\nRWhkX4ycua6uRaV4omSarsnvOzHm3UKl56p+guuz+KpJcprzkU61ZK/Bi1Zo8eDd\nn8bL6Rc7o3Bgo0cujURzgpk=\n-----END PRIVATE KEY-----\n",
  client_email: "chris1@crack-producer-463313-v4.iam.gserviceaccount.com",
  client_id: "112502856347016941271",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/chris1%40crack-producer-463313-v4.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

// Initialize Google Cloud Speech client with hardcoded credentials
let speechClient: speech.SpeechClient | null = null;
let isCredentialsConfigured = false;

try {
  // Use hardcoded credentials
  speechClient = new speech.SpeechClient({
    projectId: credentials.project_id,
    credentials: credentials,
  });
  isCredentialsConfigured = true;
  console.log(
    "✅ Google Cloud Speech client initialized with hardcoded credentials"
  );
} catch (error) {
  console.error("❌ Error initializing Google Cloud Speech client:", error);
  speechClient = null;
  isCredentialsConfigured = false;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// Transcription state
let transcriptionStream: any = null;
let isTranscribing = false;

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
      model: "gpt-5.1", // Ensure this model is appropriate and available
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "you are being intevied for front end dev posiotion. solve this task visible on screenshot or respond to questions. first write code solution (if needed - only for code tasks) and after that short explanation.",
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
    });

    return response.choices[0]?.message?.content || "No response from OpenAI";
  } catch (error: any) {
    console.error("❌ Error analyzing screenshot with OpenAI:", error);
    return `Error analyzing screenshot: ${error.message || error}`;
  }
}

// Function to start transcription
async function startTranscription(mainWindow: BrowserWindow): Promise<void> {
  try {
    if (isTranscribing) {
      console.log("Transcription already in progress");
      return;
    }

    // Check if Google Cloud credentials are properly set
    if (!speechClient || !isCredentialsConfigured) {
      const errorMessage =
        "Google Cloud Speech-to-Text is not configured. Please set up your credentials first. See GOOGLE_CLOUD_SETUP.md for instructions.";
      console.error(errorMessage);
      mainWindow.webContents.send("transcription-error", errorMessage);
      return;
    }

    console.log("Starting transcription...");

    // Test the connection by trying to create a stream
    try {
      // Create a recognition stream - using LINEAR16 for better compatibility
      const request = {
        config: {
          encoding: "LINEAR16" as const, // More reliable format
          sampleRateHertz: 16000, // Standard sample rate
          languageCode: "en-US",
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
          audioChannelCount: 1, // Mono audio
        },
        interimResults: true,
      };

      transcriptionStream = speechClient
        .streamingRecognize(request)
        .on("error", (error) => {
          console.error("❌ Transcription stream error:", error);
          let errorMessage = error.message;

          // Provide more helpful error messages
          if (
            error.message.includes("NO_START_LINE") ||
            error.message.includes("Getting metadata from plugin failed")
          ) {
            errorMessage =
              "Authentication failed. Please check your Google Cloud credentials. See GOOGLE_CLOUD_SETUP.md for help.";
          } else if (error.message.includes("PERMISSION_DENIED")) {
            errorMessage =
              "Permission denied. Make sure the Speech-to-Text API is enabled in your Google Cloud project.";
          } else if (error.message.includes("UNAUTHENTICATED")) {
            errorMessage =
              "Authentication failed. Please set up your Google Cloud credentials properly.";
          } else if (error.message.includes("Unable to detect a Project Id")) {
            errorMessage =
              "No Google Cloud project detected. Please set up your credentials. See GOOGLE_CLOUD_SETUP.md";
          }

          mainWindow.webContents.send("transcription-error", errorMessage);
          isTranscribing = false;
          transcriptionStream = null;
        })
        .on("data", (data) => {
          console.log(
            "📝 Raw transcription data from Google Cloud:",
            JSON.stringify(data, null, 2)
          );

          if (data.results && data.results.length > 0) {
            console.log(`📝 Found ${data.results.length} results`);

            for (let i = 0; i < data.results.length; i++) {
              const result = data.results[i];
              console.log(`📝 Result ${i}:`, result);

              if (result.alternatives && result.alternatives.length > 0) {
                console.log(
                  `📝 Found ${result.alternatives.length} alternatives`
                );

                const transcript = result.alternatives[0].transcript;
                const isFinal = result.isFinal;
                const confidence = result.alternatives[0].confidence;

                console.log(
                  `📝 Transcript: "${transcript}" (isFinal: ${isFinal}, confidence: ${confidence})`
                );

                mainWindow.webContents.send("transcription-data", {
                  transcript,
                  isFinal,
                  timestamp: new Date().toISOString(),
                });
              } else {
                console.log("⚠️ No alternatives in result:", result);
              }
            }
          } else {
            console.log("⚠️ No results in data. Full data:", data);
          }
        })
        .on("end", () => {
          console.log("📝 Transcription stream ended");
        })
        .on("close", () => {
          console.log("📝 Transcription stream closed");
        });

      isTranscribing = true;
      mainWindow.webContents.send("transcription-started");
      console.log("✅ Transcription started successfully");
    } catch (streamError) {
      console.error("Error creating transcription stream:", streamError);
      isTranscribing = false;
      throw streamError;
    }
  } catch (error) {
    console.error("Error starting transcription:", error);
    isTranscribing = false;

    let errorMessage = "Failed to start transcription";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    mainWindow.webContents.send("transcription-error", errorMessage);
    throw error;
  }
}

// Function to stop transcription
function stopTranscription(mainWindow: BrowserWindow): void {
  try {
    if (!isTranscribing) {
      console.log("No transcription in progress");
      return;
    }

    console.log("Stopping transcription...");

    if (transcriptionStream) {
      transcriptionStream.end();
      transcriptionStream = null;
    }

    isTranscribing = false;
    mainWindow.webContents.send("transcription-stopped");
  } catch (error) {
    console.error("Error stopping transcription:", error);
  }
}

// Function to write audio data to transcription stream
function writeAudioToTranscription(
  audioData: Buffer | ArrayBuffer | Uint8Array
): void {
  if (transcriptionStream && isTranscribing) {
    // Ensure audioData is a Buffer
    let buffer: Buffer;
    if (Buffer.isBuffer(audioData)) {
      buffer = audioData;
    } else if (audioData instanceof ArrayBuffer) {
      buffer = Buffer.from(audioData);
    } else if (audioData instanceof Uint8Array) {
      buffer = Buffer.from(audioData);
    } else {
      console.error("❌ Invalid audio data type:", typeof audioData);
      return;
    }

    console.log(`📤 Writing ${buffer.length} bytes to transcription stream`);

    // Simple audio level detection for debugging (only for small buffers to avoid performance issues)
    let hasAudio = false;
    if (buffer.length > 100 && buffer.length < 10000) {
      try {
        // Check if there's significant audio data (not just silence)
        for (let i = 0; i < Math.min(1000, buffer.length - 1); i += 2) {
          if (i + 1 < buffer.length) {
            const sample = buffer.readInt16LE(i);
            if (Math.abs(sample) > 100) {
              // Threshold for detecting audio
              hasAudio = true;
              break;
            }
          }
        }
      } catch (error) {
        console.log(
          "⚠️ Could not analyze audio data (might be compressed format)"
        );
        hasAudio = true; // Assume there's audio if we can't parse it
      }
    } else {
      hasAudio = true; // Assume larger buffers have audio
    }

    console.log(
      `📊 Audio data analysis: hasAudio=${hasAudio}, length=${buffer.length}`
    );

    transcriptionStream.write(buffer);
  } else {
    console.log(
      `⚠️ Cannot write audio data: transcriptionStream=${!!transcriptionStream}, isTranscribing=${isTranscribing}`
    );
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

  // Register IPC handlers for transcription
  ipcMain.handle("start-transcription", async () => {
    if (!mainWindowInstance) {
      throw new Error("Main window not available");
    }
    return startTranscription(mainWindowInstance);
  });

  ipcMain.handle("stop-transcription", async () => {
    if (!mainWindowInstance) {
      throw new Error("Main window not available");
    }
    stopTranscription(mainWindowInstance);
    return true;
  });

  ipcMain.handle("write-audio-data", async (_, audioData: any) => {
    try {
      writeAudioToTranscription(audioData);
      return true;
    } catch (error) {
      console.error("❌ Error writing audio data:", error);
      return false;
    }
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

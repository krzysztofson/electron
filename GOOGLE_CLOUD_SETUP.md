# Google Cloud Speech-to-Text Setup

To use the live transcription feature, you need to set up Google Cloud Speech-to-Text API.

## Quick Setup Steps:

1. **Create a Google Cloud Project**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your project ID

2. **Enable Speech-to-Text API**

   - In the Google Cloud Console, go to "APIs & Services" > "Library"
   - Search for "Cloud Speech-to-Text API"
   - Click on it and press "Enable"

3. **Create Service Account**

   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the details (name: "electron-transcription", role: "Cloud Speech Client")
   - Click "Create and Continue"
   - Skip optional steps and click "Done"

4. **Generate Key File**

   - Click on the created service account
   - Go to "Keys" tab and click "Add Key" > "Create New Key"
   - Choose JSON format and download the key file
   - Save it somewhere secure (e.g., `~/Downloads/google-cloud-key.json`)

5. **Set up Authentication (Choose ONE method)**

   **Method A: Environment Variable (Recommended for macOS/Linux)**

   ```bash
   # Add this to your ~/.zshrc or ~/.bashrc
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"

   # Then restart your terminal and run:
   source ~/.zshrc  # or ~/.bashrc
   ```

   **Method B: Individual Environment Variables**

   ```bash
   # Extract values from your JSON key file and set:
   export GOOGLE_CLOUD_PROJECT="your-project-id"
   export GOOGLE_CLOUD_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
   export GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...your private key...\n-----END PRIVATE KEY-----\n"
   ```

6. **Verify Setup**
   - Restart your terminal
   - Run the Electron app: `npm run dev`
   - Check the console for any authentication errors

## Quick Setup for macOS (Example):

Here's a complete example for macOS users:

```bash
# 1. Download your service account key to Downloads folder
# (from Google Cloud Console as described above)

# 2. Move it to a secure location
mkdir -p ~/.config/google-cloud
mv ~/Downloads/your-service-account-key.json ~/.config/google-cloud/

# 3. Add environment variable to your shell profile
echo 'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/google-cloud/your-service-account-key.json"' >> ~/.zshrc

# 4. Reload your shell configuration
source ~/.zshrc

# 5. Test the setup
cd /path/to/your/electron/project
node test-google-cloud.js

# 6. If test passes, run the app
npm run dev
```

## For Development (Temporary Setup):

If you want to test quickly without permanent environment variables:

```bash
# In your terminal, before running the app:
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
npm run dev
```

## Testing Your Google Cloud Setup

Before using the transcription feature, you can test your Google Cloud credentials:

```bash
node test-google-cloud.js
```

This will verify that your authentication is working correctly.

## Usage:

1. Click "Start Transcription" to begin live transcription
2. Speak or play audio (works great for Google Meet, Zoom, etc.)
3. See real-time transcription results
4. Click "Stop Transcription" when done
5. Use "Clear Transcription" to clear the history

## Notes:

- The app will ask for microphone permission
- Works with any audio playing on your system
- Transcription is processed in real-time using Google Cloud Speech-to-Text
- Internet connection required for transcription
- Check Google Cloud pricing for Speech-to-Text API usage

## Troubleshooting:

- If you get authentication errors, make sure GOOGLE_APPLICATION_CREDENTIALS is set correctly
- If microphone access is denied, check your browser/system permissions
- For better accuracy, speak clearly and minimize background noise

## Troubleshooting Transcription Issues

If you get authentication errors when starting transcription:

1. **Check your environment variables:**

   ```bash
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```

2. **Verify your service account key file exists and is readable:**

   ```bash
   cat "$GOOGLE_APPLICATION_CREDENTIALS"
   ```

3. **Test your credentials:**

   ```bash
   node test-google-cloud.js
   ```

4. **Common issues:**
   - Path to key file is incorrect
   - Key file is corrupted or invalid
   - Speech-to-Text API not enabled in Google Cloud
   - Service account doesn't have proper permissions

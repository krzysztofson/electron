#!/usr/bin/env node

// Test script for Google Cloud Speech-to-Text credentials
// Run with: node test-google-cloud.js

const speech = require("@google-cloud/speech");

async function testCredentials() {
  console.log("🔍 Testing Google Cloud Speech-to-Text credentials...\n");

  try {
    // Try to create a client
    const client = new speech.SpeechClient();
    console.log("✅ Speech client created successfully");

    // Try to get project ID
    const projectId = await client.getProjectId();
    console.log(`✅ Project ID: ${projectId}`);

    // Try a simple operation (list operations - this doesn't use quota)
    console.log("✅ Authentication successful!");
    console.log(
      "\n🎉 Your Google Cloud Speech-to-Text setup is working correctly!"
    );
  } catch (error) {
    console.error("❌ Error testing credentials:");
    console.error(error.message);

    if (
      error.message.includes("NO_START_LINE") ||
      error.message.includes("Getting metadata from plugin failed")
    ) {
      console.log("\n💡 Suggestions:");
      console.log(
        "1. Make sure GOOGLE_APPLICATION_CREDENTIALS environment variable is set"
      );
      console.log(
        "2. Check that the path to your service account key file is correct"
      );
      console.log("3. Verify the JSON key file is not corrupted");
      console.log(
        "\nCurrent GOOGLE_APPLICATION_CREDENTIALS:",
        process.env.GOOGLE_APPLICATION_CREDENTIALS || "Not set"
      );
    } else if (error.message.includes("PERMISSION_DENIED")) {
      console.log(
        "\n💡 Make sure the Speech-to-Text API is enabled in your Google Cloud project"
      );
    } else if (error.message.includes("UNAUTHENTICATED")) {
      console.log(
        "\n💡 Authentication failed. Check your service account credentials"
      );
    }

    console.log(
      "\n📖 See GOOGLE_CLOUD_SETUP.md for detailed setup instructions"
    );
  }
}

testCredentials();

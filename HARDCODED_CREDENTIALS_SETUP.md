# How to Get Your Google Cloud Credentials for Hardcoding

## Steps to get the actual credentials:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project**: `crack-producer-463313-v4`
3. **Go to IAM & Admin > Service Accounts**
4. **Find your service account** (or create one if you don't have one)
5. **Click on the service account**
6. **Go to "Keys" tab**
7. **Click "Add Key" > "Create New Key"**
8. **Choose JSON format and download**

## What to do with the downloaded JSON file:

The JSON file will look like this:

```json
{
  "type": "service_account",
  "project_id": "crack-producer-463313-v4",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkq...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@crack-producer-463313-v4.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

## Update the credentials in main.ts:

Copy the values from your JSON file and replace the placeholder values in `src/main/main.ts`:

```typescript
const credentials = {
  type: "service_account",
  project_id: "crack-producer-463313-v4", // Should already be correct
  private_key_id: "PUT_YOUR_PRIVATE_KEY_ID_HERE",
  private_key: "PUT_YOUR_FULL_PRIVATE_KEY_HERE", // Include the -----BEGIN and -----END lines
  client_email: "PUT_YOUR_CLIENT_EMAIL_HERE",
  client_id: "PUT_YOUR_CLIENT_ID_HERE",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "PUT_YOUR_CLIENT_X509_CERT_URL_HERE",
};
```

## Important Notes:

- **DO NOT** commit these credentials to version control
- The `private_key` should start with `-----BEGIN PRIVATE KEY-----` and end with `-----END PRIVATE KEY-----`
- The `client_email` should end with `@crack-producer-463313-v4.iam.gserviceaccount.com`
- Make sure the Speech-to-Text API is enabled in your Google Cloud project

## Testing:

After updating the credentials, restart your app with `npm run dev` and try the transcription feature.

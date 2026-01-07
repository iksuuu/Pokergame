# Deploying to Google Cloud (One-Command Monolith)

Since we have unified the frontend and backend into a single "Monolith", deploying is now much simpler. You only need to deploy **one** service to Google Cloud Run.

## Prerequisites
1.  **Google Cloud Project**: Ensure you have a project at [console.cloud.google.com](https://console.cloud.google.com).
2.  **Google Cloud Shell**: If you don't want to install anything locally, simply upload your project to **Google Cloud Shell** (the terminal in your browser).

---

## The "One-Step" Deployment

Run this command from the **root directory** of your project (the folder containing `Dockerfile` and `App.tsx`):

```bash
# Set your project ID
export PROJECT_ID=$(gcloud config get-value project)

# Build and Deploy the entire app in one go
gcloud run deploy poker-game \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=[YOUR-AI-STUDIO-KEY]" \
  --session-affinity
```

### Why this is better:
- **No CORS issues**: The frontend and backend live on the same URL.
- **Session Affinity**: Crucial for Socket.io to keep you connected in the cloud.
- **Automatic Build**: GCP will automatically build your Docker container in the cloud using Google Cloud Build.

---

## How to Verify
1.  Once the command finishes, it will give you a **Service URL** (e.g., `https://poker-game-xyz.a.run.app`).
2.  Open that URL in your browser.
3.  The Poker table should load, and you can create/join rooms immediately!

## Setting the API Key
If you didn't set the key in the command above, you can do it anytime in the [Cloud Run Console](https://console.cloud.google.com/run):
1. Click on `poker-game`.
2. Click **Edit & Deploy New Revision**.
3. Go to **Variables & Secrets** and add `GEMINI_API_KEY`.

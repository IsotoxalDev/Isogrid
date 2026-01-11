# Firebase Storage CORS Configuration

## Problem
When uploading images to Firebase Storage, you may see CORS errors like:
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://firebasestorage.googleapis.com/...
```

This happens because Firebase Storage doesn't allow cross-origin requests by default.

## Solution: Configure CORS

### Step 1: Create Firebase Storage Bucket (if not already created)

If `gsutil ls` shows no buckets, you need to create the Storage bucket first.

**Option A: Using Firebase Console (Easiest)**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click on **Storage** in the left sidebar
4. Click **Get Started**
5. Accept the default security rules or customize them
6. Click **Done**

**Option B: Using Command Line** (Recommended if Console doesn't work)
```bash
gcloud storage buckets create gs://YOUR_PROJECT_ID.appspot.com --location=us
```

**Option C: Using gsutil**
```bash
gsutil mb -b on -l us gs://YOUR_PROJECT_ID.appspot.com
```

Then verify it was created:
```bash
gsutil ls
```

You should see your bucket listed.

### Step 2: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 3: Login to Firebase
```bash
firebase login
```

### Step 4: Create `cors.json`
Create a file named `cors.json` in your project root:

```json
[
  {
    "origin": ["http://localhost:9002", "https://yourdomain.com"],
    "method": ["GET", "HEAD", "DELETE", "POST", "PUT", "OPTIONS"],
    "responseHeader": ["Content-Type", "x-firebase-storage-version", "x-goog-upload-protocol", "x-goog-upload-command", "x-goog-upload-offset"],
    "maxAgeSeconds": 3600
  }
]
```

**Important:** 
- Replace `https://yourdomain.com` with your production domain URL(s)
- The methods include `POST`, `PUT`, and `OPTIONS` which are needed for file uploads
- The `responseHeader` list includes headers required by Firebase Storage uploads

### Step 4: Apply CORS Configuration

First, find your bucket name by running:
```bash
gsutil ls
```

Your bucket will be listed as `gs://BUCKET_NAME`. It might end with either `.appspot.com` or `.firebasestorage.app`.

Then apply the CORS rules:
```bash
gsutil cors set cors.json gs://BUCKET_NAME
```

For example:
```bash
gsutil cors set cors.json gs://YOUR_PROJECT_ID.firebasestorage.app
```

### Step 5: Verify
Try uploading an image again. The CORS errors should be gone!

## What This Does
- Allows your localhost and production domains to read images from Firebase Storage
- Enables the browser to fetch images stored in your Firebase bucket
- Maintains security by restricting access to only specified origins

## Troubleshooting

### "gsutil: command not found"
You need to install Google Cloud SDK:
- **macOS:** `brew install --cask google-cloud-sdk`
- **Ubuntu/Debian:** Follow [Google Cloud documentation](https://cloud.google.com/sdk/docs/install#linux)
- **Windows:** Download from [Google Cloud SDK](https://cloud.google.com/sdk/docs/install#windows)

### "Access Denied" Error
Make sure you're authenticated:
```bash
firebase login
gcloud auth login
```

### Still Getting CORS Errors
1. Make sure you're using the correct storage bucket name
2. Check that your localhost URL is in the `cors.json` origin list
3. Clear browser cache and try again
4. Wait a few minutes for changes to propagate

<div align="center">
  <img src="./public/icon.svg" alt="Isogrid Icon" width="80" height="80" />

# Isogrid

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Firebase](https://img.shields.io/badge/Firebase-Realtime-orange)](https://firebase.google.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)](https://www.typescriptlang.org/)

  An infinite digital workspace for creative and visual thinking.

  Isogrid is a powerful, open-source canvas application designed to help you organize ideas, create mood boards, and visualize complex information in an infinite, zoomable workspace.
</div>

## ✨ Features

### Canvas & Navigation
- **Infinite Canvas** - Endless pan and zoom
- **Dot & Line Grid** - Toggle between grid patterns
- **Color Customization** - Adjust theme colors and element transparency
- **Context Menu** - Right-click to create or modify content

### Content Management
- **Text Elements** - Add customizable text with size and weight control
- **Images** - Upload to Firebase Storage with automatic aspect ratio
- **Nested Boards** - Hierarchical organization with boards within boards
- **Todo Lists** - Create and manage todos with checkmarks
- **Links** - Add external resource links
- **Arrows** - Connect elements with directional arrows

### Sync & Persistence
- **Real-time Sync** - Firebase-backed automatic saving
- **User Authentication** - Email-based access with verification
- **Import/Export** - Download and restore canvas data as JSON

## ❤️ Support Isogrid

Isogrid is a passion project built and maintained for free. If you find it useful, please consider supporting its development!

[![Donate with Razorpay](https://img.shields.io/badge/Donate-Razorpay-blue.svg?style=for-the-badge)](https://pages.razorpay.com/isogrid)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Ko--fi-red.svg?style=for-the-badge)](https://ko-fi.com/isotoxaldev0)

Note: Both Razorpay and Ko-fi allow you to contribute amounts of your choice.

## 🚀 Quick Start - Self Hosting

### Prerequisites
- Node.js 18+ and npm/yarn
- A Firebase project (free tier works)
- Git

### Step 1: Clone & Setup

```bash
git clone https://github.com/IsotoxalDev/Isogrid.git
cd Isogrid
npm install
```

### Step 2: Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Create a project"
3. Follow the setup wizard
4. Enable these services:
   - **Authentication**: Email/Password provider
   - **Firestore Database**: Start in test mode
   - **Storage**: For image uploads

### Step 3: Configure Environment Variables

Create `.env.local` in the root directory with your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
NEXT_PUBLIC_ENCRYPTION_KEY="your_encryption_key"
```

Find these values in Firebase Console → Project Settings → General tab.

### Step 4: Configure CORS for Image Uploads

```bash
# Install Google Cloud CLI if not already installed
curl https://sdk.cloud.google.com | bash

# Authenticate with your Google account
gcloud auth login

# Set your Firebase project
gcloud config set project YOUR_PROJECT_ID

# Apply CORS configuration
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

**Note**: Replace `YOUR_BUCKET_NAME` with your Firebase Storage bucket name (from Step 3).

For troubleshooting, see [Firebase CORS Setup Guide](./docs/firebase-cors-setup.md).

### Step 5: Run Development Server

```bash
npm run dev
```

Visit `http://localhost:9002` to start using Isogrid.

### Firestore Security Rules

Update your Firestore rules in Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /canvas/{userId} {
      allow read, write: if request.auth.uid == userId;
      allow create: if request.auth.uid != null;
    }
  }
}
```

## 📦 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "New Project" → Import your Isogrid repository
4. Add environment variables (same `.env.local` values)
5. Click "Deploy"

### Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and initialize
firebase login
firebase init hosting

# Build and deploy
npm run build
firebase deploy
```

### Deploy to Other Platforms

The app is a standard Next.js application and can be deployed to:
- Netlify
- AWS Amplify
- Docker containers
- Traditional Node.js hosting

Ensure all `NEXT_PUBLIC_*` environment variables are set on your platform.

## 📖 Usage Guide

### Creating & Editing Content

1. **Right-click** the canvas to open the context menu
2. Select content type:
   - **Text** - Add notes and labels
   - **Image** - Upload images from your computer
   - **Board** - Create nested boards
   - **Todo** - Create todo lists
   - **Link** - Add external links
   - **Arrow** - Draw connections between elements

3. **Double-click** any element to edit it
4. **Click and drag** to move elements
5. **Drag corners** to resize

### Navigation

- **Pan**: Click and drag with mouse, or middle-click drag
- **Zoom**: Scroll mouse wheel
- **Undo/Redo**: `Ctrl+Z` / `Ctrl+Shift+Z` (or `Cmd+Z` / `Cmd+Shift+Z` on Mac)

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 13+, React, TypeScript
- **Styling**: Tailwind CSS with custom components
- **Backend**: Firebase (Firestore, Storage, Authentication)
- **State Management**: React Hooks

### Project Structure
```
src/
├── app/
│   ├── page.tsx                 # Login page
│   ├── signup/                  # Signup flow
│   ├── forgot-password/         # Password recovery
│   └── isogrid/page.tsx         # Main canvas application
├── components/
│   ├── canvas/
│   │   ├── canvas-item.tsx      # Canvas item renderer
│   │   ├── context-menu.tsx     # Right-click menu
│   │   └── ...
│   └── ui/                      # Reusable UI components
├── lib/
│   ├── firebase.ts              # Firebase configuration
│   ├── types.ts                 # TypeScript definitions
│   └── utils.ts                 # Utility functions
└── hooks/
    └── use-toast.ts             # Toast notifications
```

## 🔐 Security

### Authentication
- Email/password authentication via Firebase Auth
- Email verification required for new accounts
- Secure password reset flow

### Data Access
- Firestore security rules enforce user-specific access
- Users can only read/write their own canvas data
- Images stored in user-specific Firebase Storage paths

### Network Security
- CORS properly configured for Firebase Storage
- All communication over HTTPS
- No sensitive credentials exposed to client

## 🛠️ Development

### Available Scripts
```bash
npm run dev        # Development server (port 9002)
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint
```

### Stack & Tools
- **TypeScript** - Full type safety
- **ESLint** - Code quality
- **Tailwind CSS** - Styling
- **Next.js** - Full-stack framework

## 🐛 Troubleshooting

### Images Not Uploading or Loading
- Verify CORS is configured: `gsutil cors get gs://YOUR_BUCKET`
- Check Firebase Storage bucket name in `.env.local`
- Clear browser cache and try again
- See [Firebase CORS Setup Guide](./docs/firebase-cors-setup.md)

### Authentication Issues
- Ensure Email/Password auth is enabled in Firebase Console
- Check that email verification is not blocking access
- Look for error messages in browser developer console

### Data Not Saving
- Verify Firestore Database is initialized
- Check Firebase security rules are not blocking access
- Ensure user is authenticated before saving
- See browser console for detailed error messages

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and test
4. Commit: `git commit -m 'Add your feature'`
5. Push: `git push origin feature/your-feature`
6. Open a Pull Request

### Guidelines
- Follow TypeScript and ESLint conventions
- Write clear commit messages
- Update documentation if needed
- Test your changes before submitting

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/)

## 📧 Support

- Open an [Issue](https://github.com/IsotoxalDev/Isogrid/issues) for bugs or features
- Check [Discussions](https://github.com/IsotoxalDev/Isogrid/discussions) for questions

---

Made with ❤️ by [@IsotoxalDev](https://github.com/IsotoxalDev)


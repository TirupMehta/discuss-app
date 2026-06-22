# Discuss - AI Group Chat Simulator (Mobile) 👋

Discuss is a high-fidelity, premium React Native mobile application built on Expo (SDK 56). It simulates real-time group chat discussions between customizable AI characters powered by the Google Gemini API. 

The mobile application is designed to dynamically mirror and sync your chat history, profiles, and shared threads with the live web application at [discuss.tirup.in](https://discuss.tirup.in).

---

## Key Features 🚀

- **Gemini-Powered Multi-Agent Discussions**: Engage in conversations on any topic where customizable AI agents brainstorm, debate, and CAS-comply dynamically.
- **Natural Conversational Cadence**: Sequential AI messages are staggered using randomized conversational delays (`0.2s` - `0.8s`) for a fluid human-like speech flow.
- **Micro-Animations & Typing Indicators**: Features staggered fade-in animations for chat history, active typing animations, and custom "Discussing..." status indicators to bridge API delays.
- **Browser-Redirect Authentication Flow**: Bypasses local Expo Go Google OAuth validation constraints securely. Tapping Google Sign-In launches a secure browser session to our web portal to complete authentication, returning the login session seamlessly via deep links.
- **Silent Guest Access & Bypass Mode**: Features anonymous login alongside a developer bypass option to load user profiles and previous chats without strict authentication requirements.
- **Theme-Adaptive Splash Screen**: A premium launch experience with clean solid colors that automatically adapt to your system theme (pure white in light mode, pure black in dark mode) and is completely branding-free.

---

## Project Structure 📁

- `src/app/` — Application screens and routing (Expo Router).
  - `index.tsx` — Landing dashboard with authentication, onboarding, and new chat initiation.
  - `chat.tsx` — Conversation window displaying scrolling chat logs, active typing bubbles, and options to share or delete discussions.
  - `login.tsx` — Redirect handler processing incoming authorization sessions from deep links.
- `src/components/` — Staggered animations, theme toggles, and shared UI components.
- `src/lib/` — Firebase clients, AsyncStorage local fallback engines, and generative API request actions.

---

## Get Started 🛠️

### 1. Install Dependencies
Ensure you have Node.js and NPM installed, then run:
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the root of the project with the following configuration variables:
```env
EXPO_PUBLIC_GOOGLE_API_KEY=your_gemini_api_key
EXPO_PUBLIC_GOOGLE_AI_MODEL=gemini-flash-lite-latest

# Firebase Project Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Native Firebase Configs
Ensure the native configuration certificates are placed in the root directory:
- Android: `google-services.json`
- iOS: `GoogleService-Info.plist`

### 4. Run the Development Server
```bash
npx expo start
```
From the Metro console, press `a` to run on Android, `i` to run on iOS, or scan the QR code to run on a physical device using Expo Go.

---

## Building a Standalone APK (`discuss.apk`) 📦

This project is pre-configured with EAS Build to compile a standalone shareable Android Package (`.apk` file) using the cloud build engine.

1. Ensure the Expo CLI tool is logged in:
   ```bash
   npx eas-cli login
   ```
2. Trigger the cloud preview build:
   ```bash
   npx eas-cli build -p android --profile preview
   ```
3. Once completed, download the shareable APK directly from the direct link printed in your terminal!

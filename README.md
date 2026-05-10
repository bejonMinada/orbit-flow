# OrbitFlow

A privacy-first, offline-first personal finance app built with React Native (Expo).

---

## 🚀 How to Launch on Mobile (Termux)

You are running this on your Android phone using **Termux**. Follow these steps exactly:

### Step 1 — Install required tools (first time only)

```sh
pkg update && pkg upgrade -y
pkg install -y nodejs git
```

### Step 2 — Clone the repository

```sh
cd ~
git clone https://github.com/bejonMinada/orbit-flow.git
cd orbit-flow
```

> If you already cloned it before, just `cd ~/orbit-flow` and pull the latest:
> ```sh
> git pull origin copilot/create-app
> ```
> ⚠️ Make sure you're on the correct branch: `git checkout copilot/create-app`

### Step 3 — Install dependencies

```sh
npm install
```

### Step 4 — Start the Expo development server

```sh
npx expo start --tunnel
```

> `--tunnel` is required when running from Termux because it creates a public URL.

### Step 5 — Open the app on your phone

1. Install the **Expo Go** app from the Play Store (free).
2. Scan the **QR code** shown in the Termux terminal with Expo Go.
3. The app will load on your phone!

---

## 📱 Running tips for Termux

| Situation | Command |
|-----------|---------|
| Start the server | `npx expo start --tunnel` |
| Clear cache and restart | `npx expo start --tunnel --clear` |
| Update dependencies | `npm install` |
| Pull latest code | `git pull origin copilot/create-app` |

---

## Architecture

| Layer | Choice |
|-------|--------|
| Framework | React Native (Expo SDK 51) |
| Language | TypeScript (strict) |
| Local DB | SQLite via `expo-sqlite` |
| Navigation | React Navigation v6 (bottom tabs + stacks) |
| Sync (Phase 2) | Google Drive / OneDrive App Folder connectors |

## Feature Modules

| Module | Status |
|--------|--------|
| Cash Ledgers | ✅ Phase 1 |
| Itemized Trackers | ✅ Phase 1 |
| Credit & Settlement Monitor | ✅ Phase 1 |
| Payment Profiles | ✅ Phase 1 |
| Sinking Funds | 🔜 Phase 3 |
| Cloud Sync | 🔜 Phase 2 |
| Receipt OCR | 🔜 Phase 4 |
| Burn-Rate Forecasting | 🔜 Phase 4 |

## Currency Support

52 ISO 4217 currencies pre-loaded (PHP, USD, EUR, GBP, JPY, SGD, AUD, INR, and more).
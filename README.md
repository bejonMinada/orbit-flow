# Netto

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

## App Personality Summary

Netto is designed as a bespoke, premium finance workspace centered on clarity through precision.  
The experience is net-first: users can immediately see what is saved, spent, and owed without visual clutter.

## Architecture

| Layer | Choice |
|-------|--------|
| Framework | React Native (Expo SDK 54) |
| Language | TypeScript (strict) |
| Local DB | SQLite via `expo-sqlite` |
| Navigation | React Navigation v6 (text-first bottom tabs + stacks) |
| Sync (Phase 2) | Google Drive / OneDrive app-folder connectors using `netto_data.json` |

## Feature Modules

| Module | Status |
|--------|--------|
| Cash Ledgers | ✅ Phase 1 |
| Itemized Inventories | ✅ Phase 1 |
| Settlement Hub | ✅ Phase 1 |
| Group Contributions | 🔜 Phase 2 |
| Payment Profiles | ✅ Phase 1 |
| Sinking Funds | 🔜 Phase 3 |
| Cloud Sync | 🔜 Phase 2 |
| Receipt OCR | 🔜 Phase 4 |
| Burn-Rate Forecasting | 🔜 Phase 4 |

## Currency Support

52 ISO 4217 currencies pre-loaded (PHP, USD, EUR, GBP, JPY, SGD, AUD, INR, and more).

## UI Style Guide (Netto Pivot)

- **Typography:** geometric sans-serif styling with clean hierarchy and generous spacing.
- **Iconography:** text-first navigation and labels; icons are reserved for critical tactile actions such as scanning or adding.
- **Light Mode Palette:** paper white background (`#FDFCF8`), white surfaces, deep charcoal text (`#1F252F`), mint accent (`#12B886`).
- **Dark Mode Palette (recommended):** deep charcoal background (`#12161D`), elevated charcoal surfaces (`#1F252F`), soft neutral text (`#E6E9EE`), mint accent (`#12B886`).
- **Branding Element:** Ascending N geometric mark used as a subtle watermark/header motif to reinforce positive net yield.

## Netto Dashboard Walkthrough

1. **Header:** Netto wordmark with subtle Ascending N watermark to establish brand context.
2. **Net Snapshot:** net balance and net result surfaced first for precision-first decision making.
3. **Flow View:** income vs expenses and savings overview to explain *why* net moved.
4. **Expense Concentration:** top expense categories displayed in text-first horizontal bars.
5. **Action Row:** text-only quick actions to open Cash Ledgers, Itemized Inventories, Settlement Hub, and Settings.
6. **Reference Panels:** recent ledgers and settlement snapshot for fast verification and corrections.

<p align="center">
  <img src="docs/images/app-icon.png" width="128" height="128" alt="R App icon: a router with a Wi-Fi signal">
</p>

<h1 align="center">R App</h1>

<p align="center">
  <b>Manage your Huawei 4G router from your Android phone, over your own Wi-Fi.</b><br>
  Live speed, data usage, signal, connected devices, Wi-Fi settings and reboot, without the router's web page.
</p>

<p align="center">
  <img alt="Android" src="https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white">
  <img alt="Expo SDK 57" src="https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white">
  <img alt="React Native 0.86" src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="LAN only" src="https://img.shields.io/badge/network-LAN%20only-2F6FEB">
</p>

---

## About

R App talks to the router's built-in **HiLink API** (`http://192.168.8.1/api/`) directly from the phone. There's no cloud, no account and no tracking: the app only ever talks to your router.

It is built and tested for the **Huawei B312-926** (HUAWEI 4G Router 2s). Other HiLink routers use a similar API and may partly work, but they're untested.

> [!NOTE]
> This is a personal, unofficial project. It is not affiliated with or endorsed by Huawei.

## Features

| | Feature | Login needed |
|---|---|---|
| 🏠 | **Home**: online status, operator and network type, live download/upload speed with a 60-second chart, session and lifetime data, today's and this month's usage with plan progress | No |
| 📶 | **Signal**: RSRP, SINR, RSRQ, RSSI with a plain-English rating (Excellent → Poor), band, PCI and cell ID | Yes |
| 📱 | **Devices**: everything connected over Wi-Fi *and* cable, new devices flagged, your own names and icons, device maker, devices seen earlier, and blocking a device from the Wi-Fi | Yes |
| 🛜 | **Wi-Fi**: change name and password, hide the network, show the password, share a QR code for guests | Yes |
| 🌐 | **Mobile data**: turn the SIM's internet on or off | Yes |
| 🔐 | **Admin password**: change the router's login password | Yes |
| 🔄 | **Reboot**: with a waiting screen that tells you when the router is back | Yes |

Coming next: data plan settings, automatic reboot, network mode (4G/3G), and an antenna positioning mode that beeps as the signal improves. See [docs/FEATURES.md](docs/FEATURES.md) for the full list and status.

## Security

The admin password controls the whole router, and HiLink only speaks plain HTTP, so the app is strict about security:

- **The password is never stored by default.** "Remember password" is opt-in and kept in Android's encrypted store, unlocked with your fingerprint or PIN.
- **Only a hash is sent at login**, never the password itself. New passwords (admin and Wi-Fi) are RSA-encrypted with the router's key, the same way its own web page does it.
- **Router pinning.** The app remembers your router's fingerprint and refuses to send anything to a router that doesn't match ("This doesn't look like your router").
- **Fingerprint or PIN** before every risky action: reboot, Wi-Fi changes, showing the Wi-Fi password, changing the admin password, blocking a device.
- **No screenshots** of the login, Wi-Fi and password screens.
- **Automatic logout** after 10 minutes idle or 5 minutes in the background. At most 3 login attempts per 5 minutes, so the router's lockout is never triggered.
- **LAN only.** In release builds, plain HTTP is allowed to the router's address and nowhere else. No analytics, ads or third-party network calls; minimal Android permissions; app backups are off.

The full rules are in [AGENTS.md §8](AGENTS.md#8-security-highest-priority).

## Getting started

### Requirements

- Node.js and npm
- An Android phone with **[Expo Go](https://expo.dev/go)** (version matching Expo SDK 57)
- Phone and computer on the router's network

### Run in development

```bash
git clone https://github.com/DilshanRanabahu/R-App.git
cd R-App
npm install
npx expo start --lan
```

Scan the QR code with Expo Go. To run over USB instead, see [AGENTS.md §3](AGENTS.md#3-commands).

### Checks

```bash
npx tsc --noEmit   # type check
npm run lint       # lint
npm test           # unit tests (Jest)
```

## Building an APK

### In the cloud (EAS Build)

Needs a free [Expo account](https://expo.dev/signup); no Android SDK required.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

The build takes about 10–20 minutes and ends with a download link for the `.apk`. Raise `version` and `android.versionCode` in [app.json](app.json) before each new release.

### On your own computer

Needs JDK 17 and the Android SDK (Platform 36, Build-Tools 36, NDK 27.1.12297006, CMake), installed most easily with Android Studio.

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease      # Windows: .\gradlew.bat assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. The generated `android/` folder isn't committed: rerun `prebuild` after config changes instead of editing it.

> [!IMPORTANT]
> Local builds are signed with a different key from cloud builds, so one can't be installed over the other without uninstalling first. Keep any release keystore **outside** the repository.

## Project structure

```
src/
  app/          Screens (Expo Router): tabs, login, Wi-Fi, change password, rebooting
  api/          The only code that talks to the router: session, tokens, XML, RSA, endpoints
  security/     Saved password, router pinning, fingerprint/PIN, session limits, log redaction
  state/        Auth, snackbar, query client
  hooks/        Data fetching and polling (React Query)
  components/   UI components from the design system
  theme/        Colors, typography, spacing
  utils/        Formatting, signal rating, charts, Wi-Fi QR
plugins/        Config plugin: plain HTTP only to the router
scripts/        Icon generator
```

## Documentation

| Document | What's in it |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | Every feature with its router endpoint, priority and status |
| [docs/DESIGN.md](docs/DESIGN.md) | Colors, typography, components, screen layouts and wording |
| [AGENTS.md](AGENTS.md) | Architecture, router API notes, security rules and working conventions |

## Tech stack

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) · Expo Router · TanStack Query · fast-xml-parser · node-forge · expo-secure-store · expo-local-authentication · react-native-svg · Jest

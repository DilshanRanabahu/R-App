# R_app — Huawei B312-926 Router Manager

A React Native (Expo) app for managing a Huawei B312-926 (HUAWEI 4G Router 2s) from an Android phone over the local network.

## Environment

| Item | Value |
|---|---|
| Router | Huawei B312-926, HiLink API at `http://192.168.8.1/api/` |
| SIM / network | HUTCH (41308), 4G LTE, band B1 |
| Wi-Fi SSID | (owner's network; not stored in the repo) |
| Phone | Samsung SM-A065F, Android 16 (SDK 36), arm64, **Expo Go 57** installed |
| Laptop | `192.168.8.102` (Ethernet), Node 26.5, npm 11.17, Java 21, **no Android SDK** |
| App stack | Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6 |
| Login | `password_type=4` (SHA-256), RSA encryption enabled, `firstlogin=1` |

## Progress

**Phase 1: done except device testing of risky actions.** The app runs on the phone through Expo Go and has been used with a real login. It is **not yet built as a standalone APK** (see [Release](#release)).

| Area | Status |
|---|---|
| Verified on the phone | Router detection, login, no-login dashboard, logged-in dashboard, signal details, connected devices (Wi-Fi + cable), "this phone" label, feature flags, pull-to-refresh, "can't reach router" screen, screenshot blocking on login |
| Built, not yet exercised | Logout, remember password, session expiry / idle logout, mobile data **switching**, reboot + waiting screen, "Trust new router" flow; Phase 2: change admin password, Wi-Fi name/password/hide, show Wi-Fi password, Wi-Fi QR |
| Security built | Router fingerprint pinning, encrypted password storage (opt-in), login attempt limiter, idle/background logout, screenshot blocking, device re-auth for risky actions, cleartext only to the router, log redaction |
| App icon | Designed and generated (`assets/`); visible only after a standalone build |
| Tests | 200 unit tests passing; type check + lint clean |

## Legend

**Priority:** P1 = MVP (build first) · P2 = core management · P3 = advanced / nice to have

**Login:** whether the endpoint needs an authenticated session ("Token" = needs a session token but not a login).

**Checked:** ✅ = endpoint answered correctly on this router · ⏳ = not yet tested on this router.

**Status:** ✅ Done (built and verified on the phone) · 🔨 Built (code done, not yet verified on the phone) · ⬜ Not started.

---

## 1. Connection & session

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 1.1 | Detect router on network (is phone on router Wi-Fi?) | P1 | `GET /api/device/basic_information` | No | ✅ | ✅ |
| 1.2 | Get session cookie + CSRF token | P1 | `GET /api/webserver/SesTokInfo` | No | ✅ | ✅ |
| 1.3 | Check login state / lock status / wait time | P1 | `GET /api/user/state-login` | No | ✅ | ✅ |
| 1.4 | Login (SHA-256, `password_type=4`) | P1 | `POST /api/user/login` | — | ✅ | ✅ |
| 1.5 | Logout | P1 | `POST /api/user/logout` | Yes | ⏳ | 🔨 |
| 1.6 | Remember password securely (opt-in, fingerprint/PIN) | P1 | `expo-secure-store` | — | — | 🔨 |
| 1.7 | Session expiry handling (`100003`) → back to login, no auto-retry loop | P1 | — | — | — | 🔨 |
| 1.8 | Handle forced first-login password change | P2 | `POST /api/user/password_scram` (see 1.9) | Yes | ⏳ | ⬜ |
| 1.9 | Change admin password (Router → Security; confirm + fingerprint/PIN; screenshot-blocked) | P2 | `POST /api/user/password_scram` (RSA-OAEP body, scheme copied from the router's web UI) | Yes | ⏳ scheme read from web UI JS, not yet run | 🔨 |

## 2. Dashboard (home screen)

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 2.1 | Operator name + network type (4G/3G) | P1 | `GET /api/net/current-plmn` | No | ✅ | ✅ |
| 2.2 | Live download / upload speed | P1 | `GET /api/monitoring/traffic-statistics` | No | ✅ | ✅ |
| 2.3 | Session data used + connection time | P1 | `GET /api/monitoring/traffic-statistics` | No | ✅ | ✅ |
| 2.4 | Total data used (lifetime) | P1 | `GET /api/monitoring/traffic-statistics` | No | ✅ | ✅ |
| 2.5 | SIM status | P1 | `GET /api/monitoring/converged-status` | No | ✅ | ✅ |
| 2.6 | Connection status, Wi-Fi client count | P1 | `GET /api/monitoring/status` | Token | ✅ | ✅ |
| 2.7 | Unread SMS badge | — | `GET /api/monitoring/check-notifications` | Token | ✅ | ✖ dropped with SMS |
| 2.8 | Live speed chart (last 60 s) | P2 | built from 2.2 polling | — | — | ✅ |

## 3. Signal & network

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 3.1 | Signal details: RSRP, RSRQ, SINR, RSSI | P1 | `GET /api/device/signal` | Yes | ✅ | ✅ |
| 3.2 | Signal quality rating (Excellent / Good / Fair / Poor) + advice sentence | P1 | computed from 3.1 | — | — | ✅ |
| 3.3 | Cell info: Cell ID, PCI, band | P2 | `GET /api/device/signal` | Yes | ✅ | ✅ |
| 3.4 | **Antenna positioning mode**: signal every second, best value so far, short history, vibration on a new best, screen kept on | P2 | `GET /api/device/signal` (1 s polling) | Yes | ✅ | 🔨 |
| 3.5 | Network mode (Auto / 4G only / 3G only) | — | `GET /api/net/net-mode-list` | Yes | ✅ | ✖ not applicable: this router lists only `03` (4G only) |
| 3.6 | LTE band lock: Automatic or one band (this router: 1, 3, 5, 8, 38, 40); confirm + fingerprint/PIN | P2 | `GET /api/net/net-mode`, `/api/net/net-mode-list`; `POST /api/net/net-mode` (`LTEBand` mask) | Yes | ✅ GET · ⏳ POST (single-band masks are not offered by the router's own page) | 🔨 |
| 3.7 | Manual operator scan / selection | P3 | `GET /api/net/plmn-list`, `POST /api/net/register` | Yes | ⏳ | ⬜ |

> Current signal on this router is **Poor** (RSRP ≈ −105 dBm, SINR ≈ 4–6 dB), so 3.4 is the most useful next signal feature.

## 4. Data usage

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 4.1 | Monthly data usage (today + this month, on Home) | P2 | `GET /api/monitoring/month_statistics` | No | ✅ | ✅ |
| 4.2 | Set monthly data limit + start date + alert % | P2 | `GET/POST /api/monitoring/start_date` | No (GET) · Yes (POST) | ✅ GET · ⏳ POST | 🔨 read only (plan shown on Home; setting it not built) |
| 4.3 | Usage progress bar vs. limit | P2 | computed | — | — | 🔨 (no plan set on the router yet, so not seen on the phone) |
| 4.4 | Reset statistics | P3 | `POST /api/monitoring/clear-traffic` | Yes | ⏳ | ⬜ |
| 4.5 | Local daily usage history (app-side, stored on phone) | P3 | built from polling | — | — | ⬜ |

## 5. Mobile data control

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 5.1 | Mobile data ON / OFF toggle (confirm before OFF) | P1 | `GET/POST /api/dialup/mobile-dataswitch` | Yes | ✅ GET · ⏳ POST | 🔨 |
| 5.2 | Roaming on/off, auto-connect | P3 | `GET/POST /api/dialup/connection` | Yes | ⏳ | ⬜ |
| 5.3 | APN profiles (view / add / select) | P3 | `GET/POST /api/dialup/profiles` | Yes | ⏳ | ⬜ |

## 6. SMS / 7. USSD — dropped

Removed on 2026-09-29 (owner's choice): the owner doesn't need SMS or USSD in the app, and the Messages tab was replaced by a **Router** tab (management). The router does expose `sms/*` and `ussd/*` (they answer `100003` login required, not `100002` not supported), so they could come back later. The old plan was: inbox, read / mark read, send, delete, counts, threads (6.1–6.6); USSD send, saved quick codes, multi-step menus (7.1–7.3). For SMS in the meantime, use the router web page (`http://192.168.8.1` → SMS).

## 8. Connected devices

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 8.1 | List Wi-Fi devices (name, IP, connection time) | P1 | `GET /api/wlan/host-list` | Yes | ✅ | ✅ |
| 8.2 | LAN (cable) devices, merged with Wi-Fi list by MAC, labelled "Wi-Fi" / "Cable" | P2 | `GET /api/lan/HostInfo` | Yes | ✅ | ✅ |
| 8.3 | Name a device and pick its type/icon (kept on the phone, by MAC) | P2 | app-side | — | — | 🔨 |
| 8.4 | Block / unblock a Wi-Fi device (MAC filter; confirm + fingerprint/PIN; never this phone, not cable devices) | P2 | read `GET /api/wlan/multi-macfilter-settings-ex`, write `POST /api/wlan/multi-macfilter-settings` (format copied from the router's `devicemanagement.js`) | Yes | ✅ GET · ⏳ POST | 🔨 |
| 8.5 | Highlight "this phone" in the list | P2 | phone IP via `expo-network` | — | — | ✅ |
| 8.6 | Device detail screen (status, connection, Wi-Fi band, IP, automatic/fixed address, MAC, maker, name on router, block) | P2 | `lan/HostInfo` (`AddressSource`, `isLocalDevice`), `wlan/host-list` (`Frequency`) | Yes | ✅ | 🔨 |
| 8.7 | Known / new devices: connected devices not marked as known are listed first as "New"; "Mark all as known" | P2 | app-side | — | — | 🔨 |
| 8.8 | Devices that are not connected now (the router still remembers them) | P2 | `GET /api/lan/HostInfo` (`Active=0`) | Yes | ✅ | 🔨 |
| 8.9 | Device maker from the MAC address (offline table of common brands; private/random addresses shown as hidden) | P2 | app-side (`scripts/make-oui.py`) | — | — | 🔨 |
| 8.10 | Rename a device on the router itself (name shared with the web UI) | P3 | `POST /api/lan/changedevicename` (`ID`, `ActualName`; needs `hostnamechange_enabled`) | Yes | ⏳ | ⬜ |
| 8.11 | Remove a not-connected device from the router's list | P3 | `POST /api/lan/HostInfo` (`ID=0`, `MacAddress`) | Yes | ⏳ | ⬜ |

## 9. Wi-Fi settings

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 9.1 | View / change SSID, hide SSID (Router → Wi-Fi) | P2 | `GET/POST /api/wlan/multi-basic-settings` (POST `;enp`, only the main SSID, `WifiRestart=1`) | Yes | ✅ GET · ⏳ POST | 🔨 |
| 9.2 | View / change Wi-Fi password (reveal needs fingerprint/PIN; screenshot-blocked) | P2 | reveal: `POST /api/user/pwd` (RSA nonce → AES reply + HMAC); change: `WifiWpapsk` RSA-encrypted in `multi-basic-settings` | Yes | ⏳ | 🔨 |
| 9.3 | Show Wi-Fi QR code for guests to scan (screenshot-blocked) | P2 | app-side (`WIFI:T:WPA;S:...;P:...;;`, `qrcode` lib + SVG) | — | — | 🔨 |
| 9.4 | Wi-Fi on/off (warn: phone will disconnect) | P3 | `POST /api/wlan/wifi-feature-switch` | Yes | ⏳ | ⬜ |
| 9.5 | Guest Wi-Fi: on/off, name, password or open, auto-off (4 h / 1 day / never), extend time, QR code (screenshot-blocked) | P2 | `GET/POST /api/wlan/multi-basic-settings` (entry with `wifiisguestnetwork=1`), `GET/POST /api/wlan/guesttime-setting`, `POST /api/user/pwd` | Yes | ✅ GET · ⏳ POST | 🔨 |
| 9.6 | Wi-Fi channel / bandwidth | P3 | `GET/POST /api/wlan/multi-basic-settings` | Yes | ⏳ | ⬜ |

## 10. Device & system

| # | Feature | Priority | Endpoint(s) | Login | Checked | Status |
|---|---|---|---|---|---|---|
| 10.1 | Device info: model, IMEI, IMSI, firmware, MAC, WAN IP (screenshot-blocked) | P2 | `GET /api/device/information` | Yes | ✅ | 🔨 model + firmware + running time on the Router tab status card (only those fields kept); full screen ⬜ |
| 10.2 | **Reboot router** (confirm + fingerprint/PIN + waiting screen) | P1 | `POST /api/device/control` (`Control=1`) | Yes | ⏳ | 🔨 |
| 10.3 | SIM PIN status / unlock | P3 | `GET/POST /api/pin/status`, `/api/pin/operate` | Yes | ⏳ | ⬜ |
| 10.4 | Firmware update check | P3 | `GET /api/online-update/check-new-version` | Yes | ⏳ | ⬜ |
| 10.5 | Feature flags (hide unsupported screens) | P1 | `GET /api/global/module-switch` | No | ✅ | 🔨 (endpoint ready, not yet used to hide screens) |
| 10.6 | Factory reset (double confirmation, type `RESET`) | P3 | `POST /api/device/control` | Yes | ⏳ | ⬜ |
| 10.7 | Automatic restart on/off (the router's own schedule: every N days in a night window; shown, not editable, like the web page) | P2 | `GET/POST /api/diagnosis/time_reboot` | Yes | ✅ GET · ⏳ POST | 🔨 |

## 11. App features (not router API)

| # | Feature | Priority | Status |
|---|---|---|---|
| 11.1 | Pull-to-refresh on every screen | P1 | ✅ |
| 11.2 | "Can't reach your router" screen with retry | P1 | ✅ |
| 11.3 | Dark theme | P3 | ⬜ (app is light-only by design) |
| 11.4 | Configurable router IP (default `192.168.8.1`, private IPs only) | P2 | 🔨 shown read-only in Settings |
| 11.5 | Refresh interval setting (2 s / 5 s / 10 s) | P2 | ⬜ |
| 11.6 | Data-limit and new-SMS notifications while the app is open | P3 | ⬜ |
| 11.7 | Android home-screen widget (signal + data used) | P3 | ⬜ |
| 11.8 | Sinhala / Tamil language support | P3 | ⬜ |
| 11.9 | Snackbar messages (errors, "session ended") | P1 | ✅ |
| 11.10 | App icon (router + Wi-Fi, light blue) | P1 | ✅ generated, needs standalone build to show |

## 12. Security features

| # | Feature | Priority | Status |
|---|---|---|---|
| 12.1 | Router fingerprint pinning (pre-login: model + public key; post-login: serial + MAC) with "This doesn't look like your router" warning | P1 | 🔨 (first-login pin saved; mismatch flow not exercised) |
| 12.2 | Login attempt limiter (3 per 5 min) + router lock countdown | P1 | 🔨 |
| 12.3 | Idle logout (10 min) and background logout (5 min) | P1 | 🔨 |
| 12.4 | Screenshot / recents blocking on sensitive screens | P1 | ✅ login screen · 🔨 Wi-Fi, change admin password |
| 12.5 | Device re-auth (fingerprint/PIN) for risky actions; blocked if the phone has no screen lock | P1 | 🔨 reboot, "Trust new router", Wi-Fi change, show Wi-Fi password / QR, admin password change |
| 12.6 | Cleartext HTTP allowed only to the router in release builds (config plugin) | P1 | 🔨 (applies to standalone builds) |
| 12.7 | Log redaction + `console` stripped from release builds | P1 | ✅ |
| 12.8 | App lock on open and after 1 minute away (optional, fingerprint/PIN; Settings → Security) | P2 | 🔨 |
| 12.9 | Clipboard auto-clear after copying the Wi-Fi password | P2 | ⬜ |

---

## Screens

```
Tabs
├── Home        → 2.x dashboard + speed chart + top/average, session ↓/↑ split,
│                 4.1 monthly usage (today / this month, plan bar) — no login needed    ✅
├── Signal      → 3.x details ✅ · "Find best router position" → antenna mode (3.4) 🔨
├── Devices     → 8.x Wi-Fi + cable devices ✅ · new / connected / not connected groups,
│                 device detail (name, type, maker, block / unblock) 🔨
├── Router      → status card (name, Online, running time, firmware) ✅, Wi-Fi (9.1–9.3 🔨),
│                 guest Wi-Fi (9.5) 🔨, Internet (5.1 mobile data ✅, 4G band 3.6 🔨), Security (1.9
│                 admin password 🔨), Maintenance (10.7 automatic restart 🔨), Danger zone (10.2 reboot) ✅
│                 · next: data plan (4.2)
└── Settings    → the app only: Account (log in/out, forget password), Security (app lock 🔨), App ✅
Login (modal)   → 1.x, 12.1, 12.2, 12.4                                                ✅
Rebooting       → 10.2 waiting screen                                                  🔨
Wi-Fi           → 9.1–9.3 name, show password, QR, change (screenshot-blocked)           🔨
Change password → 1.9 (screenshot-blocked)                                              🔨
Antenna         → 3.4 find the best router position                                    🔨
Guest Wi-Fi     → 9.5 (screenshot-blocked)                                              🔨
4G band         → 3.6 band lock                                                         🔨
```

## Build phases

1. **Phase 1 (MVP)**: ✅ project setup, router detection, no-login dashboard, login + token handling, signal, devices (Wi-Fi + cable), data toggle, reboot, security modules, app icon.
   - Remaining: test on the phone the logout, mobile data switch, reboot and remember-password flows.
2. **Release (pending decision)**: standalone APK with the icon. Choose EAS cloud build (needs a free Expo account) or a local build (needs the Android SDK, ~4–5 GB). See [Release](#release).
3. **Phase 2 (Router tab first)**: Built and still to be run on the router or checked on the phone: change admin password, Wi-Fi settings + QR, device management + blocking, guest Wi-Fi, automatic restart, LTE band lock, antenna positioning mode, app lock. Done: speed chart, monthly usage, Router tab. Not started: data plan (owner doesn't need it for now), feature-flag hiding. Network mode is not applicable (this router is 4G only). **SMS/USSD dropped** (owner's choice, 2026-09-29).
4. **Phase 3**: APN, notifications, widget, languages, factory reset.

## Release

- Not built yet. Development uses Expo Go on the phone over USB (see [AGENTS.md](../AGENTS.md) §3).
- Options: **EAS Build** (cloud; no local SDK; needs the user's Expo account login) or **local build** (install Android SDK + NDK, then `npx expo prebuild` and Gradle). Ask the user before either.
- Release signing needs a keystore kept **outside** the repo, wired in with a config plugin (not by editing `android/`).
- Icons are generated by `python scripts/make-icons.py` into `assets/`.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 57 + TypeScript (strict) + Expo Router (`src/app/`) |
| HTTP | `fetch` via `src/api/client.ts` (manages `SessionID` cookie + `__RequestVerificationToken`, `credentials: 'omit'`) |
| XML | `fast-xml-parser` (DOCTYPE/ENTITY rejected) |
| Hashing | `expo-crypto` (SHA-256) |
| RSA | `node-forge` (admin password change, Wi-Fi password change and reveal) |
| Secure storage | `expo-secure-store` |
| Re-auth | `expo-local-authentication` |
| Screenshot blocking | `expo-screen-capture` |
| Phone IP ("this phone") | `expo-network` |
| Data fetching / polling | `@tanstack/react-query` (memory only, paused off-screen/background) |
| Cleartext HTTP (release) | `plugins/withRouterNetworkSecurity.js` → network security config for `192.168.8.1` only |
| Icons | `@expo/vector-icons` (Ionicons) |
| Tests | Jest (`jest-expo`) |
| Dev testing | Expo Go on the phone via USB (`adb reverse`) |

## Technical notes & risks

- **Login hash (type 4):**
  `password = base64( sha256_hex( username + base64( sha256_hex(password) ) + token ) )`. Verified working on this router.
- **Session cookie:** the router sets `Set-Cookie: SessionID=...`; on this firmware it equals `SesInfo` from `SesTokInfo`. The app sends it itself with `credentials: 'omit'` so React Native's native cookie jar is not used.
- **Token rotation:** after login the router sends `__RequestVerificationTokenone` / `two`; other responses send `__RequestVerificationToken` (may be `#`-separated). Each POST uses one token; POSTs are serialized.
- **Connected devices:** `wlan/host-list` shows only Wi-Fi clients. `lan/HostInfo` shows all clients (incl. cable); the app merges both by MAC.
- **Account lock:** repeated wrong logins lock the account (`lockstatus`, `remainwaittime`). The app never retries a wrong password.
- **Single session:** logging in from the app may log out the web UI / HiLink app, and the other way round.
- **Error codes:** `100002` not supported · `100003` login required · `108001/108002/108006` wrong credentials · `108003` already logged in · `108007` too many attempts · `125001–125003` bad token.
- **Router public key** is stable between requests; **not verified across reboots/firmware updates**. If it changes, the app shows the "not your router" warning and the user must re-trust.
- **Dangerous actions** (reboot, factory reset, Wi-Fi off, data off, MAC block of own phone) need confirmation dialogs; most also need fingerprint/PIN.
- **Security:** never hardcode the admin password; **change the current admin password** because it was shared in plain text. Keep the app LAN-only; use a VPN (e.g. Tailscale/WireGuard) for remote access instead of port forwarding.
- `npm audit`: 13 moderate issues. 12 are in Expo build tooling (not shipped); one ships in the app (`expo-router` → `query-string` → `decode-uri-component`, low risk, see AGENTS.md §12a). Recheck before release.
- Endpoints marked ⏳ are standard HiLink endpoints but may differ or be missing on this firmware. Check each one before building its screen.

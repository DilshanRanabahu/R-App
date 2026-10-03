# AGENTS.md

Instructions for AI coding agents working on **R_app**. Read this file fully before making changes.

## 1. Project

A React Native (Expo) Android app to manage a **Huawei B312-926** 4G router from the owner's phone over the local network, using the router's HiLink XML API at `http://192.168.8.1/api/`.

| Document | Purpose | Rule |
|---|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | What to build: features, priorities (P1–P3), endpoints, phases, **status** | Source of truth for scope. Build in phase order. Update the Checked (⏳ → ✅) and Status (⬜ → 🔨 → ✅) columns and the Progress table as you go. |
| [docs/DESIGN.md](docs/DESIGN.md) | How it looks: colors, type, components, screens, states | Follow it for all UI. No design choices outside it without asking. |
| AGENTS.md (this file) | How to work: stack, architecture, **security**, safety, conventions | Rules here override convenience. |

Project docs live in `docs/`; `AGENTS.md` and `CLAUDE.md` stay in the root because agent tools look for them there.

If these documents conflict, **security rules in this file win**, then FEATURES.md for scope, then DESIGN.md for UI.

`CLAUDE.md` only contains `@AGENTS.md`, so Claude Code loads this file automatically.

### Current status (2026-10-02)

- **Phase 1 is built** and runs on the phone through Expo Go. The user has logged in successfully with the real router; dashboard, signal and devices (Wi-Fi + cable) are verified on the phone.
- **Phase 2 so far:** Router tab (status card, mobile data, reboot), monthly usage on Home, speed chart are done. **Built but not yet run on the router:** change admin password, Wi-Fi name/password/hide, reveal Wi-Fi password, Wi-Fi QR code. **Built, not yet checked on the phone:** Devices tab groups (new / connected / not connected), device detail (name, type, maker), antenna mode, app lock. **Built, POST not yet run on the router:** guest Wi-Fi, automatic restart switch, LTE band lock.
- **Device blocking (FEATURES 8.4) is built, its POST not yet run on the router.** The format was read from the router's `devicemanagement.js` on 2026-10-03 (see §6). Running it for real needs the user's approval (§9).
- **Not yet exercised on the phone:** logout, remember password, session expiry, mobile data switching, reboot, "Trust new router", and the Phase 2 items above.
- **No standalone APK yet.** The app icon is generated in `assets/`. The build route (EAS cloud vs local Android SDK) is **the user's decision**; don't start either without asking (§9).
- **Next:** test the built features on the router and phone (each router change needs the user's go-ahead, §9). The Messages tab was replaced by a Router tab; SMS/USSD are dropped; the data plan feature is not wanted for now.
- Full per-feature status is in FEATURES.md; per-screen status in DESIGN.md §17.

## 2. Environment

| Item | Value |
|---|---|
| OS / shell | Windows 11, PowerShell (Git Bash also available) |
| Node / npm / Java | 26.5 / 11.17 / 21 |
| App stack | Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6, Jest 29 (`jest-expo`) |
| Android SDK | **Not installed** (user declined a local install for now). Develop with Expo Go. A partial download may remain at `%LOCALAPPDATA%\Android\Sdk` (`cmdtools.zip`, empty `cmdline-tools/`). |
| Test phone | Samsung SM-A065F, Android 16, ≈ 384 × 853 dp, 3-button nav, adb serial from `adb devices` (use it as `<serial>` below), **Expo Go 57** (must match the SDK) |
| Network | Router `192.168.8.1` · laptop `192.168.8.102` (Ethernet) · phone `192.168.8.100` (Wi-Fi) |
| Router | B312-926, operator HUTCH, `password_type=4`, `encrypt_enabled=1` (RSA), `firstlogin=1` |

## 3. Commands

```bash
npx expo install <pkg>          # add Expo/RN packages (keeps SDK-compatible versions)
npx tsc --noEmit                # type check
npm run lint                    # lint (expo lint, ESLint 9 flat config)
npm test                        # unit tests
npx expo-doctor                 # dependency / config health (should be 21/21)
npm audit --omit=dev            # dependency vulnerability check
python scripts/make-icons.py    # regenerate app icons in assets/
python scripts/make-oui.py      # regenerate src/utils/ouiData.ts (device makers) from the IEEE registry
```

**Run on the phone (USB, known-good setup):**

```bash
adb -s <serial> reverse tcp:8081 tcp:8081
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --lan --port 8081   # keep running
adb -s <serial> shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
adb -s <serial> exec-out screencap -p > screen.png                          # check the UI
```

- Do **not** use `npx expo start --localhost`: on this laptop Metro then listens on IPv6 `::1` only, `adb reverse` connects over IPv4, and Expo Go fails with "Failed to download remote update".
- Do not set `CI=1` for the dev server: it disables reloads.
- The first bundle takes ~15–20 s; Expo Go may time out on the very first load. Reload or relaunch.
- Screenshots of the login screen are black: that is the screenshot blocking working.

Before saying a task is done: `tsc`, `lint` and `test` pass, and the change was checked on the phone for UI work.

## 4. Tech stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 57, TypeScript **strict** (+ `noUncheckedIndexedAccess`), Expo Router (tabs, routes in `src/app/`) |
| HTTP | `fetch` wrapped in `src/api/client.ts` (only place that talks to the router) |
| XML | `fast-xml-parser` (DOCTYPE/ENTITY rejected, see §8.4) |
| Hashing | `expo-crypto` (SHA-256) |
| RSA | `node-forge` |
| Secrets | `expo-secure-store` |
| App lock / re-auth | `expo-local-authentication` |
| Screenshot blocking | `expo-screen-capture` |
| Data fetching / polling | `@tanstack/react-query` (in-memory cache only, **no persistence**) |
| Non-secret prefs | `@react-native-async-storage/async-storage` |
| UI | `react-native-safe-area-context`, `@expo/vector-icons` (Ionicons) + `expo-font`, `react-native-svg` |
| Phone IP ("this phone") | `expo-network` |
| Antenna mode | `expo-keep-awake` (screen on), `expo-haptics` (buzz on a new best) |
| Wi-Fi QR code | `qrcode` (exact `1.5.4`, MIT; only `create()` is used, drawn with `react-native-svg`) |
| Build config | `expo-build-properties` + `plugins/withRouterNetworkSecurity.js` (§8.6) |
| Release | `babel-plugin-transform-remove-console` in production (`babel.config.js`) |

Do not add other dependencies without a reason written in the task summary (§8.10).

## 5. Architecture

```
src/
  app/                        # Expo Router screens (thin: layout + hooks only)
    _layout.tsx               # providers (query, snackbar, auth), stack
    login.tsx                 # modal, screenshot-blocked
    rebooting.tsx             # waits for router after reboot
    wifi.tsx                  # Wi-Fi name/password/QR, screenshot-blocked
    change-password.tsx       # admin password change, screenshot-blocked
    (tabs)/_layout.tsx        # 5 tabs (DESIGN.md §8) + "can't reach router" gate
    (tabs)/index.tsx          # Home
    (tabs)/signal.tsx
    (tabs)/devices.tsx
    (tabs)/router.tsx         # router management (status, Wi-Fi, mobile data, security, reboot)
    (tabs)/settings.tsx       # the app only (account, router address, version)
    device/[mac].tsx          # device detail: name, type, known/new, details
    antenna.tsx               # antenna positioning mode (signal every second)
    guest-wifi.tsx            # guest network: switch, name, security, auto-off, QR; screenshot-blocked
    lte-band.tsx              # LTE band lock (Automatic or one band)
  api/
    client.ts                 # session cookie, token rotation, request queue, timeout, RSA bodies
    auth.ts                   # state-login, login, logout, admin password change
    crypto.ts                 # SHA-256, base64, login hash, RSA (web UI scheme), Wi-Fi reveal decrypt
    xml.ts                    # safe build/parse + escaping (XML, web UI, Wi-Fi UI variants)
    validate.ts               # input validators (IP, SSID, Wi-Fi key, MAC, admin password; phone/USSD/SMS kept unused)
    errors.ts                 # HiLink codes → typed errors + user messages
    endpoints/                # monitoring, device, net, dialup, wlan (hosts), wifi (settings), macfilter (block list), parse (helpers)
    types.ts
    __tests__/  __fixtures__/ # tests; sanitized sample XML only
  security/
    credentials.ts            # secure-store wrapper (only place that touches the password)
    session.ts                # secureLogin (identity checks), timeouts, attempt limiter
    deviceAuth.ts             # biometric / device PIN re-auth
    redact.ts                 # redaction for logs/errors
    routerIdentity.ts         # router fingerprint pinning (§8.5)
  state/                      # AuthProvider, SnackbarProvider, AppLockProvider (+ appLock timing), queryClient, devicePrefs (nicknames/known, AsyncStorage)
  hooks/                      # react-query hooks (useTraffic, useSignal, useHosts, ...)
  components/                 # DESIGN.md §7 components
  theme/                      # colors.ts, typography.ts, spacing.ts (DESIGN.md §3–5)
  utils/                      # formatters, signal rating, devices (grouping/titles), vendor + ouiData (maker from MAC), bands (LTE masks), antenna (best/trend)
plugins/withRouterNetworkSecurity.js   # cleartext only to the router (§8.6)
```

Layer rule: `src/app/` → `hooks/` + `state/` → `api/` + `security/`. Screens never import `client.ts`, `fetch` or `expo-secure-store` directly.

## 6. Router API rules

- **All router traffic goes through `src/api/client.ts`.**
- Token: `GET /api/webserver/SesTokInfo` gives `SesInfo` (cookie) + `TokInfo` (token). Send the token as `__RequestVerificationToken` and the cookie as `Cookie: SessionID=...`. On this firmware `SesInfo` equals the `Set-Cookie: SessionID` value.
- **Cookies:** every `fetch` uses `credentials: 'omit'` so React Native's native Android cookie jar (OkHttp) is bypassed and `client.ts` is the only owner of the session. Without it the native jar overrides the `Cookie` header and logout can't really forget the session.
- **Token rotation:** read the new token from response headers after every request: after login `__RequestVerificationTokenone` / `__RequestVerificationTokentwo`, otherwise `__RequestVerificationToken` (may contain several `#`-separated tokens). Each POST consumes one. After login, `SessionID` changes (from `Set-Cookie`). Replace it.
- **Serialize POSTs** through a single queue so tokens never race.
- Request: `<?xml version="1.0" encoding="UTF-8"?><request>...</request>`. Response is `<response>` or `<error><code/></error>`. Always check for `<error>`.
- Login (`password_type=4`):
  `base64(sha256_hex(username + base64(sha256_hex(password)) + token))`
- Error codes: `100002` not supported · `100003` login required · `125001–125003` bad token (refresh token, retry **once**, rebuilding token-dependent bodies) · `108001/108002/108006` wrong credentials (never retry) · `108007` too many attempts · `108003` already logged in.
- **Connected devices:** `wlan/host-list` returns Wi-Fi clients only. `lan/HostInfo` returns all clients (incl. cable, with `InterfaceType`/`Active`). `getHosts()` merges both by MAC; a LAN-only device is treated as "cable". If `lan/HostInfo` is unsupported, fall back to Wi-Fi only.
- `lan/HostInfo` also gives `AddressSource` (`DHCP` / `Static`), `LeaseTime`, `ID` and `isLocalDevice` (`1` = the device that is asking, used as a second "this phone" check); devices that have left stay listed with `Active=0`. `wlan/host-list` adds `Frequency` (`2.4GHz`).
- **Block a Wi-Fi device** (copied from the router's `devicemanagement.js` `changeAccess`, emui webui 6):
  - Read: `GET wlan/multi-macfilter-settings-ex` → `enable` (1 = filter on), `wifimacfilterstatus` (1 = allow list, 2 = block list), `Ssids.Ssid[]` each with `wifimacblacklist` / `wifimacwhitelist` (empty, or `WifiMacFilterMac0..n` + `wifihostname0..n`).
  - Write: `POST wlan/multi-macfilter-settings` (plain XML, not the `-ex` path) with one `Ssid`: the first SSID's block-list entries, the device in the first empty slot (or its slot cleared to unblock), `WifiMacFilterStatus` (2 to block; unblocking keeps 2, or 0 if the filter was off), `Index` 0. Never auto-retried.
  - Slots: `wifimaxmacfilternum` from `wlan/wifi-feature-switch`, else 10. A router in allow-list mode is left alone (`allow_list`). With `enable=0` the list is kept but not enforced; the first block turns it on for every device already listed (the confirm dialog says so).
  - Only Wi-Fi devices (the web page hides the switch for Ethernet). The app refuses this phone.
  - Also on that page, not built: `POST lan/changedevicename` (`ID`, `ActualName`, max 64 bytes) renames a device on the router; `POST lan/HostInfo` (`ID=0`, `MacAddress`) removes a not-connected device from the list.
- **Automatic restart** (router's `systemsettings.js`): `GET/POST diagnosis/time_reboot` → `enable`, `dayinterval`, `begintime`, `endtime` (minutes after midnight). The web page only flips `enable` and posts the four values back; the app does the same.
- **LTE band** (router's `mobilesearch.js`): `GET net/net-mode` → `NetworkMode` (`03` = 4G only), `NetworkBand`, `LTEBand` (hex mask, bit n − 1 = band n). `GET net/net-mode-list` → `AccessList` (this router: only `03`, so there is no network-mode choice) and `LTEBandList` (the router's own band set, unnamed, `a000000095` = bands 1, 3, 5, 8, 38, 40, plus "All bands"). `POST net/net-mode` with the three values; the page waits 45 s. **The page only offers the listed masks; a single-band mask is the app's own addition and is unverified on this router.**
- **Guest Wi-Fi** (router's `guestwifi.js`): the `multi-basic-settings` entry with `wifiisguestnetwork=1` (ID `...Ssid.2.`); `wifiguestofftime` 0 = never, 4 = 4 hours, 24 = 1 day. Switch: plain `POST wlan/multi-basic-settings` with **all** entries, names and secrets left out (`clearSecureData`), guest `WifiEnable` set, `WifiRestart=1`. Save: `;enp`, **only** the guest entry, `WifiAuthmode` `OPEN` (+ `WifiBasicencryptionmodes=NONE`) or `WPA/WPA2-PSK` (+ `WifiWpaencryptionmodes=MIX`, key `RSA(wifiEncode(password))` in `WifiWpapsk` and `MixWifiWpapsk`, omitted when unchanged). `GET wlan/guesttime-setting` → `remaintime` (seconds), `extendtime` (minutes); `POST` `{extendtime}` keeps it on longer.
- Without a session cookie every API path answers `125002`; with an anonymous session every path answers `100003`, **even paths that don't exist**. So an endpoint can only be checked from a logged-in session.
- HiLink returns a single child as an object and several as an array; always normalize with `toArray()`.
- RSA (`encrypt_enabled=1`): key from `GET /api/webserver/publickey` (2048-bit, e=65537 on this router). Padding from `rsapadingtype` in `state-login` (`1` = OAEP with SHA-1, as on this router; else PKCS#1 v1.5). **Scheme (from the router's web UI `doRSAEncrypt`, emui webui 6):** base64(UTF-8 XML) → blocks of 214 chars (OAEP) / 245 (PKCS#1) → RSA each block → concatenate as hex; POST with `Content-Type: application/x-www-form-urlencoded; charset=UTF-8;enc`. Implemented in `crypto.ts` `rsaEncryptHex` + `client.post(..., { encrypt })`.
- **Admin password change:** `POST /api/user/password_scram` (not `user/password`) with `<username>admin</username><currentpassword/><newpassword/>`, values escaped like the web UI's `xss()` (`escapeLikeWebUi`: also `/ ( ) '` as numeric refs), body RSA-encrypted. Never auto-retried. Router rules (`web_pwd_simplify_enabled=1`): ≥ 8 chars, ASCII 32–126, no leading space. Errors: `108008` = "Password entered incorrectly too many times" (session ends), `125002` = session ends, anything else = "Password incorrect". After success the router ends the session.
- **Wi-Fi settings** (copied from the router's own `wifisecurity.js` / `wificommon.js`, emui webui 6):
  - Read: `GET wlan/multi-basic-settings` → `Ssids.Ssid[]`; main network = ID `...Radio.1.Ssid.1.`, guest = `...Ssid.2.`. `WifiWpapsk` is always empty here; `WifiBroadcast` 0 = visible, 1 = hidden. Values may contain numeric refs (`&#x2F;`), decode with `decodeCharRefs`.
  - Reveal password: `POST user/pwd` `{module: wlan, nonce: RSA(nonceHex + saltHex)}` (two random 32-byte hex secrets) → `{pwd, hash, iter}`; PBKDF2-HMAC-SHA256(nonceHex text, salt bytes, iter, 32 B) → hex: AES-128 key = [0:32], IV = [32:48] + 8 zero bytes, HMAC key = [48:64]; check HMAC-SHA256(ciphertext) = hash, then AES-CBC decrypt → `<response>` with the keys. (`crypto.ts` `decryptSecretReply`.)
  - Save: `POST wlan/multi-basic-settings` with `Content-Type: ...;enp` (body **not** RSA-wrapped), only the edited SSID entry (current fields in original order, secrets/WEP/Radius dropped, `WifiWpaencryptionmodes` AES for WPA2-PSK), `WifiRestart=1`. Values escaped like the page's `wifiEncode` (`escapeLikeWifiUi`, `'` → `&apos;`). New password = `RSA(wifiEncode(password))` hex in `WifiWpapsk` and `MixWifiWpapsk`; unchanged password = both omitted. Rules here (`wifispecialcharenable=1`, `chinesessid_enable=0`): name 1–32 keyboard chars (trimmed), key 8–63 keyboard chars, no leading space.
  - Wi-Fi restarts on save: the phone may drop before the response (treat timeout as "probably saved").
- **Web UI source for research:** page scripts (`/js/<page>.js`, e.g. `wifisecurity.js`, `wificommon.js`) are only served to a logged-in session (else `100003`), and are gzip-encoded. Find page names by guessing; `menu.js` loads `../js/<menu>.js`.
- Use `GET /api/global/module-switch` to hide unsupported features (endpoint verified; not yet wired into the UI).
- `monitoring/month_statistics` and `monitoring/start_date` are readable **without login** on this router (verified 2026-09-29). `start_date` gives the data plan: `SetMonthData=1` + `DataLimit` like `60GB` (1024 steps); `MonthLastClearTime` is when the counters were last reset.
- Request timeout 8 s. Polling per DESIGN.md: traffic 2–3 s, signal 5 s (1 s in antenna mode), others on focus. **Stop all polling** when the screen is unfocused or the app is backgrounded.

## 7. UI rules (from DESIGN.md)

- **Light theme only**: `userInterfaceStyle: "light"`, dark status bar icons, white nav bar. The phone runs system dark mode, so the app must not follow it.
- Use **theme tokens only**. No raw hex, font sizes or spacing numbers in screens/components.
- Design for **384 dp width**, one column, key content inside the top ~600 dp. Test at font scale 1.3.
- No shadows, no blur, no gradients, animations ≤ 200 ms (A06 is an entry-level phone).
- Touch targets ≥ 48 dp. Icon-only buttons need `accessibilityLabel`. Status never by color alone.
- Every screen handles all states in DESIGN.md §10 (loading skeleton, not on router Wi-Fi, login required, locked, in progress, error, empty, stale).
- Every dangerous action uses the confirmation text in DESIGN.md §11.
- Units and wording per DESIGN.md §14 (Mbps for speed, MB/GB for data, plain English).

---

## 8. Security (highest priority)

### 8.1 Threat model

| Threat | Why it matters here | Main defenses |
|---|---|---|
| Password theft from the phone | Admin password controls the whole router | Secure store, app lock, never log, screenshot blocking (§8.2, 8.7) |
| Sniffing on the LAN | Router only speaks **plain HTTP** | Keep app LAN-only, never send credentials to another host, hashed login only (§8.5, 8.6) |
| Fake / wrong router (evil twin, wrong IP) | App could send the login hash or Wi-Fi key to an attacker | Router address restrictions + router fingerprint pinning (§8.5) |
| Injection via user input or router data | SMS text, SSID, device names flow into XML and UI | Escape XML, validate input, render as plain text (§8.4) |
| Accidental harmful actions | Reboot / reset / Wi-Fi change can cut the owner off | Confirmation + re-auth + agent approval (§8.8, §9) |
| Account lockout | Wrong logins lock the router admin | No login loops, respect lock timers (§8.3) |
| Malicious / vulnerable dependency | Runs with access to credentials | Minimal, pinned, audited deps (§8.10) |
| Leaks via logs, crash reports, backups, recents | Tokens, IMEI, SMS could leak | Redaction, no persistence, `allowBackup=false` (§8.7, 8.9) |

### 8.2 Credentials

- **Never hardcode** the router password (or any credential) in code, tests, fixtures, config, docs, commits or logs. The real password must never appear in any file in this repo.
- The password is entered by the user at runtime. Only `src/security/credentials.ts` reads or writes it.
- "Remember password" is **off by default**. When on, store it with `expo-secure-store` using `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` and `requireAuthentication: true` where supported.
- Keep the password in memory only as long as needed for the login call. Don't put it in React state, context, react-query cache, navigation params or AsyncStorage.
- **Logout** and "Forget router" wipe: stored password, session cookie, token, react-query cache, router fingerprint (forget only).
- The password input: `secureTextEntry`, `autoComplete="password"`, `autoCorrect={false}`, `autoCapitalize="none"`, `importantForAutofill="yes"`. The show/hide toggle resets to hidden when leaving the screen.
- Support the router's forced first-login password change (`firstlogin=1`). New password rules: 8–32 chars and different from the old one, with a strength hint.

### 8.3 Login and session

- **No login loops.** As built, the app **never logs in automatically**: when the router reports `100003`, `useSessionWatcher` ends the local session and shows "Your session ended. Please log in again." The user logs in again (or taps "Use saved password", which prompts for fingerprint/PIN). A bad-token error (`125001–125003`) is retried once by `client.ts`. On `108006`/`108007` with a saved password, stop and wipe the saved password.
- Before every login read `user/state-login`: if `lockstatus=1`, show the `remainwaittime` countdown and disable the button (DESIGN.md §9.6).
- App-side limit: at most 3 manual attempts per 5 minutes, even if the router allows more.
- Session idle timeout: **10 minutes** without interaction → logout on the router + wipe the session. Backgrounded for > 5 minutes → same.
- Never share the session outside `client.ts` (no exposing cookie/token to screens).

### 8.4 Input, XML and output safety

- **Escape every value** placed into request XML (`& < > " '`) in `src/api/xml.ts`. Never build XML by string concatenation in endpoint files.
- `fast-xml-parser` configuration: attributes ignored, `parseTagValue: false` (keep strings, convert explicitly), `htmlEntities: false`; only the 5 predefined XML entities are decoded. **Reject any response containing `<!DOCTYPE` or `<!ENTITY`** and any response larger than 1 MB.
- Validate before sending (`src/api/validate.ts`), and show errors inline:
  - SSID: 1–32 bytes, printable characters.
  - WPA2 key: 8–63 printable ASCII.
  - Phone number: `^\+?[0-9]{3,15}$`.
  - USSD: `^[*#0-9]{2,30}$`, must start with `*` or `#`.
  - SMS text: ≤ 459 chars (3 parts), trimmed.
  - (Phone / USSD / SMS validators exist but are unused since SMS/USSD were dropped; they and the SMS link rule below apply if those features return.)
  - Admin password: 8–32 chars, ASCII 32–126, no leading space, different from the current one.
  - Router address: see §8.5.
  - MAC: `^([0-9A-F]{2}:){5}[0-9A-F]{2}$` (normalize upper case). Route parameters carrying a MAC are checked the same way (`paramToMac`).
  - Device nickname: 1–32 characters, no control characters (app-side only, never sent to the router).
- Treat **all router data as untrusted** (SMS bodies, device names, SSIDs, USSD replies). Render as plain `<Text>` only. No `WebView`, no `dangerouslySetInnerHTML`, no `eval`/`new Function`.
- SMS links: do not auto-linkify. If the user taps "Open link", show the full URL in a confirm dialog first (SMS phishing risk).
- Deep links: the app scheme may only open screens. **No deep link may trigger an action** (reboot, send SMS, change settings).

### 8.5 Router address and identity

- Router address setting accepts **only a private IPv4 address** (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), no hostnames, no ports other than 80, no `https://` external URLs. Default `192.168.8.1`.
- Before logging in, confirm the target is a Huawei HiLink router: `device/basic_information` returns `devicename` (expect `B312-926`).
- **Router fingerprint pinning** (hashes only, in secure store):
  - *Pre-login:* SHA-256 of device name + RSA public key (`webserver/publickey`), both readable without login. Checked **before** the password hash is sent; a mismatch or an unexpected model means **don't send the password**.
  - *Post-login:* SHA-256 of device name + serial + MAC (`device/information`). On mismatch, log out immediately.
  - Both show "This doesn't look like your router" with **Cancel** (default) / **Trust new router** (requires device re-auth).
  - Not yet verified: whether the public key survives a router reboot or firmware update. If it changes, users will see a false warning and must re-trust.
- Never send any router data (tokens, hashes, SMS, IMEI, IMSI, MACs) to any host other than the configured router address.
- **Secrets are only ever encrypted with the pinned router's key:** admin password change, Wi-Fi password change and Wi-Fi password reveal get the RSA key through `trustedPublicKey()` (`routerIdentity.ts`), which refuses a key that doesn't match the pre-login pin (`identity_mismatch`).
- **Redirects:** React Native follows HTTP redirects and can't be told not to. `client.ts` rejects any response whose final URL isn't `http://<router>` (port 80) before using its cookies, tokens or body (`isFromHost`), and refuses responses with `Content-Length` over 1 MB before downloading them.
- **Deep links** can open any screen. Screens must not act on open: `rebooting.tsx` only runs within 60 s of a reboot the user confirmed (`state/rebootGate.ts`); otherwise it redirects home.

### 8.6 Network

- Cleartext HTTP is allowed **only for the router address** in release builds. Use a config plugin that writes `network_security_config.xml` with `cleartextTrafficPermitted="true"` for `192.168.8.1` only and `base-config cleartextTrafficPermitted="false"`. Only debug builds may allow cleartext for the Metro dev server (`debug-overrides`). Do **not** set global `usesCleartextTraffic: true` for release.
- No analytics, crash reporting, remote config, ads or any third-party network calls. The app works fully offline apart from the router.
- No remote access features (port forwarding, cloud relay, DDNS setup from the app). For remote use, document a VPN (Tailscale/WireGuard) instead.

### 8.7 Data at rest and on screen

- **Do not persist** SMS, USSD replies, IMEI, IMSI, ICCID, phone numbers, tokens or full host lists. The react-query cache is memory only and is cleared on logout/background timeout.
- AsyncStorage may hold only: refresh interval, router address, device notes keyed by MAC (nickname, type, "known" mark; `state/devicePrefs.ts`, never the router's host list itself), app lock on/off, data plan display prefs, antenna mode best value.
- `android.allowBackup: false` (no ADB/cloud backup of app data).
- **Block screenshots and the recents preview** (`expo-screen-capture`) on: Login, Wi-Fi password view/edit, Wi-Fi QR, Change admin password, Device information (IMEI/IMSI).
- Wi-Fi password is hidden by default. Revealing it requires device re-auth (biometric/PIN).
- Clipboard: allow copying the Wi-Fi password only after re-auth, and clear the clipboard after 60 s if it still holds that value. Never copy the admin password.

### 8.8 App lock and re-authentication

- Optional **app lock** (Settings → Security, `state/AppLockProvider.tsx`): biometric / device PIN via `expo-local-authentication` when the app opens or returns after > 1 minute in background. Turning it on or off needs device re-auth. If the phone's screen lock was removed afterwards, the cover says so and lets the owner in (there is nothing left to ask for).
- **Always require device re-auth** (even if app lock is off) for: reboot, factory reset, Wi-Fi name/password change, reveal/copy Wi-Fi password, admin password change, MAC block, "Trust new router", enabling "Remember password".
- If the device has no screen lock set, the sensitive action is **blocked** with a message asking the user to set a screen lock (stricter than a password fallback).

### 8.9 Logging and errors

- No `console.log` of request/response bodies, headers, cookies, tokens, hashes, passwords, SMS text, IMEI/IMSI, phone numbers or MACs.
- Use `src/security/redact.ts` for any debug logging (only in `__DEV__`). Strip `console.*` from release builds (`babel-plugin-transform-remove-console`).
- User-facing errors are short and generic (DESIGN.md §10). Raw XML and codes appear only in the dev "Details" line, redacted.

### 8.10 Dependencies and build

- Prefer Expo SDK packages. Any new third-party package must be widely used, actively maintained, and justified in the task summary.
- Commit the lockfile, use exact versions for security-relevant packages (`node-forge`, `fast-xml-parser`), run `npm audit --omit=dev` and fix high/critical issues before release.
- Android permissions: only `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `USE_BIOMETRIC`. Block others with `android.blockedPermissions` (no location, contacts, SMS, storage, camera).
- Signing keys, keystores, EAS credentials and `.env` files never go in the repo. Add them to `.gitignore` before the first commit.
- Release builds: Hermes on, `console` stripped, dev menu off.

### 8.11 Security review checklist (every change)

- [ ] No secrets, real passwords, tokens or personal router data in the diff.
- [ ] Router calls only through `client.ts`. New XML uses `xml.ts` escaping.
- [ ] New inputs validated in `validate.ts` with tests.
- [ ] New router data rendered as plain text, not persisted unless allowed in §8.7.
- [ ] Dangerous action? Confirmation (DESIGN.md §11) + re-auth (§8.8).
- [ ] Sensitive screen? Screenshot blocking (§8.7).
- [ ] No new network destinations, permissions or unexplained dependencies.
- [ ] Logs redacted, nothing sensitive in `console.*`.

---

## 9. Agent safety rules (real router)

This app controls a **real, in-use router**. The laptop and phone depend on it for internet.

- **Allowed without asking:** read-only `GET` probes of the router API to verify endpoints; running the app in Expo Go on the phone; `adb` read-only commands (`getprop`, `wm size`, logcat, `screencap`); `adb shell input tap` to navigate **between tabs/screens** in our app (not to trigger actions).
- **Login against the real router:** preferred: **ask the user to log in on the phone themselves** (this is how Phase 1 was verified). Agents must not type the password with `adb shell input text` or put it in any command line. If an agent must log in, unit-test the hash first, then **one** attempt per task with a password the user gives in the current conversation, never written to disk, env files, shell history or scripts. On failure, stop and report.
- **Ask before any large download or system-level install** (Android SDK/NDK, emulators, global tools), even if it is the obvious route to the user's goal. Explain the options and let the user choose. Project-level `npx expo install` / `npm install` of app dependencies is fine.
- **Ask before publishing or building in the cloud** (EAS Build/Submit/Update), since it needs the user's Expo account.
- **Never, without explicit user approval in the current conversation:** reboot, factory reset, power off, mobile data off, Wi-Fi off, SSID/password change, network mode/band/APN change, MAC block, sending SMS/USSD, deleting SMS, clearing statistics, changing the admin password, `adb install/uninstall` of other apps, changing phone settings.
- Never print tokens, cookies, IMEI, IMSI, phone numbers or SMS content in chat output or files. Summarize instead ("3 SMS found").
- Fixtures in `src/api/__fixtures__/` must be sanitized: replace IMEI/IMSI/ICCID/serial/MAC/phone numbers/SMS text with fake values.
- If a request would weaken a rule in §8, point that out and ask before doing it.

## 10. Build phases (from FEATURES.md)

1. **Phase 1 (MVP): built.** Project setup, theme tokens, security modules (§8.2–8.6), router detection, no-login dashboard, login/session, signal, devices (Wi-Fi + cable), mobile data toggle, reboot, app icon. Remaining: phone tests of logout, mobile data switch, reboot, remember password (each needs the user's go-ahead, §9).
2. **Release (pending user decision):** standalone APK with the icon via EAS Build or a local Android SDK build. Release signing: keystore **outside the repo**, wired with a config plugin (never hand-edit `android/`).
3. **Phase 2 (Router tab first):** Built and still to be run on the router or checked on the phone: change admin password, Wi-Fi settings + QR, device management + blocking, guest Wi-Fi, automatic restart, LTE band lock, antenna positioning mode, app lock. Done: speed chart, monthly usage, Router tab. Not started: data plan (owner doesn't need it for now), feature-flag hiding. Network mode is not applicable (this router is 4G only). **SMS/USSD dropped** (owner's choice, 2026-09-29).
4. **Phase 3:** APN, notifications, widget, languages, factory reset.

Security modules are built **first**, not added later.

## 11. Code conventions

- TypeScript strict; no `any` in `src/api` or `src/security`. Type every response in `types.ts`.
- Functional components + hooks; screens stay thin.
- Small files, named exports, `camelCase` functions, `PascalCase` components.
- Formatters in `utils/` (bytes → MB/GB with 1024, bps → Mbps, seconds → h:mm:ss, signal rating per DESIGN.md §3).
- Comments explain *why* (e.g. HiLink quirks), not *what*.

## 12. Testing

- Unit tests (Jest) with **mocked** router responses for: password hash, token rotation, request queue, XML escaping/parsing, error mapping, all validators, redaction, router address validation, fingerprint check, session timeout, lockout handling.
- Security tests are required for every function in `src/security/` and `src/api/xml.ts`/`validate.ts`.
- Manual check on the phone (Expo Go) before marking a feature ✅ in FEATURES.md.
- Current suites (`__tests__/` next to the code): `xml`, `crypto`, `validate`, `client`, `hosts`, `monitoring`, `device`, `rsa`, `password`, `secret`, `reveal`, `wifi`, `macfilter`, `routerSettings` (API); `redact`, `session`, `routerIdentity`, `rebootGate` (security); `format`, `chart`, `usage`, `wifiQr`, `devices`, `vendor`, `bands`, `antenna` (utils); `devicePrefs`, `appLock` (state). 200 tests.
- Jest mock factories may only reference variables whose names start with `mock` (e.g. `const mockGet = jest.fn()`).
- TypeScript 6 no longer auto-includes `@types/*`: `tsconfig.json` lists `"types": ["jest", "node"]`. Add new global type packages there.

## 12a. Known issues & open questions

- **Router public key across reboots:** stable between requests, not verified across reboot/firmware update. If it changes, users see the "not your router" warning and must re-trust.
- **Pre-login pin uses public data** (device name + RSA public key, readable by anyone on the LAN), so a determined attacker on the LAN can copy it. It stops accidental wrong routers and lazy look-alikes, not a targeted LAN attacker; on plain-HTTP HiLink, a LAN man-in-the-middle can always see the session. The post-login pin (serial + MAC) and the key check above limit the damage.
- **Open decisions (security review 2026-09-29):** saved password is not wiped on manual logout or on `108007` (§8.2/§8.3 say it should — owner to decide); login and change-password screens keep the typed password in screen state until the screen closes (§8.2 says no React state).
- **`npm audit`:** 13 moderate. 12 are Expo build tooling (`@expo/config-plugins` → `xcode` → `uuid`), not shipped. **One ships in the app:** `expo-router` → `query-string` → `decode-uri-component` (GHSA-vcc3-ghjq-m6fr, DoS on a crafted percent-encoded link). Low risk (a malicious `rapp://` link could freeze the app). Update Expo patch releases (`npx expo install --check`) and re-audit before release; don't run `npm audit fix --force`.
- **Signal is poor** at the router's current spot (RSRP ≈ −105 dBm), which makes antenna positioning mode (FEATURES 3.4) high-value.
- The admin password was shared in plain text early in the project; remind the user to change it (FEATURES 1.9 will make that possible in-app).

## 13. Git

- Remote: **https://github.com/DilshanRanabahu/R-App** (branch `main`). The repository is **public**.
- **Nothing personal in the repo:** no passwords, tokens, Wi-Fi name, adb serial, IMEI/IMSI, phone numbers, MACs, real device names or SMS text, in code, docs, tests or commit messages. Use placeholders (`<serial>`, "Galaxy-A06", "My-Laptop"). Scan the staged diff for these before every commit.
- `.gitignore` covers `node_modules/`, `.expo/`, `dist/`, `/android`, `/ios`, `*.keystore`, `*.jks`, `.env*`, `credentials.json`, `google-services.json`, `*.log`, `router-dumps/`, `*.router.xml`. Keep it that way.
- Commit and push only when the user asks. Work on a branch for bigger changes. **Do not add any Claude / AI co-author or "Generated with" lines** to commits or PRs; the owner is the only contributor.
- Never commit secrets or unsanitized router data. If one is committed by mistake, stop and tell the user (history must be cleaned and the password changed).

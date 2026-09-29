# DESIGN.md

Design guide for **R_app**. Goal: a **simple, clean, light** app that is easy to use with one hand. Not fancy: no gradients, no glass/blur effects, no heavy animations. Clear numbers, clear actions, calm colors.

## 1. Target device

Designed first for the owner's phone. Everything must look right here before anywhere else.

| Property | Value | Design impact |
|---|---|---|
| Phone | Samsung Galaxy A06 (SM-A065F), Android 16 | Entry-level CPU: keep UI light and fast |
| Screen | 720 × 1600 px, 300 dpi → **≈ 384 × 853 dp** | Narrow width: one-column layouts only |
| Font scale | 1.0 | Layout must still work at 1.3× (test it) |
| Navigation | 3-button bar, **48 dp** at bottom | Respect bottom safe area; don't put actions at the very bottom edge |
| System theme | Dark mode ON | App forces **light theme** (`userInterfaceStyle: "light"`), dark status bar icons |
| Display | LCD, 60 Hz | Light backgrounds read well; avoid pure-white glare with a soft grey page background |

**Usable height** ≈ 853 − status bar (~32) − tab bar (64) − nav bar (48) ≈ **710 dp**. The most important content on each screen must fit in the top ~600 dp without scrolling.

## 2. Principles

1. **Numbers first.** Speed, data, signal: big, readable, with units.
2. **One look = one answer.** Each card answers one question ("Is my internet OK?", "How much data used?").
3. **Color means something.** Color is used for status (good / warning / bad) and the primary action, not for decoration.
4. **Safe by default.** Dangerous actions are visually separated, red, and always confirmed.
5. **Thumb-friendly.** Main actions in the middle/lower half of the screen, touch targets ≥ 48 dp.
6. **Fast.** No blur, no big shadows, no animated backgrounds. Simple fades and slides only.

## 3. Colors (light theme)

Soft grey page, white cards, one blue accent.

### Base

| Token | Hex | Use |
|---|---|---|
| `background` | `#F5F7FA` | Page background |
| `surface` | `#FFFFFF` | Cards, sheets, tab bar |
| `surfaceMuted` | `#EEF1F5` | Input fields, segmented controls, skeletons |
| `border` | `#E3E7ED` | Card borders, dividers |
| `textPrimary` | `#1F2937` | Titles, main numbers |
| `textSecondary` | `#5B6472` | Labels, descriptions |
| `textMuted` | `#8A93A0` | Hints, units, timestamps (never for important text) |

### Accent & status

| Token | Main | Soft background | Use |
|---|---|---|---|
| `primary` | `#2F6FEB` | `#EAF1FE` | Buttons, active tab, links, toggles, download speed |
| `success` | `#1E9E5A` | `#E7F6EE` | Connected, good signal, data under limit |
| `warning` | `#D98A00` | `#FFF4DE` | Fair signal, data > 80 % of limit |
| `danger` | `#D93A3A` | `#FDECEC` | Disconnected, poor signal, reboot/reset, delete |
| `info` | `#7A5AF8` | `#F1EDFE` | Upload speed (to differ from download) |

Rules:
- Status is shown as **soft background + main-color text/icon** (a "chip"), never as big blocks of strong color.
- Never show status by color alone. Always add a word or icon ("Good", "Poor").
- `textMuted` on white is below 4.5:1 contrast. Use it only for units and non-essential hints.

### Signal quality colors

| Rating | Color | RSRP (dBm) | SINR (dB) | RSRQ (dB) |
|---|---|---|---|---|
| Excellent | `success` | ≥ −80 | ≥ 20 | ≥ −10 |
| Good | `success` | −80 to −90 | 13 to 20 | −10 to −15 |
| Fair | `warning` | −90 to −100 | 0 to 13 | −15 to −20 |
| Poor | `danger` | < −100 | < 0 | < −20 |

Overall rating = the **worse** of RSRP and SINR.

## 4. Typography

Use the **system font** (matches Samsung One UI; no custom font download). Numbers use `fontVariant: ['tabular-nums']` so live values don't jump.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 32 / 38 | 600 | Hero numbers (speed, data used) |
| `title` | 22 / 28 | 600 | Screen titles |
| `heading` | 17 / 24 | 600 | Card titles |
| `body` | 15 / 22 | 400 | Normal text, list items |
| `label` | 13 / 18 | 500 | Field labels, chips, tab labels |
| `caption` | 12 / 16 | 400 | Units, timestamps, hints (minimum size) |

- Units are smaller and muted next to the number: **12.4** `Mbps`.
- Sentence case everywhere ("Connected devices", not "CONNECTED DEVICES").
- Allow font scaling; cap hero numbers with `maxFontSizeMultiplier={1.3}` so they don't break layout.

## 5. Spacing, shape, elevation

- **4 dp grid:** 4, 8, 12, 16, 20, 24, 32.
- Screen side padding: **16 dp**. Space between cards: **12 dp**. Card inner padding: **16 dp**.
- Radius: cards **14**, buttons & inputs **10**, chips **999** (pill).
- Elevation: **no shadows**. Cards use `surface` + 1 dp `border`. (Clean look, cheap to render on the A06.)
- Dividers: 1 dp `border`, inset 16 dp in lists.

## 6. Icons

- `@expo/vector-icons`, **Ionicons outline** style, 24 dp (20 dp inside chips/lists).
- Active tab icon: filled variant + `primary`. Inactive: outline + `textMuted`.
- Icons always sit next to a text label, except the header refresh/back buttons (which get `accessibilityLabel`).

## 7. Components

| Component | Spec |
|---|---|
| **Card** | `surface`, 1 dp border, radius 14, padding 16. Optional header row: title (`heading`) + right-side action/chip. |
| **Stat** | Label (`label`, `textSecondary`) above value (`display` or `heading`) + unit (`caption`, `textMuted`). |
| **Status chip** | Pill, soft background + main color text, 13 dp label, optional 8 dp dot. e.g. ● Connected |
| **Primary button** | `primary` fill, white text, height 48, radius 10, full width in forms. |
| **Secondary button** | `primaryBg` (soft) fill, `primary` text, height 48. |
| **Danger button** | White fill, `danger` text + 1 dp `danger` border. Filled red only inside the confirm dialog. |
| **List row** | Min height 56, icon (left, 24 dp) + title/subtitle + right value or chevron. Whole row is tappable. |
| **Toggle row** | List row with native `Switch` (track `primary` when on). Shows "Updating…" and disables while the request runs. |
| **Progress bar** | Height 8, radius 4, track `surfaceMuted`, fill by status color (usage < 80 % `primary`, 80–100 % `warning`, > 100 % `danger`). |
| **Signal bars** | 4 bars, filled count and color by rating; grey bars for the rest. |
| **Input** | Height 48, `surfaceMuted` fill, radius 10, label above, error text below in `danger`. Password field has show/hide eye. |
| **Confirm dialog** | Centered modal, white, radius 16. Title, one sentence of consequence, `Cancel` (secondary) + action button (red for dangerous). |
| **Snackbar** | Dark `#1F2937` bar with white text, above the tab bar, auto-hide 3 s. Used for "Saved", "Message sent", errors with "Retry". |
| **Empty state** | Icon 48 dp `textMuted`, one line of text, optional button. |
| **Skeleton** | `surfaceMuted` blocks in the shape of the content while loading (no spinners on cards). |

## 8. Navigation

Bottom tab bar (height 64, white, top border), **5 tabs**:

| Tab | Icon | Content |
|---|---|---|
| Home | `home` | Connection, speed + chart, data used (owner's choice: no signal / device / mobile-data cards) |
| Signal | `cellular` | Signal details, antenna mode |
| Devices | `phone-portrait` | Connected devices |
| Router | `hardware-chip` | Everything that changes the router: status, mobile data, reboot; next Wi-Fi, admin password, data plan, auto reboot, blocked devices |
| Settings | `settings` | The app only: account (log in/out), router address, version; later app lock |

- The **Messages** tab (SMS + USSD) was dropped on 2026-09-29 (owner's choice) and replaced by **Router**.
- Header: screen title (`title`) left, optional icon button right. No back button on tab roots.
- Sub-screens (e.g. Wi-Fi settings) push with a normal header + back arrow.
- Login opens as a full-screen modal.

## 9. Screens

Wireframes are at 384 dp width.

### 9.1 Home

```
┌──────────────────────────────────────┐
│ My Router                    ● Online│  title + status chip
│ HUTCH · 4G                           │  caption
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ↓ Download          ↑ Upload     │ │  Speed card
│ │ 12.4 Mbps           1.8 Mbps     │ │  display numbers
│ │ ▁▂▃▅▆▅▃▂▃▅▆▇ (last 60 s)         │ │  small line chart
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Data this month          42.1 GB │ │  Data card
│ │ ██████████████░░░░░░  of 60 GB   │ │  progress bar
│ │ Session 1.2 GB · 13 min          │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Signal   ▂▄▆█  Good          ›   │ │  tap → Signal tab
│ │ RSRP −86 dBm · SINR 15 dB        │ │
│ └──────────────────────────────────┘ │
│ ┌────────────────┐┌────────────────┐ │
│ │ Mobile data [●]││ 3 devices    › │ │  quick actions
│ └────────────────┘└────────────────┘ │
├──────────────────────────────────────┤
│  Home  Signal  Devices  Router  ⚙    │
└──────────────────────────────────────┘
```

- The wireframe above was the original plan. The owner chose a simpler Home: **no Log in button, no signal card, no quick actions**. Signal and Devices have their own tabs; the mobile data switch lives in Settings → Data. Home works fully without login.
- Pull to refresh.
- **Phase 1 as built:** status chip (Online / Offline / Checking), subtitle "HUTCH · 4G" (adds "SIM not ready" if needed), speed card with a **live chart of the last 60 s** (download blue line + soft fill, upload purple line, dot on the newest point; legend "● Download ● Upload"; speed axis on the left with the unit once on top ("Mbps"/"kbps") and values 0 / half / max on rounded 1-2-5 steps; time axis "60 s ago · 30 s ago · Now"; built from the 3 s traffic polling, memory only), **"Data used" card shows this session with a ↓ / ↑ split (blue / purple arrows, like the chart) + connection time + lifetime total**, then a **"Monthly usage" card**: "Today" and "This month" side by side, a note top-right ("Resets on the 1st", or "Since 26 Sep" when the router's counters were cleared after the month began), and either the plan progress bar with "93 % of your 60 GB plan · almost used up" (colour + words per §7) or "No monthly data plan is set on the router." Under the chart: **Top / Average** for the last minute in two columns aligned with Download / Upload. Nothing else: no Log in button, signal card or quick actions (log in from Settings, Signal or Devices).

### 9.2 Signal

```
┌──────────────────────────────────────┐
│ Signal                               │
│ ┌──────────────────────────────────┐ │
│ │        ▂▄▆█                      │ │
│ │        Good                      │ │  big rating, colored
│ │  Your 4G signal is good.         │ │  plain-language sentence
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ RSRP   −86 dBm   ███████░░ Good  │ │  each metric: value +
│ │ SINR   15 dB     ██████░░░ Good  │ │  mini bar + rating
│ │ RSRQ   −11 dB    ██████░░░ Good  │ │
│ │ RSSI   −61 dBm                   │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Band B3 · PCI 214 · Cell 1234567 │ │  caption, collapsible
│ └──────────────────────────────────┘ │
│ [   Find best router position    ]   │  secondary button (Phase 2)
│ ⓘ What do these numbers mean?        │  help text
└──────────────────────────────────────┘
```

- **Phase 1 as built:** rating card, metrics card (RSRP, SINR, RSRQ with bar + rating; RSSI value only), cell info line, and "What do these numbers mean?" as a plain card. No antenna-mode button yet.

**Antenna mode** (Phase 2, full screen): one huge SINR/RSRP value + rating color background band (soft color only), updates every 1 s, optional beep/vibration on change, "Best so far: −82 dBm" line. Keep screen awake while open.

### 9.3 Devices

```
┌──────────────────────────────────────┐
│ Devices                     2 online │
│ ┌──────────────────────────────────┐ │
│ │ 📱 Galaxy-A06       [This phone] │ │  "This phone" chip, listed first
│ │    192.168.8.100 · Wi-Fi · 1 h 9 min │
│ ├──────────────────────────────────┤ │
│ │ 🖥 My-Laptop                      │ │  desktop icon = cable
│ │    192.168.8.102 · Cable · 38 min │ │
│ └──────────────────────────────────┘ │
│ Shows Wi-Fi and cable devices. …     │  caption
└──────────────────────────────────────┘
```

- Icons: `phone-portrait-outline` for this phone, `desktop-outline` for cable devices, `wifi-outline` for other Wi-Fi devices.
- Subtitle: IP · connection type (Wi-Fi / Cable) · connected time (omitted when the router doesn't report it).
- Sort: this phone first, then longest connected.
- Device detail (Phase 2): nickname (editable), IP, MAC, connected time, **Block device** (danger button, disabled for "this phone" with explanation). Rows get a chevron once details exist.

### 9.4 Router

Replaces the planned Messages tab. Grouped list like Settings (shared `ListGroup` component).

```
Router
┌──────────────────────────────────────┐
│ HUAWEI 4G Router 2s        ● Online  │  heading + status chip (same as Home)
│ B312-926                             │  caption
│ Running for 3 d 4 h · Firmware 11.x  │  caption, logged in only
└──────────────────────────────────────┘
Wi-Fi
  Wi-Fi name & password          ›      → Wi-Fi screen
Internet
  Mobile data                  [●]      subtitle "Updating…" / "Off · no internet for any device"
Security
  Change admin password          ›      → change-password screen
Danger zone                             red group title
  Reboot router
```

- Logged out: status card + one card "Log in to manage your router: mobile data, reboot and more." with a Log in button.
- **Change admin password** (sub-screen, back arrow + title, screenshot-blocked): Current / New (strength hint Weak · Medium · Strong + rules caption) / Confirm; "Change password" → dialog "Change admin password? You'll be logged out and must log in with the new password. If you forget it, the router has to be reset." → fingerprint/PIN → on success snackbar "Password changed. Log in with your new password." and the login screen opens (router ends the session; a saved password is forgotten). Wrong current password → inline "Current password is incorrect."; too many wrong tries (108008) → logged out.
- **Wi-Fi screen** (sub-screen, screenshot-blocked): card "Your Wi-Fi" (Name, Security, Visible to others, Password `••••••••`) + **Show password** (fingerprint/PIN each time the screen opens); card "Share with guests" + **Show QR code** (fingerprint/PIN; dark-on-white QR, 232 dp); card "Change Wi-Fi": name, new password (empty = keep), confirm (appears when typing), "Hide network" switch, **Save changes** → dialog "Change Wi-Fi? Your phone will disconnect. Reconnect using the new password." → fingerprint/PIN. Caption: saving restarts Wi-Fi; cable devices stay connected. If the phone drops before the answer: snackbar "Your phone lost the Wi-Fi. The change was probably saved: reconnect with the new details."
- **Next (planned):** Internet (monthly data plan, network mode), Security (blocked devices), Maintenance (automatic reboot, reboot router).

### 9.5 Settings

Grouped list (group title in `label` + `textSecondary`). **As built:** only the app itself: Account (Log in / Log out, Forget saved password), App (Router address read-only, Version). Router controls moved to the Router tab (§9.4). The target layout below is kept for reference; its Wi-Fi / Data / Network / Router / Danger zone groups now belong in the Router tab:

```
Wi-Fi
  Wi-Fi name & password         ›
  Share Wi-Fi (QR code)         ›
Data
  Monthly data plan             ›
  Mobile data                 [●]
Network
  Network mode           Auto   ›
Router
  Device information            ›
  Change admin password         ›
App
  Refresh speed          5 s    ›
  Router address   192.168.8.1  ›
  Log out
Danger zone                         ← separated group, red text
  Reboot router
  Factory reset
```

### 9.6 Login

- Full-screen modal with a close (✕) button top-right. **Screenshots and the recents preview are blocked** on this screen.
- Brand block: 64 dp rounded tile (`primaryBg`) with a blue Wi-Fi icon, "R App" title, "Log in to your router" subtitle.
- Card with: Username (prefilled `admin`, or the remembered username), Password with show/hide eye, **Remember password** switch (off by default) with the caption "Saved encrypted. Unlock with your fingerprint or PIN." The switch is disabled with "Set a screen lock on your phone to use this." when the phone has no screen lock.
- Primary **Log in** button ("Logging in…" with spinner while busy). If a password is saved: secondary **Use saved password** button with a fingerprint icon.
- Errors inline under the password field: "Wrong username or password." / "Too many attempts. Try again in 58 s" (live countdown, buttons disabled).
- **Router identity warning** replaces the form: red title "This doesn't look like your router", explanation that the password was not sent, **Cancel** (secondary) and **Trust new router** (danger outline, requires fingerprint/PIN).

## 10. States

Every screen and card handles these; design them, don't leave blank screens.

| State | Look |
|---|---|
| Loading (first time) | Skeleton blocks |
| Refreshing | Pull-to-refresh spinner only; keep old data visible |
| Not on router Wi-Fi | Full screen: Wi-Fi-off icon, "Can't reach your router", "Connect your phone to your router's Wi-Fi and try again.", Retry button |
| Login required | Card-level message + Log in button (don't block the whole app) |
| Account locked | Countdown in login screen |
| Action in progress | Button shows small spinner + "Rebooting…", disabled |
| Error | Snackbar with short message + Retry; technical code only in a "Details" line |
| Empty | Empty state component ("No messages", "No devices connected") |
| Stale data | If last update > 30 s: small `textMuted` "Updated 45 s ago" under the header (not built yet) |
| Session ended | Snackbar "Your session ended. Please log in again." and cards return to their login-required state |

## 11. Dangerous actions

| Action | Confirmation |
|---|---|
| Reboot | Dialog: "Reboot router? Internet will be off for about 1–2 minutes." → **Reboot** → fingerprint/PIN |
| Mobile data off | Dialog: "Turn off mobile data? All devices will lose internet until you turn it back on." (turning on needs no dialog) |
| Change Wi-Fi name/password | Dialog: "Your phone will disconnect. Reconnect using the new password." |
| Block device | Dialog with device name |
| Send SMS / USSD | (dropped with the Messages tab) Dialog showing number/code (may cost money) |
| Factory reset | Two steps: dialog, then type `RESET` to enable the button |

If the phone has no screen lock, actions that need fingerprint/PIN are blocked with a snackbar asking the user to set one.

After reboot: full-screen waiting screen ("Rebooting your router…", spinner). It checks the router every 5 s after 20 s, then shows "Router is back online · Log in again to manage your router." with **Done**, or after 4 min "Taking longer than usual". The router session ends on reboot, so the user logs in again.

## 12. Motion & feedback

- Screen transitions: platform default.
- Value changes: no counting animations; just update the number.
- Toggles and buttons: native ripple (`android_ripple`) for touch feedback.
- Light haptic on successful toggle / action; no haptics on every refresh.
- Durations ≤ 200 ms. Respect "Remove animations" system setting.

## 13. Accessibility

- Touch targets ≥ 48 × 48 dp.
- Contrast: body text ≥ 4.5:1 on its background (`textPrimary`, `textSecondary` pass on white and `background`).
- Every icon-only button has `accessibilityLabel`.
- Signal/status readable by screen reader: e.g. "Signal good, RSRP minus 86 dBm".
- Test with font scale 1.3 and display size increased once per release.

## 14. Writing style

- Plain English, short: "Mobile data is off", not "Dial-up connection disabled".
- Explain technical terms once in help sheets (RSRP, SINR, USSD).
- Units always shown: `Mbps`, `GB`, `dBm`, `dB`.
- Speeds in **Mbps** (bits); below 1 Mbps show **kbps** so small values stay readable. Data amounts in **MB/GB** (bytes, 1 GB = 1024 MB to match the router UI); values ≥ 100 show no decimals ("177 MB"), smaller ones one decimal ("1.5 KB").
- Plural-aware counts: "1 device", "2 devices".

## 15. Implementation notes

- Tokens live in `src/theme/` (`colors.ts`, `typography.ts`, `spacing.ts`); components and screens use only tokens, no raw hex values.
- `app.json`: `"userInterfaceStyle": "light"`, `backgroundColor #F5F7FA`; `expo-status-bar` with `style="dark"`.
- `react-native-safe-area-context` for status/nav bar insets; the tab bar height is 64 dp + bottom inset.
- Components built (`src/components/`): `AppText` (variants, `numeric` = tabular digits, hero numbers capped at 1.3× font scale), `Card`, `StatusChip`, `Button` (primary / secondary / danger / dangerFilled, loading), `ListRow`, `ListGroup` (titled group of rows, used by Router + Settings), `SignalBars`, `SpeedChart` (SVG, monotone curve so it never dips below zero), `ProgressBar`, `Input` (label, error, secret with eye), `ConfirmDialog`, `EmptyState`, `LoginRequired`, `Skeleton`, `Screen` (title header + pull-to-refresh), `SubScreen` (back arrow + title for pushed screens), `QrCode` (one SVG path). Snackbar is in `src/state/SnackbarProvider.tsx`.
- Signal bars use heights 40 / 60 / 80 / 100 % so even one bar reads as a bar.
- Charts (Phase 2): one lightweight SVG line (`react-native-svg`), no chart library with heavy animations.
- Keep a dark theme possible later by reading colors from the theme object, but **ship light only** for now.
- In Expo Go a grey gear button floats at the top right: that's Expo's developer menu, not part of the app.

## 16. App icon

- Glyph: a **router with two antennas and a Wi-Fi signal** above it, in `primary` `#2F6FEB`; status lights cut out in the background color.
- Background: `primaryBg` `#EAF1FE` (soft light blue), matching the light theme.
- Files in `assets/`, generated by `python scripts/make-icons.py`:
  - `android-icon-foreground.png`: glyph on transparent, inside the adaptive-icon safe zone
  - `android-icon-background.png`: solid `#EAF1FE`
  - `android-icon-monochrome.png`: white glyph for Android themed icons
  - `icon.png`: full-square icon, larger glyph
  - `splash-icon.png`, `favicon.png`
- To change the icon, edit the script (colors come from DESIGN.md) and re-run it. The icon only appears in a standalone build; Expo Go shows its own icon.

## 17. Implementation status

| Screen / part | Status |
|---|---|
| Theme tokens, components | ✅ Built |
| Home (9.1) | ✅ Built incl. speed chart; monthly data card in Phase 2 |
| Signal (9.2) | ✅ Built; antenna mode in Phase 2 |
| Devices (9.3) | ✅ Built (Wi-Fi + cable); detail screen in Phase 2 |
| Router (9.4) | ✅ Status card, mobile data, reboot; more groups in Phase 2 |
| Settings (9.5) | ✅ App only (account, router address, version) |
| Login (9.6) | ✅ Built, screenshot-blocked |
| States (10) | ✅ Built except "stale data" line |
| Dangerous actions (11) | 🔨 Reboot + mobile data off built; others in Phase 2 |
| App icon (16) | ✅ Generated; visible after standalone build |

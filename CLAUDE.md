# HWS Log Tally — Project Context for Claude Code

## What This Is
A mobile-first PWA for tallying logs at a lumber yard. Built for Halfen Wood Specialties (HWS), a wood brokering business. Used in the field on iPhone by Jorge (JD), Claudia, and Kurt.

**Live app:** https://jdorantes.github.io/hws-log-tally  
**Repo:** https://github.com/jdorantes/hws-log-tally  
**Stack:** Vanilla JS, GitHub Pages, Google Sheets/Drive API, OAuth 2.0, PWA with service worker  
**No build step.** Files are edited and pushed directly. GitHub Pages deploys ~60s after push.

---

## File Structure

```
hws-log-tally/
├── index.html          Main app shell, bottom nav, modals
├── sw.js               Service worker (cache-first, bump CACHE_NAME version on deploy)
├── css/
│   └── style.css       Forest theme — all styles here, ~210 lines + appended additions
└── js/
    ├── config.js       Google credentials (CLIENT_ID, SHARED_FOLDER_ID, COLLABORATORS)
    ├── app.js          Core app logic, state management, render functions
    ├── keypad.js       Keypad UI module (self-contained, renders into #panel-keypad)
    └── sheets.js       Google Sheets + Drive API, OAuth, offline queue
```

---

## Architecture

### State (`app.js`)
```js
let state = {
  tallyName: '',        // name of the load / spreadsheet
  scale: null,          // 'doyle' | 'scribner' | 'both'
  nextTag: null,        // next tag number/string
  currentSeries: 0,     // increments on each new series
  logs: [],             // array of log entries
  spreadsheetId: null   // Google Sheets ID once created
};
```
State is persisted to `localStorage` under key `logTally_v3`.

### Modes
- `keypad` — the only entry mode: full-screen keypad, slim header, no sync bar
- `browse` — viewing Logs/Summary/Export tabs, full header

Voice/speech input was removed (`speech.js` and the voice entry panel are gone). `enterEntryMode()` switches into keypad mode. `navTo(name)` handles bottom nav taps.

### Key Functions
- `calcBF(length, diam, scale)` → `{doyle, scribner}` — Doyle: `((D-4)²×L)/16`, Scribner: `(0.79D²-2D-4)×L/16`
- `primaryBF(bf)` → single BF value (doyle ?? scribner)
- `bfToM3(bf)` → `Math.round(bf * 0.002360 * 1000) / 1000`
- `parseField(val)` → `{raw, phys, cut, hasCutback}` — handles slash notation e.g. `20/18`
- `saveLogFromKeypad(len, dia)` → saves log, increments tag, triggers Sheets sync
- `syncAfterSave(log)` → creates spreadsheet if needed, calls `Sheets.syncLog`
- `updateHeader()` → updates all header UI + calls `Keypad.render()` if in keypad mode
- `navTo(name)` → switches mode + tab, exposed on `window`

### Keypad Module (`keypad.js`)
Self-contained IIFE. Renders everything into `#panel-keypad` via `innerHTML`.

**Critical:** `render()` has a `_rendering` guard to prevent re-entrant renders (was causing double tag increments). `setupLongPress` uses `el._longPressSet` flag to prevent duplicate listeners stacking up on re-renders.

`next()` snapshots values into local variables before clearing, so saves can't race with re-renders.

Exposed on `window`: `Keypad.render()`, `Keypad.reset()`, `Keypad.openTagModal()`, etc.

### Google Sheets (`sheets.js`)
- Scope: `drive.file` only (not full spreadsheets — narrowed for consent screen)
- `Sheets` module is exposed on `window.Sheets` (important — keypad reads `window.Sheets.isSignedIn()`)
- `waitForGoogle(cb)` polls 250ms × 20 for GIS to load before `initTokenClient`
- Spreadsheets created in shared Drive folder → `HWS Tallies/{year}/` subfolders
- Offline queue in `localStorage` under `logTally_syncQueue`, flushes on reconnect
- Toast fires on successful sync: "☁ Saved to Sheets"

**Google Cloud setup (already done):**
- Project: HWS Tallies
- Client ID: `670754488072-he7b7lifb47tlb1keen6v1tnlkoiil7f.apps.googleusercontent.com`
- Authorized JS origin: `https://jdorantes.github.io`
- Shared Drive folder ID: `18JCXP6V0OLNfXLQGXQo6hkV7AHjIWZ4_` (in config.js)
- Test users: jdorantes@gmail.com + Claudia + Kurt

---

## UI Layout (Keypad Mode — the only entry mode)

```
[HWS · LOG TALLY]  [Scale]  [Tally Name ↗]   ← slim header (no stats, no sync bar)
──────────────────────────────────────────────
[LOGS: 12] [BF: 4.2k] [m³: 9.9] [☁ SYNCED]  ← stats strip (4 cols if Sheets configured)
[TAG: CW00042]  [＋]  [SKIP]                  ← tag row
[LENGTH: 20/18]        [DIAMETER: 14]         ← field display with CLR button
[Doyle BF: 231]                               ← live BF preview
[7][8][9][DEL]
[4][5][6][/  ]
[1][2][3][→  ]
[  0  ][NEXT ]                                ← keypad

[Entry] [Logs] [Summary] [Export]             ← bottom nav (persistent, all modes)
```

Browsing Logs/Summary/Export switches to the full header (stats + sync bar visible).

---

## CSS — Forest Theme

```css
/* CSS Variables */
--pine-darkest: #060d08    --canopy: #6dc97a
--pine-dark: #0d1f11       --leaf: #96e0a0
--pine-mid: #132a17        --amber: #f0c040
--pine-surface: #1a3620    --red: #d64040
--pine-border: #244d2c     --font-ui: 'Inter'
--moss: #2d6b38            --font-mono: 'JetBrains Mono'
--moss-bright: #4fa85a
--r-sm: 6px  --r-md: 10px  --r-lg: 14px  --r-xl: 18px
```

Key classes: `.kp-wrapper`, `.kp-stats-strip`, `.kp-tag-row`, `.kp-field`, `.kp-field-active`, `.kp-clr-btn`, `.kp-pad`, `.kp-key`, `.kp-key-next`, `.kp-key-advance`, `.kp-key-slash`, `.kp-key-func`, `.kp-key-zero`, `.log-m3`, `.bottom-nav`, `.nav-btn`, `.nav-active`

---

## Service Worker

`sw.js` — cache-first strategy. **Bump `CACHE_NAME` version (e.g. `log-tally-v3` → `v4`) with every deploy** so iOS picks up new files automatically. Google API calls always bypass cache.

Current version: `log-tally-v3`

---

## Formulas

**Doyle:** `Math.round(((D - 4) ** 2 * L) / 16)`  
**Scribner:** `Math.round((0.79 * D**2 - 2*D - 4) * L / 16)`  
**m³ from BF:** `Math.round(BF * 0.002360 * 1000) / 1000`

Where L = length (cutback value if slash notation), D = diameter (cutback value).

---

## Logs Data Shape

```js
{
  id: Date.now(),
  tag: 'CW00042',         // current tag value
  series: 2,              // series counter (increments on new series)
  scale: 'doyle',         // scale used for this log
  length: '20/18',        // raw input string
  diameter: '14',         // raw input string
  lengthCut: 18,          // cutback value (parsed)
  diameterCut: 14,        // cutback value (parsed)
  bf: { doyle: 231 },     // board feet object
  rowNum: 42              // 1-based index in this tally
}
```

Logs render chronologically (first at top, newest at bottom). Tap a log to edit/delete.

---

## Tally → Spreadsheet Flow

1. User sets tally name → `confirmTallyName()` → if signed in + no sheet yet → `Sheets.createSpreadsheet(name, scale)`
2. Sheet created in Drive folder `18JCXP6V0OLNfXLQGXQo6hkV7AHjIWZ4_` → year subfolder
3. `state.spreadsheetId` saved to localStorage
4. Each log save → `syncAfterSave(log)` → `Sheets.syncLog(id, [log])`
5. If offline → enqueued in localStorage → flushed on reconnect
6. Tally name in header becomes hyperlink to Sheet once `spreadsheetId` exists

---

## Known Gotchas

- `Sheets` must be on `window.Sheets` — keypad.js reads it that way. The last line of `sheets.js` is `window.Sheets = Sheets;`
- `Keypad.render()` has a `_rendering` guard — don't call it from inside a save path without being aware of this
- `setupLongPress` uses `el._longPressSet` to prevent stacking listeners on re-renders
- `updateHeader()` calls `Keypad.render()` at the end if `currentMode === 'keypad'` — be careful not to create render loops
- Service worker path `/sw.js` is registered at root — works because GitHub Pages serves from root for this repo
- The `panel-keypad` div is rendered by `Keypad.render()` not in static HTML — modals injected by keypad (`kpTagModal`) are inside that div
- Keypad uses `id="kpTagVal"` for the tag value display, updated inside `Keypad.render()`

---

## Deployment

```bash
git add -A
git commit -m "your message"
git push origin main
# GitHub Pages deploys in ~60 seconds
# Bump CACHE_NAME in sw.js to force iOS cache refresh
```

No build step, no npm, no bundler. Pure vanilla JS.

---

## What's Working
- Keypad entry with live BF preview
- Alphanumeric tag series with prefix support (e.g. CW00042)
- Slash notation for cutbacks (e.g. 20/18)
- Doyle / Scribner / Both scale modes
- Google Sheets sync with offline queue
- OAuth sign-in (drive.file scope only)
- Tally name as hyperlink to Google Sheet
- iOS native share sheet for sheet link
- Bottom nav (Entry / Logs / Summary / Export)
- m³ column in Logs and Summary views
- Service worker for offline use
- CSV and JSON export

## Current State / Recent Fixes
- Fixed duplicate event listeners on kpTagVal causing phantom tag skips
- Fixed render guard (_rendering flag) preventing double saves
- Fixed Sheets not on window (was module-scoped, now window.Sheets = Sheets)
- Service worker bumped to v3 to force iOS cache refresh
- Stats strip order: Logs / BF / m³ / ☁ (sign-in)
- Removed Voice/speech input mode — Keypad is now the only entry mode (speech.js deleted, voice entry panel and mode toggle removed from index.html)

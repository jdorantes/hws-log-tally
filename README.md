# Log Tally

A mobile-first web app for tallying logs at the yard. Supports keypad and speech-to-text entry, Doyle and Scribner board foot formulas, cutback values on all fields, alphanumeric tag sequences, and direct Google Sheets sync with offline queuing.

---

## Project Structure

```
log-tally/
├── index.html              Main app
├── css/
│   └── style.css           All styles
├── js/
│   ├── app.js              Core logic, state, UI
│   ├── keypad.js           Full-screen keypad input module
│   ├── speech.js           Speech recognition + parser
│   ├── sheets.js           Google Sheets API + offline queue
│   ├── config.js           YOUR credentials (not in git)
│   └── config.template.js  Template — copy to config.js
├── .gitignore
└── README.md
```

---

## Step 1 — Upload to GitHub

1. Go to [github.com](https://github.com) and sign in (or create a free account)
2. Click **+** → **New repository**
3. Name it `log-tally`, set to **Public**, click **Create repository**
4. On the next screen click **uploading an existing file**
5. Drag the contents of the `log-tally` folder into the upload area (not the folder itself):
   - `index.html`
   - `css/style.css`
   - `js/app.js`
   - `js/keypad.js`
   - `js/speech.js`
   - `js/sheets.js`
   - `js/config.template.js`
   - `.gitignore`
   - `README.md`
   - **Do NOT upload `js/config.js`** — this stays on your computer only
6. Click **Commit changes**

> **Tip:** To see hidden files like `.gitignore` in Finder, press **Cmd + Shift + .** to toggle visibility.

---

## Step 2 — Enable GitHub Pages

1. In your repository go to **Settings** → **Pages**
2. Under Source select **Deploy from a branch**
3. Select branch: **main**, folder: **/ (root)**
4. Click **Save**
5. Wait ~60 seconds then visit: `https://yourusername.github.io/log-tally`

---

## Step 3 — Set Up Google Sheets API

This lets the app create and write to Google Sheets directly.

### 3a. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name it `log-tally`, click **Create**

> If you already have a Google Cloud project from another app, you can reuse it — just enable the Sheets and Drive APIs and add your GitHub Pages URL as an authorized origin.

### 3b. Enable APIs

1. Go to **APIs & Services** → **Enable APIs and Services**
2. Search for and enable **Google Sheets API**
3. Search for and enable **Google Drive API**

### 3c. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the consent screen first:
   - User Type: **External**
   - App name: `Log Tally`
   - Add your email as test user
   - Save and continue through all steps
4. Back in Credentials → Create OAuth client ID:
   - Application type: **Web application**
   - Name: `Log Tally`
   - Under **Authorized JavaScript origins** add:
     - `https://yourusername.github.io`
   - Click **Create**
5. Copy the **Client ID** (looks like `123456789-abc...apps.googleusercontent.com`)

### 3d. Add Your Client ID to the App

1. On your computer, open `js/config.js`
2. Replace `YOUR_CLIENT_ID_HERE` with your actual Client ID:
   ```js
   GOOGLE_CLIENT_ID: '123456789-abc...apps.googleusercontent.com',
   ```
3. Optionally add collaborator emails (they get editor access on every new spreadsheet):
   ```js
   COLLABORATORS: ['wife@gmail.com', 'fatherinlaw@gmail.com'],
   ```
4. Upload the updated `js/config.js` to GitHub:
   - Go to your repository → `js/` folder → **Add file** → **Upload files**
   - Upload `config.js`

---

## Step 4 — Add to iPhone Home Screen

1. Open `https://yourusername.github.io/log-tally` in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app now opens full-screen from your home screen and works offline.

---

## Updating Files on GitHub

You never need to re-upload the whole project. To edit a single file:

1. Go to your repo on github.com
2. Click into the file (e.g. `js/app.js`)
3. Click the **pencil icon** (Edit this file)
4. Make your changes and click **Commit changes**

Changes go live on GitHub Pages within ~60 seconds.

**Pro tip:** Press the `.` key anywhere in your repo to open a full VS Code-style browser editor for multi-file editing.

---

## Using the App

### First time each load
1. Tap the **scale badge** (top right of header) → choose Doyle, Scribner, or Both
2. Tap **TAP TO NAME** → enter the load name/number
3. Set your starting tag — tap **New Series** in voice mode, or long-press the tag number in keypad mode
4. Sign in to Google Sheets via the sync bar (optional — skip if offline)

---

## Input Modes

Toggle between **Voice** and **Keypad** using the mode switcher at the top of the Entry tab.

### Keypad Mode

Designed for outdoor use — large keys readable in sunlight, easy to tap with gloves.

**Layout:**
- Top quarter shows current tag, active field values, and live board feet estimate
- Large number pad fills the rest of the screen
- `／` key inserts a cutback slash (e.g. `20/18`)
- `→` advances to the next field; on the Diameter field it saves the log
- `NEXT` saves from anywhere
- `DEL` backspaces one character
- **Auto-advance toggle** — when on, focus jumps to Diameter automatically after you tap `→` on Length

**Tag entry in keypad mode:**
- Long-press the tag number to open the series modal
- Select letter prefix using the A-Z grid (supports any number of letters, e.g. `CW`, `A`, `TBR`)
- Enter the starting number — the app auto-increments the numeric part on each save
- Tags are alphanumeric: e.g. `CW00042`, `A72301`

### Voice Mode

Tap the mic and speak. The app stays in listening mode until it hears a final result.

**Voice commands:**
| Say | Action |
|-----|--------|
| `"twenty slash eighteen, fourteen"` | Length 20/18, diameter 14 |
| `"save"` or `"next"` | Save current log and advance tag |
| `"skip"` | Skip tag number |
| `"tally name Coldwater 633"` | Set load name |
| `"new series 72400"` | Start new tag sequence |

**Cutback shortcuts:** "slash", "over", and "by" all work as the cutback separator.

---

## Scale Selection

Tap the scale badge in the header to choose the board foot formula for the current tally.

| Scale | Formula | Typical use |
|-------|---------|-------------|
| **Doyle** | `((D−4)² × L) / 16` | Common for softwoods |
| **Scribner** | `(0.79D² − 2D − 4) × L / 16` | Common for hardwoods |
| **Both** | Both columns shown | For customers requiring dual-formula reporting |

Where D = diameter cutback (inches), L = length cutback (feet). Results round to nearest whole number (.5 rounds up).

All fields support cutback notation — enter `20/18` for physical 20, cutback 18. Board feet always calculated from cutback values.

---

## Google Sheets Sync

- When signed in and online, each log syncs to Google Sheets immediately on save
- When offline or out of signal, logs queue locally and sync automatically when connection returns
- The sync bar shows how many entries are pending upload
- Each tally creates a new spreadsheet named after the load
- Spreadsheet is automatically shared with any emails listed in `COLLABORATORS`

---

## Summary Tab

Live breakdown of log counts and board feet by diameter range, updated as you enter logs. Shows separate Doyle and Scribner columns when Both scale is selected.

---

## End of Load

1. Check **Summary** tab for totals
2. Google Sheets is already up to date if you had signal during entry
3. **Export** tab → CSV for manual Google Sheets import, or JSON backup to restore later
4. **Clear All Data** starts fresh for next load — always prompts to export a backup first

---

## Formulas

**Doyle:** `Math.round(((D - 4)² × L) / 16)`

**Scribner:** `Math.round((0.79 × D² - 2D - 4) × L / 16)`

Where D = diameter cutback (inches), L = length cutback (feet). Standard rounding: .1–.4 rounds down, .5–.9 rounds up.

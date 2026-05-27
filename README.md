# Log Tally

A mobile-first web app for tallying logs at the yard. Supports speech-to-text entry, Doyle and Scribner board foot formulas, cutback values, and direct Google Sheets sync with offline queuing.

---

## Project Structure

```
log-tally/
├── index.html              Main app
├── css/
│   └── style.css           All styles
├── js/
│   ├── app.js              Core logic, state, UI
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
5. Drag the entire `log-tally` folder contents into the upload area:
   - `index.html`
   - `css/style.css`
   - `js/app.js`
   - `js/speech.js`
   - `js/sheets.js`
   - `js/config.template.js`
   - `.gitignore`
   - `README.md`
   - **Do NOT upload `js/config.js`** — this stays on your computer only
6. Click **Commit changes**

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
3. Optionally add collaborator emails:
   ```js
   COLLABORATORS: ['wife@gmail.com', 'fatherinlaw@gmail.com'],
   ```
4. Upload the updated `js/config.js` to GitHub
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

## Using the App

### First time each load
1. Tap the **scale badge** (top right) → choose Doyle, Scribner, or Both
2. Tap **TAP TO NAME** → enter the load name/number
3. Tap **New Series** → enter starting tag number
4. Sign in to Google Sheets via the sync bar (optional, can skip if offline)

### Entering logs
- Type length and diameter in the fields, or tap the mic and speak
- Use slash for cutbacks: `10/9` means physical 10, cutback 9
- Board feet calculates live using cutback values
- Tap **SAVE LOG** or say **"save"**

### Voice commands
| Say | Action |
|-----|--------|
| `"twenty slash eighteen, fourteen"` | Length 20/18, diameter 14 |
| `"save"` | Save current log |
| `"skip"` | Skip tag number |
| `"tally name Coldwater 633"` | Set load name |
| `"new series 72400"` | Start new tag sequence |

### Google Sheets sync
- When signed in and online, each log syncs immediately
- When offline, logs queue locally and sync automatically when signal returns
- The sync bar shows how many entries are pending
- Each tally creates a new spreadsheet named after the load

### End of load
1. Check **Summary** tab for totals by diameter range
2. Google Sheets is already up to date if you had signal
3. **Export** → CSV as backup, or JSON to restore later
4. **Clear All Data** to start fresh for next load (prompts to export first)

---

## Formulas Used

**Doyle:** `Math.round(((D - 4)² × L) / 16)`

**Scribner:** `Math.round((0.79 × D² - 2D - 4) × L / 16)`

Where D = diameter cutback (inches), L = length cutback (feet). Both round to nearest whole number (.5 rounds up).

---

## Updating the App

When features are added, upload the changed files to GitHub. Changes go live within ~60 seconds. Your data is stored locally on the device and is not affected by app updates.

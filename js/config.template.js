// ─── LOG TALLY CONFIGURATION TEMPLATE ────────────────────────────────────────
// Copy this file to js/config.js and fill in your values.
// js/config.js is in .gitignore and will never be committed.

const CONFIG = {
  // OAuth Client ID from Google Cloud Console
  // See README.md for full setup instructions
  GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE',

  // ID of the shared HWS Tallies Google Drive folder (owned by Claudia)
  // Found in the folder URL: drive.google.com/drive/folders/{ID}
  // Year subfolders (2025, 2026 etc.) are created automatically
  SHARED_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',

  // Collaborator emails added as editors on each new spreadsheet
  COLLABORATORS: [],
};

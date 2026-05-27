// ─── GOOGLE SHEETS + OFFLINE QUEUE ───────────────────────────────────────────

const Sheets = (() => {
  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ].join(' ');

  let tokenClient = null;
  let accessToken = null;
  let isSignedIn = false;

  // ── INIT ────────────────────────────────────────────────────────────────────
  function init() {
    if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
      console.warn('Google Sheets not configured — running in offline-only mode');
      updateSyncUI();
      return;
    }
    google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID });
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) { console.error(resp); return; }
        accessToken = resp.access_token;
        isSignedIn = true;
        updateSyncUI();
        flushQueue();
      },
    });
    updateSyncUI();
  }

  function signIn() {
    if (!tokenClient) return;
    tokenClient.requestAccessToken();
  }

  function signOut() {
    if (accessToken) google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
    isSignedIn = false;
    updateSyncUI();
  }

  function isConfigured() {
    return CONFIG.GOOGLE_CLIENT_ID && CONFIG.GOOGLE_CLIENT_ID !== 'YOUR_CLIENT_ID_HERE';
  }

  // ── SPREADSHEET CREATION ────────────────────────────────────────────────────
  async function createSpreadsheet(tallyName, scale) {
    if (!isSignedIn) return null;
    const title = tallyName || 'Log Tally';
    const headers = buildHeaders(scale);

    const body = {
      properties: { title },
      sheets: [{
        properties: { title: 'Tally', sheetId: 0 },
        data: [{
          startRow: 0, startColumn: 0,
          rowData: [{ values: headers.map(h => ({ userEnteredValue: { stringValue: h }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.17, green: 0.08, blue: 0.03 } } })) }]
        }]
      }]
    };

    const res = await gapi('https://sheets.googleapis.com/v4/spreadsheets', 'POST', body);
    if (!res || !res.spreadsheetId) return null;

    const spreadsheetId = res.spreadsheetId;

    // Share with collaborators
    for (const email of (CONFIG.COLLABORATORS || [])) {
      await gapi(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, 'POST', {
        role: 'writer', type: 'user', emailAddress: email
      });
    }

    return spreadsheetId;
  }

  function buildHeaders(scale) {
    const base = ['#', 'Tag #', 'Length (original)', 'Diameter (original)', 'Length (cutback)', 'Diameter (cutback)'];
    if (scale === 'both') return [...base, 'Doyle BF', 'Scribner BF'];
    if (scale === 'doyle') return [...base, 'Board Feet (Doyle)'];
    return [...base, 'Board Feet (Scribner)'];
  }

  // ── APPEND ROWS ─────────────────────────────────────────────────────────────
  async function appendRows(spreadsheetId, rows) {
    if (!isSignedIn || !spreadsheetId) return false;
    const values = rows.map(r => rowToArray(r));
    await gapi(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tally!A:Z:append?valueInputOption=USER_ENTERED`,
      'POST',
      { values }
    );
    return true;
  }

  function rowToArray(log) {
    const base = [
      log.rowNum,
      log.tag,
      log.length,
      log.diameter,
      log.lengthCut,
      log.diameterCut,
    ];
    if (log.scale === 'both') return [...base, log.doyleBF, log.scribnerBF];
    if (log.scale === 'doyle') return [...base, log.doyleBF];
    return [...base, log.scribnerBF];
  }

  // ── OFFLINE QUEUE ───────────────────────────────────────────────────────────
  const QUEUE_KEY = 'logTally_syncQueue';

  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
  }

  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
  }

  function enqueue(spreadsheetId, rows) {
    const q = loadQueue();
    q.push({ spreadsheetId, rows, ts: Date.now() });
    saveQueue(q);
    updateSyncUI();
  }

  async function flushQueue() {
    if (!isSignedIn) return;
    const q = loadQueue();
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      const ok = await appendRows(item.spreadsheetId, item.rows);
      if (!ok) remaining.push(item);
    }
    saveQueue(remaining);
    updateSyncUI();
  }

  function queueCount() { return loadQueue().length; }

  // ── PUBLIC SYNC ENTRY POINT ─────────────────────────────────────────────────
  // Called when saving a log. If online+signed in → immediate. Otherwise queue.
  async function syncLog(spreadsheetId, rows) {
    if (isSignedIn && navigator.onLine && spreadsheetId) {
      const ok = await appendRows(spreadsheetId, rows);
      if (!ok) enqueue(spreadsheetId, rows);
    } else {
      enqueue(spreadsheetId, rows);
    }
    updateSyncUI();
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  function updateSyncUI() {
    const btn = document.getElementById('syncBtn');
    const badge = document.getElementById('syncBadge');
    const qc = queueCount();
    if (!btn) return;

    if (!isConfigured()) {
      btn.textContent = '☁ NOT CONFIGURED';
      btn.style.opacity = '0.4';
      btn.onclick = null;
      return;
    }

    if (isSignedIn) {
      btn.textContent = qc > 0 ? `☁ SYNC (${qc} PENDING)` : '☁ SIGNED IN';
      btn.onclick = flushQueue;
    } else {
      btn.textContent = qc > 0 ? `☁ SIGN IN TO SYNC (${qc})` : '☁ SIGN IN TO SHEETS';
      btn.onclick = signIn;
    }

    if (badge) badge.textContent = qc > 0 ? qc : '';
    if (badge) badge.style.display = qc > 0 ? 'flex' : 'none';
  }

  // ── FETCH HELPER ────────────────────────────────────────────────────────────
  async function gapi(url, method, body) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json();
    } catch (e) {
      console.error('Sheets API error:', e);
      return null;
    }
  }

  // Listen for coming back online
  window.addEventListener('online', () => { flushQueue(); updateSyncUI(); });
  window.addEventListener('offline', updateSyncUI);

  return { init, signIn, signOut, createSpreadsheet, syncLog, updateSyncUI, isSignedIn: () => isSignedIn, isConfigured };
})();

// ─── GOOGLE SHEETS + DRIVE INTEGRATION ───────────────────────────────────────
const Sheets = (() => {
    const SCOPES = ['https://www.googleapis.com/auth/drive.file'].join(' ');
  let tokenClient = null, accessToken = null, isSignedIn = false;

  function init() {
    if (!isConfigured()) { updateSyncUI(); return; }
    waitForGoogle(() => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID, scope: SCOPES,
        callback: (resp) => {
          if (resp.error) { console.error('[Sheets] OAuth error:', resp); return; }
          accessToken = resp.access_token; isSignedIn = true; updateSyncUI(); flushQueue();
        },
      });
      updateSyncUI();
    });
  }

  function waitForGoogle(cb, n) {
    n = n || 0;
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) { cb(); }
    else if (n < 20) { setTimeout(function() { waitForGoogle(cb, n + 1); }, 250); }
    else { console.warn('[Sheets] Google Identity Services did not load'); updateSyncUI(); }
  }

  function signIn() {
    if (!tokenClient) { init(); setTimeout(signIn, 1500); return; }
    tokenClient.requestAccessToken();
  }

  function signOut() {
    if (accessToken) google.accounts.oauth2.revoke(accessToken);
    accessToken = null; isSignedIn = false; updateSyncUI();
  }

  function isConfigured() {
    return CONFIG.GOOGLE_CLIENT_ID && CONFIG.GOOGLE_CLIENT_ID !== 'YOUR_CLIENT_ID_HERE';
  }

  async function findFolder(name, parentId) {
    const q = "name='" + name + "' and mimeType='application/vnd.google-apps.folder' and '" + parentId + "' in parents and trashed=false";
    const res = await gapi('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name)', 'GET');
    return (res && res.files && res.files.length > 0) ? res.files[0].id : null;
  }

  async function createFolder(name, parentId) {
    const res = await gapi('https://www.googleapis.com/drive/v3/files', 'POST', { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] });
    return res ? res.id : null;
  }

  async function getYearFolderId() {
    const year = String(new Date().getFullYear());
    const rootId = CONFIG.SHARED_FOLDER_ID;
    if (!rootId || rootId === 'YOUR_FOLDER_ID_HERE') return null;
    let id = await findFolder(year, rootId);
    if (!id) id = await createFolder(year, rootId);
    return id;
  }

  async function createSpreadsheet(tallyName, scale) {
    if (!isSignedIn) return null;
    const title = tallyName || 'Log Tally';
    const headers = buildHeaders(scale);
    const body = { properties: { title }, sheets: [{ properties: { title: 'Tally', sheetId: 0 }, data: [{ startRow: 0, startColumn: 0, rowData: [{ values: headers.map(function(h) { return { userEnteredValue: { stringValue: h }, userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.05, green: 0.12, blue: 0.07 } } }; }) }] }] }] };
    const res = await gapi('https://sheets.googleapis.com/v4/spreadsheets', 'POST', body);
    if (!res || !res.spreadsheetId) return null;
    const sid = res.spreadsheetId;
    const yearFolderId = await getYearFolderId();
    if (yearFolderId) {
      const meta = await gapi('https://www.googleapis.com/drive/v3/files/' + sid + '?fields=parents', 'GET');
      const cur = meta && meta.parents ? meta.parents.join(',') : '';
      await gapi('https://www.googleapis.com/drive/v3/files/' + sid + '?addParents=' + yearFolderId + '&removeParents=' + cur + '&fields=id,parents', 'PATCH');
    }
    for (const email of (CONFIG.COLLABORATORS || [])) {
      await gapi('https://www.googleapis.com/drive/v3/files/' + sid + '/permissions', 'POST', { role: 'writer', type: 'user', emailAddress: email });
    }
    return sid;
  }

  function buildHeaders(scale) {
    const base = ['#', 'Tag #', 'Length (original)', 'Diameter (original)', 'Length (cutback)', 'Diameter (cutback)'];
    if (scale === 'both') return base.concat(['Doyle BF', 'Scribner BF']);
    if (scale === 'doyle') return base.concat(['Board Feet (Doyle)']);
    if (scale === 'scribner') return base.concat(['Board Feet (Scribner)']);
    return base.concat(['Board Feet']);
  }

  async function appendRows(spreadsheetId, rows) {
    if (!isSignedIn || !spreadsheetId) return false;
    const values = rows.map(function(log) {
      const base = [log.rowNum, log.tag, log.length, log.diameter, log.lengthCut, log.diameterCut];
      if (log.scale === 'both') return base.concat([log.bf ? (log.bf.doyle != null ? log.bf.doyle : '') : '', log.bf ? (log.bf.scribner != null ? log.bf.scribner : '') : '']);
      if (log.scale === 'doyle') return base.concat([log.bf ? (log.bf.doyle != null ? log.bf.doyle : '') : '']);
      if (log.scale === 'scribner') return base.concat([log.bf ? (log.bf.scribner != null ? log.bf.scribner : '') : '']);
      return base.concat(['']);
    });
    const res = await gapi('https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values/Tally!A:Z:append?valueInputOption=USER_ENTERED', 'POST', { values: values });
    return !!res;
  }

  const QUEUE_KEY = 'logTally_syncQueue';
  function loadQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e) { return []; } }
  function saveQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch(e) {} }
  function enqueue(sid, rows) { const q = loadQueue(); q.push({ spreadsheetId: sid, rows: rows, ts: Date.now() }); saveQueue(q); updateSyncUI(); }

  async function flushQueue() {
    if (!isSignedIn) return;
    const q = loadQueue(); if (!q.length) return;
    const remaining = [];
    for (const item of q) { const ok = await appendRows(item.spreadsheetId, item.rows); if (!ok) remaining.push(item); }
    saveQueue(remaining); updateSyncUI();
  }

  function queueCount() { return loadQueue().length; }

  async function syncLog(spreadsheetId, rows) {
    if (isSignedIn && navigator.onLine && spreadsheetId) { const ok = await appendRows(spreadsheetId, rows); if (!ok) enqueue(spreadsheetId, rows); }
    else enqueue(spreadsheetId, rows);
    updateSyncUI();
  }

  function updateSyncUI() {
    const btn = document.getElementById('syncBtn');
    const badge = document.getElementById('syncBadge');
    if (!btn) return;
    const qc = queueCount();
    if (!isConfigured()) { btn.textContent = 'Sheets not configured'; btn.style.opacity = '0.4'; btn.onclick = null; return; }
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    if (isSignedIn) {
      btn.textContent = qc > 0 ? 'Sync (' + qc + ' pending)' : 'Signed in to Sheets';
      btn.onclick = flushQueue;
    } else {
      btn.textContent = qc > 0 ? 'Sign in to sync (' + qc + ')' : 'Sign in to Sheets';
      btn.onclick = signIn;
    }
    if (badge) { badge.textContent = qc > 0 ? String(qc) : ''; badge.style.display = qc > 0 ? 'flex' : 'none'; }
  }

  async function gapi(url, method, body) {
    try {
      const res = await fetch(url, { method: method, headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { const err = await res.json().catch(function() { return {}; }); console.error('[Sheets] API error:', res.status, err); return null; }
      if (method === 'PATCH') { const text = await res.text(); return text ? JSON.parse(text) : {}; }
      return await res.json();
    } catch(e) { console.error('[Sheets] fetch error:', e); return null; }
  }

  window.addEventListener('online', function() { flushQueue(); updateSyncUI(); });
  window.addEventListener('offline', updateSyncUI);

  return { init: init, signIn: signIn, signOut: signOut, createSpreadsheet: createSpreadsheet, syncLog: syncLog, updateSyncUI: updateSyncUI, isSignedIn: function() { return isSignedIn; }, isConfigured: isConfigured };
})();

// ─── LOG TALLY — MAIN APP ─────────────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  tallyName: '',
  scale: null,          // 'doyle' | 'scribner' | 'both'
  nextTag: null,
  currentSeries: 0,
  logs: [],
  spreadsheetId: null,  // Google Sheets ID once created
};
let editingId = null;
const SK = 'logTally_v3';

function saveState() { try { localStorage.setItem(SK, JSON.stringify(state)); } catch(e) {} }
function loadState() {
  try {
    const r = localStorage.getItem(SK);
    if (r) state = Object.assign(state, JSON.parse(r));
  } catch(e) {}
}

// ── FORMULAS ──────────────────────────────────────────────────────────────────
function doyle(d, l)    { return Math.round(((d - 4) ** 2 * l) / 16); }
function scribner(d, l) { return Math.round((0.79 * d ** 2 - 2 * d - 4) * l / 16); }

function calcBF(lengthVal, diamVal, scale) {
  const lp = parseField(lengthVal), dp = parseField(diamVal);
  if (!lp || !dp) return null;
  const l = lp.cut, d = dp.cut;
  if (scale === 'doyle')    return { doyle: doyle(d, l) };
  if (scale === 'scribner') return { scribner: scribner(d, l) };
  if (scale === 'both')     return { doyle: doyle(d, l), scribner: scribner(d, l) };
  return null;
}

function primaryBF(bf) {
  if (!bf) return null;
  return bf.doyle ?? bf.scribner ?? null;
}

// ── FIELD PARSER ──────────────────────────────────────────────────────────────
function parseField(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().replace(/\s/g, '');
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    const phys = parseFloat(a), cut = parseFloat(b);
    if (!isNaN(phys) && !isNaN(cut)) return { raw: s, phys, cut, hasCutback: true };
    return null;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : { raw: s, phys: n, cut: n, hasCutback: false };
}

// ── HEADER ────────────────────────────────────────────────────────────────────
function updateHeader() {
  const totalBF = state.logs.reduce((s, l) => s + (primaryBF(l.bf) || 0), 0);
  document.getElementById('statLogs').textContent = state.logs.length;
  document.getElementById('statBF').textContent = totalBF >= 1000 ? (totalBF / 1000).toFixed(1) + 'k' : totalBF;
  const nt = state.nextTag !== null ? state.nextTag : '—';
  document.getElementById('statNextTag').textContent = nt;
  document.getElementById('nextTagDisplay').textContent = nt;
  document.getElementById('tallyNameBtn').textContent = state.tallyName || 'TAP TO NAME LOAD';
  document.getElementById('scaleDisplay').textContent = state.scale
    ? state.scale.charAt(0).toUpperCase() + state.scale.slice(1)
    : 'No Scale Set';
  updateBFLabel();
}

function updateBFLabel() {
  const label = document.getElementById('bfLabel');
  if (!label) return;
  if (state.scale === 'both') label.textContent = 'Doyle BF / Scribner BF';
  else if (state.scale === 'doyle') label.textContent = 'Board Feet (Doyle)';
  else if (state.scale === 'scribner') label.textContent = 'Board Feet (Scribner)';
  else label.textContent = 'Board Feet';
}

// ── FIELD INPUT ───────────────────────────────────────────────────────────────
function onFieldInput(el, hintId) {
  const p = parseField(el.value);
  el.classList.toggle('has-cutback', !!(p && p.hasCutback));
  const h = document.getElementById(hintId);
  h.textContent = (p && p.hasCutback) ? 'cutback: ' + p.cut : (el.value && !p ? '?' : '');
  updateFootagePreview();
}

function updateFootagePreview() {
  const l = document.getElementById('fLength').value;
  const d = document.getElementById('fDiameter').value;
  const bf = calcBF(l, d, state.scale);
  const el = document.getElementById('footagePreview');
  if (!bf) {
    el.textContent = '—';
    document.getElementById('saveBtn').disabled = true;
    return;
  }
  if (state.scale === 'both') el.textContent = (bf.doyle || '—') + ' / ' + (bf.scribner || '—');
  else el.textContent = (primaryBF(bf) || '—').toLocaleString();
  document.getElementById('saveBtn').disabled = primaryBF(bf) === null;
}

function clearFields() {
  ['fLength', 'fDiameter'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('has-cutback');
  });
  ['hLength', 'hDiameter'].forEach(id => document.getElementById(id).textContent = '');
  document.getElementById('footagePreview').textContent = '—';
  document.getElementById('saveBtn').disabled = true;
  document.getElementById('transcriptBox').textContent = 'Tap mic and speak measurements or commands';
}

// ── TAB NAVIGATION ────────────────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'logs') renderLogs();
  if (name === 'summary') renderSummary();
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (err ? ' error' : '');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => el.className = 'toast', 2600);
}

// ── TAG MANAGEMENT ────────────────────────────────────────────────────────────
function openSeriesModal() {
  document.getElementById('seriesInput').value = '';
  document.getElementById('seriesModal').classList.add('show');
  setTimeout(() => document.getElementById('seriesInput').focus(), 120);
}
function confirmNewSeries() {
  const v = parseInt(document.getElementById('seriesInput').value);
  if (isNaN(v) || v < 1) { toast('Enter a valid tag number', true); return; }
  state.nextTag = v; state.currentSeries++;
  saveState(); updateHeader(); closeModal('seriesModal');
  toast('New series starting at ' + v);
}
function skipTag() {
  if (state.nextTag === null) { toast('Set a starting tag first', true); return; }
  state.nextTag++; saveState(); updateHeader();
  toast('Skipped — now at ' + state.nextTag);
}

// ── SCALE MODAL ───────────────────────────────────────────────────────────────
function openScaleModal() {
  document.getElementById('scaleModal').classList.add('show');
}
function setScale(scale) {
  state.scale = scale;
  saveState(); updateHeader();
  closeModal('scaleModal');
  toast('Scale set to ' + scale.charAt(0).toUpperCase() + scale.slice(1));
  updateFootagePreview();
}

// ── TALLY NAME ────────────────────────────────────────────────────────────────
function openTallyModal() {
  document.getElementById('tallyInput').value = state.tallyName;
  document.getElementById('tallyModal').classList.add('show');
  setTimeout(() => document.getElementById('tallyInput').focus(), 120);
}
async function confirmTallyName() {
  state.tallyName = document.getElementById('tallyInput').value.trim();
  // Create Google Sheet if signed in and not already created
  if (Sheets.isSignedIn() && !state.spreadsheetId && state.tallyName) {
    toast('Creating spreadsheet...');
    const id = await Sheets.createSpreadsheet(state.tallyName, state.scale || 'doyle');
    if (id) { state.spreadsheetId = id; toast('Spreadsheet created!'); }
    else toast('Could not create spreadsheet — will retry when online', true);
  }
  saveState(); updateHeader(); closeModal('tallyModal');
}

// ── SAVE LOG ─────────────────────────────────────────────────────────────────
async function saveLog() {
  if (!state.scale) { openScaleModal(); return; }
  if (state.nextTag === null) { openSeriesModal(); return; }

  const l = document.getElementById('fLength').value.trim();
  const d = document.getElementById('fDiameter').value.trim();
  const bf = calcBF(l, d, state.scale);
  if (!bf) { toast('Check measurements', true); return; }

  const lp = parseField(l), dp = parseField(d);

  const log = {
    id: Date.now(),
    tag: state.nextTag,
    series: state.currentSeries,
    scale: state.scale,
    length: l,
    diameter: d,
    lengthCut: lp ? lp.cut : null,
    diameterCut: dp ? dp.cut : null,
    bf,
    rowNum: state.logs.length + 1,
  };

  state.logs.push(log);
  state.nextTag++;
  saveState(); updateHeader(); clearFields();

  const bfDisplay = state.scale === 'both'
    ? `${bf.doyle}/${bf.scribner} BF`
    : `${primaryBF(bf)} BF`;
  toast('Saved — ' + bfDisplay);

  // Sync to Google Sheets
  if (state.spreadsheetId || (Sheets.isSignedIn() && state.tallyName)) {
    if (!state.spreadsheetId && Sheets.isSignedIn()) {
      const id = await Sheets.createSpreadsheet(state.tallyName, state.scale);
      if (id) state.spreadsheetId = id;
      saveState();
    }
    await Sheets.syncLog(state.spreadsheetId, [log]);
  }
}

// ── EDIT / DELETE ─────────────────────────────────────────────────────────────
function openEditModal(id) {
  const log = state.logs.find(l => l.id === id);
  if (!log) return;
  editingId = id;
  document.getElementById('editTagLabel').textContent = '#' + log.tag;
  document.getElementById('editLength').value = log.length;
  document.getElementById('editDiameter').value = log.diameter;
  document.getElementById('editModal').classList.add('show');
}
function confirmEdit() {
  const l = document.getElementById('editLength').value.trim();
  const d = document.getElementById('editDiameter').value.trim();
  const bf = calcBF(l, d, state.scale);
  if (!bf) { toast('Check measurements', true); return; }
  const lp = parseField(l), dp = parseField(d);
  const log = state.logs.find(x => x.id === editingId);
  if (log) {
    log.length = l; log.diameter = d;
    log.lengthCut = lp ? lp.cut : null;
    log.diameterCut = dp ? dp.cut : null;
    log.bf = bf;
  }
  saveState(); updateHeader(); renderLogs(); closeModal('editModal');
  toast('Updated');
}
function deleteLog() {
  if (!confirm('Delete this log entry?')) return;
  state.logs = state.logs.filter(l => l.id !== editingId);
  // Renumber
  state.logs.forEach((l, i) => l.rowNum = i + 1);
  saveState(); updateHeader(); renderLogs(); closeModal('editModal');
  toast('Deleted');
}

// ── RENDER LOGS ───────────────────────────────────────────────────────────────
function fmtCell(val) {
  const p = parseField(val);
  if (!p) return `<span class="phys">${val || '—'}</span>`;
  if (p.hasCutback) return `<span class="phys">${p.phys}</span><br><span class="cut">↓${p.cut}</span>`;
  return `<span class="phys">${p.phys}</span>`;
}

function fmtBF(bf, scale) {
  if (!bf) return '—';
  if (scale === 'both') return `<span style="font-size:11px">${bf.doyle}<br>${bf.scribner}</span>`;
  return primaryBF(bf);
}

function renderLogs() {
  const c = document.getElementById('logList');
  if (state.logs.length === 0) {
    c.innerHTML = '<div class="empty-state">No logs entered yet.<br>Switch to Entry to begin.</div>';
    return;
  }

  const isBoth = state.scale === 'both';
  const bfHeader = isBoth ? '<span>D/S BF</span>' : '<span>BF</span>';
  const cols = isBoth ? '48px 1fr 1fr 64px' : '48px 1fr 1fr 56px';

  let html = `<div class="log-header-row" style="grid-template-columns:${cols}">
    <span>Tag</span><span>Length</span><span>Diam</span>${bfHeader}
  </div>`;

  let lastSeries = null;
  state.logs.slice().reverse().forEach(log => {
    if (lastSeries !== null && log.series !== lastSeries)
      html += `<div class="series-divider">— Series Change —</div>`;
    lastSeries = log.series;
    html += `<div class="log-item" style="grid-template-columns:${cols}" onclick="openEditModal(${log.id})">
      <div class="log-tag">${log.tag}</div>
      <div class="log-cell">${fmtCell(log.length)}</div>
      <div class="log-cell">${fmtCell(log.diameter)}</div>
      <div class="log-ft">${fmtBF(log.bf, log.scale)}</div>
    </div>`;
  });
  c.innerHTML = html;
}

// ── RENDER SUMMARY ────────────────────────────────────────────────────────────
function renderSummary() {
  const buckets = { '6–9': { c: 0, d: 0, s: 0 }, '10–13': { c: 0, d: 0, s: 0 }, '14–17': { c: 0, d: 0, s: 0 }, '18–21': { c: 0, d: 0, s: 0 }, '22+': { c: 0, d: 0, s: 0 } };

  function diamBucket(n) {
    if (n < 10) return '6–9';
    if (n < 14) return '10–13';
    if (n < 18) return '14–17';
    if (n < 22) return '18–21';
    return '22+';
  }

  state.logs.forEach(log => {
    const dp = parseField(log.diameter);
    if (!dp) return;
    const k = diamBucket(dp.cut);
    buckets[k].c++;
    buckets[k].d += log.bf?.doyle || 0;
    buckets[k].s += log.bf?.scribner || 0;
  });

  const isBoth = state.scale === 'both';
  const thBF = isBoth ? '<th style="text-align:right">Doyle BF</th><th style="text-align:right">Scribner BF</th>' : '<th style="text-align:right">Board Ft</th>';

  let html = '', tc = 0, td = 0, ts = 0;
  Object.entries(buckets).forEach(([range, d]) => {
    if (!d.c) return;
    tc += d.c; td += d.d; ts += d.s;
    const bfCells = isBoth
      ? `<td>${d.d.toLocaleString()}</td><td>${d.s.toLocaleString()}</td>`
      : `<td>${(state.scale === 'scribner' ? d.s : d.d).toLocaleString()}</td>`;
    html += `<tr><td>${range}"</td><td>${d.c}</td>${bfCells}</tr>`;
  });

  if (tc) {
    const totalBF = isBoth
      ? `<td>${td.toLocaleString()}</td><td>${ts.toLocaleString()}</td>`
      : `<td>${(state.scale === 'scribner' ? ts : td).toLocaleString()}</td>`;
    html += `<tr class="total-row"><td>TOTAL</td><td>${tc}</td>${totalBF}</tr>`;
  } else {
    html = '<tr><td colspan="5" style="color:var(--dim);text-align:center;padding:16px;font-size:12px;">No data yet</td></tr>';
  }

  document.getElementById('summaryBody').innerHTML = html;
  document.getElementById('summaryHeaderBF').innerHTML = thBF;
}

// ── SPEECH INTEGRATION ────────────────────────────────────────────────────────
function setupSpeech() {
  Speech.setup(
    (transcript, isFinal) => {
      document.getElementById('transcriptBox').textContent = transcript;
      if (!isFinal) return;
      const cmd = Speech.parse(transcript);
      handleSpeechCommand(cmd);
    },
    (status) => {
      const btn = document.getElementById('micBtn');
      const lbl = document.getElementById('micLabel');
      if (status === 'listening') {
        btn.classList.add('listening');
        lbl.textContent = '🔴  LISTENING...';
        document.getElementById('transcriptBox').textContent = '...';
      } else if (status === 'unavailable') {
        btn.disabled = true;
        lbl.textContent = '🎤 NOT AVAILABLE';
      } else {
        btn.classList.remove('listening');
        lbl.textContent = '🎤 \u00a0TAP TO SPEAK';
      }
    }
  );
}

function handleSpeechCommand(cmd) {
  switch (cmd.cmd) {
    case 'save': saveLog(); break;
    case 'skip': skipTag(); break;
    case 'tallyName':
      state.tallyName = cmd.value;
      saveState(); updateHeader();
      toast('Load name: ' + state.tallyName);
      break;
    case 'newSeries':
      state.nextTag = cmd.value; state.currentSeries++;
      saveState(); updateHeader();
      toast('New series: ' + state.nextTag);
      break;
    case 'newSeriesPrompt': openSeriesModal(); break;
    case 'measurements':
      if (cmd.length) {
        document.getElementById('fLength').value = cmd.length;
        onFieldInput(document.getElementById('fLength'), 'hLength');
      }
      if (cmd.diameter) {
        document.getElementById('fDiameter').value = cmd.diameter;
        onFieldInput(document.getElementById('fDiameter'), 'hDiameter');
      }
      if (!cmd.diameter) toast('Got length — speak diameter or enter manually');
      break;
    default:
      toast('Could not parse — try again', true);
  }
}

// ── EXPORT CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!state.logs.length) { toast('No logs to export', true); return; }
  const isBoth = state.scale === 'both';
  const bfHeaders = isBoth ? ',Doyle BF,Scribner BF' : `,Board Feet (${state.scale || 'BF'})`;
  let csv = `#,Tag #,Length (original),Diameter (original),Length (cutback),Diameter (cutback)${bfHeaders}\n`;
  state.logs.forEach(log => {
    const bfVals = isBoth
      ? `,${log.bf?.doyle || ''},${log.bf?.scribner || ''}`
      : `,${primaryBF(log.bf) || ''}`;
    csv += `${log.rowNum},${log.tag},${log.length},${log.diameter},${log.lengthCut},${log.diameterCut}${bfVals}\n`;
  });
  const name = (state.tallyName || 'log-tally').replace(/\s+/g, '_');
  dlFile(csv, `${name}.csv`, 'text/csv');
  toast('CSV exported');
}

function exportJSON() {
  const name = (state.tallyName || 'log-tally').replace(/\s+/g, '_');
  dlFile(JSON.stringify(state, null, 2), `${name}_backup.json`, 'application/json');
  toast('Backup saved');
}
function handleImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      const d = JSON.parse(ev.target.result);
      if (!d.logs) throw new Error();
      state = d; saveState(); updateHeader();
      toast('Restored ' + state.logs.length + ' logs');
    } catch { toast('Invalid backup file', true); }
  };
  r.readAsText(file); e.target.value = '';
}
function dlFile(content, filename, type) {
  const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function confirmClearAll() {
  if (!confirm('Export backup first?\n\nClick OK to export then clear, or Cancel to just clear.')) {
    if (!confirm('Are you sure? All data will be lost.')) return;
    clearAll(); return;
  }
  exportJSON();
  setTimeout(clearAll, 500);
}
function clearAll() {
  state = { tallyName: '', scale: null, nextTag: null, currentSeries: 0, logs: [], spreadsheetId: null };
  saveState(); updateHeader(); clearFields();
  toast('Cleared — ready for new load');
}

// ── ONLINE STATUS ─────────────────────────────────────────────────────────────
function updateOnline() {
  document.getElementById('offlineBadge').classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  updateHeader();
  setupSpeech();
  updateOnline();
  Sheets.init();

  document.querySelectorAll('.modal-bg').forEach(bg =>
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('show'); })
  );
  document.getElementById('seriesInput').addEventListener('keydown', e => { if (e.key === 'Enter') confirmNewSeries(); });
  document.getElementById('tallyInput').addEventListener('keydown', e => { if (e.key === 'Enter') confirmTallyName(); });
});

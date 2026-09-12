// ─── LOG TALLY — MAIN APP ─────────────────────────────────────────────────────

let state = { tallyName: '', scale: null, nextTag: null, currentSeries: 0, logs: [], spreadsheetId: null };
let editingId = null;
const SK = 'logTally_v3';

function saveState() { try { localStorage.setItem(SK, JSON.stringify(state)); } catch(e) {} }
function loadState() { try { const r = localStorage.getItem(SK); if (r) state = Object.assign(state, JSON.parse(r)); } catch(e) {} }

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

function primaryBF(bf) { if (!bf) return null; return bf.doyle ?? bf.scribner ?? null; }
function bfToM3(bf) { return bf ? Math.round(bf * 0.002360 * 1000) / 1000 : null; }

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

function updateHeader() {
  const totalBF = state.logs.reduce((s, l) => s + (primaryBF(l.bf) || 0), 0);
  document.getElementById('statLogs').textContent = state.logs.length;
  document.getElementById('statBF').textContent = totalBF >= 1000 ? (totalBF / 1000).toFixed(1) + 'k' : totalBF;
  const nt = state.nextTag !== null ? state.nextTag : '—';
  document.getElementById('statNextTag').textContent = nt;
  const btn = document.getElementById('tallyNameBtn');
  if (state.spreadsheetId && state.tallyName) {
    btn.innerHTML = '<a href="' + Sheets.sheetsUrl(state.spreadsheetId) + '" target="_blank" style="color:inherit;text-decoration:none">' + state.tallyName + ' ↗</a>';
    btn.onclick = null;
  } else {
    btn.textContent = state.tallyName || 'Name Load';
    btn.onclick = openTallyModal;
  }
  document.getElementById('scaleDisplay').textContent = state.scale ? state.scale.charAt(0).toUpperCase() + state.scale.slice(1) : 'No Scale';
  updateBottomNav();
  if (currentMode === 'keypad') Keypad.render();
}

let currentMode = 'keypad';
let currentTab  = 'entry';

function enterEntryMode() {
  currentMode = 'keypad';
  document.getElementById('mainHeader').classList.add('slim');
  document.getElementById('headerStats').classList.add('hidden');
  document.getElementById('syncBar').classList.add('hidden');
  showTab('entry', true);
  Keypad.reset(); Keypad.render();
  updateBottomNav();
}

function showTab(name, silent = false) {
  currentTab = name;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  if (!silent) { if (name === 'logs') renderLogs(); if (name === 'summary') renderSummary(); }
  updateBottomNav();
}

function navTo(name) {
  if (name === 'entry') {
    enterEntryMode();
  } else {
    if (currentMode === 'keypad') {
      currentMode = 'browse';
      document.getElementById('mainHeader').classList.remove('slim');
      document.getElementById('headerStats').classList.remove('hidden');
      document.getElementById('syncBar').classList.remove('hidden');
    }
    showTab(name);
  }
}

function updateBottomNav() {
  ['entry','logs','summary','export'].forEach(n => {
    const el = document.getElementById('nav-' + n);
    if (el) el.classList.toggle('nav-active', currentTab === n);
  });
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => el.className = 'toast', 2600);
}

let tagPrefix = '';
let tagNumLength = 5;

function openSeriesModal() { document.getElementById('seriesInput').value = ''; document.getElementById('seriesModal').classList.add('show'); setTimeout(() => document.getElementById('seriesInput').focus(), 120); }
function confirmNewSeries() {
  const v = document.getElementById('seriesInput').value.trim();
  if (!v) { toast('Enter a starting tag number', 'error'); return; }
  const num = parseInt(v); if (isNaN(num)) { toast('Invalid number', 'error'); return; }
  tagPrefix = ''; tagNumLength = v.length; state.nextTag = num; state.currentSeries++;
  saveState(); updateHeader(); closeModal('seriesModal'); toast('New series starting at ' + num, 'success');
}
function skipTag() {
  if (state.nextTag === null) { toast('Set a starting tag first', 'error'); return; }
  incrementTag(); saveState(); updateHeader(); toast('Skipped — now at ' + state.nextTag, 'success');
}
function incrementTag() {
  if (tagPrefix && typeof state.nextTag === 'string') {
    const numPart = parseInt(String(state.nextTag).slice(tagPrefix.length)) + 1;
    state.nextTag = tagPrefix + String(numPart).padStart(tagNumLength, '0');
  } else { state.nextTag = (parseInt(state.nextTag) || 0) + 1; }
}

function openScaleModal() { document.getElementById('scaleModal').classList.add('show'); }
function setScale(scale) {
  state.scale = scale; saveState(); updateHeader(); closeModal('scaleModal');
  toast('Scale: ' + scale.charAt(0).toUpperCase() + scale.slice(1), 'success');
  if (currentMode === 'keypad') Keypad.render();
}

function openTallyModal() { document.getElementById('tallyInput').value = state.tallyName; document.getElementById('tallyModal').classList.add('show'); setTimeout(() => document.getElementById('tallyInput').focus(), 120); }
async function confirmTallyName() {
  state.tallyName = document.getElementById('tallyInput').value.trim();
  if (Sheets.isSignedIn() && !state.spreadsheetId && state.tallyName) {
    toast('Creating spreadsheet...');
    const id = await Sheets.createSpreadsheet(state.tallyName, state.scale || 'doyle');
    if (id) { state.spreadsheetId = id; toast('Spreadsheet created!', 'success'); }
  }
  saveState(); updateHeader(); closeModal('tallyModal');
}

function shareTallyLink() {
  if (!state.spreadsheetId) { toast('No spreadsheet yet — save a log first', 'error'); return; }
  const url = Sheets.sheetsUrl(state.spreadsheetId);
  const name = state.tallyName || 'Log Tally';
  if (navigator.share) { navigator.share({ title: name, text: 'HWS Log Tally: ' + name, url }).catch(() => {}); }
  else { navigator.clipboard.writeText(url).then(() => toast('Link copied!', 'success')); }
}

window.appState = () => state;
window.calcBF   = calcBF;
window.bfToM3   = bfToM3;
window.toast    = toast;
window.navTo    = navTo;

window.setNextTag = function(fullTag, prefix, startNum, numLen) {
  tagPrefix = prefix || ''; tagNumLength = numLen || 5;
  state.nextTag = fullTag; state.currentSeries++;
  saveState(); updateHeader(); toast('New series: ' + fullTag, 'success');
};

window.saveLogFromKeypad = function(lengthVal, diamVal) {
  if (!state.scale) { openScaleModal(); return false; }
  if (state.nextTag === null) { Keypad.openTagModal(); return false; }
  const bf = calcBF(lengthVal, diamVal, state.scale);
  if (!bf) { toast('Check measurements', 'error'); return false; }
  const lp = parseField(lengthVal), dp = parseField(diamVal);
  const log = { id: Date.now(), tag: state.nextTag, series: state.currentSeries, scale: state.scale, length: lengthVal, diameter: diamVal, lengthCut: lp ? lp.cut : null, diameterCut: dp ? dp.cut : null, bf, rowNum: state.logs.length + 1 };
  state.logs.push(log); incrementTag(); saveState(); updateHeader();
  toast('Saved — ' + (state.scale === 'both' ? bf.doyle + '/' + bf.scribner : primaryBF(bf)) + ' BF', 'success');
  syncAfterSave(log);
  return true;
};

window.skipTag = function() { skipTag(); };

function syncAfterSave(log) {
  if (state.spreadsheetId || (Sheets.isSignedIn() && state.tallyName)) {
    (async () => {
      if (!state.spreadsheetId && Sheets.isSignedIn()) {
        const id = await Sheets.createSpreadsheet(state.tallyName, state.scale);
        if (id) { state.spreadsheetId = id; saveState(); updateHeader(); }
      }
      await Sheets.syncLog(state.spreadsheetId, [log]);
    })();
  }
}

function openEditModal(id) {
  const log = state.logs.find(l => l.id === id); if (!log) return;
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
  if (!bf) { toast('Check measurements', 'error'); return; }
  const lp = parseField(l), dp = parseField(d);
  const log = state.logs.find(x => x.id === editingId);
  if (log) { log.length = l; log.diameter = d; log.lengthCut = lp ? lp.cut : null; log.diameterCut = dp ? dp.cut : null; log.bf = bf; }
  saveState(); updateHeader(); renderLogs(); closeModal('editModal'); toast('Updated', 'success');
}
function deleteLog() {
  if (!confirm('Delete this log entry?')) return;
  state.logs = state.logs.filter(l => l.id !== editingId);
  state.logs.forEach((l, i) => l.rowNum = i + 1);
  saveState(); updateHeader(); renderLogs(); closeModal('editModal'); toast('Deleted');
}

function fmtCell(val) {
  const p = parseField(val);
  if (!p) return '<span class="phys">' + (val || '—') + '</span>';
  if (p.hasCutback) return '<span class="phys">' + p.phys + '</span><br><span class="cut">↓' + p.cut + '</span>';
  return '<span class="phys">' + p.phys + '</span>';
}
function fmtBF(bf, scale) {
  if (!bf) return '—';
  if (scale === 'both') return '<span style="font-size:11px;font-family:var(--font-mono)">' + bf.doyle + '<br>' + bf.scribner + '</span>';
  return primaryBF(bf);
}

function renderLogs() {
  const c = document.getElementById('logList');
  if (state.logs.length === 0) { c.innerHTML = '<div class="empty-state">No logs entered yet.<br>Tap Entry to begin.</div>'; return; }
  const isBoth = state.scale === 'both';
  const cols = isBoth ? '46px 1fr 1fr 60px 50px' : '46px 1fr 1fr 52px 46px';
  const bfHdr = isBoth ? '<span>D/S BF</span>' : '<span>BF</span>';
  let html = '<div class="log-header-row" style="grid-template-columns:' + cols + '"><span>Tag</span><span style="text-align:center">Len</span><span style="text-align:center">Dia</span>' + bfHdr + '<span>m³</span></div>';
  let lastSeries = null;
  state.logs.forEach(log => {
    if (lastSeries !== null && log.series !== lastSeries) html += '<div class="series-divider">— Series Change —</div>';
    lastSeries = log.series;
    const m3 = bfToM3(primaryBF(log.bf));
    html += '<div class="log-item" style="grid-template-columns:' + cols + '" onclick="openEditModal(' + log.id + ')"><div class="log-tag">' + log.tag + '</div><div class="log-cell">' + fmtCell(log.length) + '</div><div class="log-cell">' + fmtCell(log.diameter) + '</div><div class="log-ft">' + fmtBF(log.bf, log.scale) + '</div><div class="log-m3">' + (m3 != null ? m3.toFixed(3) : '—') + '</div></div>';
  });
  c.innerHTML = html;
}

function renderSummary() {
  const buckets = { '6–9':{c:0,d:0,s:0}, '10–13':{c:0,d:0,s:0}, '14–17':{c:0,d:0,s:0}, '18–21':{c:0,d:0,s:0}, '22+':{c:0,d:0,s:0} };
  function diamBucket(n) { if (n<10) return '6–9'; if (n<14) return '10–13'; if (n<18) return '14–17'; if (n<22) return '18–21'; return '22+'; }
  state.logs.forEach(log => { const dp = parseField(log.diameter); if (!dp) return; const k = diamBucket(dp.cut); buckets[k].c++; buckets[k].d += log.bf?.doyle||0; buckets[k].s += log.bf?.scribner||0; });
  const isBoth = state.scale === 'both';
  document.getElementById('summaryHeaderBF').innerHTML = isBoth ? '<th style="text-align:right">Doyle</th><th style="text-align:right">Scrib</th><th style="text-align:right">m³</th>' : 'BF';
  let html = '', tc=0, td=0, ts=0;
  Object.entries(buckets).forEach(([range, d]) => {
    if (!d.c) return; tc+=d.c; td+=d.d; ts+=d.s;
    const bf4 = state.scale==='scribner' ? d.s : d.d;
    const m3 = bfToM3(bf4);
    const bfCells = isBoth
      ? '<td>'+d.d.toLocaleString()+'</td><td>'+d.s.toLocaleString()+'</td><td>'+(bfToM3(d.d)||0).toFixed(2)+'</td>'
      : '<td>'+bf4.toLocaleString()+'</td>';
    const m3Cell = isBoth ? '' : '<td>'+(m3!=null?m3.toFixed(2):'—')+'</td>';
    html += '<tr><td>'+range+'"</td><td>'+d.c+'</td>'+bfCells+m3Cell+'</tr>';
  });
  if (tc) {
    const bf4 = state.scale==='scribner' ? ts : td;
    const totalBFCells = isBoth
      ? '<td>'+td.toLocaleString()+'</td><td>'+ts.toLocaleString()+'</td><td>'+(bfToM3(td)||0).toFixed(2)+'</td>'
      : '<td>'+bf4.toLocaleString()+'</td>';
    const totalM3Cell = isBoth ? '' : '<td>'+(bfToM3(bf4)||0).toFixed(2)+'</td>';
    html += '<tr class="total-row"><td>Total</td><td>'+tc+'</td>'+totalBFCells+totalM3Cell+'</tr>';
  } else {
    html = '<tr><td colspan="6" style="color:var(--moss-bright);text-align:center;padding:20px;font-size:13px;">No data yet</td></tr>';
  }
  document.getElementById('summaryBody').innerHTML = html;
}

function exportCSV() {
  if (!state.logs.length) { toast('No logs to export','error'); return; }
  const isBoth = state.scale==='both';
  let csv = '#,Tag #,Length (original),Diameter (original),Length (cutback),Diameter (cutback)' + (isBoth?',Doyle BF,Scribner BF,m3 (Doyle)' : ',Board Feet ('+(state.scale||'BF')+'),m3') + '\n';
  state.logs.forEach(log => {
    const pbf = primaryBF(log.bf);
    csv += log.rowNum+','+log.tag+','+log.length+','+log.diameter+','+log.lengthCut+','+log.diameterCut;
    if (isBoth) csv += ','+(log.bf?.doyle||'')+','+(log.bf?.scribner||'')+','+(bfToM3(log.bf?.doyle)||'');
    else csv += ','+(pbf||'')+','+(bfToM3(pbf)||'');
    csv += '\n';
  });
  dlFile(csv,(state.tallyName||'log-tally').replace(/\s+/g,'_')+'.csv','text/csv');
  toast('CSV exported','success');
}
function exportJSON() { dlFile(JSON.stringify(state,null,2),(state.tallyName||'log-tally').replace(/\s+/g,'_')+'_backup.json','application/json'); toast('Backup saved','success'); }
function handleImport(e) {
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=(ev)=>{ try { const d=JSON.parse(ev.target.result); if(!d.logs) throw new Error(); state=d; saveState(); updateHeader(); toast('Restored '+state.logs.length+' logs','success'); } catch { toast('Invalid backup file','error'); } };
  r.readAsText(file); e.target.value='';
}
function dlFile(content,filename,type) { const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }
function confirmClearAll() {
  if (!confirm('Export a backup first?\n\nOK = export then clear\nCancel = just clear')) { if (!confirm('Clear all data? This cannot be undone.')) return; clearAll(); return; }
  exportJSON(); setTimeout(clearAll,500);
}
function clearAll() {
  state={tallyName:'',scale:null,nextTag:null,currentSeries:0,logs:[],spreadsheetId:null};
  tagPrefix=''; tagNumLength=5;
  saveState(); updateHeader();
  if (currentMode==='keypad') Keypad.reset();
  toast('Cleared — ready for new load');
}

function updateOnline() { document.getElementById('offlineBadge').classList.toggle('show',!navigator.onLine); }
window.addEventListener('online',updateOnline);
window.addEventListener('offline',updateOnline);

document.addEventListener('DOMContentLoaded',()=>{
  loadState(); updateHeader(); updateOnline(); Sheets.init();
  enterEntryMode();
  document.querySelectorAll('.modal-bg').forEach(bg=>bg.addEventListener('click',e=>{if(e.target===bg)bg.classList.remove('show');}));
  document.getElementById('seriesInput').addEventListener('keydown',e=>{if(e.key==='Enter')confirmNewSeries();});
  document.getElementById('tallyInput').addEventListener('keydown',e=>{if(e.key==='Enter')confirmTallyName();});
});

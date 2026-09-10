// ─── KEYPAD MODULE ────────────────────────────────────────────────────────────
const Keypad = (() => {
  let activeField = 'length';
  let values = { length: '', diameter: '' };
  let autoAdvance = false;
  let tagPrefix = '';

  function render() {
    const panel = document.getElementById('panel-keypad');
    if (!panel) return;
    const s = window.appState ? window.appState() : {};
    const bfPreview = computeBFPreview();
    const totalBF = s.logs ? s.logs.reduce((acc, l) => acc + (window.primaryBF ? window.primaryBF(l.bf)||0 : 0), 0) : 0;
    const totalM3 = window.bfToM3 ? window.bfToM3(totalBF) : null;

    panel.innerHTML = `
      <div class="kp-wrapper">
        <div class="kp-tag-row">
          <div class="kp-tag-label">TAG</div>
          <div class="kp-tag-val" id="kpTagVal">${getTagDisplay()}</div>
          <div class="kp-tag-actions">
            <button class="kp-tag-btn" onclick="Keypad.openTagModal()">＋</button>
            <button class="kp-tag-btn" onclick="Keypad.skipTag()">SKIP</button>
          </div>
        </div>
        <div class="kp-stats-strip">
          <div class="kp-stat"><span class="kp-stat-val">${s.logs ? s.logs.length : 0}</span><span class="kp-stat-lbl">LOGS</span></div>
          <div class="kp-stat"><span class="kp-stat-val">${totalBF >= 1000 ? (totalBF/1000).toFixed(1)+'k' : totalBF}</span><span class="kp-stat-lbl">BF</span></div>
          <div class="kp-stat"><span class="kp-stat-val">${totalM3 != null ? totalM3.toFixed(1) : '—'}</span><span class="kp-stat-lbl">m³</span></div>
        </div>
        <div class="kp-fields">
          <div class="kp-field ${activeField==='length' ? 'kp-field-active' : ''}" onclick="Keypad.setActive('length')">
            <div class="kp-field-header">
              <div class="kp-field-label">LENGTH</div>
              ${values.length ? '<button class="kp-clr-btn" onclick="event.stopPropagation();Keypad.clrField(\'length\')">CLR</button>' : ''}
            </div>
            <div class="kp-field-val">${formatFieldDisplay('length')}</div>
            ${getCutbackHint('length')}
          </div>
          <div class="kp-field ${activeField==='diameter' ? 'kp-field-active' : ''}" onclick="Keypad.setActive('diameter')">
            <div class="kp-field-header">
              <div class="kp-field-label">DIAMETER</div>
              ${values.diameter ? '<button class="kp-clr-btn" onclick="event.stopPropagation();Keypad.clrField(\'diameter\')">CLR</button>' : ''}
            </div>
            <div class="kp-field-val">${formatFieldDisplay('diameter')}</div>
            ${getCutbackHint('diameter')}
          </div>
        </div>
        <div class="kp-bf-row">
          <span class="kp-bf-label">${getBFLabel()}</span>
          <span class="kp-bf-val">${bfPreview}</span>
        </div>
        <div class="kp-options-row">
          <label class="kp-toggle-label">
            <input type="checkbox" id="autoAdvanceToggle" ${autoAdvance ? 'checked' : ''} onchange="Keypad.setAutoAdvance(this.checked)">
            Auto-advance
          </label>
        </div>
        <div class="kp-pad">
          <button class="kp-key" onclick="Keypad.press('7')">7</button>
          <button class="kp-key" onclick="Keypad.press('8')">8</button>
          <button class="kp-key" onclick="Keypad.press('9')">9</button>
          <button class="kp-key kp-key-func" onclick="Keypad.del()">DEL</button>
          <button class="kp-key" onclick="Keypad.press('4')">4</button>
          <button class="kp-key" onclick="Keypad.press('5')">5</button>
          <button class="kp-key" onclick="Keypad.press('6')">6</button>
          <button class="kp-key kp-key-slash" onclick="Keypad.press('/')">/</button>
          <button class="kp-key" onclick="Keypad.press('1')">1</button>
          <button class="kp-key" onclick="Keypad.press('2')">2</button>
          <button class="kp-key" onclick="Keypad.press('3')">3</button>
          <button class="kp-key kp-key-advance" onclick="Keypad.advance()">→</button>
          <button class="kp-key kp-key-zero" onclick="Keypad.press('0')">0</button>
          <button class="kp-key kp-key-next" onclick="Keypad.next()">NEXT</button>
        </div>
      </div>
      <div class="modal-bg" id="kpTagModal">
        <div class="modal" style="max-width:360px">
          <h3>SET TAG SERIES</h3>
          <p>Select prefix letters (optional) then enter starting number.</p>
          <div style="margin-bottom:12px">
            <div class="kp-alpha-label">PREFIX (optional)</div>
            <div class="kp-alpha-grid" id="kpAlphaGrid"></div>
            <div class="kp-alpha-preview" id="kpAlphaPreview"></div>
          </div>
          <div style="margin-bottom:16px">
            <div class="kp-alpha-label">STARTING NUMBER</div>
            <input class="modal-input" id="kpSeriesNum" type="number" placeholder="72300" inputmode="numeric" style="margin-bottom:0">
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" onclick="Keypad.closeTagModal()">Cancel</button>
            <button class="btn-confirm" onclick="Keypad.confirmTagSeries()">START</button>
          </div>
        </div>
      </div>
    `;
    buildAlphaGrid();
    setupLongPress(document.getElementById('kpTagVal'), () => Keypad.openTagModal());
  }

  function formatFieldDisplay(field) {
    const v = values[field];
    if (!v) return '<span class="kp-placeholder">—</span>';
    return '<span class="' + (v.includes('/') ? 'kp-val-cut' : '') + '">' + v + '</span>';
  }
  function getCutbackHint(field) {
    const v = values[field];
    if (!v || !v.includes('/')) return '<div class="kp-cut-hint"></div>';
    const parts = v.split('/');
    return '<div class="kp-cut-hint">cutback: ' + (parts[1] || '?') + '</div>';
  }
  function getBFLabel() {
    const s = window.appState ? window.appState().scale : null;
    if (s==='both') return 'Doyle / Scribner';
    if (s==='doyle') return 'Doyle BF';
    if (s==='scribner') return 'Scribner BF';
    return 'Board Feet';
  }
  function computeBFPreview() {
    const s = window.appState ? window.appState() : {};
    const bf = window.calcBF ? window.calcBF(values.length, values.diameter, s.scale) : null;
    if (!bf) return '—';
    if (bf.doyle !== undefined && bf.scribner !== undefined) return bf.doyle + ' / ' + bf.scribner;
    return String(bf.doyle ?? bf.scribner ?? '—');
  }
  function getTagDisplay() {
    const s = window.appState ? window.appState() : {};
    return s.nextTag !== null && s.nextTag !== undefined ? s.nextTag : '—';
  }

  function press(char) {
    const v = values[activeField];
    if (char==='/' && v.includes('/')) return;
    if (char==='/' && v==='') return;
    values[activeField] = v + char;
    render();
  }
  function del() { values[activeField] = values[activeField].slice(0,-1); render(); }
  function clrField(field) { values[field] = ''; activeField = field; render(); }
  function advance() { if (activeField==='length') { activeField='diameter'; render(); } else { next(); } }
  function next() {
    if (!values.length || !values.diameter) {
      if (window.toast) window.toast('Enter both length and diameter','error');
      activeField = !values.length ? 'length' : 'diameter';
      render(); return;
    }
    if (window.saveLogFromKeypad) {
      const ok = window.saveLogFromKeypad(values.length, values.diameter);
      if (ok) { values={length:'',diameter:''}; activeField='length'; render(); }
    }
  }
  function setActive(field) { activeField=field; render(); }
  function setAutoAdvance(val) { autoAdvance=val; }
  function skipTag() { if (window.skipTag) window.skipTag(); render(); }

  function openTagModal() {
    tagPrefix='';
    document.getElementById('kpTagModal').classList.add('show');
    document.getElementById('kpSeriesNum').value='';
    updateAlphaPreview();
  }
  function closeTagModal() { document.getElementById('kpTagModal').classList.remove('show'); }
  function confirmTagSeries() {
    const numVal = document.getElementById('kpSeriesNum').value.trim();
    if (!numVal) { if(window.toast) window.toast('Enter a starting number','error'); return; }
    const startNum = parseInt(numVal);
    if (isNaN(startNum)) { if(window.toast) window.toast('Invalid number','error'); return; }
    const newTag = tagPrefix + String(startNum).padStart(numVal.length,'0');
    if (window.setNextTag) window.setNextTag(newTag, tagPrefix, startNum, numVal.length);
    closeTagModal(); render();
  }
  function buildAlphaGrid() {
    const grid = document.getElementById('kpAlphaGrid');
    if (!grid) return;
    grid.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l =>
      '<button class="kp-alpha-btn '+(tagPrefix.includes(l)?'kp-alpha-active':'')+'" onclick="Keypad.toggleLetter(\''+l+'\')">'+l+'</button>'
    ).join('');
  }
  function toggleLetter(l) { tagPrefix = tagPrefix.endsWith(l) ? tagPrefix.slice(0,-1) : tagPrefix+l; buildAlphaGrid(); updateAlphaPreview(); }
  function updateAlphaPreview() { const el=document.getElementById('kpAlphaPreview'); if(el) el.textContent = tagPrefix ? 'Prefix: "'+tagPrefix+'"' : 'No prefix — numeric only'; }

  function setupLongPress(el, callback) {
    if (!el) return;
    let timer;
    el.addEventListener('touchstart',()=>{timer=setTimeout(callback,600);},{passive:true});
    el.addEventListener('touchend',()=>clearTimeout(timer));
    el.addEventListener('touchmove',()=>clearTimeout(timer),{passive:true});
    el.addEventListener('mousedown',()=>{timer=setTimeout(callback,600);});
    el.addEventListener('mouseup',()=>clearTimeout(timer));
  }

  return { render, press, del, clrField, advance, next, setActive, setAutoAdvance, skipTag, openTagModal, closeTagModal, confirmTagSeries, toggleLetter, reset() { values={length:'',diameter:''}; activeField='length'; } };
})();

window.parseField = function(val) {
  if (val===null||val===undefined||val==='') return null;
  const s=String(val).trim().replace(/\s/g,'');
  if (s.includes('/')) { const [a,b]=s.split('/'); const p=parseFloat(a),c=parseFloat(b); if(!isNaN(p)&&!isNaN(c)) return{raw:s,phys:p,cut:c,hasCutback:true}; return null; }
  const n=parseFloat(s); return isNaN(n)?null:{raw:s,phys:n,cut:n,hasCutback:false};
};
window.primaryBF = function(bf) { if(!bf) return null; return bf.doyle??bf.scribner??null; };

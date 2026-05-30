// ─── KEYPAD MODULE ────────────────────────────────────────────────────────────
// Full-screen numeric/alpha keypad for outdoor log entry

const Keypad = (() => {

  // Which field is active: 'length' or 'diameter'
  let activeField = 'length';
  // Raw string values for each field
  let values = { length: '', diameter: '' };
  // Auto-advance setting
  let autoAdvance = false;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  function render() {
    const panel = document.getElementById('panel-keypad');
    if (!panel) return;

    const scale = window.appState ? window.appState().scale : null;
    const bfPreview = computeBFPreview();

    panel.innerHTML = `
      <div class="kp-wrapper">

        <!-- TAG ROW -->
        <div class="kp-tag-row">
          <div class="kp-tag-label">TAG</div>
          <div class="kp-tag-val" id="kpTagVal" onlong-press="openTagModal()">${getTagDisplay()}</div>
          <div class="kp-tag-actions">
            <button class="kp-tag-btn" onclick="Keypad.openTagModal()" title="New series / set tag">＋</button>
            <button class="kp-tag-btn" onclick="Keypad.skipTag()">SKIP</button>
          </div>
        </div>

        <!-- FIELD DISPLAY -->
        <div class="kp-fields">
          <div class="kp-field ${activeField === 'length' ? 'kp-field-active' : ''}"
               onclick="Keypad.setActive('length')">
            <div class="kp-field-label">LENGTH</div>
            <div class="kp-field-val">${formatFieldDisplay('length')}</div>
            ${getCutbackHint('length')}
          </div>
          <div class="kp-field ${activeField === 'diameter' ? 'kp-field-active' : ''}"
               onclick="Keypad.setActive('diameter')">
            <div class="kp-field-label">DIAMETER</div>
            <div class="kp-field-val">${formatFieldDisplay('diameter')}</div>
            ${getCutbackHint('diameter')}
          </div>
        </div>

        <!-- BF PREVIEW -->
        <div class="kp-bf-row">
          <span class="kp-bf-label">${getBFLabel()}</span>
          <span class="kp-bf-val">${bfPreview}</span>
        </div>

        <!-- AUTO ADVANCE TOGGLE -->
        <div class="kp-options-row">
          <label class="kp-toggle-label">
            <input type="checkbox" id="autoAdvanceToggle" ${autoAdvance ? 'checked' : ''}
              onchange="Keypad.setAutoAdvance(this.checked)">
            Auto-advance fields
          </label>
        </div>

        <!-- KEYPAD -->
        <div class="kp-pad">
          <button class="kp-key" onclick="Keypad.press('7')">7</button>
          <button class="kp-key" onclick="Keypad.press('8')">8</button>
          <button class="kp-key" onclick="Keypad.press('9')">9</button>
          <button class="kp-key kp-key-func" onclick="Keypad.del()">DEL</button>

          <button class="kp-key" onclick="Keypad.press('4')">4</button>
          <button class="kp-key" onclick="Keypad.press('5')">5</button>
          <button class="kp-key" onclick="Keypad.press('6')">6</button>
          <button class="kp-key kp-key-func" onclick="Keypad.press('/')">／</button>

          <button class="kp-key" onclick="Keypad.press('1')">1</button>
          <button class="kp-key" onclick="Keypad.press('2')">2</button>
          <button class="kp-key" onclick="Keypad.press('3')">3</button>
          <button class="kp-key kp-key-advance" onclick="Keypad.advance()">→</button>

          <button class="kp-key kp-key-zero" onclick="Keypad.press('0')">0</button>
          <button class="kp-key kp-key-next" onclick="Keypad.next()">NEXT</button>
        </div>

      </div>

      <!-- TAG MODAL (inline) -->
      <div class="modal-bg" id="kpTagModal">
        <div class="modal" style="max-width:360px">
          <h3>SET TAG SERIES</h3>
          <p>Enter prefix letters (optional) then starting number.<br>Long-press tag area to reopen.</p>
          <div style="margin-bottom:12px">
            <div class="kp-alpha-label">PREFIX (optional)</div>
            <div class="kp-alpha-grid" id="kpAlphaGrid"></div>
            <div class="kp-alpha-preview" id="kpAlphaPreview"></div>
          </div>
          <div style="margin-bottom:16px">
            <div class="kp-alpha-label">STARTING NUMBER</div>
            <input class="modal-input" id="kpSeriesNum" type="number"
              placeholder="72300" inputmode="numeric" style="margin-bottom:0">
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" onclick="Keypad.closeTagModal()">Cancel</button>
            <button class="btn-confirm" onclick="Keypad.confirmTagSeries()">START</button>
          </div>
        </div>
      </div>
    `;

    // Build alphabet grid
    buildAlphaGrid();

    // Long press on tag val
    setupLongPress(document.getElementById('kpTagVal'), () => Keypad.openTagModal());
  }

  function formatFieldDisplay(field) {
    const v = values[field];
    if (!v) return '<span class="kp-placeholder">—</span>';
    return `<span class="${v.includes('/') ? 'kp-val-cut' : ''}">${v}</span>`;
  }

  function getCutbackHint(field) {
    const v = values[field];
    if (!v || !v.includes('/')) return '<div class="kp-cut-hint"></div>';
    const parts = v.split('/');
    const cut = parts[1] || '';
    return `<div class="kp-cut-hint">cutback: ${cut || '?'}</div>`;
  }

  function getBFLabel() {
    const s = window.appState ? window.appState().scale : null;
    if (s === 'both') return 'Doyle / Scribner';
    if (s === 'doyle') return 'Doyle BF';
    if (s === 'scribner') return 'Scribner BF';
    return 'Board Feet';
  }

  function computeBFPreview() {
    const bf = window.calcBF
      ? window.calcBF(values.length, values.diameter, window.appState ? window.appState().scale : null)
      : null;
    if (!bf) return '—';
    if (bf.doyle !== undefined && bf.scribner !== undefined)
      return `${bf.doyle} / ${bf.scribner}`;
    return String(bf.doyle ?? bf.scribner ?? '—');
  }

  function getTagDisplay() {
    const s = window.appState ? window.appState() : {};
    return s.nextTag !== null && s.nextTag !== undefined ? s.nextTag : '—';
  }

  // ── KEYPAD ACTIONS ─────────────────────────────────────────────────────────
  function press(char) {
    const v = values[activeField];

    // Only allow one slash
    if (char === '/' && v.includes('/')) return;
    // Don't allow slash as first character
    if (char === '/' && v === '') return;

    values[activeField] = v + char;
    render();

    // Auto-advance: if slash was just typed AND autoAdvance is on,
    // nothing yet — wait for the cutback digits.
    // If autoAdvance on and we just completed a cutback (slash + at least 1 digit after)
    // we don't auto-jump — user still needs → or NEXT.
  }

  function del() {
    const v = values[activeField];
    values[activeField] = v.slice(0, -1);
    render();
  }

  function advance() {
    // → key: move to next field, or save if on last field
    if (activeField === 'length') {
      activeField = 'diameter';
      render();
    } else {
      // On diameter → same as NEXT
      next();
    }
  }

  function next() {
    // Validate both fields have values
    if (!values.length || !values.diameter) {
      showKPToast('Enter both length and diameter', true);
      // Highlight missing field
      if (!values.length) { activeField = 'length'; render(); }
      else { activeField = 'diameter'; render(); }
      return;
    }
    // Pass to app save function
    if (window.saveLogFromKeypad) {
      const ok = window.saveLogFromKeypad(values.length, values.diameter);
      if (ok) {
        values = { length: '', diameter: '' };
        activeField = 'length';
        render();
      }
    }
  }

  function setActive(field) {
    activeField = field;
    render();
  }

  function setAutoAdvance(val) {
    autoAdvance = val;
  }

  function skipTag() {
    if (window.skipTag) window.skipTag();
    render();
  }

  // ── TAG MODAL ──────────────────────────────────────────────────────────────
  let tagPrefix = '';

  function openTagModal() {
    tagPrefix = '';
    document.getElementById('kpTagModal').classList.add('show');
    document.getElementById('kpSeriesNum').value = '';
    updateAlphaPreview();
  }

  function closeTagModal() {
    document.getElementById('kpTagModal').classList.remove('show');
  }

  function confirmTagSeries() {
    const numVal = document.getElementById('kpSeriesNum').value.trim();
    if (!numVal) { showKPToast('Enter a starting number', true); return; }
    const startNum = parseInt(numVal);
    if (isNaN(startNum)) { showKPToast('Invalid number', true); return; }
    const newTag = tagPrefix + String(startNum).padStart(numVal.length, '0');
    if (window.setNextTag) window.setNextTag(newTag, tagPrefix, startNum, numVal.length);
    closeTagModal();
    render();
  }

  function buildAlphaGrid() {
    const grid = document.getElementById('kpAlphaGrid');
    if (!grid) return;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    grid.innerHTML = letters.map(l =>
      `<button class="kp-alpha-btn ${tagPrefix.includes(l) ? 'kp-alpha-active' : ''}"
        onclick="Keypad.toggleLetter('${l}')">${l}</button>`
    ).join('');
  }

  function toggleLetter(l) {
    if (tagPrefix.endsWith(l)) {
      tagPrefix = tagPrefix.slice(0, -1);
    } else {
      tagPrefix += l;
    }
    buildAlphaGrid();
    updateAlphaPreview();
  }

  function updateAlphaPreview() {
    const el = document.getElementById('kpAlphaPreview');
    if (el) el.textContent = tagPrefix ? `Prefix: "${tagPrefix}"` : 'No prefix — numeric only';
  }

  // ── LONG PRESS ─────────────────────────────────────────────────────────────
  function setupLongPress(el, callback) {
    if (!el) return;
    let timer;
    el.addEventListener('touchstart', () => { timer = setTimeout(callback, 600); }, { passive: true });
    el.addEventListener('touchend', () => clearTimeout(timer));
    el.addEventListener('touchmove', () => clearTimeout(timer), { passive: true });
    // Also support mouse for desktop testing
    el.addEventListener('mousedown', () => { timer = setTimeout(callback, 600); });
    el.addEventListener('mouseup', () => clearTimeout(timer));
  }

  // ── TOAST ──────────────────────────────────────────────────────────────────
  function showKPToast(msg, err = false) {
    if (window.toast) window.toast(msg, err);
  }

  // ── PUBLIC ─────────────────────────────────────────────────────────────────
  return {
    render,
    press,
    del,
    advance,
    next,
    setActive,
    setAutoAdvance,
    skipTag,
    openTagModal,
    closeTagModal,
    confirmTagSeries,
    toggleLetter,
    reset() {
      values = { length: '', diameter: '' };
      activeField = 'length';
    },
  };

})();

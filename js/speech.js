// ─── SPEECH RECOGNITION + PARSER ─────────────────────────────────────────────

const Speech = (() => {
  let recognition = null;
  let isListening = false;

  const NUMS = {
    zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
    ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
    seventeen:17,eighteen:18,nineteen:19,twenty:20,'twenty-one':21,'twenty-two':22,
    'twenty-three':23,'twenty-four':24,'twenty-five':25,'twenty-six':26,
    'twenty-seven':27,'twenty-eight':28,'twenty-nine':29,thirty:30,
    'thirty-one':31,'thirty-two':32,'thirty-three':33,'thirty-four':34,
    'thirty-five':35,'thirty-six':36,'thirty-seven':37,'thirty-eight':38,
    'thirty-nine':39,forty:40,
  };

  function wordToNum(s) {
    s = s.trim().toLowerCase();
    if (NUMS[s] !== undefined) return NUMS[s];
    const pts = s.split(/\s+/);
    if (pts.length === 2 && NUMS[pts[0]] !== undefined && NUMS[pts[1]] !== undefined)
      return NUMS[pts[0]] + NUMS[pts[1]];
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function parseSegment(seg) {
    seg = seg.trim().toLowerCase()
      .replace(/\bslash\b/g, '/')
      .replace(/\bover\b/g, '/')
      .replace(/\bby\b/g, '/')
      .replace(/\bcutback\b/g, '/');
    if (seg.includes('/')) {
      const [a, b] = seg.split('/');
      const na = wordToNum(a.trim()), nb = wordToNum(b.trim());
      return (na !== null && nb !== null) ? `${na}/${nb}` : null;
    }
    const n = wordToNum(seg);
    return n !== null ? String(n) : null;
  }

  // Main speech parser — returns a command object
  function parse(text) {
    text = text.toLowerCase().trim();

    // SAVE
    if (/^(save|save log|log it|done|next)$/.test(text))
      return { cmd: 'save' };

    // SKIP
    if (/^skip/.test(text))
      return { cmd: 'skip' };

    // TALLY NAME: "tally name Coldwater 633"
    const tnMatch = text.match(/^tally\s+name\s+(.+)$/);
    if (tnMatch)
      return { cmd: 'tallyName', value: tnMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase()) };

    // NEW SERIES: "new series 72400"
    if (text.includes('new series') || text.includes('new sequence')) {
      const m = text.match(/(?:new series|new sequence)\s*(?:starting\s*(?:at\s*)?)(\d+)/);
      return m
        ? { cmd: 'newSeries', value: parseInt(m[1]) }
        : { cmd: 'newSeriesPrompt' };
    }

    // MEASUREMENTS: up to 2 values (length, diameter)
    const segs = text.split(/[,;]|\band\b/).map(s => s.trim()).filter(Boolean);
    const vals = segs.map(parseSegment).filter(v => v !== null);
    if (vals.length > 0)
      return { cmd: 'measurements', length: vals[0], diameter: vals[1] || null };

    return { cmd: 'unknown' };
  }

  function setup(onResult, onStatus) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onStatus('unavailable'); return; }

    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => { isListening = true; onStatus('listening'); };
    recognition.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      onResult(final || interim, !!final);
    };
    recognition.onerror = (e) => {
      stop();
      if (e.error !== 'no-speech') onStatus('error:' + e.error);
      else onStatus('idle');
    };
    recognition.onend = () => { isListening = false; onStatus('idle'); };
  }

  function toggle() {
    if (!recognition) return;
    if (isListening) recognition.stop();
    else try { recognition.start(); } catch(e) {}
  }

  function stop() {
    if (recognition && isListening) recognition.stop();
  }

  return { setup, toggle, stop, parse };
})();

// ─── SCRIBNER DECIMAL C — OFFICIAL LOOKUP TABLE ──────────────────────────────
// Scribner Decimal C has no exact closed-form formula — it's defined by mill
// sawing diagrams, tabulated per whole-inch diameter and log length. The
// quadratic approximation (0.79D²-2D-4)*L/16 that used to be the only
// implementation is the standard textbook fit to that table, but it visibly
// diverges from official values — especially for small-diameter logs (Decimal
// C rounds to the nearest 10 bf, which swings hard in % terms on small
// volumes) and for lengths far from 16 ft (the rule's length-scaling isn't
// perfectly linear).
//
// Table below: board feet by small-end diameter (inches, rows) x length
// (feet, columns) — Koch, P. (1972), as tabulated in Briggs, D.G., "Board
// Foot Log Rules", Appendix 3 (Univ. of Washington Rural Technology
// Initiative), Table 1.
//
// Diameter is rounded to the nearest whole inch for the row lookup (loggers
// tally diameter to the nearest inch by convention). Length is linearly
// interpolated between the two nearest tabulated columns when it falls
// between them. Outside the table's diameter (6-30") or length (6-16 ft)
// range, `lookup()` returns null and the caller should fall back to the
// quadratic formula.
const ScribnerTable = (() => {
  const LENGTHS = [6, 8, 10, 12, 14, 16];
  const TABLE = {
    6:  [5,  5,  10, 10, 10, 20],
    7:  [5,  10, 10, 20, 20, 30],
    8:  [10, 10, 20, 20, 20, 30],
    9:  [10, 20, 30, 30, 30, 40],
    10: [20, 30, 30, 30, 40, 60],
    11: [20, 30, 40, 40, 50, 70],
    12: [30, 40, 50, 60, 70, 80],
    13: [40, 50, 60, 70, 80, 100],
    14: [40, 60, 70, 90, 100, 110],
    15: [50, 70, 90, 110, 120, 140],
    16: [60, 80, 100, 120, 140, 160],
    17: [70, 90, 120, 140, 160, 180],
    18: [80, 110, 130, 160, 190, 210],
    19: [90, 120, 150, 180, 210, 240],
    20: [110, 140, 170, 210, 240, 280],
    21: [120, 150, 190, 230, 270, 300],
    22: [130, 170, 210, 250, 290, 330],
    23: [140, 190, 230, 280, 330, 380],
    24: [150, 210, 250, 300, 350, 400],
    25: [170, 230, 290, 340, 400, 460],
    26: [190, 250, 310, 370, 440, 500],
    27: [210, 270, 340, 410, 480, 550],
    28: [220, 290, 360, 440, 510, 580],
    29: [230, 310, 380, 460, 530, 610],
    30: [250, 330, 410, 490, 570, 660],
  };
  const MIN_D = 6, MAX_D = 30, MIN_L = LENGTHS[0], MAX_L = LENGTHS[LENGTHS.length - 1];

  // Returns the official Scribner Decimal C board feet for diameter d
  // (inches) and length l (feet), or null if outside the table's range.
  function lookup(d, l) {
    const dr = Math.round(d);
    if (dr < MIN_D || dr > MAX_D || l < MIN_L || l > MAX_L) return null;
    const row = TABLE[dr];
    const i = LENGTHS.indexOf(l);
    if (i !== -1) return row[i];
    let lo = 0;
    while (lo < LENGTHS.length - 1 && LENGTHS[lo + 1] < l) lo++;
    const l0 = LENGTHS[lo], l1 = LENGTHS[lo + 1], v0 = row[lo], v1 = row[lo + 1];
    return Math.round(v0 + (v1 - v0) * (l - l0) / (l1 - l0));
  }

  return { lookup, MIN_D, MAX_D, MIN_L, MAX_L };
})();

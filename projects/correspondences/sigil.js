// A figure for a symbol whose source prints none: its name, traced on a square.
//
// Scot names sixty-eight spirits and prints no seal; Agrippa names modes, Muses, strings and
// intervals and draws none of them. Those silences are findings, and `[[no_figure]]` keeps
// them. But an instrument where a quarter of the graph can only drone is thinner than it
// needs to be, so these symbols get a figure that is **plainly mine**: `warrant: authored`,
// and the card shows the source's silence directly above it.
//
// # The rule
//
// The old way of making a sigil from a name, the one behind the planetary seals: reduce
// each letter to a number, find the numbers on a magic square, and draw the line that
// visits them in order. Here:
//
// - letters A-Z, reduced 1-9 in alphabet order (A=1 … I=9, J=1 …), which is the common
//   modern reduction and not a claim about any tradition's alphabet;
// - a letter that repeats the one before it is dropped, so the line never stalls;
// - the square is the 3×3 one, 4 9 2 / 3 5 7 / 8 1 6, whose rows, columns and diagonals
//   all sum to fifteen;
// - a small ring marks where the line starts and a bar where it ends, as on the seals.
//
// Deterministic by construction: the same name always makes the same figure, so a piece
// made with one can be found again. Nothing is random and nothing is looked up.

const SQUARE = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

/// Where each number 1-9 sits on the square, in figure space (-1..1, y up).
const CELL = (() => {
  const out = {};
  SQUARE.forEach((row, r) => row.forEach((n, c) => {
    out[n] = [(c - 1) * 0.62, (1 - r) * 0.62];
  }));
  return out;
})();

/// The numbers a name reduces to, repeats collapsed.
export function digitsOf(text) {
  const out = [];
  for (const ch of String(text).toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) continue;
    const d = ((code - 65) % 9) + 1;
    if (out[out.length - 1] !== d) out.push(d);
  }
  return out;
}

/// The points the line visits, in order.
export function pointsOf(digits) {
  return digits.map((d) => CELL[d]);
}

/// Line segments for a sigil: the path, a ring at the start, a bar across the end.
export function sigilSegments(digits) {
  const pts = pointsOf(digits);
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push([...pts[i - 1], ...pts[i]]);
  if (pts.length) {
    const [x, y] = pts[0];
    const r = 0.09;
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * Math.PI * 2;
      const a1 = ((k + 1) / 10) * Math.PI * 2;
      out.push([x + r * Math.cos(a0), y + r * Math.sin(a0), x + r * Math.cos(a1), y + r * Math.sin(a1)]);
    }
  }
  if (pts.length > 1) {
    // The bar is square to the last stroke.
    const [x0, y0] = pts[pts.length - 2];
    const [x1, y1] = pts[pts.length - 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * 0.12;
    const ny = ((x1 - x0) / len) * 0.12;
    out.push([x1 - nx, y1 - ny, x1 + nx, y1 + ny]);
  }
  return out;
}

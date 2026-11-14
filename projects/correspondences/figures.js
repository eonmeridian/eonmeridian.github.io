// The figure a symbol actually has, as lines and dots.
//
// Nothing here is invented. Every mark comes from an attribute the graph holds under a
// citation, and the drawing follows `Sigil.swift` so the same symbol reads the same on a
// phone and here.
//
// # The partition this file is one half of
//
// A symbol either **has** a figure, or its source is **recorded as printing none**. Those
// are different claims and they must not draw the same mark. Scot's 1665 quarto names
// sixty-eight spirits and gives no seal, and `[[no_figure]]` records that refusal with a
// locus; a tarot card that merely lacked a renderer here drew the identical dashed frame
// and so claimed a silence nobody made.
//
// `tests/figures.test.mjs` asserts the partition over all 445 symbols, in both directions.
// It is the reason this file covers every kind rather than the two that were easiest.
//
// # Marks, and why the count is the rhythm
//
// Both line and dot figures draw a row as **one mark or two** — a solid line is one, a
// broken line two; a single point one, a double point two. That gives one rule across both
// systems: *sound the marks in the row*. It beats reading a `0` as a rest because **a
// broken line is not an absence**: yin is a drawn mark, and sounding it as silence would
// make the figure assert something the I Ching does not.
//
// Everything else follows the same rule. A barred element triangle is two marks because it
// is drawn with two. A seven of wands is seven pips because it has seven.

import { TREE } from './tree.js';
import { digitsOf, sigilSegments } from './sigil.js';
import { CONSTELLATIONS } from './constellations.js';
import { sealFor, SEAL_CREDIT } from './seal.js';

/// The zodiac in order, for placing a decan at its absolute longitude.
///
/// Structural rather than attributed: a decan carries `sign = "aquarius"` and
/// `degrees = "0-10"`, and turning that into a longitude needs to know Aquarius is
/// eleventh. That order is not a claim anybody disputes.
const ZODIAC = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

/// The court ranks in their order, so a court card has as many marks as its place.
const COURT = { page: 1, knight: 2, queen: 3, king: 4 };

function row(y, marks, kind) {
  return { y, marks, kind };
}

/// The id half of an address: `astro:element/fire` → `fire`.
const idOf = (address) => address.split('/').slice(1).join('/');

/// Where a figure's marks come from. Every figure carries one, the way every pitch carries
/// a provenance, because a drawn mark is a claim too.
///
/// - `cited` -- the marks are an attribute the graph holds under a citation: Legge's lines,
///   Agrippa's dots, the Tree's paths.
/// - `structural` -- arithmetic on cited data: a decan's slice of the wheel, a card's pips.
/// - `convention` -- a drawing convention nobody disputes, like the elemental triangles.
/// - `typography` -- how a character is written; a glyph beside Saturn is not a claim.
///
/// - `authored` -- a figure of mine, for a symbol whose source prints none: a name traced
///   on a square (`sigil.js`), or a proportion laid out as marks. The card shows the
///   source's silence directly above it.
///
/// - `second-source` -- a figure from a *different* book than the symbol's own: the Goetia's
///   seal on a spirit Scot prints none for, through the graph's `shares_name_with`
///   (`seal.js`). It names that book, and like `authored` may never read as `cited`.
export const WARRANT = {
  lines: 'cited',
  dots: 'cited',
  node: 'cited',
  path: 'cited',
  wedge: 'structural',
  pips: 'structural',
  court: 'structural',
  element: 'convention',
  card: 'typography',
  glyph: 'typography',
  sigil: 'authored',
  ratio: 'authored',
  constellation: 'authored',
  seal: 'second-source',
};

/// The figure for a symbol, or `null` where its source prints none. Carries `warrant`.
export function figureOf(node) {
  let fig = drawnOf(node);
  if (fig) fig.warrant = WARRANT[fig.shape];
  // A constellation read from the symbol's image (`tools/constellate.py`) is mine, so it
  // may only stand in for another figure of mine or for typography -- a trump's bare card
  // outline, a glyph. A cited or structural figure is never displaced by an authored one.
  // Another book's seal outranks a figure of mine: it is at least somebody's printed
  // figure for this spirit, even if not Scot's.
  const seal = sealFor(node);
  if (seal && (!fig || fig.warrant === 'authored')) {
    fig = {
      shape: 'seal',
      // On a Goetia spirit, its own book's seal; on a Scot spirit, another book's.
      warrant: seal.own ? 'cited' : 'second-source',
      strokes: seal.strokes,
      goetia: seal.goetia,
      plate: seal.plate,
      more: seal.more,
      credit: SEAL_CREDIT,
      rows: sealRows(seal.strokes),
    };
  }
  const c = CONSTELLATIONS[node.address];
  if (c && (!fig || (fig.warrant === 'authored' && fig.shape !== 'seal') || fig.warrant === 'typography')) {
    fig = {
      shape: 'constellation',
      warrant: 'authored',
      stars: c.stars,
      lines: c.lines,
      credit: c.credit,
      rows: c.stars.map(([, y]) => row(y, 1, 'star')),
    };
  }
  return fig;
}

function drawnOf(node) {
  const a = node.attributes ?? {};
  const kind = node.kind;

  // ── six lines, cast from the bottom up ────────────────────────────────────
  // `hd:gate` carries the same attribute because a gate *is* a hexagram — an identity
  // the graph asserts, not a resemblance.
  if (typeof a.lines === 'string' && /^[01]+$/.test(a.lines)) {
    const bits = [...a.lines];
    const n = bits.length;
    return {
      shape: 'lines',
      rows: bits.map((bit, i) =>
        row(n === 1 ? 0 : (i / (n - 1)) * 2 - 1, bit === '1' ? 1 : 2, bit === '1' ? 'solid' : 'broken')
      ),
    };
  }

  // ── four rows of one or two points, read downward ─────────────────────────
  // **The pattern is written in 1 and 2, not 0 and 1** — `1111` is Way, `1112` is The
  // Tail. A regex for `[01]` silently rejected fifteen of the sixteen figures, and they
  // then drew the mark that means a source printed nothing.
  if (typeof a.pattern === 'string' && /^[12]+$/.test(a.pattern)) {
    const bits = [...a.pattern];
    const n = bits.length;
    return {
      shape: 'dots',
      rows: bits.map((bit, i) =>
        row(1 - (i / (n - 1)) * 2, bit === '1' ? 1 : 2, bit === '1' ? 'single' : 'double')
      ),
    };
  }

  // ── a decan: ten degrees at an absolute longitude ─────────────────────────
  // `degrees` is a **range string** — "0-10", "10-20", "20-30" — not a number. Reading it
  // with `Number()` gave NaN and all thirty-six fell through.
  if (kind === 'decan') {
    const within = Number(String(a.degrees ?? '').split('-')[0]);
    const sign = ZODIAC.indexOf(String(a.sign ?? ''));
    if (Number.isFinite(within) && sign >= 0) {
      return { shape: 'wedge', start: sign * 30 + within, span: 10, rows: [row(0, 1, 'wedge')] };
    }
  }

  if (kind === 'sign' && Number.isFinite(Number(a.ordinal))) {
    return { shape: 'wedge', start: (Number(a.ordinal) - 1) * 30, span: 30, rows: [row(0, 1, 'wedge')] };
  }

  // ── the four elements, drawn rather than glyphed ──────────────────────────
  // `Sigil.swift` argues the case: the alchemical characters have patchy font coverage,
  // and a triangle is what the sign actually *is*. Air and earth are barred, which is a
  // second mark and therefore a second sound.
  const element = kind === 'element' ? idOf(node.address) : a.element;
  if (kind === 'element' || kind === 'suit') {
    const barred = element === 'air' || element === 'earth';
    return {
      shape: 'element',
      element,
      rows: barred
        ? [row(0, 1, 'triangle'), row(-0.1, 1, 'bar')]
        : [row(0, 1, 'triangle')],
    };
  }

  // ── a pip card is its pips ────────────────────────────────────────────────
  // Seven of wands is seven marks, which is the card and also its rhythm. A court card
  // has no pips, so it draws its suit's triangle and as many small bars as its place in
  // the court — page one, king four.
  if (kind === 'minor') {
    const rank = Number(a.rank);
    if (Number.isFinite(rank) && rank >= 1 && rank <= 10) {
      return {
        shape: 'pips',
        element: a.element,
        count: rank,
        rows: Array.from({ length: rank }, (_, i) => row(0, 1, 'pip')),
      };
    }
    const court = COURT[String(a.rank)] ?? 1;
    return {
      shape: 'court',
      element: a.element,
      count: court,
      rows: [row(0, 1, 'triangle'), ...Array.from({ length: court }, () => row(0, 1, 'rank'))],
    };
  }

  // ── a trump is a card, and carries the letter attributed to it ────────────
  // The glyph itself is drawn by the text layer, which can resolve `letter` against
  // `qbl:letter`. Here it is only named.
  if (kind === 'trump') {
    return { shape: 'card', letter: a.letter, rows: [row(0, 1, 'card')] };
  }

  // ── the Tree ──────────────────────────────────────────────────────────────
  if (kind === 'sephira' && Number.isFinite(Number(a.ordinal))) {
    return { shape: 'node', ordinal: Number(a.ordinal), rows: [row(0, 1, 'node')] };
  }
  if (kind === 'path' && a.from_sephira && a.to_sephira) {
    return {
      shape: 'path',
      from: Number(a.from_sephira),
      to: Number(a.to_sephira),
      letter: a.letter,
      rows: [row(0, 1, 'path')],
    };
  }

  // ── a glyph is typography ─────────────────────────────────────────────────
  // §Interface: *"glyphs are typography, not correspondence — ♄ beside Saturn is how the
  // character is written rather than a claim anyone made."* The graph carries `glyph` for
  // trigrams and Hebrew letters; planets and signs are looked up client-side, which is
  // where typography belongs. Drawn by the text layer.
  if (typeof a.glyph === 'string' && a.glyph.length > 0) {
    return { shape: 'glyph', glyph: a.glyph, rows: [row(0, 1, 'glyph')] };
  }
  if (kind === 'planet') {
    return { shape: 'glyph', planet: idOf(node.address), rows: [row(0, 1, 'glyph')] };
  }

  // ── a proportion Agrippa states in words: its two terms, as marks ────────────
  // Three against two is the Diapente's hemiola, and it is what a divided string would
  // show if the book drew one. It does not; this is my figure, and says so.
  if (kind === 'ratio' && Number(a.ratio_num) > 0 && Number(a.ratio_den) > 0) {
    const num = Number(a.ratio_num);
    const den = Number(a.ratio_den);
    return { shape: 'ratio', num, den, rows: [row(0.4, num, 'term'), row(-0.4, den, 'term')] };
  }

  // ── a symbol whose source prints no figure: its name, traced on the square ────
  // Only for the kinds a source is recorded as silent on. Anything else reaching here is
  // a renderer that has not been written, and must stay visibly undrawn.
  if (AUTHORED_KINDS.has(`${node.system}:${kind}`)) {
    // An image in words is traced by what it shows, not by its label: "The image of the
    // first face of Aries" would give all thirty-six faces nearly one sigil.
    // A judgement likewise, by its opening clause in Legge's words: every label reads "The
    // judgement of hexagram N", and would trace sixty-four near-identical sigils.
    // A line text by its image, after Legge's formula: every one opens "N. In the Nth
    // line, undivided," and would trace 386 near-identical sigils.
    // A meaning likewise, by its first clause in Waite's words ("Dark man, friendly").
    const phrase = kind === 'face' ? imagePhraseOf(a.text)
      : kind === 'judgement' || kind === 'meaning' ? openingClauseOf(a.text)
        : kind === 'line' ? linePhraseOf(a.text)
          : null;
    const digits = digitsOf(phrase ?? node.label);
    if (digits.length) {
      return {
        shape: 'sigil',
        phrase,
        digits,
        rows: digits.map((d, i) => row(1 - (i / Math.max(1, digits.length - 1)) * 2, 1, 'point')),
      };
    }
  }

  // No figure. Deliberately distinguishable from "no figure yet": the caller pairs this
  // with the kind's `[[no_figure]]` declaration, and the test above fails if the two ever
  // come apart.
  return null;
}

/// A seal's rhythm: one mark for each of six bands, top to bottom, that has ink in it --
/// two where the band is busy. A seal has seventy strokes and should not play seventy steps.
function sealRows(strokes) {
  const bands = Array.from({ length: 6 }, () => 0);
  for (const s of strokes) {
    const y = s.reduce((t, p) => t + p[1], 0) / s.length;
    bands[Math.min(5, Math.max(0, Math.floor((1 - y) / 2 * 6)))] += 1;
  }
  const busy = [...bands].sort((a, b) => a - b)[3];
  return bands
    .map((n, i) => ({ n, y: 1 - (i + 0.5) / 3 }))
    .filter((b) => b.n > 0)
    .map((b) => row(b.y, b.n > busy ? 2 : 1, 'band'));
}

/// The kinds whose source is recorded as printing no figure, and so get one of mine.
/// Mirrors the `[[no_figure]]` entries in divinatory-os; `tests/figures.test.mjs` checks
/// the two agree, so a new silence cannot quietly go undrawn or a new source go ignored.
export const AUTHORED_KINDS = new Set([
  'cm:spirit', 'music:mode', 'music:interval', 'music:muse', 'music:string', 'music:ratio',
  'astro:face', 'iching:judgement', 'iching:line', 'tarot:meaning',
  'cm:rank',
]);

/// A judgement's opening clause: up to its first comma, semicolon or full stop, and never
/// more than forty characters. `null` when there is no text.
export function openingClauseOf(text) {
  if (!text) return null;
  const clause = String(text).split(/[,;.]/)[0].trim();
  return clause.slice(0, 40) || null;
}

/// What a line text shows, in Legge's words: its first clause with the numeral, the
/// formula "In the Nth line, undivided," his bracketed supplements and "shows / we see its
/// subject" dropped. "1. In the first (or lowest) line, undivided, (we see its subject as)
/// the dragon lying hid" gives "the dragon lying hid". `null` if nothing is left, and the
/// label is traced instead.
export function linePhraseOf(text) {
  if (!text) return null;
  let s = String(text).replace(/^\s*\d+\s*\.\s*/, '').replace(/\([^)]*\)/g, ' ');
  s = s.split(/[.;:]/)[0];
  s = s.replace(/^.*?\bline\b[^,]*,\s*(?:un)?divided\s*,?\s*/i, '');
  for (let prev; prev !== s;) {
    prev = s;
    s = s.replace(/^(?:shows|we see|its subject|is|as)\b[\s,]*/i, '');
  }
  s = s.split(',')[0].replace(/\s+/g, ' ').trim();
  return s.slice(0, 40) || null;
}

/// What a face's image shows, in Agrippa's words: what "ascendeth" up to the first comma,
/// semicolon or colon, with "the image / form / figure of" dropped. "in the first face of
/// Aries, ascendeth the image of a black man, standing ..." gives "a black man". `null`
/// if the sentence is not in that shape, and the label is traced instead.
export function imagePhraseOf(text) {
  const m = /\b(?:ascendeth|ascend|ariseth)\s+([^,;:]+)/i.exec(String(text ?? ''));
  if (!m) return null;
  return m[1].replace(/^(?:the|a)\s+(?:image|form|figure)\s+of\s+/i, '').trim() || null;
}

/// How many events one turn of this figure sounds.
export function stepsOf(figure) {
  if (!figure) return [];
  const steps = [];
  figure.rows.forEach((r, index) => {
    for (let m = 0; m < r.marks; m++) {
      steps.push({
        row: index,
        y: r.y,
        kind: r.kind,
        // Two marks in a row sound as a pair inside that row's slot rather than as two
        // slots, so a broken line reads as one line that is broken, not as two lines.
        // Spread evenly for more: three against two keeps both terms inside their slots.
        offset: r.marks === 1 ? 0 : (m / (r.marks - 1) - 0.5) * 0.36,
      });
    }
  });
  return steps;
}

const TAU = Math.PI * 2;

function arc(out, a0, a1, r, steps = 14) {
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + ((a1 - a0) * i) / steps;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
    out.push([Math.cos(t0) * r, Math.sin(t0) * r, Math.cos(t1) * r, Math.sin(t1) * r]);
  }
}

/// Where sephira `n` sits in a Tree figure, in figure space (-1..1): the Tree as Liber 777
/// prints it (`tree.js`), scaled to the figure. Shared by the sephira and path figures so
/// the two can never disagree about a place, and with the atlas's Tree diagram.
const treeY = (n) => 0.82 - TREE[n][1] * 1.64;
const treeX = (n) => TREE[n][0] * 1.7;

/// Line segments for drawing, in figure-local coordinates (-1..1 on both axes).
export function segmentsOf(figure) {
  if (!figure) return [];
  const out = [];

  switch (figure.shape) {
    case 'lines':
      for (const r of figure.rows) {
        if (r.kind === 'solid') out.push([-0.8, r.y, 0.8, r.y]);
        else {
          // The gap is the yin. Its width is `Sigil.swift`'s 0.22 of the figure.
          out.push([-0.8, r.y, -0.18, r.y]);
          out.push([0.18, r.y, 0.8, r.y]);
        }
      }
      return out;

    case 'dots':
      // A dot is a very short segment: this renderer has one primitive, and a point
      // sprite would need a second pass for four marks.
      for (const r of figure.rows) {
        if (r.kind === 'single') out.push([-0.06, r.y, 0.06, r.y]);
        else {
          out.push([-0.46, r.y, -0.34, r.y]);
          out.push([0.34, r.y, 0.46, r.y]);
        }
      }
      return out;

    case 'wedge': {
      const a0 = (figure.start * Math.PI) / 180;
      const a1 = ((figure.start + figure.span) * Math.PI) / 180;
      arc(out, a0, a1, 0.82);
      // Closed to the centre, so a ten-degree decan reads as a slice of the wheel rather
      // than a stray arc.
      out.push([0, 0, Math.cos(a0) * 0.82, Math.sin(a0) * 0.82]);
      out.push([0, 0, Math.cos(a1) * 0.82, Math.sin(a1) * 0.82]);
      return out;
    }

    case 'element':
    case 'court':
      triangle(out, figure.element);
      if (figure.shape === 'court') {
        for (let i = 0; i < figure.count; i++) {
          const y = -0.9 + i * 0.13;
          out.push([-0.2, y, 0.2, y]);
        }
      }
      return out;

    case 'sigil':
      return sigilSegments(figure.digits);

    case 'seal':
      for (const s of figure.strokes) {
        for (let i = 1; i < s.length; i++) out.push([...s[i - 1], ...s[i]]);
      }
      return out;

    case 'constellation': {
      for (const [i, j] of figure.lines) out.push([...figure.stars[i], ...figure.stars[j]]);
      // Each star a small cross, so a star with one line still reads as a star.
      for (const [x, y] of figure.stars) {
        out.push([x - 0.05, y, x + 0.05, y]);
        out.push([x, y - 0.05, x, y + 0.05]);
      }
      return out;
    }

    case 'ratio':
      // Each term a row of short marks, spaced across the width, like the geomantic dots.
      for (const [y, n] of [[0.4, figure.num], [-0.4, figure.den]]) {
        for (let i = 0; i < n; i++) {
          const x = n === 1 ? 0 : -0.6 + (i / (n - 1)) * 1.2;
          out.push([x - 0.06, y, x + 0.06, y]);
        }
      }
      return out;

    case 'pips': {
      // Laid out in the grid a pip card actually uses: two columns, and an odd card puts
      // its last pip on the centre line.
      const n = figure.count;
      for (let i = 0; i < n; i++) {
        const col = n === 1 ? 0 : i === n - 1 && n % 2 === 1 ? 0 : i % 2 === 0 ? -0.38 : 0.38;
        const rows = Math.ceil(n / 2);
        const r = Math.floor(i / 2);
        const y = rows === 1 ? 0 : 0.62 - (r / (rows - 1)) * 1.24;
        out.push([col - 0.09, y, col + 0.09, y]);
      }
      return out;
    }

    case 'card':
      // The outline only. Its letter is drawn by the text layer.
      out.push([-0.52, -0.78, 0.52, -0.78]);
      out.push([0.52, -0.78, 0.52, 0.78]);
      out.push([0.52, 0.78, -0.52, 0.78]);
      out.push([-0.52, 0.78, -0.52, -0.78]);
      return out;

    case 'node': {
      // The whole Tree, small, with this sephira ringed — so Kether and Malkuth are two
      // figures rather than one circle twice. The ten places are the grid `path` below
      // uses, so a sephira and a path through it put it in the same spot. The faint nine
      // are a census of the kind, like the guide rings: which sephiroth *there are*, not
      // a claim about how any of them connect. No line is drawn between them; a line is
      // a path, and a path is its own symbol with its own citation.
      for (let n = 1; n <= 10; n++) {
        const [cx, cy] = [treeX(n), treeY(n)];
        const r = n === figure.ordinal ? 0.2 : 0.06;
        const steps = n === figure.ordinal ? 18 : 6;
        for (let i = 0; i < steps; i++) {
          const t0 = (i / steps) * TAU;
          const t1 = ((i + 1) / steps) * TAU;
          out.push([cx + Math.cos(t0) * r, cy + Math.sin(t0) * r, cx + Math.cos(t1) * r, cy + Math.sin(t1) * r]);
        }
      }
      return out;
    }

    case 'path': {
      // A path is an edge between two sephiroth, so it is drawn as one: a line with a
      // ring at each end. The endpoints stand where Liber 777 prints them (`tree.js`).
      const [x0, y0] = [treeX(figure.from), treeY(figure.from)];
      const [x1, y1] = [treeX(figure.to), treeY(figure.to)];
      out.push([x0, y0, x1, y1]);
      for (const [cx, cy] of [[x0, y0], [x1, y1]]) {
        for (let i = 0; i < 8; i++) {
          const t0 = (i / 8) * TAU;
          const t1 = ((i + 1) / 8) * TAU;
          out.push([cx + Math.cos(t0) * 0.1, cy + Math.sin(t0) * 0.1, cx + Math.cos(t1) * 0.1, cy + Math.sin(t1) * 0.1]);
        }
      }
      return out;
    }

    case 'glyph':
      // Drawn by the text layer. No segments, and the caller must not read that as
      // "nothing to draw" — see `textOf`.
      return out;

    default:
      return out;
  }
}

/// The four triangles: fire up, water down, air and earth barred.
function triangle(out, element) {
  const up = element === 'fire' || element === 'air';
  const s = up ? 1 : -1;
  const h = 0.62;
  out.push([-0.62, -h * s, 0.62, -h * s]);
  out.push([0.62, -h * s, 0, h * s]);
  out.push([0, h * s, -0.62, -h * s]);
  if (element === 'air' || element === 'earth') {
    out.push([-0.3, -h * s * 0.1, 0.3, -h * s * 0.1]);
  }
}

/// The text a figure needs drawn, or `null`. Glyphs only — a diagram is never labelled.
///
/// §Interface makes the diagram primary and the name a gloss, so a hexagram draws its
/// lines and is not captioned. A glyph is different: it *is* the mark, and typography is
/// how that mark is written.
export function textOf(figure) {
  if (!figure) return null;
  if (figure.shape === 'glyph') return { glyph: figure.glyph, planet: figure.planet };
  if (figure.shape === 'card') return { letter: figure.letter };
  return null;
}

/// The dashed empty frame, for a symbol whose source prints no figure.
///
/// A broken square rather than an empty space: an absence the eye slides over and a
/// recorded refusal are different things, and §Interface rule 4 wants the second visible.
export function emptyFrame() {
  const out = [];
  const r = 0.7;
  const per = 3;
  const corners = [
    [-r, -r, r, -r],
    [r, -r, r, r],
    [r, r, -r, r],
    [-r, r, -r, -r],
  ];
  for (const [x0, y0, x1, y1] of corners) {
    for (let i = 0; i < per; i++) {
      const t0 = i / per;
      const t1 = t0 + 0.6 / per;
      out.push([
        x0 + (x1 - x0) * t0,
        y0 + (y1 - y0) * t0,
        x0 + (x1 - x0) * t1,
        y0 + (y1 - y0) * t1,
      ]);
    }
  }
  return out;
}

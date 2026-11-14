// The two places where a system *is* a diagram: the Tree of Life and the wheel of decans.
//
// Everywhere else the atlas draws a symbol's own figure. These two are different: the Tree
// is ten sephiroth and the twenty-two paths between them, and the wheel is thirty-six
// decans round twelve signs, and in both the arrangement is the thing a practitioner reads.
//
// # Every line is an edge the kernel returned
//
// §Interface rule 7. A path is drawn between two sephiroth because the path symbol has two
// cited `connects` edges, not because the sephiroth are near each other; a decan is set in
// its sign because of its cited `decan_of`. A path whose edges are missing is left out and
// counted, never guessed. Each stroke carries its edge's label in the atlas's grammar.
//
// # Where the diagram itself is a claim
//
// The Tree's positions are the ones Liber 777 prints (`tree.js`). The wheel's order is the
// zodiac's, which nobody disputes, with each sign's decans in their degree order.
//
// # Gaps are holes
//
// §Interface rule 4. Agrippa gives the geomantic figure Reddish no sign, and the graph
// records that silence. So the figure is not set anywhere on the wheel: it stands outside
// it, in a dashed frame, with the reason. A figure with no place is not given one.
//
// Pure: `treeModel` and `wheelModel` take a small interface over the corpus and return
// plain data, so the tests can hold the diagrams to the graph; the SVG is built from that.

import { TREE, TREE_LOCUS } from './tree.js';
import { planetGlyph, signGlyph } from './text.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const idOf = (address) => address.slice(address.indexOf('/') + 1);

/// The stroke for a label: the same grammar as `graph.js` and `card.js`.
function stroke(label) {
  switch (label) {
    case 'established': return 'stroke="var(--ink)"';
    case 'traditional': return 'stroke="var(--ink)" stroke-dasharray="5 3"';
    case 'speculative': return 'stroke="var(--dim)" stroke-dasharray="1.5 3.5"';
    case 'contested': return 'stroke="var(--mark)"';
    default: return 'stroke="var(--mark)" stroke-dasharray="4 2 1 2"';
  }
}

// ─── the Tree ────────────────────────────────────────────────────────────────

/// `api`: `{ symbolsOf(system, kind), traverse(address) }`, each returning parsed JSON.
export function treeModel(api) {
  const sephiroth = api.symbolsOf('qbl', 'sephira').map((s) => ({
    address: s.address,
    label: s.label,
    n: Number(idOf(s.address)),
  })).filter((s) => TREE[s.n]);

  const paths = [];
  const unplaced = [];
  for (const p of api.symbolsOf('qbl', 'path')) {
    const edges = api.traverse(p.address);
    const ends = edges.filter((e) => e.relation === 'connects');
    const ns = ends.map((e) => Number(idOf(e.to)));
    if (ends.length !== 2 || ns.some((n) => !TREE[n])) {
      unplaced.push(p.address);
      continue;
    }
    paths.push({
      address: p.address,
      label: p.label,
      n: Number(idOf(p.address)),
      ends: ns,
      edges: ends,
      letters: edges.filter((e) => e.relation === 'lettered').map((e) => e.to),
      trumps: edges.filter((e) => e.relation === 'path_walked_by').map((e) => e.to),
    });
  }
  return { sephiroth, paths, unplaced };
}

export function treeSvg(model, { letterGlyph = () => null } = {}) {
  const W = 420;
  const H = 620;
  const at = (n) => [W / 2 + TREE[n][0] * W * 1.25, 40 + TREE[n][1] * (H - 110)];
  let out = `<svg viewBox="0 0 ${W} ${H}" class="diagram tree" role="img" ` +
    `aria-label="The Tree of Life: ten sephiroth and the paths between them">`;

  for (const p of model.paths) {
    const [a, b] = p.ends.map(at);
    // One stroke per `connects` edge's label, and both edges must agree to be one line.
    const label = p.edges.every((e) => e.confidence === p.edges[0].confidence)
      ? p.edges[0].confidence
      : 'contested';
    const glyph = p.letters.map((l) => letterGlyph(idOf(l))).filter(Boolean).join(' ');
    const trump = p.trumps.map(idOf).join(' ');
    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // Where a path's midpoint would sit on another's, its labels move off the line: a
    // horizontal path labels above itself, a path down the middle pillar beside itself.
    // Placement only; the line is where the edges put it either way.
    const flat = Math.abs(a[1] - b[1]) < 1;
    const upright = Math.abs(a[0] - b[0]) < 1;
    const [gx, gy, tx, ty, anchor] = flat
      ? [mx, my - 16, mx, my - 5, 'middle']
      : upright
        ? [mx + 10, my - 1, mx + 10, my + 10, 'start']
        : [mx, my - 2, mx, my + 11, 'middle'];
    out += `<g class="hit" data-addr="${esc(p.address)}">` +
      `<title>${esc(p.label)} — connects ${p.ends.join(' and ')}</title>` +
      `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${stroke(label)} stroke-width="1.2"/>` +
      `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="transparent" stroke-width="14"/>` +
      (glyph ? `<text x="${gx}" y="${gy}" class="letter" text-anchor="${anchor}">${esc(glyph)}</text>` : '') +
      (trump ? `<text x="${tx}" y="${ty}" class="trump" text-anchor="${anchor}">${esc(trump)}</text>` : '') +
      `</g>`;
  }
  for (const s of model.sephiroth) {
    const [x, y] = at(s.n);
    out += `<g class="hit" data-addr="${esc(s.address)}">` +
      `<title>${esc(s.label)}</title>` +
      `<circle cx="${x}" cy="${y}" r="22" class="sephira"/>` +
      `<text x="${x}" y="${y + 5}" class="num">${s.n}</text>` +
      `<text x="${x}" y="${y + 38}" class="name">${esc(s.label)}</text></g>`;
  }
  out += `<text x="${W / 2}" y="${H - 8}" class="credit">${esc(TREE_LOCUS)}` +
    `${model.unplaced.length ? ` · ${model.unplaced.length} path(s) not drawn: their edges are incomplete` : ''}` +
    `</text></svg>`;
  return out;
}

// ─── the wheel ───────────────────────────────────────────────────────────────

const ZODIAC = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

/// `api`: `{ symbolsOf, traverse, gaps(address) }`.
export function wheelModel(api) {
  const signs = api.symbolsOf('astro', 'sign')
    .map((s) => ({ address: s.address, label: s.label, id: idOf(s.address) }))
    .filter((s) => ZODIAC.includes(s.id));

  const decans = [];
  for (const d of api.symbolsOf('astro', 'decan')) {
    const edges = api.traverse(d.address);
    const sign = edges.find((e) => e.relation === 'decan_of');
    const from = Number(String(d.attributes?.degrees ?? '').split('-')[0]);
    if (!sign || !Number.isFinite(from)) continue;
    decans.push({
      address: d.address,
      label: d.label,
      sign: idOf(sign.to),
      start: ZODIAC.indexOf(idOf(sign.to)) * 30 + from,
      rulers: edges.filter((e) => e.relation === 'ruled_by'),
      cards: edges.filter((e) => e.relation === 'governed_by').map((e) => e.to),
    });
  }

  const figures = [];
  const unplaced = [];
  for (const f of api.symbolsOf('geomancy', 'figure')) {
    const signed = api.traverse(f.address)
      .filter((e) => e.relation === 'attributed_to' && e.to.startsWith('astro:sign/'));
    if (signed.length) {
      for (const e of signed) figures.push({ address: f.address, label: f.label, sign: idOf(e.to), edge: e });
    } else {
      const silence = api.gaps(f.address).find((g) => g.expected_kind === 'sign');
      unplaced.push({ address: f.address, label: f.label, silence: silence ?? null });
    }
  }
  return { signs, decans, figures, unplaced };
}

/// `tarot:minor/wands-7` as `7W`: the rank and the suit's initial, which is all the ring has
/// room for. The full name is in the title.
export function shortCard(address) {
  const [suit, rank] = idOf(address).split('-');
  return rank && suit ? `${rank}${suit[0].toUpperCase()}` : idOf(address);
}

export function wheelSvg(model, { cardLabel = shortCard, cardName = (a) => a } = {}) {
  const S = 620;
  const c = S / 2;
  // Aries rises on the left and the signs run counter-clockwise, as a chart is drawn:
  // on a screen whose y runs down, that is the angle π + longitude.
  const pt = (deg, r) => {
    const a = Math.PI + (deg * Math.PI) / 180;
    return [c + Math.cos(a) * r, c - Math.sin(a) * r];
  };
  const arc = (d0, d1, r0, r1) => {
    const [a, b, e, f] = [pt(d0, r1), pt(d1, r1), pt(d1, r0), pt(d0, r0)];
    return `M${a} A${r1},${r1} 0 0 0 ${b} L${e} A${r0},${r0} 0 0 1 ${f} Z`;
  };
  let out = `<svg viewBox="0 0 ${S} ${S}" class="diagram wheel" role="img" ` +
    `aria-label="The thirty-six decans round the twelve signs">`;

  for (const s of model.signs) {
    const i = ZODIAC.indexOf(s.id);
    const [x, y] = pt(i * 30 + 15, 250);
    out += `<g class="hit" data-addr="${esc(s.address)}"><title>${esc(s.label)}</title>` +
      `<path d="${arc(i * 30, i * 30 + 30, 225, 275)}" class="sign"/>` +
      `<text x="${x}" y="${y + 6}" class="glyph">${esc(signGlyph(s.id) ?? s.label)}</text></g>`;
  }

  for (const d of model.decans) {
    const [x, y] = pt(d.start + 5, 200);
    const [cx, cy] = pt(d.start + 5, 160);
    // Every ruler an edge gives, side by side. Two books agreeing show twice as one glyph
    // with both named in the title; two disagreeing show both glyphs.
    const glyphs = [...new Set(d.rulers.map((e) => planetGlyph(idOf(e.to)) ?? idOf(e.to)))];
    const who = d.rulers.map((e) => `${idOf(e.to)} (${e.source_id})`).join(', ');
    out += `<g class="hit" data-addr="${esc(d.address)}">` +
      `<title>${esc(d.label)} — ruled by ${esc(who)}${d.cards.length ? `; ${esc(d.cards.map(cardName).join(', '))}` : ''}</title>` +
      `<path d="${arc(d.start, d.start + 10, 175, 225)}" class="decan${glyphs.length > 1 ? ' split' : ''}"/>` +
      `<text x="${x}" y="${y + 5}" class="ruler">${esc(glyphs.join(''))}</text>` +
      (d.cards.length ? `<text x="${cx}" y="${cy + 4}" class="card">${esc(d.cards.map(cardLabel).join(' '))}</text>` : '') +
      `</g>`;
  }

  // Geomantic figures outside the wheel, at their sign, as Agrippa sets them.
  const bySign = new Map();
  for (const f of model.figures) {
    const k = bySign.get(f.sign) ?? 0;
    bySign.set(f.sign, k + 1);
    const i = ZODIAC.indexOf(f.sign);
    const [x, y] = pt(i * 30 + 10 + k * 10, 292);
    out += `<g class="hit" data-addr="${esc(f.address)}"><title>${esc(f.label)} — ${esc(f.sign)} (${esc(f.edge.source_id)})</title>` +
      `<text x="${x}" y="${y + 4}" class="figure">${esc(f.label)}</text></g>`;
  }
  model.unplaced.forEach((f, k) => {
    const y = S - 44 + k * 14;
    const why = f.silence
      ? `${f.silence.source_title}${f.silence.locus ? `, ${f.silence.locus}` : ''}: ${f.silence.reason}`
      : 'no sign given, and no silence recorded';
    out += `<g class="hit hole" data-addr="${esc(f.address)}"><title>${esc(why)}</title>` +
      `<rect x="12" y="${y - 11}" width="112" height="16" class="hole"/>` +
      `<text x="18" y="${y + 1}" class="figure">${esc(f.label)} — no sign</text></g>`;
  });
  return out + `</svg>`;
}

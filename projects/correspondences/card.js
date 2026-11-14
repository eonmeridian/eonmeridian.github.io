// The source card: who says so, and where.
//
// Every edge this page draws has always carried its citation across the boundary —
// `EdgeOut` has no shape without one — and until this card the page threw it away at the
// last step and kept only the stroke. A reader could see that Death and Scorpio were
// joined, and in what grammar, but not by whom, which is the one thing that distinguishes
// this atlas from a list of associations somebody typed.
//
// # What the card shows, in order
//
// 1. The claim, read the way it was walked, with the stroke it is drawn in.
// 2. The book: title, author, year, edition, and `about` — what the text is, for someone
//    meeting it for the first time.
// 3. The locus, because "who" without "where" cannot be checked.
// 4. What kind of authority it is. A derivation is a rule, and names the source its data
//    rests on; an editorial claim is somebody's own, under their name.
// 5. **Where books disagree, every answer, side by side.** The Fool is at Aleph in Liber
//    777 and at Shin in Lévi, and neither is the card's to choose.
//
// The maintainer's `note` is not shown. It is written for whoever edits the graph — its
// debts, what must never be added — and on a card for a visitor it would read as the
// apparatus talking to itself.

import { figureOf, segmentsOf, textOf } from './figures.js';
import { identityOf, factsOf, wordsOf } from './facts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const words = (id) => id.replace(/_/g, ' ');

/// The label in plain words. What each one *means* here, not a strength.
export const LABEL_WORDS = {
  established: 'established — structure: it follows from the data by arithmetic',
  traditional: 'traditional — what a named tradition assigns',
  contested: 'contested — the books disagree, and every answer is kept',
  speculative: 'speculative — a modern proposal, under its author’s name',
};

const KIND_WORDS = {
  primary: 'read from the source itself',
  secondary: 'read from a later work quoting its source',
  derivation: 'a rule applied to cited data',
  editorial: 'asserted here, under the author’s name',
};

/// A sample of the stroke, the same grammar as the atlas and the surface.
function strokeSvg(label) {
  const dash = {
    established: '',
    traditional: 'stroke-dasharray="5 3"',
    speculative: 'stroke-dasharray="1.5 3.5"',
  }[label];
  const colour = label === 'speculative' ? 'var(--dim)'
    : label === 'contested' || dash === undefined ? 'var(--mark)' : 'var(--ink)';
  const lines = label === 'contested'
    ? `<line x1="0" y1="3" x2="34" y2="3" stroke="${colour}"/><line x1="0" y1="8" x2="34" y2="8" stroke="${colour}"/>`
    : `<line x1="0" y1="5.5" x2="34" y2="5.5" stroke="${colour}" ${dash ?? 'stroke-dasharray="4 2 1 2"'}/>`;
  return `<svg class="stroke" width="34" height="11" aria-hidden="true">${lines}</svg>`;
}

/// One cited edge, as a claim and its book.
///
/// `ctx` supplies `source(id)`, `label(address)`, and `rivals(edge)` — the other edges
/// out of the same symbol by the same relation, which is what a disagreement looks like
/// from here.
export function claimHtml(edge, ctx, { rivals = true } = {}) {
  const src = ctx.source(edge.source_id);
  // `from` is always the symbol the edge was walked from, and `relation` is already the
  // name for that direction — `letter_of` from Shin, `lettered` from the Fool — so the
  // claim reads straight off in both.
  const subject = ctx.label(edge.from);
  const object = ctx.label(edge.to);

  const who = [src?.author, src?.year].filter(Boolean).map(esc).join(', ');
  const kind = src ? KIND_WORDS[src.kind] ?? src.kind : '';
  const grounds = src?.grounds ? ctx.source(src.grounds) : null;

  let html = `<div class="claim">` +
    `<div class="says">${strokeSvg(edge.confidence)}` +
    `<b>${esc(subject)}</b> <span class="rel">${esc(words(edge.relation))}</span> <b>${esc(object)}</b></div>` +
    `<div class="label">${esc(LABEL_WORDS[edge.confidence] ?? edge.confidence)}</div>` +
    `<div class="book"><i>${esc(src?.title ?? edge.source_title)}</i>${who ? ` — ${who}` : ''}</div>` +
    (edge.locus ? `<div class="locus">${esc(edge.locus)}</div>` : `<div class="locus none">no locus: a rule has no page</div>`) +
    `<div class="kind">${esc(kind)}${src?.public_domain ? ' · public domain' : ''}` +
    (grounds ? ` · resting on <i>${esc(grounds.title)}</i>` : '') + `</div>` +
    (src?.edition ? `<div class="edition">${esc(src.edition)}</div>` : '') +
    (src?.about ? `<p class="about">${esc(src.about)}</p>` : '') +
    (src?.plate ? plateHtml(src.plate) : '');

  if (rivals) {
    const others = ctx.rivals(edge);
    if (others.length) {
      html += `<div class="rivals"><div class="head">other books answer differently</div>` +
        others.map((o) => claimHtml(o, ctx, { rivals: false })).join('') + `</div>`;
    }
  }
  return html + `</div>`;
}

/// A plate on a card is its 700 px copy in `plates/thumb/` (sharp at 2x on a card, and a
/// seventh the weight of Lilly's scan); the link opens the full page to read it.
function plateHtml(plate) {
  return `<figure class="plate"><a href="plates/${esc(plate.file)}" target="_blank" rel="noopener">` +
    `<img src="plates/thumb/${esc(plate.file)}" alt="${esc(plate.caption)}" loading="lazy" decoding="async"></a>` +
    `<figcaption>${esc(plate.locus)}. ${esc(plate.caption)}</figcaption></figure>`;
}

/// The card for one edge, opened from the paths list.
export function edgeCard(edge, ctx) {
  return claimHtml(edge, ctx);
}

/// The card for a meeting between two pieces: every direct edge, then every channel as
/// its two hops through the third symbol. Kernel order throughout.
export function meetingCard(meet, ctx) {
  const a = ctx.label(meet.a);
  const b = ctx.label(meet.b);
  let html = `<div class="pair"><b>${esc(a)}</b> and <b>${esc(b)}</b></div>`;
  if (meet.direct.length) {
    html += `<div class="section">joined directly</div>` +
      meet.direct.map((e) => claimHtml(e, ctx)).join('');
  }
  for (const ch of meet.channels) {
    html += `<div class="section">meeting through <b>${esc(ch.via.label)}</b> ` +
      `<span class="addr">${esc(ch.via.address)}</span></div>` +
      ch.from_a.map((e) => claimHtml(e, ctx)).join('') +
      ch.from_b.map((e) => claimHtml(e, ctx)).join('');
  }
  return html;
}

/// The other answers to the same question, from other books.
///
/// Same symbol, same relation, same *kind* of answer, a different answer, and a different
/// source. Each condition is there because something is not a disagreement without it:
/// Shin is the letter of a path *and* of a trump, which is two facts; a hexagram changes
/// into six others under one rule, which is six facts. Only another book putting the same
/// thing somewhere else is the Fool at Aleph and at Shin.
///
/// Pure, so it can be tested against the real corpus.
export function rivalsOf(edge, traverse) {
  const kindOf = (addr) => addr.slice(0, addr.lastIndexOf('/'));
  return traverse(edge.from).filter((o) =>
    o.relation === edge.relation &&
    o.to !== edge.to &&
    kindOf(o.to) === kindOf(edge.to) &&
    o.source_id !== edge.source_id);
}

// ---- the symbol card ----
//
// What you get for standing on a symbol, rather than for asking about an edge. In order:
//
// 1. **Its figure, large.** The same segments the surface draws (`segmentsOf`), so the
//    card cannot show a different figure from the shape you are playing. Where the source
//    prints none, the card says whose page is silent and why (the `[[no_figure]]` reason,
//    with its locus) instead of drawing an empty frame.
// 2. **What it is**, from its own attributes (`facts.js`): "the third decan of Aquarius,
//    20-30°".
// 3. **The source's own words**, verbatim, where the graph carries them. Today that is
//    Scot's entry for each of the sixty-eight spirits.
// 4. **What the graph says about it**: every edge as a sentence, each one opening onto its
//    claim. Kernel order, never ranked.
// 5. **Further reading**, only in reading mode: pointers to books that are not in the
//    public domain. Supplied by `ctx.reading`, never by the graph, and never quoted.

/// What a figure's warrant means, in words. See `WARRANT` in `figures.js`.
const FIGURE_WORDS = {
  cited: 'drawn from the source',
  structural: 'by arithmetic on cited data',
  convention: 'a drawing convention',
  typography: 'how the character is written',
  'second-source': 'from another book than this symbol’s own',
  authored: 'my translation of an image, not a source’s',
};

/// For a figure of mine, what the rule was, so "mine" is never left unexplained.
const AUTHORED_HOW = {
  sigil: 'mine, not a source’s: its name traced on the 3×3 square (sigil.js)',
  ratio: 'mine, not a source’s: the proportion’s two terms laid out as marks',
  constellation: 'mine, not a source’s: stars read from the image by a fixed rule (tools/constellate.py)',
};

/// The figure as an inline SVG, in the page's ink. `null` when there is no figure.
function figureSvg(node) {
  const fig = figureOf(node);
  if (!fig) return null;
  const glyph = textOf(fig);
  // Figure space is -1..1 with y up; SVG's y runs down.
  const lines = segmentsOf(fig).map(([x1, y1, x2, y2]) =>
    `<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}"/>`).join('');
  const text = glyph?.glyph
    ? `<text x="0" y="0.32" text-anchor="middle" font-size="0.9">${esc(glyph.glyph)}</text>`
    : '';
  if (!lines && !text) return null;
  return `<svg class="figure" viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true">` +
    `<g stroke="currentColor" stroke-width="0.07" stroke-linecap="round" fill="none">${lines}</g>` +
    `<g fill="currentColor">${text}</g></svg>`;
}

/// The card for one symbol.
///
/// `ctx` supplies, beyond what `claimHtml` needs: `lookup(address)` -> node,
/// `traverse(address)` -> edges, `silence(node)` -> the no_figure entry or null,
/// `system(id)` -> the system's label, `short(id)` -> "Agrippa 1651" or "rule", and
/// `reading(node)` -> html, or '' when reading mode is off.
export function symbolCard(node, ctx) {
  let html = '';

  const fig = figureSvg(node);
  if (fig) html += fig;

  html += `<div class="pair"><b>${esc(node.label)}</b></div>` +
    `<div class="what">${esc(ctx.system(node.system))} · ${esc(words(node.kind))}` +
    ` <span class="addr">${esc(node.address)}</span></div>`;
  const id = identityOf(node, ctx.label);
  if (id) html += `<div class="identity">${esc(id)}</div>`;
  // How a spirit appears, in its book's words, cut by a stated rule in the ingest: the
  // words after its first verb of appearing. Quoted, because they are Scot's.
  if (node.attributes?.appearance) {
    html += `<div class="identity">appears “${esc(node.attributes.appearance)}”</div>`;
  }
  const drawn = figureOf(node);
  if (drawn) {
    const how = drawn.shape === 'seal'
      ? (drawn.warrant === 'cited'
        ? `drawn from the source: its seal, plate ${drawn.plate}`
        : `another book’s, not this one’s: the Goetia’s seal of ${drawn.goetia}, plate ${drawn.plate}`) +
        (drawn.more.length ? ` (the book prints a second, plate ${drawn.more.join(', ')})` : '')
      : drawn.phrase
      ? `mine, not a source’s: “${drawn.phrase}”, the image’s own words, traced on the 3×3 square`
      : AUTHORED_HOW[drawn.shape] ?? FIGURE_WORDS[drawn.warrant] ?? drawn.warrant;
    html += `<div class="kind">figure: ${esc(how)}</div>`;
    if (drawn.credit) html += `<div class="kind">image: ${esc(drawn.credit)}</div>`;
  }

  // After the name, not before it: the silence is a fact about this symbol, and a card
  // that opened on someone else's refusal read as a card about the wrong thing. The
  // registry writes its reasons with *emphasis*, which is turned into <i> after
  // escaping so nothing else in the string can become markup.
  // Shown whether or not a figure of mine is drawn: an authored sigil sits under the
  // source's silence, never in place of it.
  const silent = ctx.silence(node);
  if (silent) {
    const reason = esc(silent.reason).replace(/\*([^*]+)\*/g, '<i>$1</i>');
    html += `<div class="silence">no figure — <i>${esc(silent.source_title)}</i>` +
      `${silent.locus ? `, ${esc(silent.locus)}` : ''}: ${reason}</div>`;
  }

  const own = wordsOf(node);
  if (own) {
    const book = ctx.source(node.source_id);
    html += `<div class="section">in the source's words</div>` +
      `<blockquote class="words">${esc(own.text)}</blockquote>` +
      `<div class="book"><i>${esc(book?.title ?? node.source_title)}</i>` +
      `${book?.author ? ` — ${esc(book.author)}, ${esc(book.year)}` : ''}</div>` +
      (own.locus ? `<div class="locus">${esc(own.locus)}</div>` : '');
  }

  const edges = ctx.traverse(node.address);

  // Words a book joins to this symbol, shown here in the book's words: Agrippa's face on
  // its decan's card, so the decan is not only "20-30° of Aquarius"; king Wăn's judgement
  // on its hexagram's, so the hexagram is not only six lines and a number. Only these
  // relations, each an edge the kernel returned with its citation -- never text found by
  // matching names.
  // The duke of Kâu's line texts come six to a hexagram, each headed by its own label.
  const JOINED_WORDS = {
    has_image: () => 'its image',
    has_judgement: () => 'the judgement',
    has_meaning: () => 'its meaning',
    has_line: (words) => words.label.replace(/^Hexagram \d+, /, ''),
  };
  for (const e of edges.filter((x) => JOINED_WORDS[x.relation])) {
    const image = ctx.lookup(e.to);
    const said = image && wordsOf(image);
    if (!said) continue;
    const book = ctx.source(image.source_id);
    html += `<div class="section">${esc(JOINED_WORDS[e.relation](image))}</div>` +
      `<blockquote class="words">${esc(said.text)}</blockquote>` +
      `<div class="book"><i>${esc(book?.title ?? image.source_title)}</i>` +
      `${book?.author ? ` — ${esc(book.author)}, ${esc(book.year)}` : ''}</div>` +
      (e.locus ? `<div class="locus">${esc(e.locus)}</div>` : '');
  }

  // Each fact is a closed row; its claim -- book, locus, about, plate, rivals -- is built
  // by `factClaim` when the row is opened. Built eagerly, Mars's card was 194 KB of HTML
  // with the same plate 65 times, and parsing it was most of the cost of arriving there.
  const facts = factsOf(edges, ctx.lookup, ctx.label);
  if (facts.length) {
    html += `<div class="section">edges</div>` +
      facts.map((f, i) =>
        `<details class="fact" data-fact="${i}"><summary>${strokeSvg(f.edge.confidence)}` +
        `<span class="rel">${esc(words(f.edge.relation))}</span> ` +
        `<b>${esc(ctx.label(f.edge.to))}</b>` +
        (f.gloss ? ` <span class="gloss">— ${esc(f.gloss)}</span>` : '') +
        ` <span class="who">${esc(ctx.short(f.edge.source_id))}</span></summary></details>`).join('');
  }

  return html + (ctx.reading(node) || '');
}

/// The claim behind the `i`th fact on a symbol's card, for when its row is opened. The
/// same edges in the same order `symbolCard` listed, so `i` names the same fact.
export function factClaim(node, i, ctx) {
  const f = factsOf(ctx.traverse(node.address), ctx.lookup, ctx.label)[i];
  return f ? claimHtml(f.edge, ctx) : '';
}

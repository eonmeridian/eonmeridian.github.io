// Reading mode: pointers to books that are not in the public domain.
//
// The graph is public-domain sources only, and divinatory-os enforces that in its loader.
// But the living literature on every one of these systems is modern and in copyright, and
// an atlas that pretended it did not exist would be poorer and less honest about where a
// reader should go next. So this mode **points**: a book, where in it to look, and one line
// in monochord's own words about what the book covers there.
//
// # It points; it never quotes, and it never becomes warrant
//
// - No quotation. `tests/reading.test.mjs` refuses any `why` over 160 characters or with a
//   quotation mark in it, which is the rule made mechanical rather than remembered.
// - No meanings. A pointer says what a book *covers*, never what it says a symbol means;
//   paraphrasing Pollack's reading of the Moon would be quoting her with extra steps.
// - Not a source. Nothing here reaches `tuning.js`, `note.js`, `strudel.js` or
//   `sequencer.js`, and the same test asserts none of them imports this file. A pointer
//   cannot license a pitch, draw a figure, or appear in a programme note's "rests on".
// - Unchecked until checked. Every locus was drafted from memory, and the card says
//   "unchecked" beside it until someone has confirmed it against a copy.
// - Not ranked. Pointers are listed in the order `reading.json` gives them.

/// Does a pointer's target cover this symbol? An exact address, `system:kind/*`, or
/// `system:*`.
export function covers(target, node) {
  if (target === node.address) return true;
  if (target.endsWith('/*')) return node.address.startsWith(target.slice(0, -1));
  if (target.endsWith(':*')) return node.system === target.slice(0, -2);
  return false;
}

/// Every pointer that covers this symbol, with its work, in file order.
export function pointersFor(node, works) {
  const out = [];
  for (const work of works) {
    for (const pointer of work.pointers) {
      if (covers(pointer.target, node)) out.push({ work, pointer });
    }
  }
  return out;
}

const KEY = 'monochord.reading';

/// Whether reading mode is on for this viewer. A convenience, so it lives in the browser
/// and is allowed to be lost.
export function readingOn() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function setReading(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private window: fine */ }
}

/// The card's further-reading section, or '' when there is nothing to point to.
export function readingHtml(node, works, esc) {
  const found = pointersFor(node, works);
  if (!found.length) return '';
  return `<div class="section">further reading <span class="rights">not in the public domain · ` +
    `pointed to, never quoted</span></div>` +
    found.map(({ work, pointer }) =>
      `<div class="pointer"><div class="book"><i>${esc(work.title)}</i> — ` +
      `${esc(work.author)}, ${esc(work.year)}</div>` +
      `<div class="locus">${esc(pointer.locus)}` +
      `${pointer.checked ? '' : ' <span class="unchecked">unchecked</span>'}</div>` +
      `<div class="why">${esc(pointer.why)}</div>` +
      `<div class="kind">${esc(work.publisher)} · ${esc(work.rights)}</div></div>`).join('');
}

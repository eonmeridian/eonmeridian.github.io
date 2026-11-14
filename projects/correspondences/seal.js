// The Goetia's seals, from the graph.
//
// divinatory-os holds the Goetia's seventy-two as `cm:goetia`, each with the seal its plate
// prints, traced off Project Gutenberg's images of the 1916 plates into a `seal` attribute
// (`scripts/trace_goetia_seals.py` there). So:
//
// - on a Goetia spirit, its seal is **its own book's figure**: `warrant: cited`;
// - on one of Scot's spirits -- a different book, which prints no seal -- the seal of the
//   Goetia spirit it `shares_name_with` is shown as **another book's**: `second-source`,
//   under Scot's recorded silence, never in place of it.
//
// The join between the two books is the graph's (`derivation/goetia-scot-names`, a stated
// rule, labelled speculative), not this file's. Procel shares no name the rule reaches,
// so he keeps a sigil.

/// A seal attribute -- `x,y` points joined by spaces, strokes joined by `;` -- as polylines.
export function parseSeal(text) {
  return String(text ?? '')
    .split(';')
    .map((stroke) => stroke.trim().split(/\s+/).map((p) => p.split(',').map(Number))
      .filter((xy) => xy.length === 2 && xy.every(Number.isFinite)))
    .filter((stroke) => stroke.length > 1);
}

/// How a Scot spirit finds the Goetia spirit it shares a name with. Set by the page (and by
/// tests) from the graph's `shares_name_with` edges; nothing by default.
let linkFor = () => null;
export function setSealLinks(fn) {
  linkFor = fn;
}

function sealOf(goetia) {
  const a = goetia?.attributes ?? {};
  if (!a.seal) return null;
  return {
    goetia: goetia.label,
    plate: Number(a.seal_plate),
    more: a.other_seal_plates ? a.other_seal_plates.split(',').map((n) => Number(n.trim())) : [],
    strokes: parseSeal(a.seal),
  };
}

/// The seal to draw for a symbol, with whether it is the symbol's own book's, or null.
export function sealFor(node) {
  if (node.system === 'cm' && node.kind === 'goetia') {
    const s = sealOf(node);
    return s && { ...s, own: true };
  }
  if (node.system === 'cm' && node.kind === 'spirit') {
    const s = sealOf(linkFor(node.address));
    return s && { ...s, own: false };
  }
  return null;
}

export const SEAL_CREDIT =
  'the Goetia, L. W. de Laurence (Chicago, 1916), after Mathers and Crowley (1904); ' +
  'its plates as Project Gutenberg #72679 gives them, traced in divinatory-os';

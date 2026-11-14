// What the graph says about one symbol, in sentences.
//
// The symbol card's middle section. **Nothing here is written about a symbol**: every line
// is a template filled from an attribute the graph holds or an edge the kernel returned,
// so a fact on the card is exactly as warranted as the datum under it, and a symbol with
// thin data has a thin card. That is the point. A card that summarised what the Moon
// *means* would be a second, uncited atlas sitting on top of the cited one.
//
// # Why it exists: a bare pair can read as a different claim
//
// From the Moon, the paths list said `rules Aquarius 3`. That is correct -- the Moon rules
// the third decan of Aquarius by the Chaldean order -- and it reads as "the Moon rules
// Aquarius", which no tradition says. The decan's label is the graph's; what was missing
// is the sentence that says what kind of thing the label names. So a decan is always
// glossed as a decan here, wherever it appears as the other end of an edge.
//
// Pure, so `tests/card.test.mjs` can run it over the real corpus.

const ORDINAL_WORDS = ['first', 'second', 'third'];
const words = (id) => id.replace(/_/g, ' ');
const num = (s) => Number(s);

/// One line saying what kind of thing this symbol is, from its own attributes. `null`
/// when the attributes say nothing beyond the label.
///
/// `label(address)` resolves another symbol's label, so a decan can name its sign and a
/// path its two sephiroth by the graph's own names.
export function identityOf(node, label) {
  const a = node.attributes ?? {};
  switch (`${node.system}:${node.kind}`) {
    case 'astro:decan': {
      const within = String(a.degrees ?? '').split('-');
      const which = ORDINAL_WORDS[Math.floor(num(within[0]) / 10)] ?? '';
      const sign = label(`astro:sign/${a.sign}`);
      return `the ${which} decan of ${sign}, ${a.degrees}°`;
    }
    case 'astro:sign':
      return `sign ${num(a.ordinal)} of 12 · ${a.modality} · ${a.element}`;
    case 'cm:spirit':
      return `spirit ${num(a.entry)} of 68 in Scot's list`;
    case 'cm:goetia':
      return `spirit ${num(a.entry)} of 72 in the Goetia` +
        (a.aliases ? `, also called ${a.aliases.split('; ').join(', ')}` : '');
    case 'cm:rank':
      return `a rank of the spirits, ${num(a.ordinal)} of 7 in the Goetia's list`;
    case 'geomancy:figure':
      return a.names ? `also called ${a.names.split('; ').slice(1).join(', ')}` : null;
    case 'hd:gate':
      return `gate ${num(a.ordinal)} of 64`;
    case 'iching:hexagram':
      return `hexagram ${num(a.ordinal)} of 64 in the King Wen order`;
    case 'iching:trigram':
      return a.image ? `its image is ${a.image}` : null;
    case 'music:interval':
    case 'music:string':
    case 'music:ratio':
      return a.gloss ?? null;
    case 'qbl:sephira':
      return `sephira ${num(a.ordinal)} of 10`;
    case 'qbl:path':
      return `path ${num(a.ordinal)}, from ${label(`qbl:sephira/${a.from_sephira}`)} ` +
        `to ${label(`qbl:sephira/${a.to_sephira}`)}`;
    case 'qbl:letter':
      return `letter ${num(a.ordinal)} of 22`;
    case 'tarot:trump':
      return `trump ${num(a.ordinal)}`;
    case 'tarot:minor':
      return a.suit ? `${a.rank} of ${a.suit} · ${a.element}` : null;
    case 'tarot:suit':
      return a.element ? `the suit of ${a.element}` : null;
    default:
      return null;
  }
}

/// Every edge out of this symbol, as a sentence, in the kernel's order.
///
/// Not sorted. §"Not a ranking": an ordering by relevance or strength is the obvious next
/// idea and a forbidden one, so the card lists what `traverse` returned, as returned.
///
/// Each fact keeps its edge, so the card can open the claim (book, locus, rivals) under it.
/// The other end is glossed when its label alone would mislead -- today that is a decan.
export function factsOf(edges, lookup, label) {
  return edges.map((edge) => {
    const other = lookup(edge.to);
    const gloss = other && other.kind === 'decan' ? identityOf(other, label) : null;
    return {
      edge,
      text: `${words(edge.relation)} ${label(edge.to)}`,
      gloss,
    };
  });
}

/// The source's own words, if the graph carries them. Verbatim or nothing.
export function wordsOf(node) {
  const a = node.attributes ?? {};
  if (typeof a.text !== 'string' || !a.text) return null;
  return { text: a.text, locus: a.locus ?? null };
}

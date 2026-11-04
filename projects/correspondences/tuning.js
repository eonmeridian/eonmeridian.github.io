// Where pitch comes from, and whose it is.
//
// # Cents, not hertz
//
// `sounds-like` and `newmusic` both carry pitch in cents and convert at exactly two
// boundaries, and their reason is the right one: *"the moment anything rounds to a MIDI
// note number, just intonation's 386-cent third becomes 400 and the whole tuning apparatus
// is decorative."* Agrippa's fifth is 702 cents. A piano's is 700. If those ever became
// the same number this instrument would be playing equal temperament while claiming a
// 1651 citation, and nothing on screen would look wrong.
//
// So everything upstream of the oscillator is cents. [`centsToHz`] is the only place they
// become a frequency.
//
// # What `sounds-like` could not do, and this can
//
// Its own survey names the gap: *"the ragas, slendro and 'just major' are cents-only — the
// number 386 is there but nothing records that it is 5:4."* A tuning table there is a name
// and a list of numbers. Here a pitch can carry **who said so**:
//
//     { cents: 702, ratio: "3:2", provenance: "cited",
//       source: "agrippa-1651", locus: "Book II, ch. XXVI, p. 262" }
//
// # Three layers, and every note names its own
//
// 1. **`cited`** — the graph licenses it. `Corpus.proportions()` returns the Diapason at
//    2:1 and the Diapente at 3:2, both from Agrippa's p. 262. This layer was empty until
//    that page was read, and its emptiness was honest rather than an oversight.
// 2. **`authored:proportion`** — a proportion I assert that no source here states. Empty
//    now that Agrippa covers the two he gives; the Diatessaron is deliberately *not* put
//    back this way, because the graph records a gap where the book is silent and filling
//    it from memory is exactly what that gap exists to prevent.
// 3. **`authored:degree`** — an `ordinal` read as a scale degree. Plainly mine: no
//    tradition says the seventh trump is a minor third. It is what makes the other 417
//    symbols playable at all.
//
// Anything no layer covers stays **unpitched** — not a rest. The CLI insists on the
// distinction and so does this: *"an arrival with no cited ratio is not a rest: the
// traversal got there, and what is missing is a source licensing a pitch."*

/// C0 = 0 cents, A4 = 5700, matching `sounds-like`'s `scales.ts` and newmusic's
/// `events.py` so a pitch could move between these instruments without rounding.
export const A4_CENTS = 5700;

/// The one place cents become a frequency.
export function centsToHz(cents) {
  return 440 * 2 ** ((cents - A4_CENTS) / 1200);
}

/// How far a pitch sits from the nearest equal-tempered semitone.
///
/// Shown, not hidden. `sounds-like`'s tuning panel argues it and is right: *"the degrees
/// are shown in cents with their drift from equal temperament, because the drift IS the
/// tuning. A raga whose numbers are all multiples of a hundred is not a raga."* Agrippa's
/// fifth reads `+2¢`, which is the whole difference between his tuning and a keyboard's.
export function driftFrom12tet(cents) {
  return cents - Math.round(cents / 100) * 100;
}

/// A seven-degree just scale, for the authored layer.
///
/// Ratios rather than equal steps, because the cited layer is ratios and switching to
/// irrational intervals for my own material would be a different sound for no reason.
/// Mine, and labelled so wherever it is heard.
const DEGREES = [
  [1, 1],
  [9, 8],
  [5, 4],
  [4, 3],
  [3, 2],
  [5, 3],
  [15, 8],
];

const centsOf = (num, den) => 1200 * Math.log2(num / den);

export class Tuning {
  /**
   * @param {object} opts
   * @param {number} opts.tonicCents  mine. Default D3.
   * @param {number} opts.octaves     how far the degree layer spreads
   * @param {Array}  opts.proportions from `Corpus.proportions()`
   */
  constructor({ tonicCents = 5000, octaves = 3, proportions = [] } = {}) {
    this.tonicCents = tonicCents;
    this.octaves = octaves;
    // Keyed by the interval the proportion is *of*, so a symbol can ask directly.
    this.cited = new Map();
    for (const p of proportions) {
      this.cited.set(p.of, p);
      // A ratio symbol is itself standable-on, and sounds at its own proportion.
      this.cited.set(p.address, p);
    }
  }

  get tonicHz() {
    return centsToHz(this.tonicCents);
  }

  /// One row of a figure, as a degree above the symbol's own pitch.
  ///
  /// **A larger authored claim than the root, and it should be read as one.** The symbol's
  /// pitch is at least anchored to something — a cited proportion, or its declared ordinal.
  /// Saying that the *third line* of a hexagram is a fourth above the first is mine
  /// outright: no source in this graph gives a line any pitch content whatever, and the
  /// `[[no_figure]]` on Agrippa's modes exists precisely because he names them and prints
  /// no step pattern.
  ///
  /// It is here because the alternative was worse in a different way. Sounding every mark
  /// at one pitch made a hexagram eight beats on one note — coherent, and monotonous
  /// enough that nobody would use the instrument. A figure that ascends is a reading of
  /// the figure; a figure on one note is a reading of nothing.
  ///
  /// So the root carries whatever warrant it has, the shape of the figure above it is
  /// mine, and the surface says so. The rows ascend in the order the figure is **read** —
  /// a hexagram from its first line at the bottom, a geomantic figure from its top row,
  /// which for Agrippa is fire, then air, water, earth.
  ///
  /// Returns a pitch with the same shape as [`pitch`], but its `provenance` is downgraded:
  /// a row of a cited symbol is **not** cited, because the citation covers the symbol and
  /// not the interval I put between its lines.
  row(base, index) {
    if (!base || index === 0) return base;
    const [num, den] = DEGREES[index % DEGREES.length];
    const octave = Math.floor(index / DEGREES.length);
    const cents = base.cents + centsOf(num, den) + octave * 1200;
    return {
      cents,
      hz: centsToHz(cents),
      ratio: `${num}:${den}${octave ? ` ×2^${octave}` : ''} above ${base.ratio}`,
      // The root may be cited; the step above it never is.
      provenance: 'authored:row',
      rootProvenance: base.provenance,
      source: null,
      locus: null,
      drift: driftFrom12tet(cents),
    };
  }

  /// What licenses a pitch for this symbol, if anything.
  ///
  /// Returns `{ cents, hz, ratio, provenance, source, locus, drift }` or `null` for
  /// unpitched. `provenance` is never absent: a note whose warrant is unknown is the thing
  /// this file exists to prevent.
  pitch(node) {
    // Layer 1. The graph's own proportion, over a cited edge, from a named page.
    const cited = this.cited.get(node.address);
    if (cited) {
      const cents = this.tonicCents + cited.cents;
      return {
        cents,
        hz: centsToHz(cents),
        ratio: `${cited.num}:${cited.den}`,
        provenance: 'cited',
        source: cited.source_id,
        title: cited.source_title,
        locus: cited.locus,
        confidence: cited.confidence,
        drift: driftFrom12tet(cents),
      };
    }

    // Layer 3. An ordinal as a degree. (Layer 2 is deliberately empty — see the module
    // note: a proportion the graph records as *absent* must not be quietly supplied here.)
    const ordinal = Number(node.attributes?.ordinal);
    if (Number.isFinite(ordinal) && ordinal >= 1) {
      const i = Math.round(ordinal) - 1;
      const [num, den] = DEGREES[i % DEGREES.length];
      // Centred on the tonic rather than climbing away from it. Spreading upward only
      // put a symbol with a high ordinal near 3.5 kHz, which is a whistle rather than a
      // note; the register now runs an octave either side of where I set the tonic.
      const octave = (Math.floor(i / DEGREES.length) % this.octaves) - 1;
      const cents = this.tonicCents + centsOf(num, den) + octave * 1200;
      return {
        cents,
        hz: centsToHz(cents),
        ratio: `${num}:${den}${octave ? ` ×2^${octave}` : ''}`,
        provenance: 'authored:degree',
        source: null,
        locus: null,
        drift: driftFrom12tet(cents),
      };
    }

    // Nothing licenses a pitch here. Not a rest — see the module note.
    return null;
  }

  /// How much of what you are about to hear is yours.
  ///
  /// The instrument should never let you forget the proportion. A piece that is entirely
  /// `authored:degree` is a piece about my scale, not about Agrippa — and now that two
  /// pitches are genuinely cited, the difference is visible rather than theoretical.
  account(nodes) {
    const tally = { cited: 0, 'authored:degree': 0, unpitched: 0 };
    for (const node of nodes) {
      const p = this.pitch(node);
      tally[p ? p.provenance : 'unpitched'] += 1;
    }
    return tally;
  }
}

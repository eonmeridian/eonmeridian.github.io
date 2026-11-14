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
// 3. **`authored:degree`** — an `ordinal` read as a stop on the string: the (n-1)th fifth
//    of the chain (`string.js`). The rule is mine; its two generators are Agrippa's. It is
//    what makes the other 1083 symbols playable at all.
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

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/// A pitch as the nearest key plus how far off it is: `D4`, `E4 −14¢`.
///
/// For reading a knob, never for choosing a pitch. The key is a landmark and the cents
/// are the pitch, for the same reason the panel shows drift: rounding to the landmark is
/// the error this file exists to avoid.
export function noteName(cents) {
  const key = Math.round(cents / 100);
  const off = Math.round(cents - key * 100);
  const name = `${NAMES[((key % 12) + 12) % 12]}${Math.floor(key / 12)}`;
  return off ? `${name} ${off > 0 ? '+' : '−'}${Math.abs(off)}¢` : name;
}

// The authored layers take their pitches from one rule, the string: see `string.js`.
// (Until 2026-11-14 this was a seven-degree just scale, 1:1 9:8 5:4 4:3 3:2 5:3 15:8.)
import { OPEN_CENTS, DEFAULT_CHAIN, ordinalStop, rowStop, ratioText, lengthText, fold } from './string.js';

export class Tuning {
  /**
   * @param {object} opts
   * @param {number} opts.tonicCents  the open string. Mine. Default A2 (3300¢, 110 Hz).
   * @param {number} opts.chain       fifths in the chain before it repeats (string.js)
   * @param {Array}  opts.proportions from `Corpus.proportions()`
   */
  constructor({ tonicCents = OPEN_CENTS, chain = DEFAULT_CHAIN, proportions = [] } = {}) {
    this.tonicCents = tonicCents;
    this.chain = chain;
    /// Pitches set by hand, as cents above the tonic, keyed by address. Mine, and the
    /// most openly so of any layer: not a rule applied to the graph but a choice made
    /// about one symbol. Stored relative to the tonic so turning the tonic moves them too.
    this.hand = new Map();
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
    // A row climbs the chain from wherever the root stands. A hand-set or cited root has no
    // chain position of its own, so its rows count fifths from the open string's.
    const root = base.stop ?? { k: 0, a: 0, b: 0, cents: fold(base.cents - this.tonicCents) };
    const stop = rowStop(root, index);
    const cents = this.tonicCents + stop.cents;
    return {
      cents,
      hz: centsToHz(cents),
      ratio: ratioText(stop),
      length: lengthText(stop),
      stop,
      // The root may be cited; the step above it never is.
      provenance: 'authored:row',
      rootProvenance: base.provenance,
      source: null,
      locus: null,
      drift: driftFrom12tet(cents),
    };
  }

  /// The pitch of each step of a figure, in order: what the instrument actually sounds.
  ///
  /// The one place a figure's marks are pitched. The sequencer, the Strudel patch and the
  /// programme note all read from here, so the piece that leaves cannot quietly be a
  /// different piece from the one you heard. Entries are `null` when the symbol is unpitched.
  voicing(node, steps) {
    const root = this.pitch(node);
    return steps.map((step) => this.row(root, step.row));
  }

  /// Every distinct pitch a shape sounds: its root, then one per row above it.
  ///
  /// A broken line's two marks are one pitch, so this counts rows and not marks. A shape
  /// with no steps (a drone) sounds its root alone. Empty when the symbol is unpitched.
  pitchesOf(node, steps) {
    const root = this.pitch(node);
    if (!root) return [];
    const rows = [...new Set(steps.map((s) => s.row))].filter((r) => r > 0).sort((a, b) => a - b);
    return [root, ...rows.map((r) => this.row(root, r))];
  }

  /// What licenses a pitch for this symbol, if anything.
  ///
  /// Returns `{ cents, hz, ratio, provenance, source, locus, drift }` or `null` for
  /// unpitched. `provenance` is never absent: a note whose warrant is unknown is the thing
  /// this file exists to prevent.
  pitch(node) {
    // Layer 0. A pitch set by hand. It outranks a citation because the composer asked for
    // it -- and it says so, so a hand-set Diapente cannot pass for Agrippa's 3:2. Any cents
    // value: a microtone is just a number here, the same as everywhere else in this file.
    if (this.hand.has(node.address)) {
      const above = this.hand.get(node.address);
      const cents = this.tonicCents + above;
      return {
        cents,
        hz: centsToHz(cents),
        ratio: `${above >= 0 ? '+' : ''}${Math.round(above)}¢`,
        provenance: 'authored:hand',
        source: null,
        locus: null,
        drift: driftFrom12tet(cents),
      };
    }

    // Layer 1. The graph's own proportion, over a cited edge, from a named page.
    const cited = this.cited.get(node.address);
    if (cited) {
      // Both cited ratios are members of the string's rule (2:1 and 3:2), folded the same way.
      const cents = this.tonicCents + fold(cited.cents);
      // Its place on the chain: the power of 3 in the ratio (3:2 is one fifth, 2:1 none).
      let a = 0;
      for (let n = cited.num * cited.den; n % 3 === 0; n /= 3) a++;
      const stop = { k: a, a, b: Math.round(a * Math.log2(3) - fold(cited.cents) / 1200), cents: fold(cited.cents) };
      return {
        stop,
        cents,
        hz: centsToHz(cents),
        ratio: `${cited.num}:${cited.den}`,
        length: `${cited.den}/${cited.num}`,
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
      const stop = ordinalStop(ordinal, this.chain);
      const cents = this.tonicCents + stop.cents;
      return {
        cents,
        hz: centsToHz(cents),
        ratio: ratioText(stop),
        length: lengthText(stop),
        stop,
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
    const tally = { cited: 0, 'authored:degree': 0, 'authored:hand': 0, unpitched: 0 };
    for (const node of nodes) {
      const p = this.pitch(node);
      const k = p ? p.provenance : 'unpitched';
      tally[k] = (tally[k] ?? 0) + 1;
    }
    return tally;
  }
}

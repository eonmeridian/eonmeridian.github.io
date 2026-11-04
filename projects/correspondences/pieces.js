// The placed shapes: what the surface is played with.
//
// Clicking a symbol in the atlas **places** it and navigates to it, so a walk through the
// graph leaves a trail you can hear. Each piece spins at its own rate; a fixed playhead
// reads its figure as it passes; shapes at different rates drift against each other.
//
// # What a piece's position means: nothing
//
// Where you drag a shape is yours and says nothing about the graph. The atlas behind it is
// the opposite — every position there is `system → ring, kind → radius, ordinal → angle`
// and moving a node would be a lie. So the two must not be confused, and the surface keeps
// them apart: pieces live in their own plane in front of the armillary, and dragging one
// never writes back to a position in the world.
//
// # Rate is authored, the pattern is not
//
// The steps come from the figure, which comes from a cited attribute. The *rate* is a
// control I set, like the tonic, and it is labelled so. That is also why this does not
// breach §Interface rule 6 — the rotation depicts the reading of a sequence, which is a
// procedure; it asserts nothing about the symbol.

import { figureOf, stepsOf } from './figures.js';
import { DEFAULT_VOICE } from './voices.js';

/// Rates that are simple ratios of each other, so pieces phase rather than smear.
///
/// Offered as a list rather than a slider because two shapes at 1.0 and 1.03 sound like
/// one shape being wrong, while 2:3 sounds like two things. The numbers are mine.
export const RATES = [0.25, 1 / 3, 0.5, 2 / 3, 1, 1.5, 2, 3];

let nextId = 1;

export class Piece {
  /**
   * @param {object} node  a symbol from the corpus, with `attributes`
   * @param {object} opts
   */
  constructor(node, { x = 0, y = 0, rate = 1, silentKind = null } = {}) {
    this.id = nextId++;
    this.node = node;
    this.x = x;
    this.y = y;
    /// Turns per second. Mine.
    this.rate = rate;
    /// Unbounded turns elapsed. The playhead position is `turns % 1`, but the *count* has
    /// to be kept unwrapped: reconstructing crossings from a wrapped phase loses a whole
    /// turn taken inside one frame, because the phase lands back where it started and the
    /// comparison that detects a wrap sees no wrap at all. A tab that stalls for a second
    /// under a fast piece would go silent rather than catch up.
    this.turns = 0;
    this.phase = 0;
    /// The absolute slot index already sounded. Starts at 0 rather than -1, so a shape
    /// rests on its first mark instead of striking the instant it is placed.
    this.lastAbs = 0;
    this.muted = false;
    /// The composer's level for this shape, 0..1.
    ///
    /// **Loudness is a mix control here and never a carrier of confidence.** `audio.js`
    /// forbids gain from expressing an epistemic label — a louder note would read as a
    /// better-supported one, and `EpistemicLabel` orders by declaration and not by
    /// strength. That prohibition is on *deriving* level from a label. A composer setting
    /// a balance is authored, exactly like the rate and the tonic, and nothing anywhere
    /// reads a label to decide it.
    this.gain = 1;
    /// Which voice from `voices.js` this shape is played on.
    ///
    /// Authored, and on the same footing as `rate` and `gain`: the header of that file
    /// argues the case, and the short version is that choosing to hear a hexagram on a
    /// bell asserts nothing about the hexagram. The **graph's** timbre — the detune that
    /// makes a contested correspondence beat — is applied on top of whatever is chosen
    /// here and cannot be turned off from this end.
    ///
    /// Defaults to the voice the atlas already had, so nothing sounds different until
    /// somebody asks it to.
    this.voice = DEFAULT_VOICE;
    /// Set when this symbol's *kind* is declared to have no figure, so the surface can
    /// say whose page is silent instead of showing a blank shape with no explanation.
    this.silentKind = silentKind;

    this.figure = figureOf(node);
    this.steps = stepsOf(this.figure);
    /// Which step index sounded most recently, so the renderer can light it and the
    /// sequencer can tell when the playhead has crossed into the next one.
    this.lastStep = -1;
  }

  /// A piece with a figure can be *articulated*: its marks are read in turn.
  ///
  /// A piece without one cannot — its source prints no figure and the graph records the
  /// refusal with a locus. That is a finding rather than a defect.
  get playable() {
    return this.steps.length > 0;
  }

  /// But "no figure" is not "no sound", and conflating them was a mistake.
  ///
  /// Agrippa gives the Diapente a **proportion and no shape**: 3:2 on p. 262, and no
  /// diagram anywhere. So it has a pitch and no rhythm — which is a drone, not a silence.
  /// Treating it as silent meant the only two cited pitches in the whole graph could
  /// never be heard, which rather defeated the point of finding them.
  ///
  /// The two facts are separate and stay separate: the *figure* is absent because a page
  /// prints none, and the *pitch* is present because a page states one (or because I
  /// supplied a degree, in which case the drone is mine and the panel says so).
  get drones() {
    return this.steps.length === 0;
  }

  get address() {
    return this.node.address;
  }

  /// Advance the spin. Returns the step indices crossed since the last call, in order,
  /// so no event is dropped when a frame is long or a rate is high.
  advance(dt) {
    this.turns += dt * this.rate;
    this.phase = this.turns % 1;
    if (!this.playable) return [];

    const n = this.steps.length;
    // Absolute slot index, never wrapped. Every slot between the last one sounded and
    // this one is crossed, however many turns that spans, so nothing is dropped and
    // nothing fires twice.
    const nowAbs = Math.floor(this.turns * n);
    const crossed = [];
    for (let s = this.lastAbs + 1; s <= nowAbs; s++) crossed.push(((s % n) + n) % n);
    this.lastAbs = Math.max(this.lastAbs, nowAbs);

    if (crossed.length) this.lastStep = crossed[crossed.length - 1];
    return crossed;
  }
}

export class Surface {
  constructor() {
    this.pieces = [];
    this.selected = null;
  }

  place(node, opts = {}) {
    // Placing the same symbol twice is allowed: two copies at different rates against
    // each other is a legitimate thing to want, and refusing it would be an opinion about
    // composition rather than about the graph.
    const piece = new Piece(node, { ...opts, ...this.freeSpot() });
    this.pieces.push(piece);
    this.selected = piece;
    return piece;
  }

  remove(piece) {
    this.pieces = this.pieces.filter((p) => p !== piece);
    if (this.selected === piece) this.selected = null;
  }

  clear() {
    this.pieces = [];
    this.selected = null;
  }

  /// Somewhere that is not on top of something else. A ring that grows as it fills, so
  /// the first few land where they can be seen rather than stacking at the origin.
  freeSpot() {
    const i = this.pieces.length;
    const ring = Math.floor(i / 6);
    const a = (i % 6) * (Math.PI / 3) + ring * 0.4;
    const r = 0.42 + ring * 0.22;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.62 };
  }

  /// The piece under a point in surface coordinates, nearest first.
  at(x, y, radius = 0.13) {
    let best = null;
    let bestD = radius * radius;
    for (const p of this.pieces) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}

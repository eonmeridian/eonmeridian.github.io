// Turning the spin into sound.
//
// Each piece rotates at its own rate and a fixed playhead reads its figure. What sounds is
// **the marks in the row**: a solid line once, a broken line twice, a single point once, a
// double point twice. The pattern is cited data; the rate is mine.
//
// # Why this is a frame loop and not a lookahead scheduler
//
// `sounds-like` schedules with a 2 s lookahead and says why: *"the timer does not schedule
// the AUDIO, it schedules the SCHEDULING"*, which is what lets a note survive a 40 ms
// round trip to a server. That is the right design **there**, where events come from
// across a socket and the piece is written in advance.
//
// Here nothing is written in advance. A rate is a knob under your hand, and the whole
// point is that turning it changes what you hear now — so scheduling two seconds ahead
// would mean either ignoring the knob for two seconds or cancelling and rebuilding the
// queue on every movement of it. The events are also cheap and sparse: eight pieces at
// three turns a second over six steps is under 150 events a second, scheduled a frame out.
//
// What is taken from them is the part that matters at this scale: **an onset is always an
// absolute `ctx.currentTime`**, never "now", so a long frame moves the sound by the amount
// the frame was long rather than clumping every missed step onto one instant.

/// A step's onset is placed within the frame it was crossed in, rather than at the frame
/// boundary. Without this, two steps crossed in one 30 ms frame both land on the same
/// millisecond and sound as one thicker event.
function onsetsWithin(count, now, dt) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(now + (dt * i) / Math.max(1, count));
  }
  return out;
}

export class Sequencer {
  /**
   * @param {import('./pieces.js').Surface} surface
   * @param {import('./audio.js').Instrument} instrument
   * @param {import('./tuning.js').Tuning} tuning
   */
  constructor(surface, instrument, tuning) {
    this.surface = surface;
    this.instrument = instrument;
    this.tuning = tuning;
    this.running = false;
    /// Set by the renderer so a sounded step can be lit on the shape that made it.
    this.onStep = null;
  }

  /// Advance every piece and sound what the playhead crossed.
  ///
  /// `dt` is the frame's own duration, so a stalled tab resumes rather than firing a
  /// burst: the pieces advance by real elapsed time and their onsets are spread across it.
  tick(dt) {
    if (!this.running || !this.instrument.ctx) return;
    const now = this.instrument.now;

    // Shapes with a proportion and no figure hold rather than articulate. Started and
    // stopped here so a drone follows placement, removal and mute without a second
    // bookkeeping path that could disagree with this one.
    const wanted = new Set();
    for (const piece of this.surface.pieces) {
      if (!piece.drones || piece.muted) continue;
      const pitch = this.tuning.pitch(piece.node);
      if (!pitch) continue; // no figure *and* no pitch: genuinely silent
      wanted.add(piece.id);
      this.instrument.droneOn(
        piece.id,
        pitch.hz,
        pitch.provenance === 'cited' ? pitch.confidence ?? 'traditional' : 'established',
        piece.gain,
        piece.voice
      );
    }
    for (const id of [...this.instrument.drones.keys()]) {
      if (!wanted.has(id)) this.instrument.droneOff(id);
    }

    for (const piece of this.surface.pieces) {
      const crossed = piece.advance(dt);
      if (!crossed.length || piece.muted) continue;

      const at = onsetsWithin(crossed.length, now, dt);
      crossed.forEach((index, i) => {
        this.sound(piece, index, at[i]);
        if (this.onStep) this.onStep(piece, index);
      });
    }
  }

  /// One mark of one figure.
  ///
  /// The three states, at the point where they are decided:
  ///
  /// - a pitch the graph licenses, or one I supply → a tone;
  /// - an arrival nothing proportions → **unpitched**, struck;
  /// - a source that prints no figure → no step existed, so nothing reaches here at all.
  ///
  /// The last is why `Piece.playable` is false rather than the steps being empty and
  /// silently skipped: a shape that cannot be played should be visibly unplayable.
  sound(piece, index, at) {
    const step = piece.steps[index];
    const root = this.tuning.pitch(piece.node);

    // **Each row of the figure gets its own degree**, ascending from the symbol's pitch in
    // the order the figure is read. Sounding every mark at the root made a hexagram eight
    // beats on one note — coherent, and monotonous enough that nobody would play it.
    //
    // The step above the root is mine outright: no source here gives a line any pitch
    // content, which is exactly why Agrippa's modes carry a `[[no_figure]]`. So `row`
    // downgrades the provenance, and a row of a cited symbol reports as `authored:row`
    // rather than inheriting a citation that covers the symbol and not my interval.
    //
    // A broken line's **two marks share their row's pitch**: they are one line, drawn with
    // a gap, and giving them different degrees would invent a melodic step the figure does
    // not contain. That is why this keys off `step.row` and not off `index`.
    const pitch = this.tuning.row(root, step ? step.row : 0);

    if (!pitch) {
      this.instrument.struck(at, 0.18, piece.gain);
      return;
    }

    // The label of the *symbol's own kind* is not an epistemic label, so a placed shape
    // has no confidence of its own to voice. It sounds at the label of the claim that
    // licensed its pitch — `traditional` for Agrippa's proportions — and `established`
    // for a degree I assigned, because my own arithmetic is not in doubt even though my
    // choice of it is. The provenance is what the panel shows; the timbre follows it.
    const label = pitch.provenance === 'cited' ? pitch.confidence ?? 'traditional' : 'established';

    // A double mark is shorter, so a broken line reads as two touches rather than two
    // notes. Duration is mine and is the same for every symbol, so nothing about a
    // symbol's importance can leak into how long it rings.
    const dur = step.kind === 'broken' || step.kind === 'double' ? 0.26 : 0.5;
    // `piece.gain` was documented as the composer's level and then not passed — `struck`
    // took it and `tone` did not, so the mix worked on unpitched shapes and silently did
    // nothing on every pitched one.
    this.instrument.tone(pitch.hz, label, at, dur, piece.gain, piece.voice);
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }
}

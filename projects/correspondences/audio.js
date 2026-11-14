// The instrument. Plain Web Audio, no library.
//
// # What may and may not carry meaning
//
// divinatory-os's §Interface rule 2: *expressiveness may never manufacture confidence*.
// And `EpistemicLabel` **orders by declaration and not by strength** — there is no sense
// in which `traditional` is more than `speculative`, only a sense in which they are
// different kinds of claim. So:
//
// - **Loudness may not carry a label.** Louder-when-better is a ranking, and a ranking is
//   the one thing nothing in this graph would justify. Nothing here reads a label to
//   decide a level.
//
//   That is narrower than "every event at one gain", which is what this said first and
//   what it enforced until a mix was wanted. A composer balancing two shapes against each
//   other is authored — the same kind of decision as the tonic and the rate, and labelled
//   the same way. The rule is about *derivation*, not about the dial existing: `tone`
//   takes a `level` from the piece, and no code path anywhere computes one from
//   `EpistemicLabel`.
// - **Brightness may not carry a label**, which is narrower than the "brightness is
//   forbidden" this said first, and narrower in exactly the way the loudness rule above
//   already had to become.
//
//   The first wording banned the filter, not the ranking. But a note whose cutoff opens
//   on the attack and settles back is how an oscillator stops sounding like a test tone
//   and starts sounding like something with a body — `sounds-like`'s `instruments.ts`
//   calls the sweep *"the single cheapest thing that makes two timbres sound like two
//   instruments rather than two pitches"*, and it is right. Refusing it did not protect
//   the reader from a ranking; it just made every voice a bare sine.
//
//   So the sweep is here, and it is **the same sweep for every label**. `_sweep` takes
//   no label and is not reachable from one: the filter is opened by the note's own
//   frequency and duration, both of which the graph fixes. Two notes of the same pitch
//   and length are indistinguishable in brightness whether one is `established` and the
//   other `contested` — which is the property the rule exists to protect. What still
//   cannot happen is brightness *derived from* a label, and nothing computes one.
//
//   The test is the same one loudness gets: if you can hear which claim is better
//   supported, that is the violation. You cannot. You can hear that a note begins.
// - **Timbre is admissible**, because it is categorical. Two tones beating is not "less"
//   than one pure tone, it is *two sources disagreeing*.
//
// The visual grammar in divinatory-os already made the same call and reached the same
// answer: `AtlasLayout.strokeEdge` draws a contested edge as **two forked strands**,
// on the grounds that *"disagreement should be visible before it is read."* This file is
// that sentence in the other medium.
//
// # Three states, not two
//
// Straight out of the `compose` command's own comment, which is the sharpest thing in
// divinatory-os's CLI:
//
// | state | sound |
// |---|---|
// | a pitch is licensed | a tone, timbre by label |
// | arrived, nothing licenses a pitch | **unpitched** — struck, damped noise |
// | nothing was reached | a rest, whose *kind* is audible |
//
// The middle row is the one that would never occur to anyone and the one the apparatus
// insists on. Spelling it as a note would invent a pitch; spelling it as a rest would
// claim nothing got there.

import { voiceOf, DEFAULT_VOICE } from './voices.js';

const PEAK = 0.16; // one gain for everything. See the note above.
const DETUNE_TRADITIONAL = 2; // cents. Transmitted through many hands: a slow chorus.
// cents. Wide enough that you hear the beat, not a chorus: 14 cents apart beats about
// 2.4 times a second at 294 Hz. It was 36 apart (6 a second) until Eon asked for it
// softer on 2026-11-14; still three and a half times traditional's spread.
const DETUNE_CONTESTED = 7;

const REVERB_S = 2.4;   // long enough to be a room, short enough not to smear a figure
const SEND = 0.20;      // how much of the sum goes to the room
const DELAY_S = 0.375;  // a dotted eighth at 120: lands off the beat, not on it
const UNVOICED = [1, 0, 1 / 3, 0, 1 / 5, 0, 1 / 7]; // square, band-limited
const RELEASE = 0.12;   // s after a note's end, for a voice that names none: no note stops dead
const SWEEP_CEILING = 6000; // Hz. The filter never opens above this: the grating band
/// The other strings, as stops on the open string (string.js): 1:1, 3:2, 2:1, 9:4, 3:1.
/// Each is a comb resonator fed by the mix, so it rings only when something near it sounds.
const SYMPATHETIC = [1, 3 / 2, 2, 9 / 4, 3];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/// A room, synthesised rather than sampled.
///
/// Exponentially decaying noise is the cheapest impulse response that sounds like
/// somewhere, and it ships nothing: an atlas that has to fetch a WAV to sound right is
/// an atlas that sounds wrong offline, which this whole stack is built to avoid.
///
/// Seeded, like every other generator here. `sounds-like`'s `bus.ts` makes the same call
/// for the same reason — an instrument that differs run to run cannot be tuned by ear,
/// and a render that differs run to run cannot be diffed.
function impulse(ctx, seconds = REVERB_S) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  let s = 0x9e3779b9;
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const white = ((s >>> 0) % 20000) / 10000 - 1;
      // Power curve, not linear: a linear tail sounds like a gate closing.
      data[i] = white * Math.pow(1 - i / n, 2.6);
    }
  }
  return buf;
}

/// tanh, as a lookup table for a WaveShaper.
///
/// The instrument sums an unbounded number of voices — every node of a neighbourhood can
/// sustain at once — and `PEAK / sqrt(n)` keeps the *average* in range without bounding
/// the peak. Two voices in phase still clip, and digital clipping is a buzz that has
/// nothing to do with the music.
///
/// A soft knee instead: quiet passages pass through very nearly untouched, and a dense
/// one compresses rather than shatters.
function softClip() {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.7);
  }
  return curve;
}

/// A short burst of white noise, built once and reused.
function noiseBuffer(ctx, seconds = 0.5) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic, like every other generator in this stack: an instrument that
  // differs run to run cannot be tuned by ear.
  let s = 0x2545f491;
  for (let i = 0; i < data.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    data[i] = ((s >>> 0) % 20000) / 10000 - 1;
  }
  return buf;
}

export class Instrument {
  constructor(tuning) {
    /// Off: every voice straight to `out`. On: a panner per piece; see `_dest`.
    this.spatial = false;
    this.panners = new Map();
    this.tuning = tuning;
    this.ctx = null;
    this.out = null;
    this.noise = null;
    this.held = [];
    this.muted = false;
    /// Sustained voices, one per piece that has a pitch and no figure to articulate.
    this.drones = new Map();
    /// Labels seen that this instrument has no voicing for. Surfaced rather than
    /// silently absorbed — `EpistemicLabel::from_label` returns `None` instead of
    /// guessing, and an instrument that quietly rounded an unknown label to its nearest
    /// neighbour would be doing exactly what the kernel refuses to.
    this.unvoiced = new Set();
  }

  /// Build the bus. Browsers will not start an AudioContext without a gesture, so this is
  /// called from the first click rather than at load.
  ///
  ///     voices -> out --------------------> shaper -> warmth -> destination
  ///                 \-> send -> room ----------^
  ///                 \-> echo -> delay ---------^
  ///                               ^--- feedback
  ///
  /// Both sends hang off `out` and not off the voices, which is what keeps `mute` honest:
  /// pulling `out` down silences them too, so a muted instrument does not go on ringing
  /// for two and a half seconds or answering itself for ten. Everything meets again at
  /// the shaper, so the limiter sees the sum — the only place it can do any good — and
  /// `warmth` is last because it is a tone control over the finished mix.
  ///
  /// One convolver for the whole instrument, as a send. It is by far the most expensive
  /// node in this graph and there must never be one per voice.
  start() {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    this.out = this.ctx.createGain();
    this.out.gain.value = 1;

    this.shaper = this.ctx.createWaveShaper();
    this.shaper.curve = softClip();
    this.shaper.oversample = '2x';   // or the knee folds harmonics back as aliasing
    this.shaper.connect(this.ctx.destination);

    // A limiter in front of the soft clip. The tanh knee alone let six reeds reach -0.6 dB
    // (measured 2026-11-14); this holds the sum down and leaves the knee for what slips by.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;
    this.limiter.connect(this.shaper);
    this.out.connect(this.limiter);

    this.room = this.ctx.createConvolver();
    this.room.buffer = impulse(this.ctx);
    this.send = this.ctx.createGain();
    this.send.gain.value = SEND;
    this.out.connect(this.send).connect(this.room).connect(this.limiter);

    // The delay. A repeat is not a reverb: the room smears a note into a wash, this
    // restates it. On an instrument where several shapes turn at ratios of each other,
    // an echo lands either with the next shape or between two of them, and which one it
    // does is the composer's business — hence a control rather than a constant.
    //
    // Feedback is capped well under 1 in `setFx`. A delay that can be driven to
    // self-oscillate is a way to make a gallery very unpleasant from across the room.
    this.delay = this.ctx.createDelay(2.0);
    this.delay.delayTime.value = DELAY_S;
    this.feedback = this.ctx.createGain();
    this.feedback.gain.value = 0.32;
    this.echo = this.ctx.createGain();
    this.echo.gain.value = 0;          // silent until asked for
    this.out.connect(this.echo).connect(this.delay);
    this.delay.connect(this.feedback).connect(this.delay);   // the tail
    this.delay.connect(this.limiter);

    // Master warmth. A gentle lowpass over everything, which is a *mix* control and not
    // a per-note one: it cannot distinguish two notes, so it cannot rank them. Wide open
    // by default so nothing changes until somebody turns it.
    this.warmth = this.ctx.createBiquadFilter();
    this.warmth.type = 'lowpass';
    this.warmth.frequency.value = 20000;
    this.warmth.Q.value = 0.4;
    this.shaper.disconnect();
    this.shaper.connect(this.warmth).connect(this.ctx.destination);

    this.noise = noiseBuffer(this.ctx);
    this.waves = new Map();

    // The other strings. A comb filter per stop -- a delay of one period fed back through a
    // gentle lowpass -- so a note near 165 Hz sets the 3:2 string ringing and one far from
    // every stop leaves them quiet. Fed from `out`, so mute silences them too.
    this.sympathy = this.ctx.createGain();
    this.sympathy.gain.value = 0.3 * 0.25;
    this.out.connect(this.sympathy);
    this.strings = SYMPATHETIC.map((ratio) => {
      const delay = this.ctx.createDelay(0.05);
      const fb = this.ctx.createGain();
      // Loop gain must stay under 1 at every frequency or the string rings forever. A
      // biquad lowpass at its default Q peaks above unity at the corner, which ran away
      // the first time; a one-pole lowpass (IIR) never exceeds 1.
      fb.gain.value = 0.9;
      const damp = this.ctx.createIIRFilter([0.35], [1, -0.65]);
      const tap = this.ctx.createGain();
      tap.gain.value = 0.12;
      this.sympathy.connect(delay);
      delay.connect(damp).connect(fb).connect(delay);
      delay.connect(tap).connect(this.limiter);
      return { ratio, delay };
    });
    this.retune();
  }

  /// Tune the other strings to the open string. Called when the open string moves.
  retune() {
    if (!this.strings) return;
    const open = this.tuning.tonicHz;
    for (const s of this.strings) {
      // Never shorter than one render quantum (128 samples): a feedback loop through a
      // DelayNode cannot be, and Web Audio would silently lengthen it, mistuning the string.
      const period = Math.max(128 / this.ctx.sampleRate, 1 / (open * s.ratio));
      s.delay.delayTime.setTargetAtTime(period, this.now, 0.02);
    }
  }

  /// The mix, ramped.
  ///
  /// `sounds-like`'s I-4 in one method: *"no `GainNode.gain.value = x`"*. Every one of
  /// these is a control somebody is turning by hand, which is exactly the case where an
  /// assignment is audible as a click and a ramp is not.
  setFx({ room, echo, warmth, sympathy } = {}) {
    if (!this.ctx) return;
    const at = this.now;
    const ramp = (param, v) => param.setTargetAtTime(v, at, 0.03);
    if (room !== undefined) ramp(this.send.gain, clamp(room, 0, 0.8));
    if (echo !== undefined) ramp(this.echo.gain, clamp(echo, 0, 0.7));
    if (sympathy !== undefined) ramp(this.sympathy.gain, clamp(sympathy, 0, 1) * 0.25);
    // Exponential in Hz, because pitch is: a linear sweep of a cutoff spends most of its
    // travel in a range nobody can hear moving.
    if (warmth !== undefined) {
      ramp(this.warmth.frequency, 200 * Math.pow(100, clamp(warmth, 0, 1)));
    }
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /// Silence everything, including what is already scheduled.
  ///
  /// **A flag would not do it.** Events are scheduled ahead of the clock, so stopping the
  /// sequencer leaves whatever was already queued to play out — up to a second of sound
  /// after you asked for silence, which reads as a mute that does not work. Every voice
  /// connects through `out`, so pulling that down catches the queued ones too.
  ///
  /// A ramp, never an assignment. `sounds-like`'s I-4: *"no `GainNode.gain.value = x`, no
  /// `stop()` without a ramp"* — a discontinuity is a click, and a click is a sound the
  /// piece did not contain. 25 ms is fast enough to feel immediate and slow enough not to
  /// snap.
  mute() {
    if (!this.ctx || this.muted) return;
    this.muted = true;
    const at = this.now;
    this.out.gain.cancelScheduledValues(at);
    this.out.gain.setValueAtTime(this.out.gain.value, at);
    this.out.gain.linearRampToValueAtTime(0, at + 0.025);
  }

  unmute() {
    if (!this.ctx || !this.muted) return;
    this.muted = false;
    const at = this.now;
    this.out.gain.cancelScheduledValues(at);
    this.out.gain.setValueAtTime(this.out.gain.value, at);
    this.out.gain.linearRampToValueAtTime(1, at + 0.05);
  }

  toggleMute() {
    if (this.muted) this.unmute();
    else this.mute();
    return this.muted;
  }

  /// One pitched tone, voiced by its epistemic label.
  ///
  /// `label` is the on-the-wire spelling — `established`, `traditional`, `contested`,
  /// `speculative`, and the three that do not occur in this graph yet.
  /// `level` is the **composer's** balance for this voice, 0..1, and is the one thing here
  /// allowed to change how loud something is. Nothing derives it from `label`: a louder
  /// note would read as a better-supported one, and `EpistemicLabel` orders by declaration
  /// and not by strength. A mix is authored; a ranking is forbidden.
  tone(hz, label, at, dur = 0.55, level = 1, voiceId = DEFAULT_VOICE, source = null) {
    const ctx = this.ctx;
    const V = voiceOf(voiceId);
    const dest = this._dest(source);
    const env = ctx.createGain();
    env.connect(dest);
    env.gain.setValueAtTime(0, at);
    const peak = PEAK * Math.max(0, Math.min(1, level));

    // The attack is squeezed INTO the note rather than the note stretched to fit it.
    // `sounds-like` documents what the other way costs: with a 0.35 s attack no note can
    // be shorter than its envelope, so a sixteenth becomes a swell and sixteen of them
    // ring at once. A broken line here is a 0.26 s touch and would have been a drone.
    const wanted = Math.max(0.04, dur);
    // `speculative` still lengthens its own onset — that is the label speaking, and it is
    // a *shape*, not a level or a brightness. The voice's attack is the composer's floor
    // under it; the label may soften an entrance but cannot sharpen one.
    const want = Math.max(V.env.attack, label === 'speculative' ? 0.09 : 0);
    const squeeze = Math.min(1, wanted / Math.max(1e-6, want + 0.05));
    const attack = Math.max(0.003, want * squeeze);

    // Attack, decay to the sustain, then out. A voice with `sustain: 0` is struck and
    // decays through the note; one with `sustain: 1` is held flat and only released at
    // the end. This is what separates a bell from an organ, and it is the composer's
    // choice in both cases — nothing here is read from the graph.
    const decay = Math.min(V.env.decay, Math.max(0.01, wanted - attack));
    const floor = 0.0001;
    env.gain.linearRampToValueAtTime(peak, at + attack);
    if (V.env.sustain < 0.999) {
      env.gain.exponentialRampToValueAtTime(
        Math.max(floor, peak * V.env.sustain), at + attack + decay);
    }
    // Exponential ramps cannot reach zero, hence the floor rather than 0. The release runs
    // past the note's end, as a string's does, instead of stopping on it: a gate closing
    // on every note was part of what made the old voices hard.
    const release = V.env.release ?? RELEASE;
    const end = at + Math.max(attack + 0.02, wanted);
    if (V.env.sustain >= 0.999) env.gain.setValueAtTime(peak, end);
    env.gain.exponentialRampToValueAtTime(floor, end + release);

    // The sweep. See the header: no label reaches this, and it cannot.
    const bus = V.sweep > 0 ? this._sweep(at, hz, wanted, V) : ctx.createGain();
    bus.connect(env);

    // **The stack is the composer's; the detune is the graph's.** Every partial of the
    // chosen voice gets every one of the label's detunes, so a contested correspondence
    // beats whatever it is played on and an established one never does. Neither can
    // suppress the other.
    this._stack(bus, hz, label, V, at, at + Math.max(dur, 0.04) + (V.env.release ?? RELEASE) + 0.05);

    // Breath. Two sources, and they are different claims:
    //   - the voice's own `noise`, which is the composer's choice of instrument;
    //   - `speculative`, which is the graph saying a correspondence was asserted.
    // They add, so a speculative pluck is breathier than either alone.
    const breathiness = V.noise + (label === 'speculative' ? 0.5 : 0);
    if (breathiness > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = hz;
      band.Q.value = 2;
      const breath = ctx.createGain();
      breath.gain.setValueAtTime(0, at);
      breath.gain.linearRampToValueAtTime(peak * Math.min(0.9, breathiness), at + 0.03);
      breath.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      src.connect(band).connect(breath).connect(dest);
      src.start(at);
      src.stop(at + 0.3);
    }

    return env;
  }

  /// A filter that opens on the onset and settles back — the note *speaking*.
  ///
  /// **This function takes no label and must never take one.** That is the whole of the
  /// argument in the header: brightness derived from a claim's standing would be a
  /// ranking, brightness derived from the note's own pitch and length is a timbre.
  ///
  /// `voice` is not a loophole. It is the entry the *composer* chose from `voices.js`,
  /// the same kind of decision as the tonic and the rate, and it is chosen per placed
  /// shape — before any of that shape's notes have a label at all. Two notes of the same
  /// pitch and length on the same voice are identical in brightness whether one is
  /// `established` and the other `contested`. What still cannot happen is a cutoff
  /// derived from a claim's standing, and nothing computes one.
  ///
  /// The cutoff is a multiple of the note's own frequency rather than a fixed Hz, or the
  /// sweep would be an event for a low note and inaudible for a high one — the same
  /// gesture has to land the same way across six octaves of corpus.
  _sweep(at, hz, dur, voice) {
    const ctx = this.ctx;
    const nyq = ctx.sampleRate / 2 - 1000;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = voice.q;   // emphasis at the corner, so the movement is audible

    const open = Math.min(hz * voice.sweep, SWEEP_CEILING, nyq);
    const rest = Math.min(hz * 2.6, SWEEP_CEILING, nyq);
    // Fast enough to be part of the attack rather than a separate wash, and squeezed
    // into short notes for the same reason the amplitude envelope is: a fixed 90 ms
    // sweep on a 60 ms note is a note that never finishes speaking.
    const span = Math.min(0.09, Math.max(0.012, dur * 0.5));

    f.frequency.setValueAtTime(rest, at);
    f.frequency.linearRampToValueAtTime(open, at + span);
    f.frequency.exponentialRampToValueAtTime(rest, at + Math.max(span + 0.03, dur));
    // Returned unconnected: the caller owns both ends, oscillators in and its own
    // envelope out.
    return f;
  }

  /// The oscillator stack a note or a drone is built from: each partial of the voice, at
  /// each detune the label asks for. One place, so the rule that an unvoiced label sounds
  /// as a square wave -- it must not pass for a voiced one -- holds for held shapes too.
  /// `stopAt` null means held until `droneOff`.
  _stack(dest, hz, label, V, at, stopAt) {
    const ctx = this.ctx;
    const unvoiced = label === 'unknown' || label === 'emerging' || label === 'in-vitro';
    const oscs = [];
    const detunes = this._detunesFor(label);
    for (const part of V.partials) {
      const g = ctx.createGain();
      // Divided by the number of copies, so a detuned pair never peaks above one
      // oscillator. Without it `traditional` and `contested` were 5 dB louder than
      // `established` (measured 2026-11-14), which is a label setting a level: the one
      // thing forbidden. Not the square root: at a few cents the pair stays in phase
      // through a short note and sums coherently, which measured 2.4 dB louder.
      g.gain.value = (part.gain * V.norm) / detunes.length;
      // A square carries more power per peak than a sine-like voice: 2.3 dB more RMS on the
      // string voice at equal peak (measured). Trimmed, so wrong-sounding is not also louder.
      if (unvoiced) g.gain.value *= 0.77;
      g.connect(dest);
      for (const cents of detunes) {
        const osc = ctx.createOscillator();
        // A square wave cut off at its 7th harmonic: still hollow and plainly not a voice,
        // without the full square's buzz up the spectrum.
        if (unvoiced) osc.setPeriodicWave(this._wave(UNVOICED));
        else if (part.type === 'wave') osc.setPeriodicWave(this._wave(part.harmonics));
        else osc.type = part.type;
        osc.frequency.value = hz;
        osc.detune.value = part.cents + cents;
        osc.connect(g);
        osc.start(at);
        if (stopAt !== null) osc.stop(stopAt);
        oscs.push(osc);
      }
    }
    return oscs;
  }

  /// A PeriodicWave from harmonic amplitudes, built once per table.
  _wave(harmonics) {
    let w = this.waves.get(harmonics);
    if (!w) {
      const real = new Float32Array(harmonics.length + 1);
      const imag = new Float32Array(harmonics.length + 1);
      harmonics.forEach((a, i) => { imag[i + 1] = a; });
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(harmonics, w);
    }
    return w;
  }

  _detunesFor(label) {
    switch (label) {
      case 'established':
        // One tone, no detune. An identity: a hexagram *is* a gate.
        return [0];
      case 'traditional':
        return [-DETUNE_TRADITIONAL, DETUNE_TRADITIONAL];
      case 'contested':
        // Two sources answering differently, sounded as two tones close enough to
        // beat against each other. The forked strands, heard.
        return [-DETUNE_CONTESTED, DETUNE_CONTESTED];
      case 'speculative':
        return [0];
      default:
        this.unvoiced.add(label);
        return [0];
    }
  }

  /// Arrived, and nothing licenses a pitch.
  ///
  /// Struck and damped: definite in time, indefinite in pitch. It happened; no source
  /// says at what frequency.
  struck(at, dur = 0.18, level = 1, source = null) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const shape = ctx.createBiquadFilter();
    shape.type = 'bandpass';
    shape.frequency.value = 320;
    shape.Q.value = 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(PEAK * Math.max(0, Math.min(1, level)), at + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 1800;   // the noise's top octaves were a hiss, not a strike
    src.connect(shape).connect(soft).connect(env).connect(this._dest(source));
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  /// A rest, and **which kind of rest**.
  ///
  /// `crates/score`'s third refusal, honoured in the last mile: *"A symbol with no edges
  /// and a search that ran out of hops are different claims, and rendering them as one
  /// rest would make a search budget read as a fact about a tradition."* So a page that
  /// wrote down its refusal is audible, and a search budget is not — because one is a
  /// finding and the other is a parameter I chose.
  ///
  /// Returns the reason, so a caller can show it alongside.
  rest(reason, at) {
    switch (reason) {
      case 'withheld': {
        // Somebody read the page and wrote down what was not on it. The gesture of a
        // note stopped: an onset, immediately damped. You hear the refusal.
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = this.tuning.tonicHz;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(PEAK * 0.7, at + 0.006);
        // Damped at once, but over 120 ms: at 50 ms the stopped note was a click.
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        osc.connect(env).connect(this.out);
        osc.start(at);
        osc.stop(at + 0.16);
        return 'withheld';
      }
      case 'isolated':
        // In the graph, and nothing has been put beside it. True silence; the surface
        // draws the hole.
        return 'isolated';
      case 'budget':
        // We stopped looking. Silence, and the surface draws a horizon rather than a
        // hole, because this is a fact about my search and not about the tradition.
        return 'budget';
      default:
        // `target-empty` and `unknown` are errors rather than music.
        return reason;
    }
  }

  /// Hold one pitch until told otherwise: a shape with a proportion and no figure.
  ///
  /// Keyed by piece so it can be stopped when that piece is removed or muted. Ramped in
  /// and out, never assigned — see `mute`.
  droneOn(id, hz, label = 'established', level = 1, voiceId = DEFAULT_VOICE) {
    if (!this.ctx) return;
    let held = this.drones.get(id);
    // A held drone follows its piece. Its timbre is its label and its voice, so a change
    // to either rebuilds it: a Diapente set by hand stops being `traditional` and must
    // stop sounding like Agrippa's. Pitch and level glide instead -- the tonic knob or a
    // level under a finger mid-drag would otherwise be a stutter of fades.
    if (held && (held.label !== label || held.voiceId !== voiceId)) {
      this.droneOff(id);
      held = null;
    }
    if (held) {
      if (held.hz !== hz) {
        for (const osc of held.oscs) osc.frequency.setTargetAtTime(hz, this.now, 0.03);
        held.hz = hz;
      }
      if (held.level !== level) {
        held.env.gain.setTargetAtTime(PEAK * 0.55 * clamp(level, 0, 1), this.now, 0.05);
        held.level = level;
      }
      return;
    }
    const ctx = this.ctx;
    const V = voiceOf(voiceId);
    const at = this.now;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(PEAK * 0.55 * clamp(level, 0, 1), at + 0.6);
    env.connect(this._dest(id));

    // A held shape gets the same stack an articulated one does, so switching a piece's
    // voice sounds like the same decision whether it is spelling a figure or holding a
    // proportion. The filter is parked open rather than swept: there is no onset to
    // speak on, and a filter that swept once at the start and then sat still for ten
    // minutes would be a click, not a timbre.
    const oscs = this._stack(env, hz, label, V, at, null);
    this.drones.set(id, { oscs, env, hz, label, level, voiceId });
  }

  // ---- where the sound is ----
  //
  // With `spatial` off (the default) every voice goes straight to `out`, as it always did:
  // the composition heard from nowhere in particular. With it on, each placed piece is a
  // sound source at its own place in the armillary -- a PannerNode per piece, HRTF,
  // falling off with distance -- and the listener stands where the camera stands. Walk
  // toward a shape and it grows louder and moves across your head as you pass it.
  //
  // Every panner still feeds `out`, so mute, the room, the echo and the limiter work
  // exactly as before. Distance attenuates; nothing reads a label to decide a level.

  _dest(source) {
    if (!this.spatial || source === null || source === undefined) return this.out;
    let p = this.panners.get(source);
    if (!p) {
      p = new PannerNode(this.ctx, {
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: 0.8,
        rolloff: 1.1,
        maxDistance: 40,
      });
      p.connect(this.out);
      this.panners.set(source, p);
    }
    return p;
  }

  /// Turn spatial sound on or off. Held drones are rebuilt so they move to the new route.
  setSpatial(on) {
    if (!this.ctx) { this.spatial = on; return; }
    this.spatial = on;
    for (const id of [...this.drones.keys()]) this.droneOff(id);
    if (!on) {
      // Let each one go after its drone has faded and its last scheduled note has rung,
      // as `forget` does for a removed piece. Disconnecting here cut them mid-ramp: a click
      // every time you left walk.
      for (const id of [...this.panners.keys()]) this.forget(id);
    }
  }

  /// Where a piece's sound comes from this frame.
  place(source, [x, y, z]) {
    const p = this.spatial && this.panners.get(source);
    if (!p) return;
    const t = this.now;
    p.positionX.setTargetAtTime(x, t, 0.03);
    p.positionY.setTargetAtTime(y, t, 0.03);
    p.positionZ.setTargetAtTime(z, t, 0.03);
  }

  /// Where the listener stands and faces: the camera's eye.
  listen(eye, forward, up = [0, 1, 0]) {
    if (!this.ctx || !this.spatial) return;
    const L = this.ctx.listener;
    const t = this.now;
    if (L.positionX) {
      L.positionX.setTargetAtTime(eye[0], t, 0.03);
      L.positionY.setTargetAtTime(eye[1], t, 0.03);
      L.positionZ.setTargetAtTime(eye[2], t, 0.03);
      L.forwardX.setTargetAtTime(forward[0], t, 0.03);
      L.forwardY.setTargetAtTime(forward[1], t, 0.03);
      L.forwardZ.setTargetAtTime(forward[2], t, 0.03);
      L.upX.setTargetAtTime(up[0], t, 0.03);
      L.upY.setTargetAtTime(up[1], t, 0.03);
      L.upZ.setTargetAtTime(up[2], t, 0.03);
    } else {
      L.setPosition(...eye);
      L.setOrientation(...forward, ...up);
    }
  }

  /// A piece was removed: let its panner go once its last note has rung out.
  forget(source) {
    const p = this.panners.get(source);
    if (!p) return;
    this.panners.delete(source);
    setTimeout(() => p.disconnect(), 1500);
  }

  droneOff(id) {
    const held = this.drones.get(id);
    if (!held) return;
    const at = this.now;
    held.env.gain.cancelScheduledValues(at);
    held.env.gain.setValueAtTime(held.env.gain.value, at);
    held.env.gain.linearRampToValueAtTime(0, at + 0.3);
    for (const osc of held.oscs) osc.stop(at + 0.35);
    this.drones.delete(id);
  }

  /// Hold a neighbourhood: what you hear standing still.
  ///
  /// Every node that a layer licenses a pitch for is sustained at once. Nodes nothing
  /// licenses are struck once on arrival rather than held, because an indefinite pitch
  /// cannot be sustained without becoming a drone that says something the graph does
  /// not.
  sustain(nodes, at = this.now) {
    this.release();
    for (const node of nodes) {
      const pitch = this.tuning.pitch(node);
      if (!pitch) {
        this.struck(at);
        continue;
      }
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = pitch.hz;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      // Divided among the held voices so a dense neighbourhood does not clip. This is
      // headroom, not emphasis: every voice gets the same share.
      env.gain.linearRampToValueAtTime(PEAK / Math.max(1, Math.sqrt(nodes.length)), at + 0.4);
      osc.connect(env).connect(this.out);
      osc.start(at);
      this.held.push({ osc, env });
    }
  }

  release(at = this.now) {
    for (const { osc, env } of this.held) {
      env.gain.cancelScheduledValues(at);
      env.gain.setValueAtTime(env.gain.value, at);
      env.gain.linearRampToValueAtTime(0, at + 0.35);
      osc.stop(at + 0.4);
    }
    this.held = [];
  }
}

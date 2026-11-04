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
const DETUNE_TRADITIONAL = 4; // cents. Transmitted through many hands.
const DETUNE_CONTESTED = 18; // cents. Wide enough that you hear the beat, not a chorus.

const REVERB_S = 2.4;   // long enough to be a room, short enough not to smear a figure
const SEND = 0.20;      // how much of the sum goes to the room
const DELAY_S = 0.375;  // a dotted eighth at 120: lands off the beat, not on it

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
    this.out.connect(this.shaper);

    this.room = this.ctx.createConvolver();
    this.room.buffer = impulse(this.ctx);
    this.send = this.ctx.createGain();
    this.send.gain.value = SEND;
    this.out.connect(this.send).connect(this.room).connect(this.shaper);

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
    this.delay.connect(this.shaper);

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
  }

  /// The mix, ramped.
  ///
  /// `sounds-like`'s I-4 in one method: *"no `GainNode.gain.value = x`"*. Every one of
  /// these is a control somebody is turning by hand, which is exactly the case where an
  /// assignment is audible as a click and a ramp is not.
  setFx({ room, echo, warmth } = {}) {
    if (!this.ctx) return;
    const at = this.now;
    const ramp = (param, v) => param.setTargetAtTime(v, at, 0.03);
    if (room !== undefined) ramp(this.send.gain, clamp(room, 0, 0.8));
    if (echo !== undefined) ramp(this.echo.gain, clamp(echo, 0, 0.7));
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
  tone(hz, label, at, dur = 0.55, level = 1, voiceId = DEFAULT_VOICE) {
    const ctx = this.ctx;
    const V = voiceOf(voiceId);
    const env = ctx.createGain();
    env.connect(this.out);
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
    // Exponential ramps cannot reach zero, hence the floor rather than 0.
    env.gain.exponentialRampToValueAtTime(floor, at + Math.max(attack + 0.02, wanted));

    // The sweep. See the header: no label reaches this, and it cannot.
    const bus = V.sweep > 0 ? this._sweep(at, hz, wanted, V) : ctx.createGain();
    bus.connect(env);

    // **The stack is the composer's; the detune is the graph's.** Every partial of the
    // chosen voice gets every one of the label's detunes, so a contested correspondence
    // beats whatever it is played on and an established one never does. Neither can
    // suppress the other.
    const detunes = this._detunesFor(label);
    const unvoiced = label === 'unknown' || label === 'emerging' || label === 'in-vitro';
    for (const part of V.partials) {
      const g = ctx.createGain();
      g.gain.value = part.gain * V.norm;
      g.connect(bus);
      for (const cents of detunes) {
        const osc = ctx.createOscillator();
        // An unvoiced label must not pass for a voiced one, whatever the voice is.
        osc.type = unvoiced ? 'square' : part.type;
        osc.frequency.value = hz;
        osc.detune.value = part.cents + cents;
        osc.connect(g);
        osc.start(at);
        osc.stop(at + dur + 0.05);
      }
    }

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
      src.connect(band).connect(breath).connect(this.out);
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

    const open = Math.min(hz * voice.sweep, nyq);
    const rest = Math.min(hz * 2.6, nyq);
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
  struck(at, dur = 0.18, level = 1) {
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
    src.connect(shape).connect(env).connect(this.out);
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
        osc.frequency.value = this.tuning.tonic;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(PEAK * 0.7, at + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        osc.connect(env).connect(this.out);
        osc.start(at);
        osc.stop(at + 0.1);
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

  /// Play one voice of a score: its hops in sequence, then whatever it arrived at.
  ///
  /// Equal routes are separate voices upstream and stay separate here, so two routes to
  /// the same arrival is polyphony. Collapsing them would mean choosing one, and
  /// choosing means ranking sources against each other.
  ///
  /// Returns the time it ends, so a caller can lay voices out or overlap them.
  playVoice(voice, at, step = 0.34) {
    if (voice.voice !== 'sounded') {
      const reason = voice.silence?.reason?.reason ?? 'unknown';
      this.rest(reason, at);
      return at + step;
    }

    let t = at;
    for (const s of voice.steps) {
      // Each hop is articulated with **its own** label, never the route's. A route
      // through three traditions has no aggregate confidence and this refuses to
      // invent one: `Step` carries a label and `Voice` deliberately does not.
      const hop = { address: s.to, kind: s.to.split(':')[1]?.split('/')[0] ?? '', attributes: {} };
      const pitch = this.tuning.pitch(hop);
      if (pitch) this.tone(pitch.hz, s.confidence, t);
      else this.struck(t);
      t += step;
    }
    return t;
  }

  /// Hold one pitch until told otherwise: a shape with a proportion and no figure.
  ///
  /// Keyed by piece so it can be stopped when that piece is removed or muted. Ramped in
  /// and out, never assigned — see `mute`.
  droneOn(id, hz, label = 'established', level = 1, voiceId = DEFAULT_VOICE) {
    if (!this.ctx || this.drones.has(id)) return;
    const ctx = this.ctx;
    const V = voiceOf(voiceId);
    const at = this.now;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(PEAK * 0.55 * clamp(level, 0, 1), at + 0.6);
    env.connect(this.out);

    // A held shape gets the same stack an articulated one does, so switching a piece's
    // voice sounds like the same decision whether it is spelling a figure or holding a
    // proportion. The filter is parked open rather than swept: there is no onset to
    // speak on, and a filter that swept once at the start and then sat still for ten
    // minutes would be a click, not a timbre.
    const oscs = [];
    for (const part of V.partials) {
      const g = ctx.createGain();
      g.gain.value = part.gain * V.norm;
      g.connect(env);
      for (const cents of this._detunesFor(label)) {
        const osc = ctx.createOscillator();
        osc.type = part.type;
        osc.frequency.value = hz;
        osc.detune.value = part.cents + cents;
        osc.connect(g);
        osc.start(at);
        oscs.push(osc);
      }
    }
    this.drones.set(id, { oscs, env });
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

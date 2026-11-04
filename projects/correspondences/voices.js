// The lexicon: what a shape may be played *on*.
//
// # Why this is allowed to exist
//
// `audio.js` spends its header establishing that timbre is the one axis that may carry an
// epistemic label, because timbre is categorical — two tones beating is not *less* than
// one pure tone, it is two sources disagreeing. That argument is about timbre **derived
// from the graph**, and it is untouched here: `_detunesFor` still voices the label, and a
// `contested` correspondence still beats at ±18 cents whatever it is played on.
//
// What this file adds is the other kind of timbre: the one **the composer picks**. That is
// the same sort of decision as the tonic, the rate and the mix, and `pieces.js` already
// argues the case for those — *"Rate is authored, the pattern is not"*. Choosing to hear a
// hexagram on a bell rather than a bare tone asserts nothing about the hexagram.
//
// The two compose rather than compete, and the order matters:
//
//     the composer chooses the instrument · the graph decides what it does with it
//
// So every voice here is a stack of partials, and the label's detune is applied to **each**
// of them. A `contested` bell beats; an `established` bell does not. Neither the lexicon
// nor the label can suppress the other, which is what keeps the disagreement audible no
// matter how the piece is dressed.
//
// # What is not here
//
// **No samples.** `sounds-like`'s vendor README records why its own lexicon is
// oscillators-only: named instruments in these engines fetch sample banks at runtime, and
// using them puts the network back into something built to work without one. Everything
// below is oscillators and shaped noise.
//
// **No loudness differences between voices.** Each stack is normalised by the sum of its
// partial gains, so switching a piece from `tone` to `organ` changes its colour and not
// its level. A lexicon where the interesting voice was also the loud one would be a mix
// decision hiding inside a timbre menu.
//
// # The shape of a voice
//
//   partials  the stack. `cents` is offset from the fundamental — 1200 is an octave,
//             1902 a just twelfth. `gain` is relative and normalised away.
//   env       attack/decay/sustain in fractions; `sustain` 0 means struck and decaying,
//             1 means held flat until the note ends.
//   sweep     how far the filter opens on the onset, as a multiple of the fundamental.
//             0 leaves the filter alone.
//   q         resonance at the corner.
//   noise     a band-limited breath mixed into the attack, 0..1.

/// The default is first, and it is the sound this instrument already had: one sine, no
/// stack, no noise. Nothing about an existing piece changes until somebody asks it to.
export const VOICES = [
  {
    id: 'tone',
    label: 'tone',
    note: 'One partial. What the atlas has always sounded like.',
    partials: [{ cents: 0, gain: 1, type: 'sine' }],
    env: { attack: 0.012, decay: 0.30, sustain: 0.55 },
    sweep: 9, q: 1.1, noise: 0,
  },
  {
    id: 'bell',
    label: 'bell',
    note: 'Inharmonic partials, struck and left to ring.',
    // Not a harmonic series: a bell's partials are famously *not* integer multiples, and
    // rounding them to a harmonic stack is what makes a synthesised bell sound like an
    // organ. A just twelfth and a wide seventeenth, then a high inharmonic.
    partials: [
      { cents: 0, gain: 1, type: 'sine' },
      { cents: 1902, gain: 0.40, type: 'sine' },
      { cents: 2790, gain: 0.22, type: 'sine' },
      { cents: 3640, gain: 0.10, type: 'sine' },
    ],
    env: { attack: 0.004, decay: 0.85, sustain: 0.0 },
    sweep: 7, q: 0.9, noise: 0,
  },
  {
    id: 'glass',
    label: 'glass',
    note: 'Two octaves and a breath. Thin, and it speaks at the top.',
    partials: [
      { cents: 0, gain: 1, type: 'sine' },
      { cents: 1200, gain: 0.55, type: 'sine' },
      { cents: 2400, gain: 0.18, type: 'triangle' },
    ],
    env: { attack: 0.03, decay: 0.5, sustain: 0.3 },
    sweep: 12, q: 2.2, noise: 0.25,
  },
  {
    id: 'reed',
    label: 'reed',
    note: 'A narrow pulse, held. The odd harmonics do the work.',
    partials: [
      { cents: 0, gain: 1, type: 'square' },
      { cents: 1200, gain: 0.16, type: 'square' },
    ],
    env: { attack: 0.05, decay: 0.16, sustain: 0.85 },
    sweep: 5, q: 3.0, noise: 0.10,
  },
  {
    id: 'organ',
    label: 'organ',
    note: 'Stopped ranks — octave, twelfth, fifteenth. Fludd would know it.',
    // The drawbar stack of the Divine Monochord's own century, near enough: a rank at the
    // unison, one an octave up, one a twelfth, one two octaves.
    partials: [
      { cents: 0, gain: 1, type: 'sine' },
      { cents: 1200, gain: 0.50, type: 'sine' },
      { cents: 1902, gain: 0.30, type: 'sine' },
      { cents: 2400, gain: 0.20, type: 'sine' },
    ],
    env: { attack: 0.02, decay: 0.05, sustain: 1.0 },
    sweep: 0, q: 0.7, noise: 0,
  },
  {
    id: 'bowed',
    label: 'bowed',
    note: 'Slow to speak, and it does not stop.',
    partials: [
      { cents: 0, gain: 1, type: 'sawtooth' },
      { cents: 3, gain: 0.7, type: 'sawtooth' },   // a hair sharp: the pair breathes
    ],
    env: { attack: 0.14, decay: 0.2, sustain: 0.9 },
    sweep: 4, q: 2.6, noise: 0.18,
  },
  {
    id: 'pluck',
    label: 'pluck',
    note: 'Gone almost before it arrives.',
    partials: [
      { cents: 0, gain: 1, type: 'triangle' },
      { cents: 1200, gain: 0.3, type: 'sine' },
    ],
    env: { attack: 0.002, decay: 0.16, sustain: 0.0 },
    sweep: 14, q: 1.6, noise: 0.3,
  },
];

const BY_ID = new Map(VOICES.map((v) => [v.id, v]));

export const DEFAULT_VOICE = 'tone';

/// Never throws and never guesses quietly.
///
/// An unknown id returns the default *and* is reported, following the same rule
/// `Instrument.unvoiced` follows for labels: `EpistemicLabel::from_label` returns `None`
/// rather than rounding to the nearest neighbour, and a lexicon that silently substituted
/// would be doing what the kernel refuses to.
export const unknownVoices = new Set();

export function voiceOf(id) {
  const v = BY_ID.get(id);
  if (v) return v;
  if (id != null && id !== DEFAULT_VOICE) unknownVoices.add(id);
  return BY_ID.get(DEFAULT_VOICE);
}

/// The sum of a stack's partial gains, so a voice can be normalised to the same level as
/// any other. Computed once per voice rather than per note.
for (const v of VOICES) {
  v.norm = 1 / v.partials.reduce((s, p) => s + p.gain, 0);
}

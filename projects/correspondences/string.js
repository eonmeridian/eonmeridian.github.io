// The string: one rule for every pitch this instrument supplies itself.
//
// Eon chose this system on 2026-11-14 (docs/correspondences.md, system A). It replaces the
// seven-degree just scale that pitched 1083 of the 1088 symbols.
//
// # The rule
//
// Every pitch is the open string times 3^a / 2^b. The string is divided only by the two
// ratios the graph cites, Agrippa's Diapason 2:1 and Diapente 3:2 (p. 262), so the cited
// layer is the first two members of this rule and not a separate system.
//
// - A symbol with ordinal n stands on the (n-1)th fifth of the chain, counted modulo the
//   chain length, in octave `floor((n-1) / chain) % 3` above the open string.
// - Row r of a figure stands r fifths further along the chain than its root, in the
//   first octave at or above the root.
// - Everything is folded by octaves into the string's three octaves, [open, open x 8).
//   At the default open string that is 110 Hz to 880 Hz.
//
// The chain length is the composer's, like the open string. 7 gives a Pythagorean
// diatonic set; 12 adds the chromatic fifths; 17 is the gamut Safi al-Din al-Urmawi built
// from fifths; 53 fifths close within 3.6 cents of the octave, which is the comma grid
// Turkish makam theory counts in. Past 12, neighbouring pitches sit a Pythagorean comma
// (23.5 cents) apart: those are the microtones.
//
// `tests/string.test.mjs` recomputes every pitch in the corpus from this rule.

export const OPEN_CENTS = 3300;          // A2, 110 Hz. Mine; the knob says so.
export const OCTAVES = 3;               // the string's length, in octaves
export const CHAINS = [7, 12, 17, 53];
export const DEFAULT_CHAIN = 7;

const LOG2_3 = Math.log2(3);
const FIFTH = 1200 * (LOG2_3 - 1);       // 701.955 cents

/// The fifth `k` steps along the chain, reduced into one octave: 3^a / 2^b in [1, 2).
export function fifth(k) {
  const a = k;
  const b = Math.floor(k * LOG2_3);
  return { a, b, cents: 1200 * (a * LOG2_3 - b) };
}

/// Octave-fold `cents` (relative to the open string) into the string's span.
export function fold(cents) {
  const top = OCTAVES * 1200;
  let c = cents;
  while (c >= top - 1e-9) c -= 1200;
  while (c < -1e-9) c += 1200;
  return c;
}

/// A stop on the string, relative to the open string: fifths `k`, octave `octave`.
export function stopOf(k, octave) {
  const f = fifth(k);
  const cents = fold(f.cents + octave * 1200);
  const oct = Math.round((cents - f.cents) / 1200);
  return { k, a: f.a, b: f.b - oct, cents };
}

/// The stop for a symbol's ordinal.
export function ordinalStop(ordinal, chain = DEFAULT_CHAIN) {
  const i = Math.round(ordinal) - 1;
  const k = i % chain;
  const octave = Math.floor(i / chain) % OCTAVES;
  return stopOf(k, octave);
}

/// Row `r` above a root stop: r fifths further along, in the first octave at or above it.
export function rowStop(root, r) {
  if (r === 0) return root;
  const k = root.k + r;
  const f = fifth(k);
  const up = (((f.cents - fifth(root.k).cents) % 1200) + 1200) % 1200;
  const cents = fold(root.cents + up);
  const oct = Math.round((cents - f.cents) / 1200);
  return { k, a: f.a, b: f.b - oct, cents };
}

/// "3^4/2^6", or the small ratio it reduces to when that is plainer ("81:64", "3:2").
export function ratioText({ a, b }) {
  const num = 3 ** a * (b < 0 ? 2 ** -b : 1);
  const den = b > 0 ? 2 ** b : 1;
  if (num < 1e6 && den < 1e6) return `${num}:${den}`;
  return `3^${a}/2^${b}`;
}

/// Where the stop is on the string, as a fraction of its length: the inverse ratio.
export function lengthText(stop) {
  const [num, den] = ratioText(stop).split(':');
  return den ? `${den}/${num}` : `2^${stop.b}/3^${stop.a}`;
}

export { FIFTH };

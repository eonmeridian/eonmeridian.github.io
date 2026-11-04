// The arrangement, as a Strudel patch you can take elsewhere.
//
// **Additive, never a replacement.** The Web Audio instrument stays the thing you hear;
// this is a view. It exists because `direction.md` asks for *"one piece made entirely from
// traversals, with its sources listed"*, and until something can leave the page there is
// nothing to show anyone.
//
// # The tuning survives, which was not a given
//
// The first plan for this pane assumed it would be lossy — that Strudel speaks in scale
// degrees, so Agrippa's 702-cent fifth would flatten to a piano's 700 and, in
// `sounds-like`'s phrase, *"the whole tuning apparatus is decorative"*. Probing the
// vendored bundle showed `freq` among its controls, so the patch emits **frequencies**
// rather than degrees and the ratio is preserved exactly.
//
// What cannot cross is the *reason*: that the fifth is 3:2 because Agrippa writes it on
// p. 262. Strudel has no vocabulary for a citation, so that goes in the header, and in the
// programme note beside it.
//
// # Oscillators only
//
// Strudel's named instruments — `piano`, `bd`, `hh` — are **samples fetched from a remote
// bank at runtime**. `diagrammatic-immanence`'s vendor README records this, and it is the
// reason its own lexicon is oscillators-only: using them would quietly put the network back
// into an application built to work without one. `tests/strudel.test.mjs` enforces the
// allowlist so a sample name cannot creep in later.
//
// # Syntax already paid for
//
// Comments are `//`, never `#`. Repeats are written longhand, never `!7`. `.iter()` rotates
// rather than repeats. `.slow(N)` also slows `<>` alternation and desynchronises it, so
// tempo is `setcps` and nothing else.

/// The four oscillators and the noise source, and nothing that would fetch a sample.
export const VOICES = {
  established: 'sine',
  traditional: 'triangle',
  contested: 'triangle',
  speculative: 'sawtooth',
  unpitched: 'white',
};

const round = (n, places = 2) => Number(n.toFixed(places));

/// One `stack()` member per piece.
///
/// Never bucketed or averaged. `diagrammatic-immanence` learned this the hard way: one
/// member per *thing* is what makes independent voices audible as independent, and
/// collapsing them loses the only property polyrhythm has.
function member(piece, tuning) {
  const pitch = tuning.pitch(piece.node);
  const n = piece.steps.length;

  // The comment header is machine-readable on purpose: a single piece can be auditioned
  // by slicing this member out of the patch and evaluating it alone, rather than by a
  // second sound path that would be a second interpretation of the same arrangement.
  const head =
    `  // ${piece.address} · ${piece.node.label} · ${n} mark${n === 1 ? '' : 's'}` +
    ` · rate ${round(piece.rate)}× · ${pitch ? pitch.provenance : 'unpitched'}` +
    (pitch && pitch.provenance === 'cited' ? ` · ${pitch.source} ${pitch.locus ?? ''}` : '');

  if (piece.drones) {
    // A proportion with no figure: a pitch and no rhythm, which is a drone. Agrippa gives
    // the Diapente 3:2 on p. 262 and no diagram anywhere, so it can be held and not
    // articulated — and treating that as silence would make the only cited pitches in the
    // graph unhearable.
    if (!pitch) {
      return [
        `  // ${piece.address} · ${piece.node.label} · no figure and no pitch`,
        `  //   ${piece.node.source_title} prints no figure, and nothing proportions it.`,
      ].join('\n');
    }
    return [
      head + ' · held, not articulated',
      `  freq("${round(pitch.hz)}")`,
      `    .s("${VOICES[pitch.provenance === 'cited' ? 'traditional' : 'established']}")`,
      `    .gain(0.09).attack(0.6).release(0.3).clip(1)`,
    ].join('\n');
  }

  // Every slot is written out. A rest is `~`; there are none here, because every mark in
  // a figure sounds — a broken line is two marks, not a silence.
  const slots = Array.from({ length: n }, () => (pitch ? round(pitch.hz) : '~')).join(' ');

  if (!pitch) {
    // Arrived, and nothing licenses a pitch. Unpitched: filtered noise, struck.
    return [
      head,
      `  s("${VOICES.unpitched}*${n}")`,
      `    .lpf(900).decay(0.12).sustain(0)`,
      `    .gain(0.16).fast(${round(piece.rate, 3)})`,
    ].join('\n');
  }

  const voice = VOICES[pitch.provenance === 'cited' ? 'traditional' : 'established'];
  return [
    head,
    `  freq("${slots}")`,
    `    .s("${voice}")`,
    `    .gain(0.16)`,
    `    .attack(0.01).decay(0.18).sustain(0.2).release(0.25)`,
    `    .fast(${round(piece.rate, 3)})`,
  ].join('\n');
}

/// What this patch cannot carry, said in the patch.
///
/// The instrument's timbre grammar has no Strudel vocabulary: `contested` as two
/// oscillators beating, five distinguishable kinds of silence, and the unpitched third
/// state as a struck sound rather than a rest. Naming the omissions is the difference
/// between a view and a lossy copy pretending to be the thing.
function omissions(pieces, tuning) {
  const lines = ['  // WHAT THIS PATCH DOES NOT CARRY'];
  const contested = pieces.some((p) => tuning.pitch(p.node)?.confidence === 'contested');
  if (contested) {
    lines.push('  //   a contested correspondence sounds here as one tone. In the');
    lines.push('  //   instrument it is two, eighteen cents apart, beating — you are');
    lines.push('  //   meant to hear two sources disagreeing.');
  }
  lines.push('  //   the five kinds of silence are one silence here. A page that');
  lines.push('  //   refused an answer and a search that ran out of hops are');
  lines.push('  //   different claims, and only the instrument tells them apart.');
  lines.push('  //   provenance is a comment, not a sound. Which pitches are cited');
  lines.push('  //   is in the header; nothing in the audio distinguishes them.');
  return lines.join('\n');
}

/// The whole arrangement as a patch.
export function toStrudel(surface, tuning, version) {
  const pieces = surface.pieces;
  const cited = pieces.filter((p) => tuning.pitch(p.node)?.provenance === 'cited').length;

  const head = [
    '// monochord — emitted artifact, do not edit by hand.',
    `// graph        : ${version.hash}  ${version.symbols} symbols, ${version.edges} edges`,
    `// tonic        : ${round(tuning.tonicHz)} Hz — mine, not the tradition's`,
    `// shapes       : ${pieces.length}`,
    `// cited pitches: ${cited} of ${pieces.length}`,
    '//',
    '// Frequencies, not scale degrees, so the tuning survives: a cited fifth is 702',
    '// cents above the tonic and not a piano\'s 700.',
    '',
    'setcps(1)',
    '',
  ];

  if (pieces.length === 0) {
    return [...head, '// nothing placed.', '', '// no terminal.'].join('\n');
  }

  const body = ['stack(', pieces.map((p) => member(p, tuning)).join(',\n\n'), ')'].join('\n');

  return [
    ...head,
    body,
    '',
    omissions(pieces, tuning),
    '',
    // The refusal of closure `diagrammatic-immanence` ends every plate and patch on. A
    // traversal has no last hop; saying so is more honest than a final barline.
    '// no terminal.',
  ].join('\n');
}

// The programme note: what a piece rests on.
//
// `direction.md` names first contact as *"one piece made entirely from traversals, **with
// its sources listed**"*, and says the piece has worked if *"its programme note can name
// every source it rests on — which is a thing this instrument can produce and a DAW
// cannot."* This is that note.
//
// It is the client-side twin of `Score::cited_works` in divinatory-os, which does the same
// job for a traversal: walk what sounded, collect the works underneath it, deduplicate, and
// present them in a fixed order.
//
// # The last line is the point, and it is not flattering
//
// A piece assembled here is mostly **mine**: my tonic, my scale degrees, my rates. Two
// pitches in the whole graph are cited, and both come from one page of Agrippa. A note that
// listed the sources and let you infer the piece was *about* them would be the laundering
// this apparatus exists to refuse — so the ratio is stated outright, in the form that is
// least comfortable to read.

/// Every work the arrangement rests on, and in what way.
///
/// A source can appear for three different reasons and they are kept apart, because they
/// are different kinds of debt:
///
/// - **a figure** — the shape came off that page (Legge's hexagram lines, Agrippa's dots);
/// - **a pitch** — that page states the proportion (Agrippa's p. 262, and nothing else);
/// - **a silence** — that page was consulted and prints nothing, which is a finding and
///   belongs in the note as much as a figure does.
export function restsOn(surface, tuning) {
  const works = new Map();

  const note = (id, title, kind, detail) => {
    if (!works.has(id)) works.set(id, { id, title, figures: 0, pitches: 0, silences: 0, loci: new Set() });
    const w = works.get(id);
    w[kind] += 1;
    if (detail) w.loci.add(detail);
  };

  for (const piece of surface.pieces) {
    const node = piece.node;
    const pitch = tuning.pitch(node);

    if (piece.playable) {
      note(node.source_id, node.source_title, 'figures');
    } else {
      // No figure. The page was read and prints none — Scot's sixty-eight spirits, and
      // every mode Agrippa names without drawing.
      note(node.source_id, node.source_title, 'silences');
    }

    if (pitch && pitch.provenance === 'cited') {
      note(pitch.source, pitch.title ?? pitch.source, 'pitches', pitch.locus);
    }
  }

  // Address order via the id, so the same arrangement always lists its debts the same way.
  return [...works.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/// The note as text, ready to sit beside a recording.
export function programmeNote(surface, tuning, version) {
  const pieces = surface.pieces;
  const pitched = pieces.map((p) => tuning.pitch(p.node));
  const cited = pitched.filter((p) => p && p.provenance === 'cited').length;
  const authored = pitched.filter((p) => p && p.provenance !== 'cited').length;
  const unpitched = pitched.filter((p) => !p).length;

  const lines = [
    `monochord — ${pieces.length} shape${pieces.length === 1 ? '' : 's'}, ` +
      `tonic ${tuning.tonicHz.toFixed(2)} Hz (mine)`,
    `graph ${version.hash} · ${version.symbols} symbols · ${version.edges} edges`,
    '',
    'RESTS ON',
  ];

  for (const w of restsOn(surface, tuning)) {
    const parts = [];
    if (w.pitches) parts.push(`${w.pitches} pitch${w.pitches === 1 ? '' : 'es'}, cited`);
    if (w.figures) parts.push(`${w.figures} figure${w.figures === 1 ? '' : 's'}`);
    if (w.silences) {
      parts.push(`${w.silences} silence${w.silences === 1 ? '' : 's'} — prints no figure`);
    }
    const locus = w.loci.size ? `  (${[...w.loci].join('; ')})` : '';
    lines.push(`  ${w.title}`);
    lines.push(`    ${parts.join(' · ')}${locus}`);
  }

  if (authored) lines.push('  my own scale — the rest');

  lines.push('');
  // Stated plainly. A piece that is almost entirely authored is a piece about my scale,
  // and a note that let you infer otherwise would be doing the laundering this whole
  // apparatus exists to refuse.
  if (cited === 0) {
    lines.push(`No pitch here is cited. All ${authored} are mine.`);
  } else {
    lines.push(
      `${authored} of ${cited + authored} pitches are mine; ` +
        `${cited} ${cited === 1 ? 'is' : 'are'} cited.`
    );
  }
  if (unpitched) {
    lines.push(`${unpitched} shape${unpitched === 1 ? '' : 's'} sound${unpitched === 1 ? 's' : ''} unpitched: nothing proportions them.`);
  }

  return lines.join('\n');
}

// Where a symbol is, and why it is there.
//
// **Deterministic, and that is a requirement rather than a preference.** A
// force-directed layout would untangle the graph beautifully and lose the one property
// that matters: the same neighbourhood must look the same every visit, or you cannot
// learn your way around and a piece made here cannot be found again. divinatory-os's
// §Next puts it plainly — the tangle is a question of what you mounted, not of how you
// laid it out, and **never rank by a score**.
//
// So no simulation, no relaxation, no iteration. Position is a pure function of data
// that is already in the graph: which system a symbol belongs to, which kind within it,
// and its own declared `ordinal`.
//
// # The arrangement
//
// An armillary. Each system is an orbital ring at its own inclination; each kind within
// a system is a radius; each symbol sits at an angle given by its ordinal. Eight tilted
// rings intersecting is, not by accident, the shape Fludd drew the cosmos as — and it
// puts the busiest junction in the graph, the decan, where several planes cross.
//
// Two things this buys beyond looking right. Positions are **global**, so walking from
// one neighbourhood to the next moves the camera through a stable world rather than
// re-laying-out a new one. And a symbol with no `ordinal` still lands somewhere
// definite, by a hash of its address, because a missing attribute must not put it at
// the origin on top of everything else.

const TAU = Math.PI * 2;

/// Radius of the innermost kind-ring, and the gap between successive ones.
const BASE_RADIUS = 1.15;
const KIND_SPACING = 0.42;

/// How far the rings tilt away from each other. A half-turn spread over the systems
/// means no two share a plane, and none is edge-on to a camera on the equator.
const INCLINATION_SPAN = Math.PI * 0.55;

/// A deterministic hash of a string, for symbols whose kind declares no ordinal.
/// xorshift over char codes — the same trick `motes.js` uses to seed identically on a
/// Mac and a Pi.
function hash01(text) {
  let s = 0x2545f491;
  for (let i = 0; i < text.length; i++) {
    s ^= text.charCodeAt(i);
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
  }
  return ((s >>> 0) % 100000) / 100000;
}

/// Build the index the layout needs from a census.
///
/// The census is in `registry.toml` order, which is a declaration order rather than an
/// alphabetical one — so the rings sit in the order the project actually names its
/// systems, and adding a ninth system tilts a new plane in rather than reshuffling the
/// eight that exist.
export function index(census) {
  const systems = new Map();
  census.forEach((system, i) => {
    const kinds = new Map();
    system.kinds.forEach((k, j) => {
      kinds.set(k.kind, { order: j, count: Math.max(1, k.count) });
    });
    systems.set(system.id, {
      order: i,
      of: census.length,
      label: system.label,
      kinds,
    });
  });
  return systems;
}

/// The ring a (system, kind) pair occupies: a radius, a tilt, and a starting longitude.
///
/// Exported so the faint guide circles in `rings.js` are drawn from the *same* numbers
/// the symbols are placed by. Two copies of this arithmetic would eventually disagree,
/// and a guide circle that missed its own symbols would be a drawn line asserting a
/// structure the data does not have.
export function ringOf(system, kindOrder) {
  return {
    radius: BASE_RADIUS + kindOrder * KIND_SPACING,
    inclination:
      (system.order / Math.max(1, system.of - 1) - 0.5) * INCLINATION_SPAN,
    phase: (system.order / system.of) * TAU * 0.618,
  };
}

/// A point at parameter `t` in [0,1) around a ring.
export function pointOn(ring, t) {
  const theta = t * TAU + ring.phase;
  const x = Math.cos(theta) * ring.radius;
  const zFlat = Math.sin(theta) * ring.radius;
  return [x, -zFlat * Math.sin(ring.inclination), zFlat * Math.cos(ring.inclination)];
}

/// Every ring in the world, for the guides. In census order, like everything else.
export function rings(census, idx) {
  const out = [];
  for (const system of census) {
    const s = idx.get(system.id);
    for (const k of system.kinds) {
      const kind = s.kinds.get(k.kind);
      out.push({ system: system.id, kind: k.kind, ...ringOf(s, kind ? kind.order : 0) });
    }
  }
  return out;
}

/// A symbol's place in the world. Pure: same node, same census, same three numbers.
///
/// `node` needs `system`, `kind`, and `attributes.ordinal` where the kind has one.
export function place(node, idx) {
  const system = idx.get(node.system);
  if (!system) {
    // An address from a system the census does not list should not silently land at
    // the centre of the world, where it would sit inside everything else.
    const h = hash01(node.address);
    return [Math.cos(h * TAU) * 4.5, (h - 0.5) * 3, Math.sin(h * TAU) * 4.5];
  }

  const kind = system.kinds.get(node.kind);
  const kindOrder = kind ? kind.order : 0;
  const count = kind ? kind.count : 1;

  // The ordinal is a string attribute; a kind that declares none falls back to a hash
  // of the address, which is stable and spreads rather than stacking.
  const ordinal = Number(node.attributes?.ordinal);
  const t = Number.isFinite(ordinal) ? (ordinal - 1) / count : hash01(node.address);

  // A circle in the xz-plane, tilted about x, with a per-system phase so the rings do
  // not all begin at the same longitude — which would draw a false seam straight
  // through the sphere.
  return pointOn(ringOf(system, kindOrder), t);
}

/// The centroid of a set of placed nodes — where the camera looks when you stand in a
/// neighbourhood.
export function centroid(positions) {
  if (positions.length === 0) return [0, 0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of positions) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  const n = positions.length;
  return [x / n, y / n, z / n];
}

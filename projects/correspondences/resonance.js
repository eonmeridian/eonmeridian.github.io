// Resonance: two shapes that correspond, brought together, and the catch when they do.
//
// A piece's position on the surface means nothing — `pieces.js` says so and keeps the
// surface apart from the armillary for that reason. What *can* mean something is two
// pieces meeting, because whether they correspond is not a matter of where they sit: the
// kernel is asked, `Corpus.between(a, b)`, and it answers with cited edges or with nothing.
//
// # What pulls, and what does not
//
// A piece is drawn toward another **only when `between` returns a route** — a direct edge,
// or a channel through one third symbol (a path between two sephiroth, a decan a card and a
// sign share). Two pieces that do not correspond feel nothing as they pass, and that
// absence is the finding: *these do not meet within one step, according to any source
// here.* Faking a pull there would be an uncited correspondence rendered as physics.
//
// # What the catch may not say
//
// §Interface rule 2: expressiveness may never manufacture confidence. So the snap, the
// sparks and the chord are **the same size for every label**. A `speculative` meeting and
// an `established` one latch at the same distance, with the same number of sparks and the
// same loudness. What differs is *kind*: the stroke the route is drawn in and the timbre the
// chord is sounded in, which are the categorical carriers the rest of the atlas already
// uses. The pull strength is geometry — how close you are — and never how well supported
// the meeting is.
//
// Rule 6: motion depicts procedure. The pull is the query having returned a route; the
// latch is the lock; the phase easing is the two readings being brought into step. None of
// it animates to suggest that the meeting *means* something.

/// Surface units. A piece's figure is drawn at radius ~0.11 (`piecepass.js`).
export const DOCK = 0.27;      // centre-to-centre distance when latched: rims just apart
export const CAPTURE = 0.42;   // inside this, a related piece begins to pull
export const LATCH = 0.3;      // inside this, it catches
export const BREAK = 0.62;     // pull a latched piece this far and it tears away
export const ALIGN = 0.6;      // seconds for two latched shapes to come into phase
export const UNFOLD = 0.55;    // seconds for the route to draw itself

const key = (a, b) => `${a}\u0000${b}`;

/// Does this answer contain a meeting at all?
export function meets(m) {
  return !!m && (m.direct.length > 0 || m.channels.length > 0);
}

/// Every label on a meeting, in the order the kernel returned the edges.
///
/// Not a set and not sorted: two sources asserting the same label is two voices, and the
/// chord sounds each. Nothing here chooses between them.
export function labelsOf(m) {
  const out = [];
  for (const e of m.direct) out.push(e.confidence);
  for (const ch of m.channels) {
    for (const e of ch.from_a) out.push(e.confidence);
    for (const e of ch.from_b) out.push(e.confidence);
  }
  return out;
}

export class Resonance {
  /// @param {(a: string, b: string) => object} between  `Corpus.between`, parsed
  constructor(between) {
    this.between = between;
    this.cache = new Map();
    /// Latched pairs: `{ a, b, meet, age, align, rates }`. `a` is the piece that was
    /// brought; `b` the one it was brought to.
    this.bonds = [];
    /// Offered next steps: symbols one cited edge from a newly latched piece.
    this.ghosts = [];
    this.onLatch = null;
    this.onBreak = null;
  }

  /// The kernel's answer for a pair, asked once per pair per page.
  meet(a, b) {
    const k = key(a, b);
    if (!this.cache.has(k)) this.cache.set(k, this.between(a, b));
    return this.cache.get(k);
  }

  bondOf(piece) {
    return this.bonds.find((b) => b.a === piece || b.b === piece) ?? null;
  }

  /// Where a dragged piece should sit, given where the pointer wants it.
  ///
  /// Returns `{ x, y }`. Latches as a side effect, and calls `onLatch(bond)` the moment it
  /// does — that is the catch, and everything that follows hangs off it.
  pull(piece, x, y, pieces) {
    const held = this.bonds.find((b) => b.a === piece);
    if (held) {
      const [dx, dy] = held.dock;
      const dockX = held.b.x + dx;
      const dockY = held.b.y + dy;
      if (Math.hypot(x - dockX, y - dockY) < BREAK - DOCK) return { x: dockX, y: dockY };
      this.release(held);
    }

    // The nearest piece that corresponds. Nearest by distance on the surface, which is
    // where your hand is — never by anything about the meeting.
    let partner = null;
    let best = CAPTURE;
    let meeting = null;
    for (const q of pieces) {
      if (q === piece || q.address === piece.address) continue;
      const d = Math.hypot(x - q.x, y - q.y);
      if (d >= best) continue;
      const m = this.meet(piece.address, q.address);
      if (!meets(m)) continue;
      partner = q;
      best = d;
      meeting = m;
    }
    if (!partner) return { x, y };

    const d = Math.max(1e-6, best);
    const ux = (x - partner.x) / d;
    const uy = (y - partner.y) / d;
    const dockX = partner.x + ux * DOCK;
    const dockY = partner.y + uy * DOCK;

    if (d < LATCH) {
      this.latch(piece, partner, meeting, [ux * DOCK, uy * DOCK]);
      return { x: dockX, y: dockY };
    }

    // The magnet. Quadratic in how far inside the capture ring you are, so it is felt as
    // a lean before it is seen as a jump.
    const t = (CAPTURE - d) / (CAPTURE - LATCH);
    const k = 0.55 * t * t;
    return { x: x + (dockX - x) * k, y: y + (dockY - y) * k };
  }

  /// Latch two pieces directly, without a drag — a ghost tapped into place.
  latch(a, b, meeting = this.meet(a.address, b.address), dock = null) {
    if (!meets(meeting)) return null;
    // A piece docked to its own partner would dock to a shape that is docked to it:
    // each would chase the other. The existing bond stands.
    if (this.bonds.some((x) => x.a === b && x.b === a)) return null;
    for (const old of this.bonds.filter((x) => x.a === a)) this.release(old);
    if (!dock) {
      const d = Math.max(1e-6, Math.hypot(a.x - b.x, a.y - b.y));
      dock = [((a.x - b.x) / d) * DOCK, ((a.y - b.y) / d) * DOCK];
    }
    a.x = b.x + dock[0];
    a.y = b.y + dock[1];

    // Into step. A latched group runs at the slowest of its members' own rates -- mine,
    // like every rate -- and the brought piece is advanced, never rewound, until its
    // phase matches. Advancing means the marks it passes are sounded on the way, so the
    // catching-up is heard.
    //
    // Each piece remembers its own rate (`baseRate`) from before it was latched to
    // anything. Recording the pair's rates per bond, as this used to, captured a rate a
    // *different* bond had already slowed: chain A-B then C-B, or release out of order,
    // and a piece's own rate was lost for good.
    for (const p of [a, b]) if (!this.bondOf(p)) p.baseRate = p.rate;
    const bond = { a, b, meet: meeting, dock, age: 0, align: 0 };
    this.bonds.push(bond);
    this.settle();
    bond.align = (((b.turns - a.turns) % 1) + 1) % 1;
    this.onLatch?.(bond);
    return bond;
  }

  /// Every latched group at the slowest of its members' own rates; every piece no longer
  /// latched back at its own.
  settle(freed = []) {
    const parent = new Map();
    const find = (p) => {
      while (parent.get(p) !== p) p = parent.get(p);
      return p;
    };
    for (const { a, b } of this.bonds) {
      for (const p of [a, b]) if (!parent.has(p)) parent.set(p, p);
      parent.set(find(a), find(b));
    }
    const slowest = new Map();
    for (const p of parent.keys()) {
      const root = find(p);
      slowest.set(root, Math.min(slowest.get(root) ?? Infinity, p.baseRate ?? p.rate));
    }
    for (const p of parent.keys()) p.rate = slowest.get(find(p));
    for (const p of freed) {
      if (parent.has(p) || p.baseRate === undefined) continue;
      p.rate = p.baseRate;
      delete p.baseRate;
    }
  }

  release(bond) {
    if (!this.bonds.includes(bond)) return;
    this.bonds = this.bonds.filter((x) => x !== bond);
    // What is still latched settles again; a piece latched to nothing now goes back to
    // its own rate.
    this.settle([bond.a, bond.b]);
    this.ghosts = this.ghosts.filter((g) => g.parent !== bond.a && g.parent !== bond.b);
    this.onBreak?.(bond);
  }

  /// Where a bond's `i`th channel symbol is drawn.
  viaAt(bond, i) {
    return viaSpot(bond.a, bond.b, i);
  }

  /// Offer next steps from a freshly caught piece: symbols one cited edge away.
  ///
  /// `candidates` are `{ node, edge }` in the kernel's order, and the first `max` are
  /// taken **in that order** — address order, which is no judgement about which is the
  /// better next step. They fan out on the side away from the partner, so the pair stays
  /// legible and the offers read as leading onward.
  offer(bond, candidates, max = 6) {
    const parent = bond.a;
    this.ghosts = this.ghosts.filter((g) => g.parent !== parent);
    const shown = candidates.slice(0, max);
    const away = Math.atan2(parent.y - bond.b.y, parent.x - bond.b.x);
    const spread = Math.min(Math.PI * 1.1, 0.42 * Math.max(1, shown.length - 1));
    shown.forEach((c, i) => {
      const t = shown.length === 1 ? 0 : i / (shown.length - 1) - 0.5;
      const ang = away + t * spread;
      this.ghosts.push({
        node: c.node,
        edge: c.edge,
        parent,
        x: parent.x + Math.cos(ang) * 0.3,
        y: parent.y + Math.sin(ang) * 0.3,
        age: 0,
      });
    });
    return { shown: shown.length, more: Math.max(0, candidates.length - max) };
  }

  /// The ghost under a point, if any.
  ghostAt(x, y, radius = 0.07) {
    let best = null;
    let bestD = radius;
    for (const g of this.ghosts) {
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < bestD) { best = g; bestD = d; }
    }
    return best;
  }

  /// Advance the bonds: bring phases into step, and tear any pair pulled apart.
  ///
  /// `live` is the surface's current pieces, so a removed piece takes its bonds with it.
  tick(dt, live) {
    for (const bond of [...this.bonds]) {
      if (!live.includes(bond.a) || !live.includes(bond.b)) {
        this.release(bond);
        continue;
      }
      if (Math.hypot(bond.a.x - bond.b.x, bond.a.y - bond.b.y) > BREAK) {
        this.release(bond);
        continue;
      }
      bond.age += dt;
      if (bond.align > 0) {
        const step = Math.min(bond.align, (dt / ALIGN) * Math.max(bond.align, 0.25));
        bond.a.turns += step;
        bond.align -= step;
        if (bond.align < 1e-4) {
          bond.a.turns += bond.align;
          bond.align = 0;
        }
      }
    }
    this.ghosts = this.ghosts.filter((g) => live.includes(g.parent));
  }
}

// ---------------------------------------------------------------------------------------
// Geometry. Pure, so the stroke grammar can be tested without a GPU.

/// The stroke for one label: `null` for solid, or `[on, off]` in surface units.
///
/// The same grammar as `graph.js`'s edges and the iPhone's `AtlasLayout.strokeEdge`:
/// weight and dash carry the label, never how bright or how thick. `contested` is solid
/// and drawn twice, as a fork.
export function dashOf(label) {
  switch (label) {
    case 'established': return null;
    case 'traditional': return [0.026, 0.016];
    case 'speculative': return [0.006, 0.018];
    case 'contested': return null;
    default: return [0.018, 0.008, 0.004, 0.008]; // visibly odd: a label with no stroke
  }
}

/// Split a line into its dashes, up to `progress` of its length.
export function dashed(x0, y0, x1, y1, pattern, progress = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const upto = len * Math.max(0, Math.min(1, progress));
  if (upto <= 0) return [];
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  if (!pattern) return [[x0, y0, x0 + ux * upto, y0 + uy * upto]];
  const out = [];
  let at = 0;
  let i = 0;
  while (at < upto) {
    const run = pattern[i % pattern.length];
    if (i % 2 === 0) {
      const end = Math.min(upto, at + run);
      out.push([x0 + ux * at, y0 + uy * at, x0 + ux * end, y0 + uy * end]);
    }
    at += run;
    i++;
  }
  return out;
}

/// One cited hop drawn between two points, as strands: `[{ seg, label }]`.
///
/// Several edges between the same two points — two sources, or one source twice — are
/// laid side by side rather than merged, so a meeting two books agree on reads as two
/// lines and not as one thicker one.
export function strands(x0, y0, x1, y1, edges, progress = 1) {
  const len = Math.max(1e-6, Math.hypot(x1 - x0, y1 - y0));
  const px = -(y1 - y0) / len;
  const py = (x1 - x0) / len;
  const lanes = [];
  for (const e of edges) {
    if (e.confidence === 'contested') {
      lanes.push({ label: e.confidence, fork: -1 }, { label: e.confidence, fork: 1 });
    } else {
      lanes.push({ label: e.confidence, fork: 0 });
    }
  }
  const out = [];
  const GAP = 0.016;
  lanes.forEach((lane, i) => {
    const o = (i - (lanes.length - 1) / 2) * GAP;
    const ox = px * o;
    const oy = py * o;
    for (const seg of dashed(x0 + ox, y0 + oy, x1 + ox, y1 + oy, dashOf(lane.label), progress)) {
      out.push({ seg, label: lane.label });
    }
  });
  return out;
}

/// Where a channel's third symbol sits: off the line between the pair, alternating sides,
/// so several channels fan out instead of stacking. Index order is the kernel's.
export function viaSpot(a, b, i) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y));
  const px = -(b.y - a.y) / len;
  const py = (b.x - a.x) / len;
  const side = i % 2 === 0 ? 1 : -1;
  const r = 0.15 * (1 + Math.floor(i / 2));
  return { x: mx + px * r * side, y: my + py * r * side };
}

/// Every strand a bond draws, unfolded to `progress`: the direct edges between the pair,
/// and each channel as two hops through its third symbol.
export function bondStrokes(bond, progress = 1) {
  const { a, b, meet } = bond;
  const out = [];
  if (meet.direct.length) out.push(...strands(a.x, a.y, b.x, b.y, meet.direct, progress));
  meet.channels.forEach((ch, i) => {
    const v = viaSpot(a, b, i);
    // The two hops draw one after the other, so the route reads as a route.
    out.push(...strands(a.x, a.y, v.x, v.y, ch.from_a, Math.min(1, progress * 2)));
    out.push(...strands(b.x, b.y, v.x, v.y, ch.from_b, Math.max(0, progress * 2 - 1)));
  });
  return out;
}

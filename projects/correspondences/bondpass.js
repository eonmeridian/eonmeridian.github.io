// Latched pairs, drawn: the route between them, the symbol a channel runs through, the
// next steps on offer, and the sparks of the catch.
//
// Same plane as the pieces, and after them, so a route sits over the shapes it joins.
//
// **Every line here is an edge the kernel returned.** `resonance.js` builds strokes only
// from `Corpus.between`, whose every hop carries a source, and a ghost's line is the one
// cited edge that offered it. There is no line drawn because two pieces are near each
// other; nearness is what *asks*, and only an answer is drawn.

import { program, uniforms } from './scene/gl.js';
import { emptyFrame, figureOf, segmentsOf } from './figures.js';
import { UNFOLD, bondStrokes, strands, viaSpot } from './resonance.js';
import { screenOf } from './pieces.js';

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aColour;
uniform vec2 uAspect;
uniform float uPoint;
out vec4 vColour;
void main() {
  vColour = aColour;
  gl_PointSize = uPoint;
  gl_Position = vec4(aPos * uAspect, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec4 vColour;
uniform float uRound;
out vec4 fragColor;
void main() {
  float a = vColour.a;
  if (uRound > 0.5) {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    a *= smoothstep(1.0, 0.2, r);
  }
  fragColor = vec4(vColour.rgb, a);
}`;

const INK = [0.957, 0.957, 0.949];
const CAVEAT = [0.545, 0.545, 0.576];
const ACCENT = [0.886, 0.337, 0.302];
const MERIDIAN = [0.204, 0.878, 0.541];

/// The colour of a stroke by label — the same table as `graph.js`'s edge shader, so a
/// route on the surface and the same edge in the armillary read alike.
function tintOf(label) {
  switch (label) {
    case 'established': return [...INK, 0.55];
    case 'traditional': return [...INK, 0.5];
    case 'speculative': return [...CAVEAT, 0.7];
    case 'contested': return [...ACCENT, 0.8];
    default: return [...ACCENT, 0.9];
  }
}

const SPARKS = 56;   // per catch, for every label alike
const SPARK_LIFE = 1.1;

export class BondPass {
  /// @param {Resonance} resonance
  /// @param {(node: object) => boolean} silent  whether a node's kind prints no figure
  constructor(resonance, silent) {
    this.resonance = resonance;
    this.silent = silent;
    this.sparks = [];
    /// Symbols a channel runs through, drawn at `viaSpot` — kept so a tap can find them.
    this.vias = [];
  }

  build(stage) {
    const gl = stage.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = program(gl, FS, VS);
    this.u = uniforms(gl, this.prog, ['uAspect', 'uPoint', 'uRound']);
    this.vao = gl.createVertexArray();
    this.posBuf = gl.createBuffer();
    this.colBuf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    for (const [loc, buf, size] of [[0, this.posBuf, 2], [1, this.colBuf, 4]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
  }

  /// The catch. Sparks gather from around both shapes onto the route between them.
  ///
  /// The count is a constant, never a function of the label: a `speculative` meeting and
  /// an `established` one throw exactly as many.
  burst(bond) {
    const a = screenOf(bond.a);
    const b = screenOf(bond.b);
    if (!a || !b) return;
    for (let i = 0; i < SPARKS; i++) {
      const from = i % 2 ? a : b;
      const ang = Math.random() * Math.PI * 2;
      const r = 0.14 + Math.random() * 0.22;
      const t = Math.random();
      this.sparks.push({
        x0: from.x + Math.cos(ang) * r,
        y0: from.y + Math.sin(ang) * r,
        tx: a.x + (b.x - a.x) * t,
        ty: a.y + (b.y - a.y) * t,
        age: -Math.random() * 0.25,
      });
    }
  }

  _glyph(out, cols, node, cx, cy, scale, colour) {
    const shape = this.silent(node) ? emptyFrame() : segmentsOf(figureOf(node));
    for (const s of shape) {
      out.push(cx + s[0] * scale, cy + s[1] * scale, cx + s[2] * scale, cy + s[3] * scale);
      cols.push(...colour, ...colour);
    }
  }

  draw(stage, dt) {
    const gl = stage.gl;
    const lines = [];
    const lineCols = [];
    this.vias = [];

    for (const bond of this.resonance.bonds) {
      const progress = Math.min(1, bond.age / UNFOLD);
      // Drawn between the shapes where they are drawn -- at their orbits when orbiting --
      // not where they sit on the surface.
      const A = screenOf(bond.a);
      const B = screenOf(bond.b);
      if (!A || !B) continue;
      const seen = { ...bond, a: A, b: B };
      for (const { seg, label } of bondStrokes(seen, progress)) {
        lines.push(...seg);
        const c = tintOf(label);
        lineCols.push(...c, ...c);
      }
      // The third symbol of each channel, drawn small where its two hops meet. It is a
      // symbol in its own right and can be tapped onto the surface.
      bond.meet.channels.forEach((ch, i) => {
        const at = viaSpot(A, B, i);
        const shown = Math.max(0, Math.min(1, progress * 2 - 0.6));
        if (shown <= 0) return;
        this._glyph(lines, lineCols, ch.via, at.x, at.y, 0.05, [...CAVEAT, 0.85 * shown]);
        this.vias.push({ node: ch.via, x: at.x, y: at.y, bond });
      });
    }

    // Offered next steps: one cited edge from the piece just caught, drawn in that edge's
    // own stroke, with the symbol at the end of it.
    for (const g of this.resonance.ghosts) {
      g.age = (g.age ?? 0) + dt;
      // An offer is a place on the surface to drag onto; while orbiting there is nothing
      // to drag and the parent is drawn elsewhere, so offers wait until orbits are off.
      if (g.parent.sx !== undefined) continue;
      const shown = Math.max(0, Math.min(1, (g.age - 0.4) / 0.5));
      if (shown <= 0) continue;
      for (const { seg, label } of strands(g.parent.x, g.parent.y, g.x, g.y, [g.edge], shown)) {
        lines.push(...seg);
        const c = tintOf(label);
        lineCols.push(c[0], c[1], c[2], c[3] * 0.45, c[0], c[1], c[2], c[3] * 0.45);
      }
      this._glyph(lines, lineCols, g.node, g.x, g.y, 0.045, [...CAVEAT, 0.6 * shown]);
    }

    // Sparks.
    const pts = [];
    const ptCols = [];
    for (const s of this.sparks) s.age += dt;
    this.sparks = this.sparks.filter((s) => s.age < SPARK_LIFE);
    for (const s of this.sparks) {
      if (s.age < 0) continue;
      const t = s.age / SPARK_LIFE;
      const e = 1 - (1 - t) ** 3;
      pts.push(s.x0 + (s.tx - s.x0) * e, s.y0 + (s.ty - s.y0) * e);
      ptCols.push(...MERIDIAN, Math.sin(Math.PI * t) * 0.9);
    }

    if (!lines.length && !pts.length) return;

    const aspect = stage.canvas.width / Math.max(1, stage.canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uAspect, aspect > 1 ? 1 / aspect : 1, aspect > 1 ? 1 : aspect);
    gl.bindVertexArray(this.vao);

    const upload = (pos, cols) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.DYNAMIC_DRAW);
    };

    if (lines.length) {
      upload(lines, lineCols);
      gl.uniform1f(this.u.uRound, 0);
      gl.uniform1f(this.u.uPoint, 1);
      gl.drawArrays(gl.LINES, 0, lines.length / 2);
    }
    if (pts.length) {
      upload(pts, ptCols);
      gl.uniform1f(this.u.uRound, 1);
      gl.uniform1f(this.u.uPoint, 7 * (stage.canvas.height / 900));
      gl.drawArrays(gl.POINTS, 0, pts.length / 2);
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}

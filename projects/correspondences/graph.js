// The atlas, drawn.
//
// A pass in the sense `web/scene/gl.js` means: `{ build(stage), draw(stage, dt) }`.
//
// # Only edges the kernel returned
//
// divinatory-os's §Interface rule 7: *a canvas may only draw edges the kernel returned.*
// `Corpus.neighbourhood` hands back the **induced subgraph** — every edge has both
// endpoints among the nodes — so every line here is a correspondence somebody asserted,
// with a source and a locus. Joining two nodes because they landed near each other on a
// tilted ring would be an uncited claim rendered in cited ink, and the reason it never
// happens is that this file has no way to invent an edge: it draws what it was given.
//
// # The stroke grammar is not new
//
// It is `AtlasLayout.strokeEdge` from the iPhone app, in GLSL. Same four voicings, same
// reasoning, so the same graph reads the same way in both places:
//
// | label | stroke |
// |---|---|
// | `established` | solid |
// | `traditional` | dashed |
// | `speculative` | dotted, in the caveat colour |
// | `contested` | **two forked strands** — disagreement seen before it is read |
//
// Weight and dash carry it. Not opacity-as-strength, and not colour temperature:
// `EpistemicLabel` orders by declaration and not by strength, so anything that reads as
// *more* would be asserting a ranking no source gives.

import { program, uniforms } from './scene/gl.js';
import { lookAt, multiply, perspective } from './scene/math.js';

/// Label to a small integer the shader can switch on. Exhaustive, and an unrecognised
/// label lands on its own code rather than the nearest familiar one.
const CODE = {
  established: 0,
  traditional: 1,
  speculative: 2,
  contested: 3,
};
const CODE_UNVOICED = 4;

const NODE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
// x: hops from the centre. y: 1.0 when the source prints no figure for its kind.
layout(location=1) in vec2 aFlags;

uniform mat4 uViewProj;
uniform float uPixelScale;

out float vDistance;
out float vNoFigure;

void main() {
  vDistance = aFlags.x;
  vNoFigure = aFlags.y;
  vec4 clip = uViewProj * vec4(aPos, 1.0);
  gl_Position = clip;
  // The centre is drawn largest. That is structural -- it is where you are standing --
  // and not a claim that it matters more than its neighbours.
  // Three tiers: where you are, its cited neighbours, and the rest of the world.
  float size = vDistance > 8.0 ? 2.6 : mix(15.0, 7.0, clamp(vDistance / 3.0, 0.0, 1.0));
  gl_PointSize = size * uPixelScale * 3.0 / max(0.35, clip.w);
}`;

const NODE_FS = `#version 300 es
precision highp float;

in float vDistance;
in float vNoFigure;
out vec4 fragColor;

const vec3 INK      = vec3(0.957, 0.957, 0.949);
const vec3 MERIDIAN = vec3(0.204, 0.878, 0.541);
const vec3 CAVEAT   = vec3(0.545, 0.545, 0.576);

void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r = length(d);
  if (r > 1.0) discard;

  // The centre is the meridian colour: orientation, where you are.
  vec3 tint = mix(MERIDIAN, INK, clamp(vDistance, 0.0, 1.0));

  if (vNoFigure > 0.5) {
    // A source that prints no figure for this kind. Drawn as a ring, not a disc:
    // a hole with an edge, never a mark that could pass for a drawn figure.
    float ring = smoothstep(0.62, 0.72, r) * (1.0 - smoothstep(0.92, 1.0, r));
    fragColor = vec4(CAVEAT, ring * 0.9);
    return;
  }

  float core = 1.0 - smoothstep(0.0, 1.0, r);
  // The world is present and quiet; the neighbourhood is what you are being told.
  float alpha = vDistance > 8.0
    ? core * 0.20
    : core * mix(1.0, 0.55, clamp(vDistance / 3.0, 0.0, 1.0));
  fragColor = vec4(tint, alpha);
}`;

const EDGE_VS = `#version 300 es
layout(location=0) in vec3 aFrom;
layout(location=1) in vec3 aTo;
// x: label code. y: strand sign (-1, 0, +1) -- contested is drawn twice.
layout(location=2) in vec2 aEdge;

uniform mat4 uViewProj;
uniform vec2 uResolution;

out float vAlong;
out float vCode;
out float vLengthPx;

void main() {
  vCode = aEdge.x;

  vec4 a = uViewProj * vec4(aFrom, 1.0);
  vec4 b = uViewProj * vec4(aTo, 1.0);

  // Screen-space perpendicular, so weight is a width in pixels rather than in world
  // units -- a line that thins with distance would read as a weaker claim.
  vec2 an = a.xy / max(0.0001, a.w);
  vec2 bn = b.xy / max(0.0001, b.w);
  vec2 dir = bn - an;
  vLengthPx = length(dir * uResolution * 0.5);
  vec2 perp = normalize(vec2(-dir.y, dir.x) + 1e-6);

  // Six vertices, two triangles, from gl_VertexID alone.
  int id = gl_VertexID;
  float end = (id == 1 || id == 2 || id == 4) ? 1.0 : 0.0;
  float side = (id == 2 || id == 4 || id == 5) ? 1.0 : -1.0;

  float widthPx = vCode < 0.5 ? 1.7 : (vCode < 1.5 ? 1.3 : 1.1);
  vec4 clip = mix(a, b, end);
  vec2 offset = perp * side * widthPx / uResolution * clip.w;
  // A forked pair sits either side of where the single line would run.
  offset += perp * aEdge.y * 2.6 / uResolution * clip.w;

  clip.xy += offset;
  gl_Position = clip;
  vAlong = end;
}`;

const EDGE_FS = `#version 300 es
precision highp float;

in float vAlong;
in float vCode;
in float vLengthPx;
out vec4 fragColor;

const vec3 INK    = vec3(0.957, 0.957, 0.949);
const vec3 CAVEAT = vec3(0.545, 0.545, 0.576);
const vec3 ACCENT = vec3(0.886, 0.337, 0.302);

void main() {
  float px = vAlong * vLengthPx;
  vec3 tint = INK;
  float alpha = 0.55;

  if (vCode < 0.5) {
    // established: solid.
  } else if (vCode < 1.5) {
    // traditional: dashed 5 on, 3 off -- the iPhone's [5, 3].
    alpha = 0.42;
    if (mod(px, 8.0) > 5.0) discard;
  } else if (vCode < 2.5) {
    // speculative: dotted 1.5 on, 3.5 off, in the caveat colour.
    tint = CAVEAT;
    alpha = 0.70;
    if (mod(px, 5.0) > 1.5) discard;
  } else if (vCode < 3.5) {
    // contested: two solid strands, in the accent colour. Drawn twice by the
    // instance data, so what you see is a fork rather than a thicker line.
    tint = ACCENT;
    alpha = 0.80;
  } else {
    // A label this build has no stroke for. Visibly odd on purpose: it must not be
    // mistaken for one of the four above.
    tint = ACCENT;
    alpha = 0.9;
    if (mod(px, 3.0) > 1.0) discard;
  }

  fragColor = vec4(tint, alpha);
}`;

export class GraphPass {
  constructor() {
    /// Every symbol in the graph, placed once and never moved. This is the world: the
    /// eight tilted rings you are standing inside. Drawn dim, because it is context
    /// rather than the answer to anything you asked.
    this.context = [];
    this.nodes = [];
    this.edges = [];
    /// The camera always looks at the middle of the world, and the world never moves.
    /// Framing the *node* instead put the camera outside the rings looking in at three
    /// dots, and re-centring on every step made the atlas feel like it was being rebuilt
    /// rather than travelled.
    this.target = [0, 0, 0];
    /// How far out to orbit. Wide enough to keep the whole armillary in frame, so a
    /// cross-system correspondence is visibly a line across the cosmos rather than a
    /// line to somewhere off-screen.
    this.radius = 5.6;
    /// Where the camera is, and where it is heading. Selecting a symbol swings the view
    /// round to face it — that swing *is* the walk, and it is the only motion here that
    /// means anything. Everything else is a slow idle drift.
    this.angle = 0;
    this.aim = 0;
    /// Elevation, clamped short of the poles: at the pole `lookAt`'s up vector becomes
    /// parallel to the view and the armillary flips over.
    this.elevation = 0.16;
    /// Set while the hand is on the camera. The auto-swing yields rather than fighting
    /// it — a camera that argues with a drag is worse than one that never moves.
    this.manual = false;
    this.count = 0;
    this.contextCount = 0;
    this.edgeCount = 0;
  }

  /// Turn to face a position. Called when you stand somewhere new.
  ///
  /// Re-arms the swing that a drag turned off: selecting a symbol is a request to be
  /// shown it, and is the one thing that should take the camera back from the hand.
  faceToward(pos) {
    this.aim = Math.atan2(pos[0], pos[2]);
    this.manual = false;
  }

  /// Drag on empty space: horizontal is azimuth, vertical is elevation.
  orbit(dx, dy) {
    this.manual = true;
    this.angle -= dx * 2.4;
    this.aim = this.angle; // stop the easing from pulling back to the last selection
    this.elevation = Math.max(-1.15, Math.min(1.15, this.elevation + dy * 1.8));
  }

  /// Wheel: in far enough to stand among the rings, out far enough to see the cosmos.
  dolly(amount) {
    this.radius = Math.max(2.2, Math.min(12, this.radius * (1 + amount)));
  }

  /// Place the whole graph once. Deterministic, so this is the same every load.
  setContext(stage, placed) {
    this.context = placed;
    if (stage?.gl) this._uploadContext(stage.gl);
  }

  _uploadContext(gl) {
    const n = this.context.length;
    const pos = new Float32Array(n * 3);
    const flags = new Float32Array(n * 2);
    this.context.forEach((node, i) => {
      pos.set(node.pos, i * 3);
      // Distance 9 is beyond anything a neighbourhood returns, which the shader reads
      // as "context" and draws at its dimmest.
      flags[i * 2] = 9;
      flags[i * 2 + 1] = node.noFigure ? 1 : 0;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ctxPos);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ctxFlags);
    gl.bufferData(gl.ARRAY_BUFFER, flags, gl.STATIC_DRAW);
    this.contextCount = n;
  }

  build(stage) {
    const gl = stage.gl;
    if (this.nodeProg) gl.deleteProgram(this.nodeProg);
    if (this.edgeProg) gl.deleteProgram(this.edgeProg);

    this.nodeProg = program(gl, NODE_FS, NODE_VS);
    this.nodeU = uniforms(gl, this.nodeProg, ['uViewProj', 'uPixelScale']);
    this.edgeProg = program(gl, EDGE_FS, EDGE_VS);
    this.edgeU = uniforms(gl, this.edgeProg, ['uViewProj', 'uResolution']);

    this.ctxVao = gl.createVertexArray();
    this.ctxPos = gl.createBuffer();
    this.ctxFlags = gl.createBuffer();
    gl.bindVertexArray(this.ctxVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ctxPos);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ctxFlags);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.nodeVao = gl.createVertexArray();
    this.nodePos = gl.createBuffer();
    this.nodeFlags = gl.createBuffer();
    gl.bindVertexArray(this.nodeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePos);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeFlags);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.edgeVao = gl.createVertexArray();
    this.edgeFrom = gl.createBuffer();
    this.edgeTo = gl.createBuffer();
    this.edgeMeta = gl.createBuffer();
    gl.bindVertexArray(this.edgeVao);
    for (const [loc, buf, size] of [
      [0, this.edgeFrom, 3],
      [1, this.edgeTo, 3],
      [2, this.edgeMeta, 2],
    ]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, 1); // per instance, not per vertex
    }
    gl.bindVertexArray(null);

    this._upload(gl);
    if (this.context.length) this._uploadContext(gl);
  }

  /// Hand the pass a neighbourhood, already placed.
  ///
  /// `nodes` are `{ pos, distance, noFigure }`; `edges` are `{ from, to, confidence }`
  /// where the endpoints are positions. A contested edge is expanded into two strands
  /// here rather than in the shader, because the fork is two draws of one claim and the
  /// instance data is where that is legible.
  setNeighbourhood(stage, nodes, edges) {
    this.nodes = nodes;
    this.edges = [];
    for (const e of edges) {
      const code = CODE[e.confidence] ?? CODE_UNVOICED;
      if (code === CODE.contested) {
        this.edges.push({ ...e, code, strand: -1 });
        this.edges.push({ ...e, code, strand: 1 });
      } else {
        this.edges.push({ ...e, code, strand: 0 });
      }
    }
    if (stage?.gl) this._upload(stage.gl);
  }

  _upload(gl) {
    const n = this.nodes.length;
    const pos = new Float32Array(n * 3);
    const flags = new Float32Array(n * 2);
    this.nodes.forEach((node, i) => {
      pos[i * 3] = node.pos[0];
      pos[i * 3 + 1] = node.pos[1];
      pos[i * 3 + 2] = node.pos[2];
      flags[i * 2] = node.distance ?? 0;
      flags[i * 2 + 1] = node.noFigure ? 1 : 0;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePos);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeFlags);
    gl.bufferData(gl.ARRAY_BUFFER, flags, gl.DYNAMIC_DRAW);
    this.count = n;

    const m = this.edges.length;
    const from = new Float32Array(m * 3);
    const to = new Float32Array(m * 3);
    const meta = new Float32Array(m * 2);
    this.edges.forEach((e, i) => {
      from.set(e.from, i * 3);
      to.set(e.to, i * 3);
      meta[i * 2] = e.code;
      meta[i * 2 + 1] = e.strand;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeFrom);
    gl.bufferData(gl.ARRAY_BUFFER, from, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTo);
    gl.bufferData(gl.ARRAY_BUFFER, to, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeMeta);
    gl.bufferData(gl.ARRAY_BUFFER, meta, gl.DYNAMIC_DRAW);
    this.edgeCount = m;
  }

  draw(stage) {
    const gl = stage.gl;
    const aspect = stage.canvas.width / Math.max(1, stage.canvas.height);

    // Ease toward facing the current symbol, with a slow drift on top so the volume
    // keeps its depth while you are standing still. machinic-hymns' orbit speed for the
    // drift; the swing is quicker because it is answering something you just did.
    //
    // Shortest way round, or a step from one side of the sphere to the other would
    // sometimes take the long way for no reason.
    let delta = this.aim - this.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.angle += delta * 0.045;

    // The idle drift stops under the hand. Drifting while somebody is aiming the camera
    // makes a careful angle impossible to hold.
    const a = this.angle + (this.manual ? 0 : stage.time * 0.012);
    const r = this.radius;
    const cosEl = Math.cos(this.elevation);
    const eye = [
      Math.sin(a) * r * cosEl,
      Math.sin(this.elevation) * r + (this.manual ? 0 : Math.sin(stage.time * 0.031) * 0.25),
      Math.cos(a) * r * cosEl,
    ];
    const viewProj = multiply(
      perspective(0.86, aspect, 0.1, 40),
      lookAt(eye, this.target)
    );
    // Published for `Rings`, which must use *this* camera rather than recompute one:
    // two cameras drifting apart by a frame would draw the guide circles slightly off
    // the symbols they run through. Ordering therefore matters — `Rings` is added
    // after this pass so the matrix exists when it draws.
    stage.camera = viewProj;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: light, not paint

    if (this.edgeCount > 0) {
      gl.useProgram(this.edgeProg);
      gl.uniformMatrix4fv(this.edgeU.uViewProj, false, viewProj);
      gl.uniform2f(this.edgeU.uResolution, stage.canvas.width, stage.canvas.height);
      gl.bindVertexArray(this.edgeVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.edgeCount);
      gl.bindVertexArray(null);
    }

    gl.useProgram(this.nodeProg);
    gl.uniformMatrix4fv(this.nodeU.uViewProj, false, viewProj);
    gl.uniform1f(this.nodeU.uPixelScale, stage.canvas.height / 900);

    if (this.contextCount > 0) {
      gl.bindVertexArray(this.ctxVao);
      gl.drawArrays(gl.POINTS, 0, this.contextCount);
      gl.bindVertexArray(null);
    }
    if (this.count > 0) {
      gl.bindVertexArray(this.nodeVao);
      gl.drawArrays(gl.POINTS, 0, this.count);
      gl.bindVertexArray(null);
    }

    gl.disable(gl.BLEND);
  }
}

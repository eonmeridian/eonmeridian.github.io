// The placed shapes, drawn.
//
// A screen-space pass in front of the armillary. Pieces live in their own plane on
// purpose: a position in the atlas *means* something — `system → ring, kind → radius,
// ordinal → angle` — and a position on the surface is only where you put it. Drawing them
// in the same space would invite reading one as the other.
//
// Every segment comes from `figures.js`, which reads a cited attribute. A symbol whose
// source prints no figure gets the dashed empty frame and nothing inside it.

import { program, uniforms } from './scene/gl.js';
import { emptyFrame, segmentsOf } from './figures.js';

const VS = `#version 300 es
// x0,y0,x1,y1 of one segment in figure-local space (-1..1)
layout(location=0) in vec4 aSeg;
// x,y of the piece's centre; z: scale; w: rotation in radians
layout(location=1) in vec4 aPlace;
// x: 1.0 when selected. y: 0..1 recency of a sounded step. z: 1.0 when unplayable.
layout(location=2) in vec3 aState;

uniform vec2 uAspect;

out float vSelected;
out float vLit;
out float vSilent;

void main() {
  vSelected = aState.x;
  vLit = aState.y;
  vSilent = aState.z;

  vec2 local = (gl_VertexID == 0) ? aSeg.xy : aSeg.zw;

  float c = cos(aPlace.w);
  float s = sin(aPlace.w);
  vec2 spun = vec2(local.x * c - local.y * s, local.x * s + local.y * c);

  vec2 p = aPlace.xy + spun * aPlace.z;
  gl_Position = vec4(p * uAspect, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;

in float vSelected;
in float vLit;
in float vSilent;
out vec4 fragColor;

const vec3 INK      = vec3(0.957, 0.957, 0.949);
const vec3 MERIDIAN = vec3(0.204, 0.878, 0.541);
const vec3 CAVEAT   = vec3(0.545, 0.545, 0.576);

void main() {
  // A shape whose source prints no figure is drawn in the caveat colour and never in
  // ink: the frame is a recorded refusal, not a mark somebody made.
  vec3 tint = vSilent > 0.5 ? CAVEAT : INK;

  // Selection is the meridian colour -- orientation, where you are -- and is the only
  // thing here that brightens. It says which piece the panel is describing and nothing
  // about the symbol.
  if (vSelected > 0.5) tint = MERIDIAN;

  // A step that just sounded flares briefly. This is motion depicting procedure: the
  // playhead crossed a mark, and the flare is that crossing, not an opinion about it.
  float alpha = (vSilent > 0.5 ? 0.5 : 0.8) + vLit * 0.6;
  fragColor = vec4(tint + vLit * 0.35, alpha);
}`;

/// The playhead: a fixed radius line every piece is read against.
const PLAYHEAD = [[0, 0.98, 0, 1.28]];

export class PiecePass {
  constructor(surface) {
    this.surface = surface;
    /// Recency of the last sounded step per piece id, decayed each frame so a flare
    /// fades rather than switching off.
    this.lit = new Map();
    this.count = 0;
  }

  build(stage) {
    const gl = stage.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = program(gl, FS, VS);
    this.u = uniforms(gl, this.prog, ['uAspect']);

    this.vao = gl.createVertexArray();
    this.segBuf = gl.createBuffer();
    this.placeBuf = gl.createBuffer();
    this.stateBuf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    for (const [loc, buf, size] of [
      [0, this.segBuf, 4],
      [1, this.placeBuf, 4],
      [2, this.stateBuf, 3],
    ]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
  }

  /// Mark a step as just sounded, so it can flare.
  flare(piece) {
    this.lit.set(piece.id, 1);
  }

  draw(stage, dt) {
    const gl = stage.gl;
    const pieces = this.surface.pieces;

    for (const [id, v] of this.lit) {
      const next = v - dt * 3.2;
      if (next <= 0) this.lit.delete(id);
      else this.lit.set(id, next);
    }

    const segs = [];
    const places = [];
    const states = [];

    for (const piece of pieces) {
      const selected = this.surface.selected === piece ? 1 : 0;
      const lit = this.lit.get(piece.id) ?? 0;
      const silent = piece.playable ? 0 : 1;
      // No figure means the frame, and the frame is all there is: an empty list here
      // would draw nothing at all and read as a piece that failed to load.
      const shape = piece.playable ? segmentsOf(piece.figure) : emptyFrame();

      for (const seg of shape) {
        segs.push(seg[0], seg[1], seg[2], seg[3]);
        places.push(piece.x, piece.y, 0.11, piece.phase * Math.PI * 2);
        states.push(selected, lit, silent);
      }
    }

    // The playhead sits in the world, not on a piece, and does not spin.
    for (const seg of PLAYHEAD) {
      segs.push(seg[0], seg[1], seg[2], seg[3]);
      places.push(0, 0, 1, 0);
      states.push(0, 0, 0);
    }

    this.count = segs.length / 4;
    if (this.count === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.segBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(segs), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.placeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(places), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(states), gl.DYNAMIC_DRAW);

    const aspect = stage.canvas.width / Math.max(1, stage.canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uAspect, aspect > 1 ? 1 / aspect : 1, aspect > 1 ? 1 : aspect);
    gl.bindVertexArray(this.vao);
    // Two vertices per instance: gl.LINES, one segment each.
    gl.drawArraysInstanced(gl.LINES, 0, 2, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}

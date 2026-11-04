// The armillary itself: one faint circle per (system, kind).
//
// Without these the world is a starfield — 443 points that read as scatter rather than
// as eight tilted planes with a structure. The guides are what make it an atlas.
//
// **A guide is not an uncited edge.** It asserts nothing between two symbols. It draws
// the set that a kind *is*: thirty-six decans lie on one circle because there are
// thirty-six decans and `sign.ordinal × 30 + degrees` puts them in that order, which is
// the same geometry divinatory-os's §Next already specifies for the decan wheel. The
// circle is a rendering of a census, and the census is not in doubt.
//
// It is drawn from `layout.ringOf`, the same function that places the symbols, so a
// guide cannot drift away from the points it runs through.

import { program, uniforms } from './scene/gl.js';
import { lookAt, multiply, perspective } from './scene/math.js';
import { pointOn } from './layout.js';

const SEGMENTS = 96;

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uViewProj;
void main() { gl_Position = uViewProj * vec4(aPos, 1.0); }`;

const FS = `#version 300 es
precision highp float;
out vec4 fragColor;
// Barely there. The structure should be felt before it is looked at, and a bright
// scaffold would compete with the cited edges, which are the only lines here that
// make a claim.
void main() { fragColor = vec4(0.957, 0.957, 0.949, 0.055); }`;

export class Rings {
  constructor(rings) {
    this.rings = rings;
    this.count = 0;
  }

  build(stage) {
    const gl = stage.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = program(gl, FS, VS);
    this.u = uniforms(gl, this.prog, ['uViewProj']);

    // One long line-strip per ring would need a draw call each. Instead every ring is
    // emitted as separate segments into one buffer: 24 rings become one draw.
    const verts = [];
    for (const ring of this.rings) {
      for (let i = 0; i < SEGMENTS; i++) {
        const a = pointOn(ring, i / SEGMENTS);
        const b = pointOn(ring, (i + 1) / SEGMENTS);
        verts.push(...a, ...b);
      }
    }
    const data = new Float32Array(verts);

    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buf) gl.deleteBuffer(this.buf);
    this.vao = gl.createVertexArray();
    this.buf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.count = data.length / 3;
  }

  /// Shares the camera with `GraphPass`, so it is passed in rather than recomputed —
  /// two cameras drifting apart would put the guides slightly off their own symbols.
  draw(stage) {
    const gl = stage.gl;
    const cam = stage.camera;
    if (!cam || this.count === 0) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uViewProj, false, cam);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.LINES, 0, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}

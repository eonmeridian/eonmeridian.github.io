// The motes, after dream/render/motes.tscn.
//
// Godot emits these from a box, drifting up (its -y) at 3-16 units with a
// little gravity and 0.6 lifetime randomness, drawn from a radial gradient that
// is opaque at the centre, 0.4 at a third out, and gone at the edge, with a
// fade curve that rises by 0.2 of life and falls after 0.75.
//
// Here they are screen-space points with the same behaviour computed in the
// vertex shader from one seed attribute: no particle system, no per-frame
// buffer upload, one draw call. The whole thing is a wrap on fract().
//
// They are the room's dust — and later, in Rite 3, they are the dropped
// intervals: what the transcript threw away, still in the air, still audible.

import { program, uniforms } from './gl.js';

const VS = `#version 300 es
// x0, y0, speed, size
layout(location=0) in vec4 aSeed;

uniform highp float uTime;
uniform mediump float uLucidity;   // stated: crosses to the fragment stage
uniform highp vec2 uResolution;

out float vFade;

void main() {
  float speed = aSeed.z;

  // Life runs 0..1 and wraps. Offsetting by y0 staggers the field so they do
  // not all appear and vanish together, which reads as a strobe.
  float life = fract(aSeed.y + uTime * speed * 0.02);

  // A slow sway. Without it they fall in perfectly straight lines and read as
  // rain rather than as dust hanging in a room.
  float sway = sin(uTime * 0.3 + aSeed.x * 31.4) * 0.012;

  vec2 p = vec2(aSeed.x + sway, life);

  // The fade curve: up by 0.2 of life, hold, down after 0.75.
  vFade = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.75, 1.0, life));

  // Waking sharpens everything, motes included: they contract as lucidity rises.
  float dpr = uResolution.y / 900.0;
  gl_PointSize = aSeed.w * dpr * mix(1.6, 0.9, uLucidity);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision mediump float;

in float vFade;
out vec4 fragColor;

uniform mediump float uLucidity;   // must match the vertex declaration exactly

const vec3 MARK     = vec3(0.886, 0.337, 0.302);
const vec3 MERIDIAN = vec3(0.204, 0.878, 0.541);

void main() {
  // The Godot gradient, as a function: 1.0 at the centre, 0.4 at a third out,
  // 0.0 at the rim. Sampling a 64x64 texture for this would be a texture fetch
  // to describe a curve.
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = mix(1.0, 0.4, smoothstep(0.0, 0.7, d)) * (1.0 - smoothstep(0.7, 1.0, d));

  vec3 col = mix(MARK, MERIDIAN, uLucidity);
  fragColor = vec4(col * a * vFade, a * vFade);
}`;

export class Motes {
  build(stage) {
    const gl = stage.gl;
    // A quarter of machinic-hymns' count. There, motes are the room's dust and the only
    // points on screen; here every *symbol* is a point, and dust at full density reads as
    // more symbols than the graph has.
    const n = Math.round(stage.tier.motes * 0.25);

    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = program(gl, FS, VS);
    this.u = uniforms(gl, this.prog, ['uTime', 'uLucidity', 'uResolution']);

    // Deterministic seeds: the room should look the same on the Mac and the Pi,
    // and a scene that differs run to run cannot be tuned by eye.
    let s = 0x2545f491;
    const rand = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };

    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      data[i * 4 + 0] = rand();                    // x
      data[i * 4 + 1] = rand();                    // y phase
      data[i * 4 + 2] = 0.30 + rand() * 1.30;      // speed (3..16, scaled)
      data[i * 4 + 3] = 1.2 + rand() * rand() * 5.0; // size, biased small
    }

    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buf) gl.deleteBuffer(this.buf);
    this.vao = gl.createVertexArray();
    this.buf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.count = n;
  }

  draw(stage) {
    const gl = stage.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: they are light, not paint
    gl.useProgram(this.prog);
    gl.uniform1f(this.u.uTime, stage.time);
    gl.uniform1f(this.u.uLucidity, stage.lucidity);
    gl.uniform2f(this.u.uResolution, stage.canvas.width, stage.canvas.height);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}

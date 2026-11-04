// The post chain, ported from dream/render/dream_post.gdshader.
//
// Every term is scaled by murk = 1.0 - lucidity, so the picture literally
// sharpens as the room wakes: the grain settles, the colour returns, the edges
// stop lying, the tunnel opens out. That is dream's design and it is exactly
// what this piece needs — the week's arc, in the optics rather than in a caption.
//
// The one substantive change is the murk tint. dream desaturates toward a warm
// rose. Here it desaturates toward --mark, because the murk IS the remainder:
// what the room cannot resolve is the same red as what the operation discards.
//
// Tap count is a tier setting. The smear is the most expensive thing on screen
// and the first thing to give up on a Pi.

import { program, uniforms } from './gl.js';

const FS = (taps) => `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform float uTime;
uniform float uLucidity;

const float GRAIN      = 0.55;
const float ABERRATION = 0.007;
const float VIGNETTE   = 1.0;
const float WOBBLE     = 0.0035;
const float SMEAR      = 0.012;
const vec3  MURK_TINT  = vec3(0.780, 0.470, 0.440);   // desaturated --mark

void main() {
  float murk = 1.0 - uLucidity;
  vec2 uv = vUv;
  vec2 c = uv - 0.5;

  // The dream will not hold still.
  uv += vec2(sin(uv.y * 9.0 + uTime * 0.6), cos(uv.x * 8.0 + uTime * 0.5)) * WOBBLE * murk;

  // Radial chromatic aberration.
  vec2 off = c * ABERRATION * murk;
  vec3 col;
  col.r = texture(uScene, uv + off).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - off).b;

  // Radial smear toward centre — the soft focus of not-quite-seeing.
  vec3 blur = vec3(0.0);
  for (int i = 1; i <= ${taps}; i++) {
    blur += texture(uScene, uv - c * SMEAR * murk * (float(i) / float(${taps}))).rgb;
  }
  col = mix(col, blur / float(${taps}), murk * 0.45);

  // Desaturate toward the murk. Waking up puts the colour back.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * MURK_TINT * 1.5, murk * 0.35);

  float v = 1.0 - smoothstep(0.42, 1.10, length(c * vec2(1.0, 1.1)));
  col *= mix(1.0, v, VIGNETTE * (0.25 + 0.75 * murk));

  float n = fract(sin(dot(uv * vec2(1024.0, 768.0) + uTime * 37.0,
                          vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * GRAIN * murk * 0.16;

  fragColor = vec4(col, 1.0);
}`;

export class Post {
  build(stage) {
    const gl = stage.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = program(gl, FS(stage.tier.taps));
    this.u = uniforms(gl, this.prog, ['uScene', 'uTime', 'uLucidity']);
  }

  draw(stage) {
    const gl = stage.gl;
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stage.target.tex);
    gl.uniform1i(this.u.uScene, 0);
    gl.uniform1f(this.u.uTime, stage.time);
    gl.uniform1f(this.u.uLucidity, stage.lucidity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

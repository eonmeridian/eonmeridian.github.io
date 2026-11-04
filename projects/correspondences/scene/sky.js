// The sky, ported from dream/render/sky.gdshader.
//
// Godot canvas_item -> WebGL2: SCREEN_UV becomes vUv (flipped in y, because
// Godot's origin is top-left and GL's is bottom-left), TIME becomes uTime,
// SCREEN_PIXEL_SIZE.y/.x becomes uResolution.x/.y, COLOR becomes fragColor.
// The maths is otherwise unchanged, including the two decisions worth keeping:
//
//   * the sun is a bright region with a wide halo, not a disc, because a hot
//     pinpoint reads as a lens flare, and nobody is holding a camera inside a
//     dream;
//   * the shafts are sampled on (cos, sin) rather than on the angle, because
//     atan wraps at PI and the seam would run straight through the light.
//
// What IS changed is the palette. dream runs oxblood -> teal. Here the field
// stays near-black throughout and the haze and light travel from --mark (red,
// the operation and its remainder) toward --meridian (green, passage). The room
// begins in the colour of the remainder and wakes toward the colour of passage.
// Red never fully leaves: the horizon retains it even at full lucidity, because
// the difference is irreducible.

import { program, uniforms } from './gl.js';

const FS = (octaves) => `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform float uLucidity;
uniform vec2 uResolution;

const vec3 TOP_ASLEEP    = vec3(0.043, 0.027, 0.031);
const vec3 TOP_LUCID     = vec3(0.024, 0.043, 0.035);
const vec3 HORIZON_ASLEEP= vec3(0.350, 0.118, 0.110);
const vec3 HORIZON_LUCID = vec3(0.038, 0.140, 0.088);
const vec3 SUN_ASLEEP    = vec3(0.886, 0.337, 0.302);   // --mark
const vec3 SUN_LUCID     = vec3(0.204, 0.878, 0.541);   // --meridian

const vec2  SUN_UV       = vec2(0.74, 0.30);
const float RAY_STRENGTH = 0.40;
const float HAZE_STRENGTH= 0.20;
const float DRIFT_SPEED  = 0.015;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),                hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < ${octaves}; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);   // Godot's origin
  float aspect = uResolution.x / uResolution.y;
  float lucidity = uLucidity;

  vec3 top = mix(TOP_ASLEEP, TOP_LUCID, lucidity);
  vec3 hor = mix(HORIZON_ASLEEP, HORIZON_LUCID, lucidity);
  vec3 sun = mix(SUN_ASLEEP, SUN_LUCID, lucidity);

  // The bright band peaks at the horizon and falls away below it. Running the
  // gradient straight to the bottom leaves a flat slab of colour under it.
  float g = clamp(uv.y, 0.0, 1.0);
  vec3 deep = mix(top, hor, 0.3) * 0.5;
  vec3 col = mix(top, hor, smoothstep(0.04, 0.70, g));
  col = mix(col, deep, smoothstep(0.70, 1.0, g));

  // Slow drifting haze: depth without geometry.
  vec2 hp = vec2(uv.x * 3.0 + uTime * DRIFT_SPEED,
                 uv.y * 2.0 - uTime * DRIFT_SPEED * 0.4);
  float haze = fbm(hp);
  col = mix(col, hor, haze * HAZE_STRENGTH * (0.35 + 0.65 * smoothstep(0.0, 0.7, g)));

  vec2 d = (uv - SUN_UV) * vec2(aspect, 1.0);
  float dist = length(d);
  float core = exp(-dist * dist * 18.0) * mix(0.55, 0.42, lucidity);
  float halo = exp(-dist * 2.0) * mix(0.38, 0.16, lucidity);
  col += sun * (core + halo);

  float ang = atan(d.y, d.x);
  vec2 ring = vec2(cos(ang), sin(ang)) * 2.6 + vec2(uTime * 0.02, uTime * 0.014);
  float rays = smoothstep(0.40, 0.86, fbm(ring)) * exp(-dist * 1.25);
  col += sun * rays * RAY_STRENGTH * (0.30 + 0.70 * lucidity);

  fragColor = vec4(col, 1.0);
}`;

export class Sky {
  build(stage) {
    const gl = stage.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = program(gl, FS(stage.tier.octaves));
    this.u = uniforms(gl, this.prog, ['uTime', 'uLucidity', 'uResolution']);
  }

  draw(stage) {
    const gl = stage.gl;
    gl.useProgram(this.prog);
    gl.uniform1f(this.u.uTime, stage.time);
    gl.uniform1f(this.u.uLucidity, stage.lucidity);
    gl.uniform2f(this.u.uResolution, stage.canvas.width, stage.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

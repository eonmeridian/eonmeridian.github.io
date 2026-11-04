// Glyphs and names, as textured quads over the placed shapes.
//
// Drawn after `PiecePass` and reading the same `Surface`, so a glyph sits on its own shape
// and a name sits inside its own frame. Two things reach here and nothing else:
//
// - a **glyph**, where the character *is* the mark (♄, א, ☲);
// - a **name**, only inside an empty frame, where the source prints no figure and the
//   gloss is all there honestly is.
//
// A drawn figure is never captioned. See `text.js`.

import { program, uniforms } from './scene/gl.js';
import { figureOf, textOf } from './figures.js';

const VS = `#version 300 es
// x,y centre; z scale; w rotation
layout(location=0) in vec4 aPlace;
// u0,v0,u1,v1
layout(location=1) in vec4 aUv;
// x: 1.0 when this is a name in an empty frame rather than a glyph
layout(location=2) in float aGloss;

uniform vec2 uAspect;

out vec2 vUv;
out float vGloss;

void main() {
  vGloss = aGloss;

  // A unit quad from the vertex id: two triangles, six vertices.
  int id = gl_VertexID;
  vec2 corner = vec2((id == 1 || id == 2 || id == 4) ? 1.0 : -1.0,
                     (id == 2 || id == 4 || id == 5) ? 1.0 : -1.0);
  vUv = vec2(mix(aUv.x, aUv.z, corner.x * 0.5 + 0.5),
             mix(aUv.w, aUv.y, corner.y * 0.5 + 0.5));

  // **Text never turns.** The first version spun a glyph with its shape, on the theory
  // that the rotation shows the playhead reading it — and a rotating ♄ is simply
  // unreadable. A character is a thing to be read, which is the whole reason §Interface
  // allows one here at all; the flare on the shape already shows the beat.
  vec2 p = aPlace.xy + corner * aPlace.z;
  gl_Position = vec4(p * uAspect, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;

in vec2 vUv;
in float vGloss;
out vec4 fragColor;

uniform sampler2D uAtlas;

const vec3 INK    = vec3(0.957, 0.957, 0.949);
const vec3 CAVEAT = vec3(0.545, 0.545, 0.576);

void main() {
  float a = texture(uAtlas, vUv).a;
  if (a < 0.02) discard;
  // A name inside an empty frame is in the caveat colour, like the frame itself: it is
  // standing in for a figure that does not exist, and should not read as ink somebody
  // put on a page.
  vec3 tint = vGloss > 0.5 ? CAVEAT : INK;
  fragColor = vec4(tint, a * (vGloss > 0.5 ? 0.75 : 0.95));
}`;

export class TextPass {
  constructor(surface, atlas, letters) {
    this.surface = surface;
    this.atlas = atlas;
    this.letters = letters;
    this.count = 0;
  }

  build(stage) {
    const gl = stage.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = program(gl, FS, VS);
    this.u = uniforms(gl, this.prog, ['uAspect', 'uAtlas']);

    this.vao = gl.createVertexArray();
    this.placeBuf = gl.createBuffer();
    this.uvBuf = gl.createBuffer();
    this.glossBuf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    for (const [loc, buf, size] of [
      [0, this.placeBuf, 4],
      [1, this.uvBuf, 4],
      [2, this.glossBuf, 1],
    ]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
  }

  draw(stage) {
    const gl = stage.gl;
    const places = [];
    const uvs = [];
    const gloss = [];

    for (const piece of this.surface.pieces) {
      const figure = piece.figure;
      const glyph = this.atlas.glyphFor(figure, this.letters);

      if (glyph) {
        const rect = this.atlas.slot(glyph, { size: 0.62 });
        if (!rect) continue;
        places.push(piece.x, piece.y, 0.1, piece.phase * Math.PI * 2);
        uvs.push(rect.u0, rect.v0, rect.u1, rect.v1);
        gloss.push(0);
        continue;
      }

      // No figure at all: the name, inside the frame, upright.
      if (!figure) {
        const rect = this.atlas.slot(piece.node.label, { serif: true, size: 0.3 });
        if (!rect) continue;
        places.push(piece.x, piece.y, 0.085, 0);
        uvs.push(rect.u0, rect.v0, rect.u1, rect.v1);
        gloss.push(1);
      }
    }

    this.count = gloss.length;
    if (this.count === 0) return;

    this.atlas.upload();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.placeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(places), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glossBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gloss), gl.DYNAMIC_DRAW);

    const aspect = stage.canvas.width / Math.max(1, stage.canvas.height);
    gl.enable(gl.BLEND);
    // Straight alpha here, not additive: text read through the shape behind it is not
    // text, and a glyph is a mark rather than a light.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uAspect, aspect > 1 ? 1 / aspect : 1, aspect > 1 ? 1 : aspect);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas.texture);
    gl.uniform1i(this.u.uAtlas, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}

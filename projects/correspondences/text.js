// Typography: a glyph atlas on a canvas, uploaded once as a texture.
//
// Two things need drawn characters, and only two.
//
// **Glyphs.** ♄, א, ☲. §Interface sanctions this outright — *"glyphs are typography, not
// correspondence: ♄ beside Saturn is how the character is written rather than a claim
// anyone made"* — which is also why the planet table lives here in the client and not in
// `kernel-data`. The graph already carries `glyph` for trigrams and Hebrew letters.
//
// **Names inside empty frames.** Where a source prints no figure, the name is all there
// honestly is. §Interface makes the diagram primary and the name a gloss, so the gloss is
// what remains when there is no diagram — and sixty-eight goetic spirits stop being
// sixty-eight identical boxes without a seal being invented for any of them.
//
// **A figure is never labelled.** A hexagram draws its lines and gets no caption. Setting a
// name beside a diagram is the type-first mistake §Interface was written to correct: the
// name is the part `sources.toml` records doubts about, and the lines are the part that is
// cited.

/// The planetary and zodiacal characters, keyed by address id.
///
/// Every one is suffixed **U+FE0E**, the variation selector that forces text presentation.
/// Without it these render as colour emoji tiles on Apple platforms — a trap divinatory-os's
/// §Interface already records, and one that turns a careful monochrome atlas into a row of
/// cartoon planets.
const VS15 = '︎';

const PLANET = {
  saturn: '♄', jupiter: '♃', mars: '♂', sun: '☉', venus: '♀',
  mercury: '☿', moon: '☽', 'north-node': '☊', 'south-node': '☋',
};

/// Trumps carry `letter = "aleph"`; the letters themselves carry the glyph. Resolved at
/// build time from the corpus so nothing here duplicates what the graph already holds.
export function letterGlyphs(corpus) {
  const out = new Map();
  try {
    for (const node of JSON.parse(corpus.symbols_of('qbl', 'letter'))) {
      const id = node.address.split('/').slice(1).join('/');
      if (node.attributes?.glyph) out.set(id, node.attributes.glyph);
    }
  } catch {
    // A corpus without Hebrew letters is a smaller corpus, not a broken one.
  }
  return out;
}

/// A texture holding every string this page needs, packed into a grid.
export class TextAtlas {
  constructor(gl, { cell = 128, cols = 16 } = {}) {
    this.gl = gl;
    this.cell = cell;
    this.cols = cols;
    this.slots = new Map();
    this.canvas = document.createElement('canvas');
    this.canvas.width = cell * cols;
    this.canvas.height = cell * cols;
    this.ctx = this.canvas.getContext('2d');
    this.texture = gl.createTexture();
    this.dirty = true;
    this.full = false;
  }

  /// Where `text` sits in the atlas, drawing it first if it is new.
  ///
  /// Returns `{u0, v0, u1, v1}` or `null` when the atlas is full — `null` rather than a
  /// wrong rectangle, so a missing glyph is missing rather than showing somebody else's.
  slot(text, { serif = false, size = 0.5 } = {}) {
    const key = `${serif ? 's' : 'm'}:${text}`;
    if (this.slots.has(key)) return this.slots.get(key);
    const n = this.slots.size;
    if (n >= this.cols * this.cols) {
      this.full = true;
      return null;
    }

    const cx = (n % this.cols) * this.cell;
    const cy = Math.floor(n / this.cols) * this.cell;
    const ctx = this.ctx;
    ctx.clearRect(cx, cy, this.cell, this.cell);
    ctx.fillStyle = '#ffffff'; // tinted in the shader, so one atlas serves every colour
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // A name may be long; a glyph never is. Shrink to fit rather than clip, because a
    // truncated name is a different name.
    let px = Math.floor(this.cell * size);
    const family = serif
      ? '"Iowan Old Style", Palatino, Georgia, serif'
      : 'ui-monospace, Menlo, monospace';
    do {
      ctx.font = `${px}px ${family}`;
      if (ctx.measureText(text).width <= this.cell * 0.88 || px <= 8) break;
      px -= 2;
    } while (px > 8);

    ctx.fillText(text, cx + this.cell / 2, cy + this.cell / 2);

    const u = 1 / this.cols;
    const rect = {
      u0: (n % this.cols) * u,
      v0: Math.floor(n / this.cols) * u,
      u1: (n % this.cols) * u + u,
      v1: Math.floor(n / this.cols) * u + u,
    };
    this.slots.set(key, rect);
    this.dirty = true;
    return rect;
  }

  /// The glyph for a figure, if it has one.
  glyphFor(figure, letters) {
    if (!figure) return null;
    if (figure.shape === 'glyph') {
      if (figure.glyph) return figure.glyph;
      if (figure.planet) {
        const ch = PLANET[figure.planet];
        return ch ? ch + VS15 : null;
      }
    }
    if (figure.shape === 'card' && figure.letter) {
      return letters.get(figure.letter) ?? null;
    }
    return null;
  }

  upload() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (this.dirty) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.dirty = false;
    }
  }
}

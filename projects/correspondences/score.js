// The arrangement, seen: one stave per placed shape.
//
// The surface shows you one piece at a time — whichever is selected — and the atlas shows
// the graph. Neither shows **the piece you are making**. This does.
//
// `diagrammatic-immanence`'s `score` regime is the same idea and states it best: *"the same
// object, rotated: x is cycle, one stave per lane. This is the regime that makes the thesis
// visible — the plate's horizontal axis and the patch's time axis are the same integers, so
// you can read the patch off the picture."*
//
// # Not a piano roll
//
// `sounds-like`'s `ScoreRoll` puts pitch on the vertical axis, which is right for a piece
// in twelve-tone equal temperament and wrong here. **A piano roll's vertical axis is a
// keyboard**, and a keyboard is the one grid this tuning does not sit on: Agrippa's fifth is
// 702 cents and would land between two rows, so drawing it on either would be a lie of
// exactly the kind the cents refactor existed to prevent.
//
// So: one stave per piece, time across, and the pitch **written as its ratio**. A ratio is
// what the graph holds; a key number is what it refuses to hold.
//
// Drawn on a 2D canvas rather than in WebGL. It is a table of rules and text, and the glyph
// atlas exists for marks on shapes, not for setting type.

import { DIAGNOSTIC } from './diagnostic.js';

const FIELD = '#07070b';
const INK = '#f4f4f2';
const MERIDIAN = '#34e08a';
const MARK = '#e2564d';
const DIM = '#8b8b93';

const ROW = 38;
const GUTTER = 190;

export class ScoreView {
  /**
   * @param {HTMLCanvasElement} canvas  the staves
   * @param {Surface} surface
   * @param {Tuning} tuning
   * @param {HTMLElement} [pane]  what is actually shown and hidden; the canvas alone if
   *   nothing is passed, so the score still works without a rack around it
   * @param {() => void} [onPick]  a stave was tapped and the selection changed
   */
  constructor(canvas, surface, tuning, pane = null, onPick = null) {
    this.canvas = canvas;
    this.surface = surface;
    this.tuning = tuning;
    this.pane = pane ?? canvas;
    this.onPick = onPick;
    this.ctx = canvas.getContext('2d');
    this.visible = false;

    // A stave is a row, and tapping it selects that shape — the score stops being a
    // picture of the arrangement and becomes a way into it. The inverse of the same
    // arithmetic `draw` uses to place the row, kept next to it so the two cannot drift.
    canvas.addEventListener('pointerdown', (ev) => {
      const r = canvas.getBoundingClientRect();
      const i = Math.floor((ev.clientY - r.top - 34 + ROW / 2) / ROW);
      const piece = this.surface.pieces[i];
      if (!piece) return;
      this.surface.selected = piece;
      if (this.onPick) this.onPick(piece);
    });
  }

  toggle() {
    this.visible = !this.visible;
    this.pane.hidden = !this.visible;
    return this.visible;
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  }

  draw() {
    if (!this.visible) return;
    const { w, h } = this.resize();
    const ctx = this.ctx;

    ctx.fillStyle = FIELD;
    ctx.fillRect(0, 0, w, h);

    const pieces = this.surface.pieces;
    if (pieces.length === 0) {
      ctx.fillStyle = DIM;
      ctx.font = 'italic 15px "Iowan Old Style", Palatino, Georgia, serif';
      ctx.fillText('Nothing placed. Click a symbol in the atlas.', 24, 44);
      return;
    }

    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';

    pieces.forEach((piece, i) => {
      const y = 34 + i * ROW;
      if (y > h - 16) return; // more shapes than staves; the surface still holds them
      const pitch = this.tuning.pitch(piece.node);
      const selected = this.surface.selected === piece;

      // Provenance is the row's colour. Cited is the meridian, authored the mark, and
      // unpitched the dim — the same three the tally counts, so the score and the tally
      // cannot disagree about what a piece is.
      const tint = !pitch ? DIM : pitch.provenance === 'cited' ? MERIDIAN : MARK;

      ctx.fillStyle = selected ? INK : DIM;
      ctx.fillText(piece.node.label.slice(0, 18), 16, y);
      ctx.fillStyle = tint;
      const written = pitch ? `${pitch.ratio}` : 'unpitched';
      ctx.fillText(written, 130, y);

      // The stave.
      ctx.strokeStyle = 'rgba(244,244,242,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(GUTTER, y + 0.5);
      ctx.lineTo(w - 24, y + 0.5);
      ctx.stroke();

      const span = w - 24 - GUTTER;

      if (piece.drones) {
        // Held, not articulated: a continuous line rather than marks, because there is no
        // rhythm to draw. A page that gives a proportion and no figure gives no beats.
        ctx.strokeStyle = tint;
        ctx.globalAlpha = pitch ? 0.55 : 0.2;
        ctx.lineWidth = pitch ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(GUTTER, y + 0.5);
        ctx.lineTo(w - 24, y + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = DIM;
        ctx.font = 'italic 11px "Iowan Old Style", Palatino, Georgia, serif';
        const why = pitch
          ? `held — ${piece.node.source_title} prints no figure`
          : `silent — ${piece.node.source_title} prints no figure, and nothing proportions it`;
        ctx.fillText(why, GUTTER + 8, y - 13);
        ctx.font = '11px ui-monospace, Menlo, monospace';
        return;
      }

      // One mark per step, at the fraction of a turn where it actually sounds — so a
      // broken line's two marks sit inside one row's slot rather than as two slots, which
      // is how it is heard and how it is drawn on the shape.
      const n = piece.steps.length;
      const phase = piece.phase;
      piece.steps.forEach((step, s) => {
        const at = (s + (step.offset ?? 0) * 0.5) / n;
        const x = GUTTER + at * span;
        const lit = Math.abs(at - phase) < 0.5 / n;
        ctx.fillStyle = tint;
        ctx.globalAlpha = lit ? 1 : 0.55;
        const tall = step.kind === 'solid' || step.kind === 'single' ? 9 : 5;
        ctx.fillRect(x, y - tall / 2, 2, tall);
        ctx.globalAlpha = 1;
      });

      // The playhead for this piece, where its own turn has got to.
      ctx.strokeStyle = 'rgba(244,244,242,0.35)';
      ctx.beginPath();
      ctx.moveTo(GUTTER + phase * span, y - 12);
      ctx.lineTo(GUTTER + phase * span, y + 12);
      ctx.stroke();

      ctx.fillStyle = DIM;
      ctx.fillText(`${n}·${piece.rate.toFixed(2)}×`, w - 90, y - 13);
    });

    // Every stave has its own playhead because every shape turns at its own rate; there is
    // no shared bar line, and drawing one would imply a common metre the pieces do not have.
    // The caption says so for a reader who has not been told; see `diagnostic.js`.
    if (DIAGNOSTIC) {
      ctx.fillStyle = DIM;
      ctx.font = 'italic 11px "Iowan Old Style", Palatino, Georgia, serif';
      ctx.fillText(
        'one stave per shape · each turns at its own rate, so there is no shared bar line',
        16,
        h - 14
      );
    }
  }
}

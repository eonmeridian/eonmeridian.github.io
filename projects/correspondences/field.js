// The ground the atlas is drawn on.
//
// This exists because of a bug worth recording. machinic-hymns puts `Sky` first in its
// pass list, and a sky is a fullscreen fragment pass — so it writes every pixel of the
// offscreen target every frame and, entirely as a side effect, clears it. `Stage._render`
// never calls `gl.clear` at all.
//
// Drop the sky and nothing clears. Every frame then composites on top of the last, and
// because the motes and the graph both blend additively, the picture becomes long
// comet-trails of everything that has moved — which looks, briefly and confusingly, like
// a post-processing problem rather than a missing clear.
//
// So the clear is explicit here instead of implicit somewhere else. `--field` is in the
// palette as *"structure, law, the given"*, which is the right thing for an atlas to sit
// on, and making it a pass rather than editing the vendored `Stage` keeps that file
// identical to its source.

export class Field {
  constructor(colour = [0.027, 0.027, 0.043]) {
    this.colour = colour;
  }

  draw(stage) {
    const gl = stage.gl;
    gl.clearColor(this.colour[0], this.colour[1], this.colour[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

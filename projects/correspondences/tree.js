// Where the ten sephiroth stand on the Tree.
//
// The graph holds the Tree's topology -- which path connects which two sephiroth, cited
// to Liber 777 -- but not its geometry, and geometry is a claim too: put Tiphareth on a
// side pillar and every path through it is drawn slanting where the book draws it straight.
// So the positions are the ones Liber 777 prints: Col. XII, "The Tree of Life", p. xxvii,
// read by eye off the page in the Weiser 1973 reprint of the 1909 tables. Kether, Tiphareth,
// Yesod and Malkuth down the middle; Chokmah, Chesed and Netzach on the right; Binah,
// Geburah and Hod on the left, as the diagram sets them facing the reader.
//
// Measured, not idealised: the heights are the page's own spacing (Tiphareth a little
// nearer Chesed than Netzach, Malkuth further below Yesod than Yesod below Tiphareth),
// scaled so Kether is 0 and Malkuth 1. The side pillars are drawn at equal width.

export const TREE_LOCUS = 'Liber 777, Col. XII, "The Tree of Life", p. xxvii';

/// `n -> [x, y]`: x in -0.24..0.24 (right is positive, as the page faces you), y in 0..1
/// from Kether down.
export const TREE = {
  1: [0, 0],
  2: [0.24, 0.145],
  3: [-0.24, 0.145],
  4: [0.24, 0.395],
  5: [-0.24, 0.395],
  6: [0, 0.513],
  7: [0.24, 0.632],
  8: [-0.24, 0.632],
  9: [0, 0.776],
  10: [0, 1],
};

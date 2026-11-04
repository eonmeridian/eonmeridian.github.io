// A knob you can turn with a finger, a mouse, or the arrow keys.
//
// Lifted in structure from `sounds-like`'s `Knob.tsx`, which gets three things right that
// are easy to get wrong, and rewritten without React because nothing here has React.
//
// # 1. It is a real `<input type="range">`
//
// Visually hidden, never `display: none` — so it stays in the tab order, arrow keys work,
// and a screen reader announces a slider with a value. The dial you see is a `<div>` that
// draws what the input holds. Building the whole thing out of pointer maths on a `<canvas>`
// is the obvious approach and it silently costs you every one of those.
//
// # 2. The dial is turned by a CSS custom property
//
// `--ang`, read by a `rotate()` in the stylesheet. `sounds-like` explains why: writing one
// custom property is cheap, while recomputing a `transform` string on every `pointermove`
// is *"what makes a rack of knobs feel sticky"*. On a Pi that difference is the difference
// between a control and a complaint.
//
// # 3. Vertical drag, not rotational
//
// Dragging in a circle around a 44px target is a thing no one can do accurately and no one
// expects to. Up is more. `TRAVEL` is the pixels for the full range; holding Shift divides
// it, and the anchor is re-taken when Shift changes so the value does not jump mid-gesture.
//
// # What is different here
//
// `touch-action: none` on the hit area, and a hit area sized for a fingertip rather than a
// cursor — this instrument's other surface is an 800x480 panel with no keyboard, and a
// knob that needs a mouse would be a knob that does not exist there.

const TRAVEL = 200;   // px for the full range
const FINE = 5;       // Shift divides the travel by this

/// @param {object} spec
///   id, label, min, max, value, reset, step, format(v) -> string, onInput(v)
export function knob(spec) {
  const {
    label, min = 0, max = 1, value = 0, reset = value,
    step = 0.001, format = (v) => v.toFixed(2), onInput = () => {},
  } = spec;

  const root = document.createElement('div');
  root.className = 'knob';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'sr-only';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', label);

  const hit = document.createElement('div');
  hit.className = 'dial-hit';
  const dial = document.createElement('div');
  dial.className = 'dial';
  const tick = document.createElement('i');
  dial.appendChild(tick);
  hit.appendChild(dial);

  const name = document.createElement('span');
  name.className = 'kname';
  name.textContent = label;
  const read = document.createElement('span');
  read.className = 'kval';

  root.append(input, hit, name, read);

  const paint = () => {
    const v = Number(input.value);
    const t = (v - min) / (max - min || 1);
    // 270 degrees of travel, centred on up: the dead zone at the bottom is what makes
    // the pointer's position readable at a glance rather than ambiguous near the ends.
    dial.style.setProperty('--ang', `${-135 + t * 270}deg`);
    read.textContent = format(v);
  };

  const set = (v, notify = true) => {
    input.value = String(Math.max(min, Math.min(max, v)));
    paint();
    if (notify) onInput(Number(input.value));
  };

  // Arrow keys and assistive technology come through the input itself.
  input.addEventListener('input', () => { paint(); onInput(Number(input.value)); });

  let drag = null;
  hit.addEventListener('pointerdown', (ev) => {
    hit.setPointerCapture(ev.pointerId);
    drag = { y: ev.clientY, from: Number(input.value), shift: ev.shiftKey };
    ev.preventDefault();
  });
  hit.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    // Re-anchor when Shift is toggled mid-drag, or the value leaps by the ratio between
    // the two travels at the moment the key goes down.
    if (ev.shiftKey !== drag.shift) {
      drag = { y: ev.clientY, from: Number(input.value), shift: ev.shiftKey };
    }
    const travel = TRAVEL * (ev.shiftKey ? FINE : 1);
    set(drag.from + ((drag.y - ev.clientY) / travel) * (max - min));
  });
  // Every way a drag can end. `lostpointercapture` is the one that is easy to omit and
  // the one that leaves a knob stuck following the cursor after the mouse leaves.
  for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    hit.addEventListener(kind, () => { drag = null; });
  }
  hit.addEventListener('dblclick', () => set(reset));

  paint();
  return { el: root, set, get: () => Number(input.value) };
}

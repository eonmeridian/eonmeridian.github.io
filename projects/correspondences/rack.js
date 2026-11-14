// The rack: what you can change from inside the score.
//
// The score was a picture of an arrangement you could not touch — you read it, then went
// back to the atlas to change anything. `sounds-like` puts the hand where the eye already
// is, and that is the whole idea here: the staves show what each shape is doing, and the
// controls for the shape you are looking at sit directly under them.
//
// # Two racks, because there are two kinds of decision
//
// **Per shape** — voice, rate, level, mute. These are the arrangement: what this shape is
// played on, how fast it turns, how loud it sits against the others.
//
// **The mix** — room, echo, warmth. One set for the instrument, not one per shape. A
// reverb per voice is the most expensive mistake available in Web Audio (`audio.js` says
// so where the convolver is built), and more to the point a room is a property of the
// room.
//
// # Everything here is authored, and says so
//
// Not one control on this panel reads a label, a provenance or a citation. That is the
// line `audio.js` draws and it is drawn in the same place here: the graph decides what a
// correspondence *is*, the composer decides what it is played on and how loud. The rack
// is labelled `authored` in the corner so nobody has to take my word for it.
//
// # Two controls that do touch pitch, and are labelled where it is heard
//
// **tonic** moves every pitch together; it was always mine and always said so. **pitch**
// sets one symbol's pitch by hand, to the cent -- a microtone is just a value between
// keys. A hand-set pitch reports `authored:hand` everywhere a pitch is shown or counted,
// so turning this knob on the Diapente cannot make your fifth read as Agrippa's.
// **graph** gives the symbol back to the layers in `tuning.js`.

import { knob } from './knob.js';
import { noteName } from './tuning.js';
import { CHAINS } from './string.js';
import { VOICES } from './voices.js';

export class Rack {
  /**
   * @param {HTMLElement} host      where the rack is built
   * @param {Surface} surface       for the current selection
   * @param {Instrument} instrument for the mix
   * @param {(piece: Piece, what: string) => void} act  the shared verbs
   */
  constructor(host, surface, instrument, act, onTuning = () => {}) {
    this.host = host;
    this.tuning = instrument.tuning;
    /// Told whenever a pitch changes, so panels that show pitch can redraw.
    this.onTuning = onTuning;
    this.surface = surface;
    this.instrument = instrument;
    this.act = act;
    this.shown = null;      // the piece the per-shape row is currently describing
    this._build();
  }

  _build() {
    const h = this.host;
    h.innerHTML = '';

    // ── the shape ──────────────────────────────────────────────────────────
    this.forPiece = document.createElement('div');
    this.forPiece.className = 'rackrow';

    this.who = document.createElement('div');
    this.who.className = 'rackwho';

    this.voices = document.createElement('div');
    this.voices.className = 'chips';
    for (const v of VOICES) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.voice = v.id;
      b.textContent = v.label;
      b.title = v.note;
      b.onclick = () => {
        const p = this.surface.selected;
        if (!p) return;
        p.voice = v.id;
        // A held shape is already sounding, so its drone has to be rebuilt to be heard
        // on the new voice. Without this the change is inaudible until you mute and
        // unmute, which reads as the control not working.
        this.instrument.droneOff(p.id);
        this.sync();
      };
      this.voices.appendChild(b);
    }

    this.rate = document.createElement('div');
    this.rate.className = 'stepper';
    const mk = (txt, what, title) => {
      const b = document.createElement('button');
      b.className = 'chip wide';
      b.textContent = txt;
      b.title = title;
      b.onclick = () => { this.act(this.surface.selected, what); this.sync(); };
      return b;
    };
    this.rateOut = document.createElement('span');
    this.rateOut.className = 'rateout';
    this.rate.append(
      mk('−', 'slower', 'slower'), this.rateOut, mk('+', 'faster', 'faster'));

    this.level = knob({
      label: 'level', min: 0, max: 1, value: 1, reset: 1,
      format: (v) => v.toFixed(2),
      onInput: (v) => { const p = this.surface.selected; if (p) p.gain = v; },
    });

    // Cents above the open string, so a hand-set pitch rides the open-string knob with
    // everything else. The string's three octaves, and no further (string.js).
    this.pitch = knob({
      label: 'pitch', min: 0, max: 3599, value: 0, reset: 0, step: 1,
      format: (v) => noteName(this.tuning.tonicCents + v),
      onInput: (v) => {
        const p = this.surface.selected;
        if (!p) return;
        this.tuning.hand.set(p.address, v);
        this.sync();
        this.onTuning();
      },
    });
    this.graphBtn = document.createElement('button');
    this.graphBtn.className = 'chip wide';
    this.graphBtn.textContent = 'graph';
    this.graphBtn.title = 'give this symbol its pitch back from the graph';
    this.graphBtn.onclick = () => {
      const p = this.surface.selected;
      if (!p) return;
      this.tuning.hand.delete(p.address);
      this.shown = null; // re-read the knob from the layers
      this.sync();
      this.onTuning();
    };

    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'chip wide';
    this.muteBtn.onclick = () => { this.act(this.surface.selected, 'mute'); this.sync(); };

    this.dropBtn = document.createElement('button');
    this.dropBtn.className = 'chip wide';
    this.dropBtn.textContent = 'remove';
    this.dropBtn.onclick = () => { this.act(this.surface.selected, 'drop'); this.sync(); };

    this.forPiece.append(
      this.who, this.voices, this.rate, this.level.el, this.pitch.el, this.graphBtn,
      this.muteBtn, this.dropBtn);

    // ── the mix ────────────────────────────────────────────────────────────
    const mix = document.createElement('div');
    mix.className = 'rackrow mix';
    const tag = document.createElement('div');
    tag.className = 'rackwho';
    tag.innerHTML = '<b>the mix</b><span>authored</span>';

    // The open string, F2 to C#3, continuous: it can sit between keys like anything else.
    // Every pitch is a stop on this string (string.js), so this moves all of them.
    this.tonic = knob({
      label: 'open', min: 2900, max: 3700, value: this.tuning.tonicCents,
      reset: this.tuning.tonicCents, step: 1,
      format: (v) => noteName(v),
      onInput: (v) => {
        this.tuning.tonicCents = v;
        this.instrument.retune?.();
        this.pitch.set(this.pitch.get(), false); // repaint: its readout is tonic-relative
        this.onTuning();
      },
    });

    // Defaults match what `Instrument.start` built, so opening the rack changes nothing.
    this.room = knob({
      label: 'room', min: 0, max: 0.8, value: 0.20, reset: 0.20,
      onInput: () => this._fx(),
    });
    this.echo = knob({
      label: 'echo', min: 0, max: 0.7, value: 0, reset: 0,
      onInput: () => this._fx(),
    });
    this.warmth = knob({
      label: 'warmth', min: 0, max: 1, value: 1, reset: 1,
      // Shown as the cutoff it actually is, because "0.62" tells a composer nothing.
      format: (v) => `${Math.round(200 * Math.pow(100, v))}Hz`,
      onInput: () => this._fx(),
    });
    // How many fifths the chain runs before it repeats. Past 12 the neighbours sit a
    // Pythagorean comma apart: these are the microtones (string.js).
    this.chain = document.createElement('div');
    this.chain.className = 'chips';
    this.chain.setAttribute('role', 'group');
    this.chain.setAttribute('aria-label', 'fifths in the chain');
    for (const n of CHAINS) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${n} fifths`;
      b.dataset.chain = n;
      b.setAttribute('aria-pressed', String(n === this.tuning.chain));
      b.onclick = () => {
        this.tuning.chain = n;
        for (const c of this.chain.children) c.setAttribute('aria-pressed', String(c === b));
        this.shown = null;
        this.sync();
        this.onTuning();
      };
      this.chain.append(b);
    }
    // The other strings: resonators at the first stops of the open string, which ring only
    // when the mix sounds near them. Off at 0.
    this.sympathy = knob({
      label: 'strings', min: 0, max: 1, value: 0.3, reset: 0.3,
      onInput: () => this._fx(),
    });
    mix.append(tag, this.tonic.el, this.chain, this.room.el, this.echo.el, this.warmth.el, this.sympathy.el);

    h.append(this.forPiece, mix);
    this.sync();
  }

  _fx() {
    this.instrument.setFx({
      room: this.room.get(), echo: this.echo.get(), warmth: this.warmth.get(),
      sympathy: this.sympathy.get(),
    });
  }

  /// Read the selection and show it. Called on every draw, so it must stay cheap and must
  /// not fight the user: the level knob is only written when the *selection* changes, or
  /// it would snap back to the piece's value under a finger that is mid-drag.
  sync() {
    const p = this.surface.selected;
    this.forPiece.classList.toggle('empty', !p);

    if (!p) {
      this.who.innerHTML = '<b>no shape selected</b><span>tap a stave, or the atlas</span>';
      for (const b of this.voices.querySelectorAll('.chip')) b.setAttribute('aria-pressed', 'false');
      this.rateOut.textContent = '—';
      this.muteBtn.textContent = 'mute';
      for (const b of [this.muteBtn, this.dropBtn, this.graphBtn]) b.disabled = true;
      this.shown = null;
      return;
    }

    for (const b of [this.muteBtn, this.dropBtn]) b.disabled = false;
    this.who.innerHTML =
      `<b>${p.node.label}</b><span>${p.drones ? 'held'
        : `${p.steps.length} step${p.steps.length === 1 ? '' : 's'}`}</span>`;
    for (const b of this.voices.querySelectorAll('.chip')) {
      b.setAttribute('aria-pressed', String(b.dataset.voice === p.voice));
    }
    this.rateOut.textContent = `${p.rate.toFixed(2)}×`;
    this.muteBtn.textContent = p.muted ? 'unmute' : 'mute';

    const byHand = this.tuning.hand.has(p.address);
    this.graphBtn.disabled = !byHand;
    this.graphBtn.setAttribute('aria-pressed', String(!byHand));

    if (this.shown !== p) {
      this.level.set(p.gain, false);
      // Show where the symbol sounds now, so the first turn starts from its pitch and not
      // from the tonic. An unpitched symbol starts at the tonic: turning the knob is how it
      // is given one.
      const now = this.tuning.pitch(p.node);
      this.pitch.set(now ? now.cents - this.tuning.tonicCents : 0, false);
      this.shown = p;
    }
  }
}

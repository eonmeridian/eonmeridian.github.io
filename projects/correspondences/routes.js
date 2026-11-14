// The way from here to a system, played.
//
// The kernel's `score(origins, target, hops)` lays a traversal out "in the order it would
// be played" (`divinatory_score::Score`): one voice per route, one step per cited hop, and
// a silent voice wherever nothing was reached or a source withheld an answer. This file is
// the last mile, and it keeps the score's three refusals:
//
// 1. **No aggregate label.** Each hop sounds in its own label's timbre. A voice has none.
// 2. **No collapsing of equal routes.** Two routes to one arrival are two voices, played
//    one after the other in the kernel's order. Nothing here sorts.
// 3. **No silent drop of a silence.** A withheld answer is the damped withheld rest. A
//    search that ran out of hops takes its beat and makes no sound, because the budget is
//    my parameter and not anyone's finding. Either way the card names which it was.
//
// This replaced `Instrument.playVoice`, which pitched each hop from a stub with no
// attributes (so a symbol whose pitch comes from its `ordinal` sounded unpitched), could
// not be stopped, and was never called.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const words = (id) => String(id).replace(/_/g, ' ');

/// The hop budgets offered. The kernel's own default is 3; past 4 a route is mostly the
/// search, not the tradition.
export const HOPS = [1, 2, 3, 4];

/// A score laid out in time, as events an instrument can play. Pure.
///
/// `pitchOf(address)` is the page's tuning, or null for a symbol no layer pitches. Each
/// sounded hop is its arrival: where you stand is already sounding, so a route begins
/// with its first step. Voices follow one another with a breath between them, so two
/// routes to one place are heard as two.
export function scheduleOf(score, pitchOf, { step = 0.34, breath = 0.5 } = {}) {
  const events = [];
  let t = 0;
  score.voices.forEach((voice, v) => {
    if (voice.voice === 'sounded') {
      voice.steps.forEach((s, i) => {
        const pitch = pitchOf(s.to);
        events.push(pitch
          ? { at: t, voice: v, step: i, kind: 'tone', hz: pitch.hz, label: s.confidence }
          : { at: t, voice: v, step: i, kind: 'struck' });
        t += step;
      });
    } else {
      // `SilenceReason` is serde-tagged: the reason is `silence.reason.reason`.
      const reason = voice.silence?.reason?.reason ?? 'unknown';
      events.push({ at: t, voice: v, step: null, kind: 'rest', reason });
      t += step;
    }
    t += step * breath;
  });
  return { events, length: t };
}

/// Plays a schedule against an `Instrument`, a little ahead of time, so it can be stopped
/// part-way: nothing is handed to Web Audio more than `ahead` seconds before it sounds.
export class RoutePlayer {
  constructor(instrument, { onStep = () => {}, onEnd = () => {}, ahead = 0.2 } = {}) {
    this.instrument = instrument;
    this.onStep = onStep;
    this.onEnd = onEnd;
    this.ahead = ahead;
    this.timer = null;
    this.cues = [];
  }

  get playing() {
    return this.timer !== null;
  }

  play(schedule) {
    this.stop();
    const inst = this.instrument;
    const start = inst.now + 0.08;
    let next = 0;
    const tick = () => {
      const horizon = inst.now + this.ahead;
      while (next < schedule.events.length && start + schedule.events[next].at <= horizon) {
        const e = schedule.events[next++];
        const at = start + e.at;
        if (e.kind === 'tone') inst.tone(e.hz, e.label, at);
        else if (e.kind === 'struck') inst.struck(at);
        else inst.rest(e.reason, at);
        // The card lights the hop when it sounds, not when it is scheduled.
        this.cues.push(setTimeout(() => this.onStep(e), Math.max(0, (at - inst.now) * 1000)));
      }
      if (next >= schedule.events.length && inst.now >= start + schedule.length) {
        this.stop();
        this.onEnd();
      }
    };
    this.timer = setInterval(tick, 25);
    tick();
  }

  /// Stop scheduling. What is already handed to Web Audio (at most `ahead` seconds)
  /// rings out; `M` catches that too, as a ramp on the master gain.
  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const c of this.cues) clearTimeout(c);
    this.cues = [];
  }
}

/// Why a voice reached nothing, in words. A budget is said to be a budget.
function silenceHtml(voice, score, ctx) {
  const reason = voice.silence?.reason?.reason ?? 'unknown';
  const recorded = voice.silence?.recorded ?? [];
  const lead = {
    withheld: 'withheld',
    isolated: 'nothing: this symbol has no correspondences',
    budget: `nothing within ${score.hops} hop${score.hops === 1 ? '' : 's'}: my search budget, not a finding`,
    'target-empty': 'nothing: that system holds no symbols',
  }[reason] ?? esc(reason);
  let html = `<div class="rest">${lead}</div>`;
  for (const r of recorded) {
    html += `<div class="withheld-by">${esc(words(r.relation))} no ${esc(r.expected_kind)} · ` +
      `<i>${esc(ctx.short(r.cited_to))}</i>${r.locus ? `, <span class="locus">${esc(r.locus)}</span>` : ''}` +
      `<div class="why">${esc(r.reason)}</div></div>`;
  }
  return html;
}

/// The card for a score: every voice, every hop with its label and its book, in kernel
/// order. `ctx` supplies `short(sourceId)` and `system(id)`.
///
/// Each hop carries `data-v`/`data-s`, and each silent voice `data-v`, so the page can
/// light what is sounding. An arrival is a button (`data-to`) that walks there.
export function routeCard(score, origin, ctx, { playing = false } = {}) {
  const sounded = score.voices.filter((v) => v.voice === 'sounded').length;
  let html = `<div class="pair"><b>${esc(origin.label)}</b> to <b>${esc(ctx.system(score.target))}</b></div>` +
    `<div class="routebar">` +
    `<button class="rplay" data-act="${playing ? 'stop' : 'play'}">${playing ? 'stop' : 'play'}</button>` +
    `<span class="hops">within ` +
    HOPS.map((h) => `<button class="rhop" data-hops="${h}" aria-pressed="${h === score.hops}">${h}</button>`).join('') +
    ` hop${score.hops === 1 ? '' : 's'}</span></div>` +
    `<div class="label">${sounded} route${sounded === 1 ? '' : 's'}` +
    `${score.voices.length > sounded ? `, ${score.voices.length - sounded} silence${score.voices.length - sounded === 1 ? '' : 's'}` : ''}` +
    ` · in the kernel's order, not ranked</div>`;
  if (score.truncated) {
    html += `<div class="label">the kernel stopped short somewhere: this is not every route</div>`;
  }

  score.voices.forEach((voice, v) => {
    html += `<div class="route" data-v="${v}">`;
    if (voice.voice !== 'sounded') {
      html += silenceHtml(voice, score, ctx);
    } else {
      voice.steps.forEach((s, i) => {
        const last = i === voice.steps.length - 1;
        const to = last ? voice.arrival_label : ctx.label(s.to);
        html += `<div class="hop" data-v="${v}" data-s="${i}">` +
          `<span class="rel${s.confidence === 'contested' ? ' contested' : ''}">${esc(words(s.relation))}</span> ` +
          (last
            ? `<button class="arrive" data-to="${esc(s.to)}">${esc(to)}</button>`
            : `<b>${esc(to)}</b>`) +
          ` <span class="by"><i>${esc(ctx.short(s.cited_to))}</i> · ${esc(s.confidence)}</span></div>`;
      });
      if (voice.more_routes) {
        html += `<div class="label">and ${voice.more_routes} more equally short route` +
          `${voice.more_routes === 1 ? '' : 's'} here, capped by the kernel</div>`;
      }
    }
    html += `</div>`;
  });
  return html;
}

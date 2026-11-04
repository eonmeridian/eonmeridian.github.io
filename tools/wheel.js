<script>
// The narrow dial turns. A drag (or a scroll over it) rotates the ring; the work nearest the
// reading line on top fills the middle, and the ring settles on it. A tap on a title opens its
// page; a tap on a theme's name turns to it. With reduced motion the ring follows the finger only: no glide, no settle.
(function () {
  var wheel = document.getElementById("wheel");
  if (!wheel) return;
  var turn = wheel.querySelector(".turn"), spin = wheel.querySelector(".spin"),
      items = [].slice.call(spin.querySelectorAll(".wt text")),
      themes = [].slice.call(spin.querySelectorAll(".tg")),
      rt = wheel.querySelector(".rt"), rm = wheel.querySelector(".rm"), ro = wheel.querySelector(".ro"),
      still = matchMedia("(prefers-reduced-motion: reduce)"),
      A = items.map(function (t) { return +t.getAttribute("data-a"); }),
      TA = themes.map(function (g) { return +g.getAttribute("data-a"); }),
      flip = [], low = [], theta = 0, cur = -1, target = null, vel = 0, raf = 0, last = 0, drag = null, idle = 0;
  function norm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function pick(i) {
    if (cur >= 0) items[cur].classList.remove("on");
    cur = i;
    var t = items[i], d = t.dataset, title = t.textContent;
    t.classList.add("on");
    rt.textContent = title; rt.href = d.h;
    rt.className = "rt" + (title.length > 22 ? " long" : title.length > 13 ? " mid" : "");
    rm.textContent = [d.y, d.th].filter(Boolean).join(" · ");
    ro.hidden = !d.o;
    if (d.o) {
      ro.href = d.o; ro.textContent = d.ow + " ↗";
      if (d.x) { ro.target = "_blank"; ro.rel = "noopener"; } else { ro.removeAttribute("target"); ro.removeAttribute("rel"); }
    }
    turn.setAttribute("aria-valuenow", i + 1); turn.setAttribute("aria-valuetext", title);
  }
  function draw() {
    spin.style.transform = "rotate(" + theta.toFixed(2) + "deg)";
    var best = 0, bd = 400;
    for (var i = 0; i < items.length; i++) {
      var ab = norm(A[i] + theta), f = ab > 180 && ab < 357;
      if (f !== flip[i]) {
        flip[i] = f;
        items[i].setAttribute("transform", "rotate(" + (A[i] + (f ? 90 : -90)) + ")");
        items[i].setAttribute("x", f ? -158 : 158);
        items[i].setAttribute("text-anchor", f ? "end" : "start");
      }
      var d = Math.min(ab, 360 - ab);
      if (d < bd) { bd = d; best = i; }
    }
    for (var j = 0; j < themes.length; j++) {
      var a = norm(TA[j] + theta), lo = a > 95 && a < 265;
      if (lo !== low[j]) { low[j] = lo; themes[j].classList.toggle("lo", lo); }
    }
    if (best !== cur) pick(best);
  }
  function tick(now) {
    raf = 0;
    var dt = last ? Math.min(48, now - last) : 16.7;
    last = now;
    if (!drag && vel) {
      theta += vel * dt;
      vel *= Math.pow(0.94, dt / 16.7);
      if (Math.abs(vel) < 0.02) { vel = 0; draw(); settle(); }
    }
    if (target !== null) {
      var d = target - theta;
      if (Math.abs(d) < 0.05) { theta = target; target = null; }
      else theta += d * (1 - Math.pow(0.78, dt / 16.7));
    }
    draw();
    if (vel || target !== null) raf = requestAnimationFrame(tick); else last = 0;
  }
  function frame() { if (!raf) raf = requestAnimationFrame(tick); }
  function goTo(i) {
    var t = -A[i];
    t += 360 * Math.round((theta - t) / 360);
    vel = 0;
    if (still.matches) { theta = t; target = null; draw(); } else { target = t; frame(); }
  }
  function settle() { goTo(cur); }
  function angle(e) {
    var b = turn.getBoundingClientRect();
    return Math.atan2(e.clientY - (b.top + b.width * .655), e.clientX - (b.left + b.width / 2)) * 180 / Math.PI;
  }
  turn.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, a: angle(e), el: e.target, moved: false, s: [] };
    vel = 0; target = null;
    try { turn.setPointerCapture(e.pointerId); } catch (_) {}
  });
  turn.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
    drag.moved = true;
    var a = angle(e), d = a - drag.a;
    drag.a = a;
    theta += ((d + 540) % 360) - 180;
    drag.s.push([e.timeStamp, theta]);
    while (drag.s.length > 2 && e.timeStamp - drag.s[0][0] > 90) drag.s.shift();
    frame();
  });
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (!d.moved) {
      var w = d.el.closest && d.el.closest("text[data-a]"), g = d.el.closest && d.el.closest(".tg");
      if (w) location.href = w.getAttribute("data-h"); else if (g) goTo(+g.getAttribute("data-i"));
      return;
    }
    var s = d.s;
    vel = 0;
    if (!still.matches && e.type === "pointerup" && s.length > 1 && e.timeStamp - s[s.length - 1][0] < 80) {
      var f = s[0], l = s[s.length - 1];
      if (l[0] > f[0]) vel = Math.max(-1.5, Math.min(1.5, (l[1] - f[1]) / (l[0] - f[0])));
    }
    if (Math.abs(vel) > 0.02) frame(); else { vel = 0; settle(); }
  }
  turn.addEventListener("pointerup", end);
  turn.addEventListener("pointercancel", end);
  wheel.addEventListener("wheel", function (e) {
    e.preventDefault();
    vel = 0; target = null;
    var dd = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    theta -= dd * (e.deltaMode ? 5 : .2);
    frame();
    clearTimeout(idle);
    idle = setTimeout(settle, 180);
  }, { passive: false });
  turn.addEventListener("keydown", function (e) {
    var n = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (e.key === "Enter") { location.href = rt.href; return; }
    if (!n) return;
    e.preventDefault();
    goTo((cur + n + items.length) % items.length);
  });
  draw();
})();
</script>

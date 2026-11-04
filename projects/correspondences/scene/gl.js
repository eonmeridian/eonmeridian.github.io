// Minimal WebGL2 harness: a program, a fullscreen triangle, a clock, and a
// quality tier that answers to measured frame time.
//
// No library. The sky and the post chain are both fullscreen fragment passes,
// which is a vertex buffer and a shader — reaching for a scene graph to draw
// two triangles would be the tail wagging the dog. Geometry (the cloud, the
// plane) is the part that may want three.js, and it is kept separate so that
// decision stays open.
//
// The tiers exist from the first commit on purpose. The Pi 5's VideoCore VII is
// not an M3 Max, and retrofitting quality levels after the look is tuned is how
// an installation becomes a slideshow in a gallery.

export const TIERS = {
  // octaves: fbm detail. taps: radial smear samples. scale: render resolution.
// motes: drifting particle count.
  high: { octaves: 5, taps: 5, scale: 1.0, motes: 1400 },
  mid: { octaves: 4, taps: 3, scale: 0.75, motes: 800 },
  low: { octaves: 3, taps: 3, scale: 0.5, motes: 350 },
};

const FULLSCREEN_VS = `#version 300 es
// One triangle that covers the screen. Two would give a seam down the
// diagonal on some drivers when derivatives are taken across it.
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // The error message is the product: report the offending line, not just
    // the driver's complaint, because GLSL line numbers are otherwise useless
    // against a template-assembled source.
    const log = gl.getShaderInfoLog(sh);
    const line = Number((log.match(/:(\d+):/) || [])[1]);
    const ctx = src.split('\n').slice(Math.max(0, line - 3), line + 2).join('\n');
    throw new Error(`shader compile failed\n${log}\n--- near line ${line} ---\n${ctx}`);
  }
  return sh;
}

export function program(gl, fs, vs = FULLSCREEN_VS) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

/** Cache uniform locations; getUniformLocation every frame is a real cost. */
export function uniforms(gl, prog, names) {
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(prog, n);
  return u;
}


/** An off-screen colour buffer. The scene renders here; the post chain reads it. */
export class Target {
  constructor(gl) {
    this.gl = gl;
    this.fbo = gl.createFramebuffer();
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    // LINEAR because the smear samples between texels; CLAMP because sampling
    // past the edge with REPEAT wraps the vignette around to the far side.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.w = 0; this.h = 0;
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w; this.h = h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('framebuffer incomplete — the post chain has nothing to read');
  }

  bind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.viewport(0, 0, this.w, this.h);
  }
}

export class Stage {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} tier  starting quality; downgrades itself if frames are slow
   */
  constructor(canvas, tier = 'high') {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false, // we never draw a hard edge; it would only cost fill
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!this.gl) throw new Error('WebGL2 is unavailable. The scene needs it; the rites do not.');

    this.tierName = tier;
    this.tier = TIERS[tier];
    this.passes = [];
    this.post = null;
    this.target = new Target(this.gl);
    this.time = 0;
    this.lucidity = 0;

    // Frame-time median over a short window. A mean lets one stall from a
    // garbage collection drop the whole room a tier.
    this._frames = [];
    this._lastChange = 0;
    // How many tiers this has ever given up. An installation that recovers has to
    // remember that it once could not cope, or it spends the evening oscillating.
    this._sank = 0;

    /// Called once per frame before the passes draw, with the delta in seconds.
    /// The scene's own state — where the camera is, how awake the room is — belongs to
    /// whoever assembled the scene, not in here.
    this.onFrame = null;

    this._onResize = () => this.resize();
    addEventListener('resize', this._onResize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2) * this.tier.scale;
    const w = Math.max(1, Math.floor(innerWidth * dpr));
    const h = Math.max(1, Math.floor(innerHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    if (this.target) this.target.resize(w, h);
  }

  /** A pass is { draw(stage, dt) } and may rebuild on a tier change. */
  add(pass) {
    this.passes.push(pass);
    if (pass.build) pass.build(this);
    return pass;
  }

  /** The final pass, drawn to the screen with the scene as its input. */
  setPost(pass) {
    this.post = pass;
    if (pass && pass.build) pass.build(this);
    return pass;
  }

  _render(dt) {
    const gl = this.gl;
    if (this.post) {
      this.target.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    for (const p of this.passes) p.draw(this, dt);

    if (this.post) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.post.draw(this, dt);
    }
  }

  _measure(dt) {
    this._frames.push(dt);
    if (this._frames.length < 60) return;
    const sorted = [...this._frames].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this._frames.length = 0;

    // 20 ms ≈ 50 fps. Below that the drift stops reading as drift.
    const order = ['high', 'mid', 'low'];
    const i = order.indexOf(this.tierName);
    if (this.time - this._lastChange < 3) return;

    if (median > 0.020 && i < order.length - 1) {
      this._sank++;
      this.setTier(order[i + 1]);
      this._lastChange = this.time;
      console.info(`[stage] ${(median * 1000).toFixed(1)}ms median → tier ${this.tierName}`);
      return;
    }

    // Climb back. This only ever fell before, which is wrong for the thing it was
    // written for: an installation runs for days, and a single garbage collection in
    // the first minute would otherwise leave a Pi 5 rendering at half resolution until
    // somebody power-cycled it. The cost of never recovering is much larger than the
    // cost of one wrong guess upward, because the wrong guess corrects itself in three
    // seconds and the ratchet does not.
    //
    // Not symmetric with the fall, on purpose:
    //
    //   - **12 ms, not 20.** Recovering at the threshold it sank at guarantees an
    //     oscillation, because the tier above is by definition more expensive than the
    //     one measuring comfortable now. The gap is the hysteresis.
    //   - **Each recovery is slower than the last.** A room that cannot hold `high`
    //     will find that out again, and `_sank` makes it wait longer every time rather
    //     than retry forever on the same cadence.
    const patience = 8 * Math.pow(3, Math.max(0, this._sank - 1));
    if (median < 0.012 && i > 0 && this.time - this._lastChange > patience) {
      this.setTier(order[i - 1]);
      this._lastChange = this.time;
      console.info(`[stage] ${(median * 1000).toFixed(1)}ms median → tier ${this.tierName}`);
    }
  }

  setTier(name) {
    this.tierName = name;
    this.tier = TIERS[name];
    this.resize();
    for (const p of this.passes) if (p.build) p.build(this);
    if (this.post && this.post.build) this.post.build(this);
  }

  start() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1); // clamp: a backgrounded tab
      last = now;
      this.time += dt;
      this._measure(dt);
      if (this.onFrame) this.onFrame(dt);
      this._render(dt);
      this._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame(frame);
    return this;
  }

  stop() {
    cancelAnimationFrame(this._raf);
    removeEventListener('resize', this._onResize);
  }
}

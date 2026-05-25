'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TAU   = Math.PI * 2;
const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CFG = {
  transitionMs:    400,
  swipeThreshold:  45,
  tapStirStrength: 4.5,
};

// ─── SCENE DEFINITIONS ────────────────────────────────────────────────────────
const SCENES = [
  {
    id:         'tiny-cabin',
    name:       'Tiny Cabin',
    background: 'assets/scenes/tiny-cabin/background-placeholder.svg',
    overlays:   ['snow', 'smoke'],
  },
  {
    id:         'beach',
    name:       'Beach',
    background: 'assets/scenes/beach/background-placeholder.svg',
    overlays:   ['birds', 'waterGlints', 'seaMist'],
  },
  {
    id:         'aquarium',
    name:       'Aquarium',
    background: 'assets/scenes/aquarium/background-placeholder.svg',
    overlays:   ['bubbles', 'lightRays', 'fishSilhouettes'],
  },
];

// ─── ASSET LOADING ────────────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function preloadScenes(scenes) {
  return Promise.all(scenes.map(s => loadImage(s.background).then(img => (s.image = img))));
}

// ─── IMAGE COVER HELPER ───────────────────────────────────────────────────────
function drawImageCover(ctx, img, W, H) {
  if (!img) return;
  const ir = img.width / img.height;
  const vr = W / H;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > vr) { sw = img.height * vr;  sx = (img.width  - sw) / 2; }
  else         { sh = img.width  / vr;  sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

// ─── OVERLAY SYSTEMS ──────────────────────────────────────────────────────────
// Shared interface: init(W,H) · stir?(strength) · update(dt,t) · draw(ctx,W,H,t)

class SnowOverlay {
  constructor() { this.particles = []; this.stir_ = 0; }

  init(W, H) {
    this.W = W; this.H = H;
    this.particles = Array.from({ length: 130 }, () => this._spawn(true));
  }

  _spawn(scatter) {
    return {
      x:  rand(0, this.W),
      y:  scatter ? rand(0, this.H * 0.92) : rand(-this.H * 0.06, 0),
      vx: rand(-0.45, 0.45),
      vy: rand(0.40, 1.10),
      sz: rand(1.5, 3.5),
      a:  rand(0.45, 1.0),
      ph: rand(0, TAU),
    };
  }

  stir(s) { this.stir_ = s; }

  update(dt, t) {
    const T  = dt * 0.05;
    const st = this.stir_;
    this.stir_ *= 0.93;
    for (const p of this.particles) {
      p.x  += (p.vx + Math.sin(t * 0.9 + p.ph) * 0.35) * T + (Math.random() - 0.5) * st * 0.25;
      p.y  += (p.vy + (Math.random() - 0.5) * st * 0.3) * T;
      p.vx  = clamp(p.vx + (Math.random() - 0.5) * 0.018, -1.5, 1.5);
      p.vy  = Math.min(p.vy + 0.008, 2.5);
      if (p.x < -6)          p.x = this.W + 6;
      if (p.x > this.W + 6)  p.x = -6;
      if (p.y > this.H * 0.94) Object.assign(p, this._spawn(false));
    }
  }

  draw(ctx, W, H, t) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const p of this.particles) {
      const tw = 0.75 + 0.25 * Math.sin(t * 2.0 + p.ph);
      ctx.globalAlpha = p.a * tw;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

class SmokeOverlay {
  constructor() { this.puffs = []; }

  init(W, H) {
    this.W = W; this.H = H;
    // Chimney sits just right of centre near the top of the cabin background
    this.cx = W * 0.525;
    this.cy = H * 0.293;
    this.puffs = Array.from({ length: 7 }, (_, i) => this._spawn(i / 7));
  }

  _spawn(tOffset) {
    const life = rand(2.8, 5.0);
    return {
      x:       this.cx + rand(-3, 3),
      y:       this.cy,
      vx:      rand(-0.12, 0.12),
      vy:      rand(-0.55, -0.22),
      sz:      rand(5, 10),
      a:       rand(0.06, 0.15),
      life:    0,
      maxLife: life,
      delay:   -(tOffset * life),
    };
  }

  update(dt) {
    for (const p of this.puffs) {
      p.delay -= dt * 0.001;
      if (p.delay > 0) continue;
      p.life += dt * 0.001;
      p.x    += p.vx;
      p.y    += p.vy;
      p.vx   += (Math.random() - 0.5) * 0.012;
      p.sz   += 0.035;
      if (p.life > p.maxLife) Object.assign(p, this._spawn(0));
    }
  }

  draw(ctx, W, H, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(195,195,200,1)';
    for (const p of this.puffs) {
      if (p.delay > 0) continue;
      const prog = p.life / p.maxLife;
      const fade = prog < 0.15 ? prog / 0.15 : 1 - prog;
      ctx.globalAlpha = p.a * fade * fade;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

class BirdsOverlay {
  constructor() { this.birds = []; }

  init(W, H) {
    this.W = W; this.H = H;
    this.birds = Array.from({ length: 6 }, () => this._spawn(true));
  }

  _spawn(scatter) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      x:   scatter ? rand(0, this.W) : (dir > 0 ? -30 : this.W + 30),
      y:   rand(this.H * 0.07, this.H * 0.38),
      vx:  dir * rand(0.5, 1.3),
      sz:  rand(5, 11),
      ph:  rand(0, TAU),
      dir,
    };
  }

  update(dt, t) {
    const T = dt * 0.05;
    for (const b of this.birds) {
      b.x += b.vx * T;
      if (b.x > this.W + 45 || b.x < -45) Object.assign(b, this._spawn(false));
    }
  }

  draw(ctx, W, H, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(20,10,5,0.65)';
    ctx.lineWidth   = 1.4;
    ctx.lineCap     = 'round';
    for (const b of this.birds) {
      const flapY = Math.sin(t * 4.0 + b.ph) * b.sz * 0.55;
      ctx.beginPath();
      ctx.moveTo(b.x - b.sz, b.y + flapY);
      ctx.quadraticCurveTo(b.x, b.y - flapY * 0.4, b.x + b.sz, b.y + flapY);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class WaterGlintsOverlay {
  constructor() { this.glints = []; }

  init(W, H) {
    this.W = W; this.H = H;
    this.glints = Array.from({ length: 35 }, () => ({
      x:     rand(0, W),
      y:     rand(H * 0.54, H * 0.84),
      len:   rand(6, 24),
      a:     rand(0.18, 0.55),
      ph:    rand(0, TAU),
      speed: rand(0.5, 1.6),
    }));
  }

  update(dt, t) {}

  draw(ctx, W, H, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,235,160,0.9)';
    ctx.lineCap     = 'round';
    for (const g of this.glints) {
      const tw = 0.2 + 0.8 * Math.abs(Math.sin(t * g.speed + g.ph));
      ctx.globalAlpha = g.a * tw;
      ctx.lineWidth   = 1.3 + tw * 0.8;
      ctx.beginPath();
      ctx.moveTo(g.x - g.len * 0.5, g.y);
      ctx.lineTo(g.x + g.len * 0.5, g.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class SeaMistOverlay {
  constructor() { this.particles = []; }

  init(W, H) {
    this.W = W; this.H = H;
    this.particles = Array.from({ length: 22 }, () => this._spawn(true));
  }

  _spawn(scatter) {
    return {
      x:       rand(0, this.W),
      y:       scatter ? rand(this.H * 0.50, this.H * 0.95) : this.H + 15,
      vx:      rand(-0.25, 0.25),
      vy:      rand(-0.18, -0.06),
      sz:      rand(18, 50),
      a:       rand(0.025, 0.085),
      life:    0,
      maxLife: rand(6, 14),
    };
  }

  update(dt, t) {
    const T = dt * 0.05;
    for (const p of this.particles) {
      p.x    += p.vx * T;
      p.y    += p.vy * T;
      p.life += dt * 0.001;
      if (p.life > p.maxLife || p.y < this.H * 0.30) Object.assign(p, this._spawn(false));
    }
  }

  draw(ctx, W, H, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(215,232,255,1)';
    for (const p of this.particles) {
      const fade = Math.min(p.life / 0.8, (p.maxLife - p.life) / 1.0, 1);
      ctx.globalAlpha = p.a * clamp(fade, 0, 1);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

class BubblesOverlay {
  constructor() { this.particles = []; }

  init(W, H) {
    this.W = W; this.H = H;
    this.particles = Array.from({ length: 42 }, () => this._spawn(true));
  }

  _spawn(scatter) {
    return {
      x:  rand(0, this.W),
      y:  scatter ? rand(0, this.H * 0.95) : this.H + 10,
      vx: rand(-0.22, 0.22),
      vy: rand(-0.85, -0.30),
      sz: rand(2, 7),
      a:  rand(0.14, 0.48),
      ph: rand(0, TAU),
    };
  }

  stir(s) {
    for (const p of this.particles) {
      p.vx += (Math.random() - 0.5) * s * 0.4;
      p.vy -= Math.random() * s * 0.25;
    }
  }

  update(dt, t) {
    const T = dt * 0.05;
    for (const p of this.particles) {
      p.x += (p.vx + Math.sin(t * 0.7 + p.ph) * 0.18) * T;
      p.y += p.vy * T;
      if (p.x < -10)          p.x = this.W + 10;
      if (p.x > this.W + 10)  p.x = -10;
      if (p.y < -20) Object.assign(p, this._spawn(false));
    }
  }

  draw(ctx, W, H, t) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.a;
      ctx.strokeStyle = 'rgba(100,205,255,0.80)';
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, TAU); ctx.stroke();
      ctx.globalAlpha = p.a * 0.5;
      ctx.fillStyle   = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(p.x - p.sz * 0.28, p.y - p.sz * 0.28, p.sz * 0.32, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

class LightRaysOverlay {
  constructor() { this.rays = []; }

  init(W, H) {
    this.W = W; this.H = H;
    this.rays = Array.from({ length: 5 }, (_, i) => ({
      x:     W * (0.12 + i * 0.19),
      w:     rand(W * 0.042, W * 0.100),
      a:     rand(0.038, 0.090),
      ph:    rand(0, TAU),
      speed: rand(0.28, 0.65),
    }));
  }

  update(dt, t) {}

  draw(ctx, W, H, t) {
    ctx.save();
    for (const r of this.rays) {
      const tw   = 0.45 + 0.55 * Math.sin(t * r.speed + r.ph);
      ctx.globalAlpha = r.a * tw;
      const grad = ctx.createLinearGradient(r.x, 0, r.x, H * 0.88);
      grad.addColorStop(0,   'rgba(190,235,255,0.90)');
      grad.addColorStop(0.5, 'rgba(160,220,255,0.30)');
      grad.addColorStop(1,   'rgba(160,220,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(r.x - r.w * 0.5, 0);
      ctx.lineTo(r.x + r.w * 0.5, 0);
      ctx.lineTo(r.x + r.w * 1.6, H * 0.88);
      ctx.lineTo(r.x - r.w * 1.6, H * 0.88);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

class FishSilhouettesOverlay {
  constructor() { this.fish = []; }

  init(W, H) {
    this.W = W; this.H = H;
    this.fish = Array.from({ length: 6 }, () => this._spawn(true));
  }

  _spawn(scatter) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      x:   scatter ? rand(0, this.W) : (dir > 0 ? -35 : this.W + 35),
      y:   rand(this.H * 0.22, this.H * 0.78),
      vx:  dir * rand(0.25, 0.75),
      sz:  rand(9, 20),
      a:   rand(0.30, 0.65),
      ph:  rand(0, TAU),
      dir,
    };
  }

  update(dt, t) {
    const T = dt * 0.05;
    for (const f of this.fish) {
      f.x += f.vx * T;
      f.y += Math.sin(t * 0.6 + f.ph) * 0.06;
      if (f.x > this.W + 45 || f.x < -45) Object.assign(f, this._spawn(false));
    }
  }

  draw(ctx, W, H, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,25,55,0.65)';
    for (const f of this.fish) {
      ctx.globalAlpha = f.a;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.dir, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, f.sz, f.sz * 0.40, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-f.sz * 0.95, 0);
      ctx.lineTo(-f.sz * 1.55, -f.sz * 0.45);
      ctx.lineTo(-f.sz * 1.55,  f.sz * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

// ─── OVERLAY REGISTRY ─────────────────────────────────────────────────────────
const OVERLAY_REGISTRY = {
  snow:            (W, H) => { const o = new SnowOverlay();            o.init(W, H); return o; },
  smoke:           (W, H) => { const o = new SmokeOverlay();           o.init(W, H); return o; },
  birds:           (W, H) => { const o = new BirdsOverlay();           o.init(W, H); return o; },
  waterGlints:     (W, H) => { const o = new WaterGlintsOverlay();     o.init(W, H); return o; },
  seaMist:         (W, H) => { const o = new SeaMistOverlay();         o.init(W, H); return o; },
  bubbles:         (W, H) => { const o = new BubblesOverlay();         o.init(W, H); return o; },
  lightRays:       (W, H) => { const o = new LightRaysOverlay();       o.init(W, H); return o; },
  fishSilhouettes: (W, H) => { const o = new FishSilhouettesOverlay(); o.init(W, H); return o; },
};

// ─── UI DRAWING ───────────────────────────────────────────────────────────────
function getSab() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
}

function drawTitle(ctx, W, H, name) {
  const fs = Math.round(Math.max(11, H * 0.019));
  ctx.save();
  ctx.globalAlpha   = 0.68;
  ctx.fillStyle     = '#ffffff';
  ctx.font          = `500 ${fs}px -apple-system, system-ui, 'Helvetica Neue', sans-serif`;
  ctx.textAlign     = 'center';
  ctx.letterSpacing = '3px';
  ctx.shadowBlur    = 8;
  ctx.shadowColor   = 'rgba(0,0,0,0.6)';
  ctx.fillText(name.toUpperCase(), W / 2, Math.max(fs + 14, H * 0.062));
  ctx.restore();
}

function drawDots(ctx, W, H, total, active) {
  const sab    = getSab();
  const dotR   = 3.5;
  const gap    = 14;
  const startX = W / 2 - ((total - 1) * gap) / 2;
  const y      = H - Math.max(28, sab + 24);
  ctx.save();
  for (let i = 0; i < total; i++) {
    ctx.globalAlpha = i === active ? 0.90 : 0.28;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath(); ctx.arc(startX + i * gap, y, dotR, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ─── MOMENTARIUM APP ──────────────────────────────────────────────────────────
class MomentariumApp {
  constructor(canvas) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.W         = 0;
    this.H         = 0;
    this.dpr       = 1;
    this.activeIdx = 0;
    this.overlays  = {};   // { [sceneId]: { [name]: overlayInstance } }

    this.fade       = 1;
    this.fadingOut  = false;
    this.fadingIn   = false;
    this.pendingIdx = null;
    this.transT     = 0;

    this.lastTime  = null;
    this.startTime = performance.now();

    this._initResize();
    this._initInput();

    preloadScenes(SCENES).then(() => {
      this._buildOverlays();
      requestAnimationFrame(t => this._loop(t));
    });
  }

  // ── Resize ──────────────────────────────────────────────────────────────────
  _initResize() {
    const resize = () => {
      this.dpr = window.devicePixelRatio || 1;
      this.W   = window.innerWidth;
      this.H   = window.innerHeight;
      this.canvas.width         = this.W * this.dpr;
      this.canvas.height        = this.H * this.dpr;
      this.canvas.style.width   = this.W + 'px';
      this.canvas.style.height  = this.H + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._reinitOverlays();
    };
    window.addEventListener('resize', resize);
    resize();
  }

  // ── Overlays ────────────────────────────────────────────────────────────────
  _buildOverlays() {
    for (const scene of SCENES) {
      this.overlays[scene.id] = {};
      for (const name of scene.overlays) {
        if (OVERLAY_REGISTRY[name]) {
          this.overlays[scene.id][name] = OVERLAY_REGISTRY[name](this.W, this.H);
        }
      }
    }
  }

  _reinitOverlays() {
    for (const scene of SCENES) {
      const group = this.overlays[scene.id];
      if (!group) continue;
      for (const o of Object.values(group)) {
        if (o.init) o.init(this.W, this.H);
      }
    }
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  _initInput() {
    const el = this.canvas;
    let tx = 0, ty = 0, ttime = 0;

    el.addEventListener('touchstart', e => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
      ttime = Date.now();
      e.preventDefault();
    }, { passive: false });

    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      const dt = Date.now() - ttime;
      if (Math.abs(dx) > CFG.swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        this._go(this.activeIdx + (dx < 0 ? 1 : -1));
      } else if (Math.abs(dx) < 14 && Math.abs(dy) < 14 && dt < 280) {
        this._stir();
      }
      e.preventDefault();
    }, { passive: false });

    // Desktop mouse
    let mx = 0, my = 0, mdown = false;
    el.addEventListener('mousedown', e => { mdown = true; mx = e.clientX; my = e.clientY; });
    el.addEventListener('mouseup',   e => {
      if (!mdown) return; mdown = false;
      const dx = e.clientX - mx, dy = e.clientY - my;
      if (Math.abs(dx) > CFG.swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        this._go(this.activeIdx + (dx < 0 ? 1 : -1));
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        this._stir();
      }
    });

    // Arrow keys for desktop navigation
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') this._go(this.activeIdx + 1);
      if (e.key === 'ArrowLeft')  this._go(this.activeIdx - 1);
    });
  }

  _stir() {
    const group = this.overlays[SCENES[this.activeIdx].id] || {};
    for (const o of Object.values(group)) {
      if (o.stir) o.stir(CFG.tapStirStrength);
    }
  }

  _go(idx) {
    if (this.fadingOut || this.fadingIn) return;
    const next = ((idx % SCENES.length) + SCENES.length) % SCENES.length;
    if (next === this.activeIdx) return;
    this.pendingIdx = next;
    this.fadingOut  = true;
    this.transT     = performance.now();
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  _loop(now) {
    const dt = this.lastTime === null ? 16 : Math.min(now - this.lastTime, 50);
    this.lastTime = now;
    const t = (now - this.startTime) * 0.001;

    this._updateTransition(now);

    const group = this.overlays[SCENES[this.activeIdx].id] || {};
    for (const o of Object.values(group)) {
      if (o.update) o.update(dt, t);
    }

    this._draw(t);
    requestAnimationFrame(n => this._loop(n));
  }

  // ── Transition ──────────────────────────────────────────────────────────────
  _updateTransition(now) {
    if (!this.fadingOut && !this.fadingIn) return;
    const elapsed = now - this.transT;
    const half    = CFG.transitionMs / 2;

    if (this.fadingOut) {
      this.fade = clamp(1 - elapsed / half, 0, 1);
      if (elapsed >= half) {
        this.fade      = 0;
        this.fadingOut = false;
        this.fadingIn  = true;
        this.activeIdx = this.pendingIdx;
        this.transT    = now;
      }
    } else {
      this.fade = clamp(elapsed / half, 0, 1);
      if (elapsed >= half) {
        this.fade     = 1;
        this.fadingIn = false;
      }
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  _draw(t) {
    const { ctx, W, H } = this;
    const scene = SCENES[this.activeIdx];
    ctx.clearRect(0, 0, W, H);

    // Background image (object-fit cover)
    if (scene.image) {
      drawImageCover(ctx, scene.image, W, H);
    } else {
      ctx.fillStyle = '#06080f';
      ctx.fillRect(0, 0, W, H);
    }

    // Overlay systems
    const group = this.overlays[scene.id] || {};
    for (const o of Object.values(group)) {
      if (o.draw) o.draw(ctx, W, H, t);
    }

    // UI
    drawTitle(ctx, W, H, scene.name);
    drawDots(ctx, W, H, SCENES.length, this.activeIdx);

    // Fade to black overlay for transitions
    if (this.fade < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - this.fade;
      ctx.fillStyle   = '#000000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  new MomentariumApp(document.getElementById('c'));
});

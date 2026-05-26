'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TAU   = Math.PI * 2;
const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CFG = {
  transitionMs:    400,
  swipeThreshold:  45,
  tapKickStrength: 6,
  shakeThreshold:  13,
};

// ─── SCENE DEFINITIONS ────────────────────────────────────────────────────────
const SCENES = [
  {
    id:         'tiny-cabin',
    name:       'Tiny Cabin',
    background: {
      portrait:  'assets/scenes/tiny-cabin/background-portrait.png',
      landscape: 'assets/scenes/tiny-cabin/background-landscape.png',
    },
    overlays:   ['snow', 'smoke', 'cabinEvents'],
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

async function preloadScenes(scenes) {
  await Promise.all(scenes.map(async s => {
    if (typeof s.background === 'object') {
      [s.imagePortrait, s.imageLandscape] = await Promise.all([
        loadImage(s.background.portrait),
        loadImage(s.background.landscape),
      ]);
    } else {
      s.image = await loadImage(s.background);
    }
  }));
}

const deerSprites = {};
async function preloadDeerSprites() {
  const base = 'assets/scenes/tiny-cabin/deer/';
  await Promise.all(
    ['walk-0', 'walk-1', 'walk-2', 'walk-3', 'pause'].map(async n => {
      deerSprites[n] = await loadImage(`${base}${n}.png`);
    })
  );
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

// ─── PAINT-SPACE COORDINATE TRANSFORMS ───────────────────────────────────────
// These two functions are the inverse of each other through drawImageCover's
// crop math. Use paintToCanvas for all overlay anchor positioning so coords
// track the correct painting pixel at any viewport size or orientation.

function _coverParams(img, W, H) {
  const ir = img.width / img.height;
  const vr = W / H;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > vr) { sw = img.height * vr; sx = (img.width  - sw) / 2; }
  else         { sh = img.width  / vr; sy = (img.height - sh) / 2; }
  return { sx, sy, sw, sh };
}

// paintToCanvas: painting pixel (px,py) → canvas point {x,y}
function paintToCanvas(px, py, img, W, H) {
  if (!img) return { x: px / 100 * W, y: py / 100 * H };
  const { sx, sy, sw, sh } = _coverParams(img, W, H);
  return { x: (px - sx) / sw * W, y: (py - sy) / sh * H };
}

// canvasToPaint: canvas point (cx,cy) → painting pixel {px,py}
// Used by the ?debug measurement tool — click a feature, get its paint coords.
function canvasToPaint(cx, cy, img, W, H) {
  const { sx, sy, sw, sh } = _coverParams(img, W, H);
  return { px: Math.round(sx + (cx / W) * sw), py: Math.round(sy + (cy / H) * sh) };
}

// ─── OVERLAY SYSTEMS ──────────────────────────────────────────────────────────
// Shared interface: init(W,H) · stir?(strength) · update(dt,t) · draw(ctx,W,H,t)

class SnowOverlay {
  constructor() { this.particles = []; this.stir_ = 0; }

  init(W, H) {
    this.W = W; this.H = H;
    this.particles = Array.from({ length: 500 }, () => this._spawn(true));
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

  kick(strength) {
    for (const p of this.particles) {
      p.vx = clamp(p.vx + (Math.random() - 0.5) * strength, -8, 8);
      p.vy = clamp(p.vy + Math.random() * strength * 0.25,   0, 8);
    }
  }

  update(dt, t) {
    this.stir_ *= 0.93;
    if (this.stir_ < 0.001) { this.stir_ = 0; return; }
    const T  = dt * 0.05;
    const st = this.stir_;
    for (const p of this.particles) {
      p.x  += (p.vx + Math.sin(t * 0.9 + p.ph) * 0.35) * T + (Math.random() - 0.5) * st * 0.25;
      p.y  += p.vy * T;
      p.vx  = clamp(p.vx + (Math.random() - 0.5) * 0.018, -1.5, 1.5);
      p.vy  = clamp(p.vy + 0.008, 0, 2.5);
      if (p.x < -6)          p.x = this.W + 6;
      if (p.x > this.W + 6)  p.x = -6;
      if (p.y > this.H * 0.94) Object.assign(p, this._spawn(false));
    }
  }

  draw(ctx, W, H, t) {
    const vis = Math.min(1, this.stir_ / 8);
    if (vis <= 0) return;
    const buckets = [[], [], []];
    for (const p of this.particles) {
      const tw = 0.75 + 0.25 * Math.sin(t * 2.0 + p.ph);
      const a  = p.a * tw * vis;
      buckets[a > 0.66 ? 2 : a > 0.33 ? 1 : 0].push(p);
    }
    ctx.save();
    ctx.fillStyle = '#ffffff';
    const alphas = [0.28, 0.58, 0.88];
    for (let b = 0; b < 3; b++) {
      if (!buckets[b].length) continue;
      ctx.globalAlpha = alphas[b] * vis;
      ctx.beginPath();
      for (const p of buckets[b]) { ctx.moveTo(p.x + p.sz, p.y); ctx.arc(p.x, p.y, p.sz, 0, TAU); }
      ctx.fill();
    }
    ctx.restore();
  }
}

class SmokeOverlay {
  constructor() {
    this.puffs = [];
    this._kick = 0;
    this._stir = 0;
  }

  setChimneyPos(portrait, landscape) {
    this._chimneyPortrait  = portrait;
    this._chimneyLandscape = landscape || portrait;
    return this;
  }

  setChimneyPx(portrait, landscape) {
    this._chimneyPxPortrait  = portrait;
    this._chimneyPxLandscape = landscape || portrait;
    return this;
  }

  init(W, H, img) {
    this.W = W; this.H = H; this._img = img || null;
    const L = W > H;
    if (img && this._chimneyPxPortrait) {
      const { px, py } = L ? this._chimneyPxLandscape : this._chimneyPxPortrait;
      const pt = paintToCanvas(px, py, img, W, H);
      this.cx = pt.x; this.cy = pt.y;
    } else {
      const pos = L ? (this._chimneyLandscape || { cx: 0.525, cy: 0.293 })
                    : (this._chimneyPortrait  || { cx: 0.525, cy: 0.293 });
      this.cx = W * pos.cx; this.cy = H * pos.cy;
    }
    this.puffs = Array.from({ length: 26 }, (_, i) => this._spawn(i / 26));
  }

  _spawn(ageFraction = 0) {
    const maxLife = rand(6.0, 10.0);
    const initSz  = rand(4, 8);
    return {
      x:       this.cx + rand(-3, 3),
      y:       this.cy,
      vx:      rand(-2, 4),         // px/s — nearly straight up at chimney; drift develops with age
      vy:      rand(-28, -16),      // px/s — slow rise
      initSz,
      sz:      initSz,
      maxSz:   rand(28, 46),        // billow size — smaller than before, less globular
      life:    ageFraction * maxLife,
      maxLife,
      warm:    rand(0.3, 0.9),
      phase:   rand(0, TAU),
    };
  }

  kick(strength) {
    this._kick = Math.max(this._kick, strength);
    for (const p of this.puffs) {
      p.vy -= strength * 2.5;
      p.vx += (Math.random() - 0.5) * strength * 2;
    }
  }

  stir(strength) {
    this._stir = Math.max(this._stir, strength);
  }

  update(dt, t) {
    const s = dt * 0.001;
    this._kick = Math.max(0, this._kick - s * 3);
    this._stir = Math.max(0, this._stir - s * 1.5);

    for (const p of this.puffs) {
      p.life += s;

      const prog = Math.max(0, p.life / p.maxLife);
      // Turbulence ramps in after the first 30% of life — column is straight near chimney
      const turbScale = clamp((prog - 0.30) / 0.55, 0, 1);

      const tx = (Math.sin(t * 0.65 + p.phase + p.y * 0.003) * 8
               +  Math.cos(t * 0.37 + p.x * 0.005) * 5) * turbScale;
      const ty =  Math.cos(t * 0.50 + p.phase) * 3 * turbScale;

      p.vx += (tx + this._stir * 25) * s;
      p.vy += ty * s;

      // Drag: lateral fades faster than vertical (wind carries, buoyancy persists)
      p.vx *= 1 - s * 0.22;
      p.vy *= 1 - s * 0.12;

      p.x += p.vx * s;
      p.y += p.vy * s;

      // Grow puff radius as it rises (easeOutQuad)
      const ease = 1 - (1 - Math.min(prog, 1)) ** 2;
      p.sz = p.initSz + (p.maxSz - p.initSz) * ease;

      if (p.life > p.maxLife) Object.assign(p, this._spawn(0));
    }
  }

  draw(ctx, W, H, t) {
    ctx.save();
    for (const p of this.puffs) {
      if (p.sz < 1) continue;
      const prog = Math.max(0, Math.min(1, p.life / p.maxLife));

      // Fade envelope: quick ramp-in → hold → gentle ramp-out
      let fade;
      if (prog < 0.12)      fade = prog / 0.12;
      else if (prog < 0.58) fade = 1;
      else                  fade = 1 - (prog - 0.58) / 0.42;

      const alpha = 0.18 * fade * fade;
      if (alpha < 0.003) continue;

      // Warm dark-gray near chimney → cooler medium-gray as it drifts
      const w = p.warm * Math.max(0, 1 - prog * 0.85);
      const r = Math.round(155 + w * 18);
      const g = Math.round(152 + w * 10);
      const b = 162;

      // Soft radial gradient gives each puff a volumetric, cloud-like edge
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.sz);
      grad.addColorStop(0,    `rgba(${r},${g},${b},${Math.min(0.999, alpha * 1.7).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz, 0, TAU);
      ctx.fill();
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
  constructor() { this.particles = []; this.stir_ = 0; }

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

  stir(s) { this.stir_ = s; }

  kick(strength) {
    for (const p of this.particles) {
      p.vx = clamp(p.vx + (Math.random() - 0.5) * strength, -5, 5);
      p.vy = clamp(p.vy + (Math.random() - 0.5) * strength, -5, 5);
    }
  }

  update(dt, t) {
    const T  = dt * 0.05;
    const st = this.stir_;
    this.stir_ *= 0.93;
    for (const p of this.particles) {
      p.x += (p.vx + Math.sin(t * 0.7 + p.ph) * 0.18 + (Math.random() - 0.5) * st * 0.15) * T;
      p.y += (p.vy + (Math.random() - 0.5) * st * 0.20) * T;
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

// ─── TINY CABIN — TIMED MICRO-EVENTS ─────────────────────────────────────────
const EV_NAMES_CABIN = [
  'deer', 'owl', 'rabbit', 'fox',
  'shootingStar', 'pondCrack', 'snowSlip', 'branchDrop',
  'windowShadow', 'chimneySpark', 'smokeBurst',
];

class CabinEventsOverlay {
  constructor() { this._ev = null; }

  init(W, H, img) {
    this.W = W; this.H = H; this._img = img || null;
    this.S = Math.min(W, H) * 0.46;
    const L = W > H;
    const p2c = (px, py) => paintToCanvas(px, py, img, W, H);

    // Measured paint-pixel anchors — portrait (941×1672) / landscape (1672×941)
    const ch = p2c(...(L ? [890,  552] : [540, 1058]));
    const pk = p2c(...(L ? [818,  537] : [467, 1046]));
    const el = p2c(...(L ? [696,  649] : [340, 1185]));
    const er = p2c(...(L ? [941,  647] : [605, 1184]));
    const wl = p2c(...(L ? [761,  688] : [398, 1237]));
    const wr = p2c(...(L ? [877,  688] : [543, 1236]));
    const tl = p2c(...(L ? [219,  334] : [190,  926]));
    const tr = p2c(...(L ? [1504, 315] : [773,  949]));
    const gd = p2c(...(L ? [821,  750] : [477, 1322]));
    const po = p2c(...(L ? [568,  849] : [333, 1494]));

    this.gy        = gd.y;
    this.chx       = ch.x;
    this.chy       = ch.y;
    this.roofPeakX = pk.x;
    this.roofPeakY = pk.y;
    this.roofLX    = el.x;
    this.roofRX    = er.x;
    this.roofBaseY = (el.y + er.y) * 0.5;
    this.winW      = W * (L ? 0.052 : 0.065);
    this.winH      = H * (L ? 0.058 : 0.065);
    this.winLX     = wl.x - this.winW * 0.5;
    this.winRX     = wr.x - this.winW * 0.5;
    this.winY      = (wl.y + wr.y) * 0.5 - this.winH * 0.5;
    this.pondCx    = po.x;
    this.pondCy    = po.y;
    this.pondRx    = W * (L ? 0.120 : 0.130);
    this.pondRy    = H * (L ? 0.028 : 0.030);
    this.treeLX    = tl.x;
    this.treeLTopY = tl.y;
    this.treeRX    = tr.x;
    this.treeRTopY = tr.y;

    if (!this._ev) {
      const lf = {};
      for (const n of EV_NAMES_CABIN) lf[n] = -999;
      this._ev = { nextT: null, active: null, start: 0, dir: 1, lastFired: lf, data: {} };
    }
  }

  triggerEvent(name, t) {
    if (!EV_NAMES_CABIN.includes(name)) return;
    const ev = this._ev;
    ev.active            = name;
    ev.lastFired[name]   = t;
    ev.start             = t;
    ev.dir               = Math.random() < 0.5 ? 1 : -1;
    ev.data              = {};
    ev.nextT             = t + 12 + Math.random() * 8;
    console.info(`[cabin event] ${name}`);
  }

  update(dt, t) {
    const ev = this._ev;
    if (!ev) return;
    if (ev.nextT === null) ev.nextT = t + 5;
    if (ev.active || t < ev.nextT) return;

    const weights = EV_NAMES_CABIN.map(n => Math.min(1.0, 0.01 + (t - ev.lastFired[n]) * 0.012));
    const total   = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = EV_NAMES_CABIN[EV_NAMES_CABIN.length - 1];
    for (let i = 0; i < EV_NAMES_CABIN.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosen = EV_NAMES_CABIN[i]; break; }
    }
    ev.active            = chosen;
    ev.lastFired[chosen] = t;
    ev.start             = t;
    ev.dir               = Math.random() < 0.5 ? 1 : -1;
    ev.data              = {};
    ev.nextT             = t + 10 + Math.random() * 8;
  }

  draw(ctx, W, H, t) {
    const ev = this._ev;
    if (!ev || !ev.active) return;
    const et = t - ev.start;
    const { S, gy, chx, chy } = this;
    ctx.save();

    // ── SHOOTING STAR ──────────────────────────────────────────────────────────
    if (ev.active === 'shootingStar') {
      const dur = 1.8;
      if (et > dur) { ev.active = null; } else {
        if (!ev.data.init) {
          ev.data.init  = true;
          ev.data.x     = W * (0.08 + Math.random() * 0.55);
          ev.data.y     = H * (0.04 + Math.random() * 0.18);
          ev.data.angle = 0.38 + Math.random() * 0.32;
        }
        const p    = et / dur;
        const a    = p < 0.12 ? p / 0.12 : p > 0.70 ? 1 - (p - 0.70) / 0.30 : 1;
        const dist = p * W * 0.42;
        const tail = Math.min(dist, W * 0.22);
        const hx   = ev.data.x + Math.cos(ev.data.angle) * dist;
        const hy   = ev.data.y + Math.sin(ev.data.angle) * dist;
        const tx   = hx - Math.cos(ev.data.angle) * tail;
        const ty   = hy - Math.sin(ev.data.angle) * tail;
        ctx.globalAlpha = a;
        const gr = ctx.createLinearGradient(tx, ty, hx, hy);
        gr.addColorStop(0,    'rgba(255,255,255,0)');
        gr.addColorStop(0.38, 'rgba(255,245,170,0.50)');
        gr.addColorStop(0.78, 'rgba(180,225,255,0.85)');
        gr.addColorStop(1,    'rgba(255,255,255,1)');
        ctx.shadowBlur = 16; ctx.shadowColor = 'rgba(200,230,255,0.95)';
        ctx.strokeStyle = gr; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalAlpha = a * 0.36;
        ctx.strokeStyle = 'rgba(160,210,255,0.65)'; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalAlpha = a;
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14);
        hg.addColorStop(0, 'rgba(255,255,255,0.95)');
        hg.addColorStop(1, 'rgba(255,245,180,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, 14, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }

    // ── CHIMNEY SPARK ──────────────────────────────────────────────────────────
    } else if (ev.active === 'chimneySpark') {
      const dur = 2.2;
      if (et > dur) { ev.active = null; } else {
        if (!ev.data.init) {
          ev.data.init   = true;
          ev.data.sparks = Array.from({ length: 12 }, (_, i) => ({
            x:     rand(-S * 0.018, S * 0.018),
            y:     rand(-S * 0.015, S * 0.010),
            vx:    rand(-S * 0.045, S * 0.045),
            vy:    rand(-S * 0.34,  -S * 0.18),
            delay: i * 0.035,
            hue:   rand(28, 48),
            size:  rand(S * 0.006, S * 0.012),
          }));
        }
        ctx.globalCompositeOperation = 'screen';
        ev.data.sparks.forEach(sp => {
          const p = clamp((et - sp.delay) / (dur - sp.delay), 0, 1);
          if (p <= 0 || p >= 1) return;
          const fade = p < 0.12 ? p / 0.12 : p > 0.72 ? (1 - p) / 0.28 : 1;
          const sx   = chx + sp.x + sp.vx * p;
          const sy   = chy + sp.y + sp.vy * p + S * 0.16 * p * p;
          ctx.globalAlpha = fade * 0.88;
          ctx.fillStyle   = `hsl(${sp.hue},100%,64%)`;
          ctx.shadowBlur  = 8; ctx.shadowColor = `hsl(${sp.hue},100%,54%)`;
          ctx.beginPath(); ctx.arc(sx, sy, sp.size * (1 - p * 0.35), 0, TAU); ctx.fill();
        });
        ctx.shadowBlur = 0;
      }

    // ── SMOKE BURST ────────────────────────────────────────────────────────────
    } else if (ev.active === 'smokeBurst') {
      const dur = 5.0;
      if (et > dur) { ev.active = null; } else {
        const inten = et < 0.6 ? et / 0.6 : et > 3.5 ? (dur - et) / 1.5 : 1;
        for (let i = 0; i < 10; i++) {
          const p  = (t * 0.9 + i * 0.21) % 2.4;
          const sx = chx + Math.sin(t * 0.95 + i * 1.5) * S * 0.07;
          const sy = chy - p * S * 0.62;
          ctx.globalAlpha = (1 - p / 2.4) * 0.50 * inten;
          ctx.fillStyle   = '#c8c8c8';
          ctx.beginPath(); ctx.arc(sx, sy, S * 0.044 + p * S * 0.09, 0, TAU); ctx.fill();
        }
      }

    // ── POND CRACK ─────────────────────────────────────────────────────────────
    } else if (ev.active === 'pondCrack') {
      const dur = 2.6;
      if (et > dur) { ev.active = null; } else {
        if (!ev.data.init) {
          ev.data.init  = true;
          ev.data.x     = this.pondCx + rand(-this.pondRx * 0.35, this.pondRx * 0.35);
          ev.data.y     = this.pondCy + rand(-this.pondRy * 0.20, this.pondRy * 0.20);
          ev.data.angle = rand(-0.42, 0.42);
        }
        const p    = et / dur;
        const grow = Math.min(1, p / 0.55);
        const fade = p > 0.72 ? (1 - p) / 0.28 : 1;
        const len  = this.pondRx * 0.68 * grow;
        const { x, y, angle } = ev.data;
        const pts  = [
          [-0.50, 0.00],[-0.30,-0.10],[-0.08, 0.02],
          [ 0.10,-0.08],[ 0.30, 0.05],[ 0.50,-0.02],
        ];
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(x, y); ctx.rotate(angle);
        ctx.strokeStyle = 'rgba(245,252,255,0.92)'; ctx.lineWidth = 1.7;
        ctx.shadowBlur  = 7; ctx.shadowColor = 'rgba(200,235,255,0.85)';
        ctx.beginPath();
        pts.forEach(([px, py], i) => {
          i === 0 ? ctx.moveTo(px * len, py * this.pondRy) : ctx.lineTo(px * len, py * this.pondRy);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(45,76,102,0.55)'; ctx.lineWidth = 0.8;
        [[-0.12,-0.04,-0.20],[0.18,0.04,0.20],[0.31,0.02,-0.15]].forEach(([px, py, by]) => {
          ctx.beginPath();
          ctx.moveTo(px * len, py * this.pondRy);
          ctx.lineTo((px + by) * len, (py + 0.16) * this.pondRy);
          ctx.stroke();
        });
        ctx.restore();
      }

    // ── SNOW SLIP ──────────────────────────────────────────────────────────────
    } else if (ev.active === 'snowSlip') {
      const dur = 3.2;
      if (et > dur) { ev.active = null; } else {
        if (!ev.data.init) {
          ev.data.init = true;
          ev.data.side = Math.random() < 0.5 ? -1 : 1;
        }
        const p = et / dur, side = ev.data.side;
        const edgeX    = side < 0 ? this.roofLX : this.roofRX;
        const slideEnd = 0.58;
        const slideP   = Math.min(1, p / slideEnd);
        const clumpX   = this.roofPeakX + (edgeX - this.roofPeakX) * slideP;
        const clumpY   = this.roofPeakY + (this.roofBaseY - this.roofPeakY) * slideP;
        const fallP    = p > slideEnd ? (p - slideEnd) / (1 - slideEnd) : 0;
        const alpha    = p > 0.82 ? (1 - p) / 0.18 : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = 'rgba(236,246,252,0.96)';
        if (p <= slideEnd) {
          ctx.beginPath();
          ctx.ellipse(clumpX, clumpY, S * 0.050, S * 0.014, side * 0.50, 0, TAU);
          ctx.fill();
        }
        if (fallP > 0) {
          for (let i = 0; i < 12; i++) {
            const fp = Math.min(1, fallP + i * 0.025);
            const px = edgeX + side * S * (0.025 + i * 0.006) + Math.sin(i * 1.7) * S * 0.018;
            const py = this.roofBaseY + fp * fp * S * 0.34 + i * S * 0.004;
            ctx.globalAlpha = alpha * (1 - fp) * 0.92;
            ctx.beginPath(); ctx.arc(px, py, S * (0.010 + (i % 3) * 0.003), 0, TAU); ctx.fill();
          }
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.ellipse(edgeX + side * S * 0.095, gy - S * 0.004, S * 0.13 * fallP, S * 0.024 * fallP, 0, 0, TAU);
          ctx.fill();
        }
      }

    // ── BRANCH DROP ────────────────────────────────────────────────────────────
    } else if (ev.active === 'branchDrop') {
      const dur = 2.8;
      if (et > dur) { ev.active = null; } else {
        if (!ev.data.init) {
          ev.data.init = true;
          const useL   = Math.random() < 0.5;
          ev.data.dropX = (useL ? this.treeLX : this.treeRX) + rand(-S * 0.035, S * 0.035);
          ev.data.dropY = (useL ? this.treeLTopY : this.treeRTopY) + S * 0.12;
        }
        const p  = et / dur;
        const dx = ev.data.dropX, dy = ev.data.dropY;
        ctx.fillStyle = 'rgba(234,244,252,0.94)';
        for (let i = 0; i < 18; i++) {
          const sway = Math.sin(t * 2.2 + i * 1.9) * S * 0.012;
          const px   = dx + sway + (i - 8.5) * S * 0.0026;
          const py   = dy + p * p * (gy - dy) + i * S * 0.002;
          ctx.globalAlpha = (p > 0.82 ? (1 - p) / 0.18 : 1) * (1 - p * 0.72);
          ctx.beginPath(); ctx.arc(px, py, S * (0.007 + (i % 3) * 0.002), 0, TAU); ctx.fill();
        }
      }

    // ── WINDOW SHADOW ──────────────────────────────────────────────────────────
    } else if (ev.active === 'windowShadow') {
      const dur = 4.0;
      if (et > dur) { ev.active = null; } else {
        if (!ev.data.init) {
          ev.data.init  = true;
          ev.data.which = Math.random() < 0.5 ? 0 : 1;
          ev.data.wdir  = Math.random() < 0.5 ? -1 : 1;
        }
        const owx = ev.data.which === 0 ? this.winLX : this.winRX;
        const ww  = this.winW, wh = this.winH, wy = this.winY;
        const p      = et / dur;
        const fade   = Math.sin(p * Math.PI);
        const travel = (p - 0.5) * ww * 1.6 * ev.data.wdir;
        const sx     = owx + ww * 0.5 + travel;
        const sy     = wy + wh * 0.58;
        ctx.save();
        ctx.beginPath(); ctx.rect(owx, wy, ww, wh); ctx.clip();
        ctx.globalAlpha = fade * 0.64;
        ctx.fillStyle   = '#120804';
        ctx.beginPath(); ctx.arc(sx, sy - wh * 0.22, wh * 0.20, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx, sy + wh * 0.18, ww * 0.22, wh * 0.34, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = fade * 0.18;
        ctx.fillStyle   = '#080301';
        ctx.fillRect(owx, wy, ww, wh);
        ctx.restore();
      }

    // ── RABBIT ─────────────────────────────────────────────────────────────────
    } else if (ev.active === 'rabbit') {
      const dur = 6;
      if (et > dur) { ev.active = null; } else {
        const p      = et / dur;
        const startX = ev.dir > 0 ? -S * 0.08 : W + S * 0.08;
        const endX   = ev.dir > 0 ? W + S * 0.08 : -S * 0.08;
        const sz     = S * 0.055;
        const rx     = startX + (endX - startX) * p;
        const hop    = et * 5.5;
        const inAir  = Math.abs(Math.sin(hop)) > 0.1;
        const ry     = gy - Math.abs(Math.sin(hop)) * sz * 1.05;
        ctx.globalAlpha = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.scale(ev.dir * (inAir ? 1.0 : 1.26), inAir ? 1.0 : 0.74);
        ctx.fillStyle = '#cde0f0';
        ctx.beginPath(); ctx.ellipse(0, 0, sz*.50, sz*.34, 0.12, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sz*.38, -sz*.16, sz*.25, sz*.21, -0.18, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sz*.28, -sz*.50, sz*.07, sz*.22, -0.12, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sz*.43, -sz*.52, sz*.07, sz*.22,  0.14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a0808';
        ctx.beginPath(); ctx.arc(sz*.50, -sz*.20, sz*.055, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8f2ff';
        ctx.beginPath(); ctx.arc(-sz*.48, sz*.05, sz*.13, 0, TAU); ctx.fill();
        ctx.restore();
      }

    // ── FOX ────────────────────────────────────────────────────────────────────
    } else if (ev.active === 'fox') {
      const dur = 7.5;
      if (et > dur) { ev.active = null; } else {
        const p      = et / dur;
        const startX = ev.dir > 0 ? -S * 0.16 : W + S * 0.16;
        const endX   = ev.dir > 0 ? W + S * 0.16 : -S * 0.16;
        const fx     = startX + (endX - startX) * p;
        const fy     = gy + S * 0.095 + Math.sin(et * 4.4) * S * 0.010;
        const sz     = S * 0.092;
        const fa     = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;
        const step   = Math.sin(et * 8.0) * sz * 0.10;
        ctx.save();
        ctx.globalAlpha = fa;
        ctx.translate(fx, fy);
        if (ev.dir < 0) ctx.scale(-1, 1);
        const [coat, dark, black, cream] = ['#c96c25', '#8a3d16', '#1b0e08', '#f0efe6'];
        const back = step, fore = -step;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(-sz*.46,-sz*.31);
        ctx.bezierCurveTo(-sz*.78,-sz*.52,-sz*1.02,-sz*.44,-sz*1.10,-sz*.26);
        ctx.bezierCurveTo(-sz*.94,-sz*.18,-sz*.70,-sz*.15,-sz*.43,-sz*.21);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = cream;
        ctx.beginPath();
        ctx.moveTo(-sz*.95,-sz*.37);
        ctx.bezierCurveTo(-sz*1.06,-sz*.35,-sz*1.13,-sz*.29,-sz*1.10,-sz*.24);
        ctx.bezierCurveTo(-sz*1.00,-sz*.21,-sz*.92,-sz*.22,-sz*.84,-sz*.26);
        ctx.bezierCurveTo(-sz*.87,-sz*.32,-sz*.91,-sz*.35,-sz*.95,-sz*.37);
        ctx.fill();
        ctx.fillStyle = coat;
        ctx.beginPath();
        ctx.moveTo(-sz*.54,-sz*.26);
        ctx.bezierCurveTo(-sz*.34,-sz*.48, sz*.16,-sz*.54, sz*.43,-sz*.39);
        ctx.bezierCurveTo( sz*.58,-sz*.30, sz*.53,-sz*.15, sz*.28,-sz*.12);
        ctx.bezierCurveTo(-sz*.03,-sz*.08,-sz*.34,-sz*.10,-sz*.55,-sz*.18);
        ctx.bezierCurveTo(-sz*.62,-sz*.21,-sz*.61,-sz*.24,-sz*.54,-sz*.26);
        ctx.fill();
        ctx.fillStyle = cream;
        ctx.beginPath();
        ctx.moveTo(sz*.32,-sz*.31);
        ctx.bezierCurveTo(sz*.23,-sz*.18, sz*.03,-sz*.11,-sz*.16,-sz*.13);
        ctx.bezierCurveTo(sz*.10,-sz*.08, sz*.31,-sz*.11, sz*.41,-sz*.23);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = coat;
        ctx.beginPath();
        ctx.moveTo(sz*.38,-sz*.38);
        ctx.bezierCurveTo(sz*.52,-sz*.53, sz*.74,-sz*.51, sz*.86,-sz*.36);
        ctx.bezierCurveTo(sz*.78,-sz*.28, sz*.63,-sz*.25, sz*.44,-sz*.29);
        ctx.bezierCurveTo(sz*.36,-sz*.31, sz*.34,-sz*.35, sz*.38,-sz*.38);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sz*.50,-sz*.49); ctx.lineTo(sz*.55,-sz*.75); ctx.lineTo(sz*.68,-sz*.50); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sz*.66,-sz*.47); ctx.lineTo(sz*.77,-sz*.68); ctx.lineTo(sz*.80,-sz*.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = cream;
        ctx.beginPath();
        ctx.moveTo(sz*.65,-sz*.36);
        ctx.bezierCurveTo(sz*.76,-sz*.37, sz*.90,-sz*.31, sz*.95,-sz*.26);
        ctx.bezierCurveTo(sz*.81,-sz*.22, sz*.67,-sz*.24, sz*.56,-sz*.30);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = black;
        ctx.beginPath(); ctx.arc(sz*.92,-sz*.27, sz*.025, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(sz*.68,-sz*.38, sz*.020, 0, TAU); ctx.fill();
        ctx.strokeStyle = black; ctx.lineWidth = sz*.070; ctx.lineCap = 'round';
        [[-0.44, back*.28],[-0.31,-back*.20],[0.30,fore*.26],[0.43,-fore*.18]].forEach(([lx, sx], i) => {
          ctx.beginPath();
          ctx.moveTo(sz * lx, i < 2 ? -sz*.16 : -sz*.18);
          ctx.lineTo(sz * lx + sx, sz*.06);
          ctx.stroke();
        });
        ctx.restore();
      }

    // ── DEER ───────────────────────────────────────────────────────────────────
    } else if (ev.active === 'deer') {
      const dur = 11;
      if (et > dur) { ev.active = null; } else {
        const p       = et / dur;
        const ps      = 0.40, pe = 0.58;
        const xp      = p < ps ? p / ps * 0.5 : p < pe ? 0.5 : 0.5 + (p - pe) / (1 - pe) * 0.5;
        const sz      = S * 0.28;
        const margin  = sz * 1.5;
        const startX  = ev.dir > 0 ? -margin : W + margin;
        const endX    = ev.dir > 0 ? W + margin : -margin;
        const dx      = startX + (endX - startX) * xp;
        const pausing = p >= ps && p < pe;
        const fa      = p < 0.07 ? p / 0.07 : p > 0.93 ? (1 - p) / 0.07 : 1;

        const frameIdx = Math.floor(et * (4.6 / (Math.PI * 2)) * 4) % 4;
        const frame    = pausing ? deerSprites['pause'] : deerSprites[`walk-${frameIdx}`];
        if (frame) {
          // drawH tuned so sprite deer ≈ same apparent height as procedural deer
          const drawH  = sz * 1.2;
          const drawW  = drawH * (frame.naturalWidth / frame.naturalHeight);
          // foot anchor within sprite — tune FOOT_X/Y if positioning looks off
          const FOOT_X = 0.50, FOOT_Y = 0.92;
          const wc  = pausing ? 0 : et * 4.6;
          const bob = pausing ? 0 : Math.abs(Math.cos(wc)) * sz * 0.028;

          ctx.save();
          ctx.globalAlpha = fa;
          ctx.translate(dx, gy);
          if (ev.dir < 0) ctx.scale(-1, 1);
          ctx.translate(0, -bob);
          ctx.drawImage(frame, -drawW * FOOT_X, -drawH * FOOT_Y, drawW, drawH);

          if (pausing) {
            const bAge  = et - ps * dur;
            const bFade = Math.min(1, bAge / 0.55);
            // nose offset from foot anchor in sprite coords (pause frame, head raised)
            const noseX = drawW * 0.12;
            const noseY = -drawH * 0.79;
            const breathAngle = -0.35;
            for (let i = 0; i < 3; i++) {
              const bp = ((t * .62 + i * .42) % 1.5) * bFade;
              ctx.globalAlpha = fa * (1 - bp / 1.5) * 0.28 * bFade;
              ctx.fillStyle = '#cce4f3';
              ctx.beginPath();
              ctx.arc(
                noseX + Math.cos(breathAngle) * bp * sz * .25,
                noseY + Math.sin(breathAngle) * bp * sz * .25,
                sz * .025 + bp * sz * .050, 0, TAU
              );
              ctx.fill();
            }
          }

          ctx.restore();
        }
      }

    // ── OWL ────────────────────────────────────────────────────────────────────
    } else if (ev.active === 'owl') {
      const dur = 14;
      if (et > dur) { ev.active = null; } else {
        const p        = et / dur;
        const sz       = S * 0.070;
        const perchX   = this.treeLX + S * 0.020;
        const perchY   = this.treeLTopY + S * 0.145;
        const swoopEnd = 0.28, leaveAt = 0.70;
        const fadeIn   = Math.min(1, et / 0.55);

        const flyingOwl = (x, y, phase, dir, lift, alpha, mode) => {
          const wb   = Math.sin(phase * TAU);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(x, y);
          ctx.scale(dir, 1);
          ctx.rotate(lift);

          if (mode === 'departing') {
            const lp = Math.sin(phase * TAU * .36) * .04;
            ctx.scale(-1, 1);
            ctx.fillStyle = '#100904';
            ctx.save(); ctx.rotate(-.48 + lp);
            ctx.beginPath();
            ctx.moveTo(-sz*.06,-sz*.02);
            ctx.quadraticCurveTo(-sz*.86,-sz*.76,-sz*1.86,-sz*.58);
            ctx.quadraticCurveTo(-sz*1.62,-sz*.42,-sz*1.92,-sz*.28);
            ctx.quadraticCurveTo(-sz*1.52,-sz*.20,-sz*1.86,-sz*.04);
            ctx.quadraticCurveTo(-sz*1.42, sz*.02,-sz*1.70, sz*.18);
            ctx.quadraticCurveTo(-sz*.92,  sz*.22,-sz*.08,  sz*.16);
            ctx.closePath(); ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#120a04';
            ctx.save(); ctx.rotate(-.20 - lp * .55);
            ctx.beginPath();
            ctx.moveTo(0,-sz*.04);
            ctx.quadraticCurveTo( sz*.82,-sz*.86, sz*1.94,-sz*.76);
            ctx.quadraticCurveTo( sz*1.70,-sz*.56, sz*2.02,-sz*.44);
            ctx.quadraticCurveTo( sz*1.62,-sz*.34, sz*1.92,-sz*.17);
            ctx.quadraticCurveTo( sz*1.46,-sz*.08, sz*1.70, sz*.08);
            ctx.quadraticCurveTo( sz*.88,  sz*.18, sz*.02,  sz*.14);
            ctx.closePath(); ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#0d0703';
            ctx.beginPath();
            ctx.moveTo(sz*.34,sz*.12); ctx.lineTo(sz*.98,sz*.04); ctx.lineTo(sz*.80,sz*.20);
            ctx.lineTo(sz*1.04,sz*.34); ctx.lineTo(sz*.34,sz*.34); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#130a04';
            ctx.beginPath(); ctx.ellipse(0, sz*.20, sz*.58, sz*.34, .06, 0, TAU); ctx.fill();
            ctx.fillStyle = '#0f0803';
            ctx.beginPath(); ctx.arc(-sz*.38, -sz*.10, sz*.36, 0, TAU); ctx.fill();
            ctx.fillStyle = '#140b04';
            ctx.beginPath();
            ctx.moveTo(-sz*.58,-sz*.18);
            ctx.quadraticCurveTo(-sz*.34,-sz*.48,-sz*.10,-sz*.18);
            ctx.quadraticCurveTo(-sz*.02, sz*.10,-sz*.34, sz*.18);
            ctx.quadraticCurveTo(-sz*.66, sz*.10,-sz*.58,-sz*.18);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#0b0502';
            ctx.beginPath();
            ctx.moveTo(-sz*.35,-sz*.02); ctx.lineTo(-sz*.26,sz*.10); ctx.lineTo(-sz*.44,sz*.10);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#0b0502'; ctx.lineWidth = sz*.045; ctx.lineCap = 'round';
            [-sz*.16, sz*.03].forEach((lx, i) => {
              ctx.beginPath(); ctx.moveTo(lx, sz*.42); ctx.lineTo(lx + sz*(.06+i*.03), sz*.61); ctx.stroke();
            });
            ctx.restore(); return;
          }

          const wr = .18 + Math.max(0, -wb) * .12;
          ctx.fillStyle = '#100904';
          ctx.save(); ctx.rotate(-wr * .62);
          ctx.beginPath();
          ctx.moveTo(-sz*.12,-sz*.02);
          ctx.quadraticCurveTo(-sz*.42,-sz*.92,-sz*.94,-sz*1.38);
          ctx.quadraticCurveTo(-sz*1.14,-sz*1.08,-sz*1.00,-sz*.76);
          ctx.quadraticCurveTo(-sz*1.20,-sz*.64,-sz*1.02,-sz*.40);
          ctx.quadraticCurveTo(-sz*1.18,-sz*.24,-sz*.92,-sz*.08);
          ctx.quadraticCurveTo(-sz*.58,  sz*.08,-sz*.12, sz*.14);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.save(); ctx.rotate(wr * .62);
          ctx.beginPath();
          ctx.moveTo( sz*.12,-sz*.02);
          ctx.quadraticCurveTo( sz*.42,-sz*.92, sz*.94,-sz*1.38);
          ctx.quadraticCurveTo( sz*1.14,-sz*1.08, sz*1.00,-sz*.76);
          ctx.quadraticCurveTo( sz*1.20,-sz*.64, sz*1.02,-sz*.40);
          ctx.quadraticCurveTo( sz*1.18,-sz*.24, sz*.92,-sz*.08);
          ctx.quadraticCurveTo( sz*.58,  sz*.08, sz*.12, sz*.14);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.beginPath(); ctx.ellipse(0, sz*.22, sz*.42, sz*.58, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#0b0502';
          ctx.beginPath();
          ctx.moveTo(-sz*.25,sz*.68); ctx.lineTo(0,sz*1.04); ctx.lineTo(sz*.25,sz*.68);
          ctx.lineTo(sz*.14,sz*1.14); ctx.lineTo(0,sz*.98); ctx.lineTo(-sz*.14,sz*1.14);
          ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.arc(0, -sz*.28, sz*.32, 0, TAU); ctx.fill();
          [[-sz*.18,-1],[sz*.18,1]].forEach(([ox, side]) => {
            ctx.beginPath();
            ctx.moveTo(ox,-sz*.50); ctx.lineTo(ox+side*sz*.12,-sz*.76); ctx.lineTo(ox-side*sz*.05,-sz*.55);
            ctx.closePath(); ctx.fill();
          });
          ctx.restore();
        };

        const perchedOwl = (x, y, alpha) => {
          const ht = Math.sin(et * 1.28) * 0.36;
          ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
          ctx.fillStyle = '#160d06';
          ctx.beginPath(); ctx.ellipse(0, sz*.24, sz*.34, sz*.54, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#211307';
          ctx.beginPath(); ctx.ellipse(-sz*.20, sz*.20, sz*.14, sz*.44, -.16, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse( sz*.20, sz*.20, sz*.14, sz*.44,  .16, 0, TAU); ctx.fill();
          ctx.save(); ctx.translate(0, -sz*.18); ctx.rotate(ht);
          ctx.fillStyle = '#1a0f07';
          ctx.beginPath(); ctx.arc(0, 0, sz*.34, 0, TAU); ctx.fill();
          [[-sz*.16,-1],[sz*.16,1]].forEach(([ox, s]) => {
            ctx.beginPath();
            ctx.moveTo(ox,-sz*.25); ctx.lineTo(ox+s*sz*.12,-sz*.50); ctx.lineTo(ox-s*sz*.05,-sz*.31);
            ctx.closePath(); ctx.fill();
          });
          ctx.fillStyle = 'rgba(255,222,128,0.96)';
          [-sz*.12, sz*.12].forEach(ex => { ctx.beginPath(); ctx.arc(ex,-sz*.02,sz*.085,0,TAU); ctx.fill(); });
          ctx.fillStyle = '#090504';
          [-sz*.12, sz*.12].forEach(ex => { ctx.beginPath(); ctx.arc(ex,-sz*.02,sz*.044,0,TAU); ctx.fill(); });
          ctx.restore();
          ctx.strokeStyle = '#100904'; ctx.lineWidth = sz*.055; ctx.lineCap = 'round';
          [-sz*.10, sz*.10].forEach(fx => {
            ctx.beginPath(); ctx.moveTo(fx, sz*.75); ctx.lineTo(fx + sz*.13, sz*.84); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fx, sz*.75); ctx.lineTo(fx - sz*.13, sz*.84); ctx.stroke();
          });
          ctx.restore();
        };

        if (p < swoopEnd) {
          const q    = p / swoopEnd;
          const ease = 1 - Math.pow(1 - q, 3);
          const owlX = (perchX - S*.52) + (perchX - (perchX - S*.52)) * ease;
          const owlY = (perchY - H*.28) + (perchY - (perchY - H*.28)) * ease + Math.sin(q * Math.PI) * S*.060;
          flyingOwl(owlX, owlY, et * 1.7, 1, .34 - ease * .42, fadeIn, 'swooping');
        } else if (p < leaveAt) {
          perchedOwl(perchX, perchY, Math.min(1, (p - swoopEnd) / 0.08));
        } else {
          const q    = (p - leaveAt) / (1 - leaveAt);
          const ease = q * q * (3 - 2 * q);
          const owlX = perchX + (W - perchX + sz * 2) * ease;
          const owlY = perchY * (1-ease) + (this.roofPeakY - sz*.85 + S*.06) * ease - Math.sin(q * Math.PI) * S*.14;
          const edgeFade = owlX > W*.88 ? Math.max(0, 1 - (owlX - W*.88) / (sz * 3)) : 1;
          flyingOwl(owlX, owlY, et * 2.15, 1, -.10 - ease * .10, edgeFade, 'departing');
        }
      }
    }

    ctx.restore();
  }
}

// ─── OVERLAY REGISTRY ─────────────────────────────────────────────────────────
const OVERLAY_REGISTRY = {
  snow:            (W, H, img) => { const o = new SnowOverlay();            o.init(W, H, img); return o; },
  smoke:           (W, H, img) => { const o = new SmokeOverlay().setChimneyPx({ px: 540, py: 1058 }, { px: 890, py: 552 }); o.init(W, H, img); return o; },
  cabinEvents:     (W, H, img) => { const o = new CabinEventsOverlay();     o.init(W, H, img); return o; },
  birds:           (W, H, img) => { const o = new BirdsOverlay();           o.init(W, H, img); return o; },
  waterGlints:     (W, H, img) => { const o = new WaterGlintsOverlay();     o.init(W, H, img); return o; },
  seaMist:         (W, H, img) => { const o = new SeaMistOverlay();         o.init(W, H, img); return o; },
  bubbles:         (W, H, img) => { const o = new BubblesOverlay();         o.init(W, H, img); return o; },
  lightRays:       (W, H, img) => { const o = new LightRaysOverlay();       o.init(W, H, img); return o; },
  fishSilhouettes: (W, H, img) => { const o = new FishSilhouettesOverlay(); o.init(W, H, img); return o; },
};

// ─── UI DRAWING ───────────────────────────────────────────────────────────────
function getSab() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
}

function drawUI(ctx, W, H, sceneName, total, active) {
  const sab  = getSab();
  const serif = `Georgia, 'Times New Roman', serif`;
  ctx.save();

  // Top scrim + app title
  const topG = ctx.createLinearGradient(0, 0, 0, H * 0.18);
  topG.addColorStop(0, 'rgba(0,0,0,0.52)');
  topG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, W, H * 0.18);

  ctx.textAlign   = 'center';
  ctx.fillStyle   = 'rgba(200,218,255,0.55)';
  ctx.font        = `${Math.round(H * 0.020)}px ${serif}`;
  ctx.shadowBlur  = 10;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.fillText('M O M E N T A R I U M', W / 2, Math.max(20, sab) + H * 0.055);

  // Bottom scrim + scene name + dots
  const botG = ctx.createLinearGradient(0, H * 0.83, 0, H);
  botG.addColorStop(0, 'rgba(0,0,0,0)');
  botG.addColorStop(1, 'rgba(0,0,0,0.68)');
  ctx.fillStyle = botG;
  ctx.fillRect(0, H * 0.83, W, H * 0.17);

  const dotY   = H - Math.max(48, sab + 42);
  const nameY  = dotY - 18;
  const gap    = 14;
  const startX = W / 2 - ((total - 1) * gap) / 2;

  ctx.fillStyle  = 'rgba(190,210,255,0.55)';
  ctx.font       = `${Math.round(H * 0.015)}px ${serif}`;
  ctx.shadowBlur = 8;
  ctx.fillText(sceneName.toUpperCase(), W / 2, nameY);

  ctx.shadowBlur = 0;
  for (let i = 0; i < total; i++) {
    ctx.globalAlpha = i === active ? 0.90 : 0.28;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath(); ctx.arc(startX + i * gap, dotY, i === active ? 4 : 3, 0, TAU); ctx.fill();
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

    this.stormLevel = 0;

    this.lastTime  = null;
    this.startTime = performance.now();

    this._debugMode = location.search.includes('debug') || location.hash.includes('debug');
    this._debugDot  = null;

    this._initResize();
    this._initInput();
    this._initShake();

    Promise.all([preloadScenes(SCENES), preloadDeerSprites()]).then(() => {
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
    window.addEventListener('orientationchange', resize);
    resize();
  }

  // ── Image selection ─────────────────────────────────────────────────────────
  _sceneImage(scene) {
    if (scene.imagePortrait || scene.imageLandscape) {
      return this.W > this.H
        ? (scene.imageLandscape || scene.imagePortrait)
        : (scene.imagePortrait  || scene.imageLandscape);
    }
    return scene.image || null;
  }

  // ── Overlays ────────────────────────────────────────────────────────────────
  _buildOverlays() {
    for (const scene of SCENES) {
      this.overlays[scene.id] = {};
      const img = this._sceneImage(scene);
      for (const name of scene.overlays) {
        if (OVERLAY_REGISTRY[name]) {
          this.overlays[scene.id][name] = OVERLAY_REGISTRY[name](this.W, this.H, img);
        }
      }
    }
  }

  _reinitOverlays() {
    for (const scene of SCENES) {
      const group = this.overlays[scene.id];
      if (!group) continue;
      const img = this._sceneImage(scene);
      for (const o of Object.values(group)) {
        if (o.init) o.init(this.W, this.H, img);
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
        if (this._debugMode) this._debugMeasure(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        else this._stir();
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
        if (this._debugMode) this._debugMeasure(e.clientX, e.clientY);
        else this._stir();
      }
    });

    // Arrow keys + debug keys
    // S = shake, [ / ] = cycle event, Enter = fire selected event
    this._dbgEventIdx = 0;
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { this._go(this.activeIdx + 1); return; }
      if (e.key === 'ArrowLeft')  { this._go(this.activeIdx - 1); return; }
      if (e.key === 's' || e.key === 'S') { this.onShake(); return; }
      const scene = SCENES[this.activeIdx];
      const evOverlay = (this.overlays[scene.id] || {}).cabinEvents;
      if (!evOverlay) return;
      if (e.key === '[') {
        e.preventDefault();
        this._dbgEventIdx = ((this._dbgEventIdx - 1) + EV_NAMES_CABIN.length) % EV_NAMES_CABIN.length;
        console.info(`[cabin event] selected: ${EV_NAMES_CABIN[this._dbgEventIdx]} (${this._dbgEventIdx + 1}/${EV_NAMES_CABIN.length})`);
      } else if (e.key === ']') {
        e.preventDefault();
        this._dbgEventIdx = (this._dbgEventIdx + 1) % EV_NAMES_CABIN.length;
        console.info(`[cabin event] selected: ${EV_NAMES_CABIN[this._dbgEventIdx]} (${this._dbgEventIdx + 1}/${EV_NAMES_CABIN.length})`);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const t = (performance.now() - this.startTime) * 0.001;
        evOverlay.triggerEvent(EV_NAMES_CABIN[this._dbgEventIdx], t);
      }
    });
  }

  _stir() {
    const group = this.overlays[SCENES[this.activeIdx].id] || {};
    for (const o of Object.values(group)) {
      if (o.kick) o.kick(CFG.tapKickStrength);
      else if (o.stir) o.stir(CFG.tapKickStrength);
    }
  }

  _debugMeasure(cx, cy) {
    const scene = SCENES[this.activeIdx];
    const img   = this._sceneImage(scene);
    if (!img) { console.warn('[debug] no image for current scene'); return; }
    const { px, py } = canvasToPaint(cx, cy, img, this.W, this.H);
    this._debugDot = { x: cx, y: cy, px, py };
    console.info(
      `[debug] paintToCanvas(${px}, ${py})` +
      `  ←  canvas (${Math.round(cx)}, ${Math.round(cy)})` +
      `  img ${img.width}×${img.height}`
    );
  }

  onShake() {
    this.stormLevel = 3.0;
    const group = this.overlays[SCENES[this.activeIdx].id] || {};
    for (const o of Object.values(group)) {
      if (o.kick) o.kick(13);
    }
  }

  _decayStorm(dt) {
    if (this.stormLevel <= 0) return;
    const decay = this.stormLevel > 1.5 ? 0.998 : 0.9975;
    this.stormLevel = this.stormLevel * Math.pow(decay, dt / 16);
    if (this.stormLevel < 0.005) { this.stormLevel = 0; return; }
    const group = this.overlays[SCENES[this.activeIdx].id] || {};
    for (const o of Object.values(group)) {
      if (o.stir) o.stir(this.stormLevel * 5);
    }
  }

  _initShake() {
    let lastMag = 0, lastShakeMs = 0;
    const handle = e => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const delta = Math.abs(mag - lastMag);
      lastMag = mag;
      const now = Date.now();
      if (delta > CFG.shakeThreshold && now - lastShakeMs > 500) {
        lastShakeMs = now;
        this.onShake();
      }
    };
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      this.canvas.addEventListener('touchstart', () => {
        DeviceMotionEvent.requestPermission()
          .then(p => { if (p === 'granted') window.addEventListener('devicemotion', handle); })
          .catch(() => {});
      }, { once: true });
    } else {
      window.addEventListener('devicemotion', handle);
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
    this._decayStorm(dt);

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

    // Background image (object-fit cover, orientation-aware)
    const bg = this._sceneImage(scene);
    if (bg) {
      drawImageCover(ctx, bg, W, H);
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
    drawUI(ctx, W, H, scene.name, SCENES.length, this.activeIdx);

    // Debug overlay — active when ?debug is in the URL
    if (this._debugMode) {
      ctx.save();
      ctx.font        = '11px monospace';
      ctx.fillStyle   = 'rgba(255,200,60,0.85)';
      ctx.shadowBlur  = 6;
      ctx.shadowColor = '#000';
      ctx.fillText('DEBUG — click to measure paint coords', 8, H - 8);
      if (this._debugDot) {
        const d = this._debugDot;
        ctx.strokeStyle = 'rgba(255,60,60,0.95)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(d.x - 22, d.y); ctx.lineTo(d.x + 22, d.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 22); ctx.lineTo(d.x, d.y + 22); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,60,60,0.95)';
        ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, TAU); ctx.fill();
        ctx.fillStyle   = 'rgba(255,255,100,0.95)';
        ctx.fillText(`(${d.px}, ${d.py})`, d.x + 8, d.y - 8);
      }
      ctx.restore();
    }

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

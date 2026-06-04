'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TAU   = Math.PI * 2;
const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CFG = {
  transitionMs:    400,
  swipeThreshold:  45,
  tapKickStrength: 6,
  shakeThreshold:  8,
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
    overlays:   ['stars', 'auroraShimmer', 'windowGlow', 'snow', 'smoke', 'cabinEvents'],
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
  {
    id:   'tech-ruin',
    name: 'Tech Ruin',
    background: {
      portrait:  'assets/scenes/tech-ruin/background-portrait.png',
      landscape: 'assets/scenes/tech-ruin/background-landscape.png',
    },
    overlays: ['techRuin'],
  },
  {
    id:   'space-church',
    name: 'Space Church',
    background: {
      portrait:  'assets/scenes/space-church/background-portrait.png',
      landscape: 'assets/scenes/space-church/background-landscape.png',
    },
    overlays: ['spaceChurch'],
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
const DEER_WALK_FRAMES = 11;
async function preloadDeerSprites() {
  const base  = 'assets/scenes/tiny-cabin/deer/';
  const names = Array.from({ length: DEER_WALK_FRAMES }, (_, i) => `walk-${i}`);
  names.push('pause');
  await Promise.all(names.map(async n => {
    deerSprites[n] = await loadImage(`${base}${n}.png`);
  }));
}

const owlSprites = {};
async function preloadOwlSprites() {
  owlSprites['swoop'] = await loadImage('assets/scenes/tiny-cabin/owl/swoop.png');
}

const rabbitSprites = {};
async function preloadRabbitSprites() {
  await Promise.all(
    ['hop', 'still'].map(async n => {
      rabbitSprites[n] = await loadImage(`assets/scenes/tiny-cabin/rabbit/${n}.png`);
    })
  );
}

let windowShadowImg = null;
async function preloadWindowShadow() {
  windowShadowImg = await loadImage('assets/scenes/tiny-cabin/window-shadow.png');
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

// ─── TECH RUIN — EVENT NAMES (for keyboard debug) ────────────────────────────
const EV_NAMES_TECH_RUIN = [
  'server_glitch', 'glow_surge', 'cable_spark', 'power_arc',
  'data_drift', 'monitor_static', 'screen_message', 'scanner_sweep',
  'spore_cloud', 'eyes_appear', 'firefly_surge', 'bird_fly',
  'leaf_gust', 'falling_leaf', 'rain_drips', 'creature_scurry',
  'sunbeam_shift', 'night_shift',
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

    this.gy        = gd.y + this.S * 0.08;
    this.doorY     = gd.y;
    this.chx       = ch.x;
    this.chy       = ch.y;
    this.roofPeakX = pk.x;
    this.roofPeakY = pk.y;
    this.roofLX    = el.x;
    this.roofRX    = er.x;
    this.roofBaseY = (el.y + er.y) * 0.5;
    this.winW      = W * (L ? 0.026 : 0.033);
    this.winH      = H * (L ? 0.030 : 0.032);
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
        if (!ev.data.init) {
          ev.data.init  = true;
          ev.data.puffs = Array.from({ length: 12 }, (_, i) => ({
            phase:  i / 12,
            vx:     rand(-2, 3),
            warm:   rand(0.3, 0.9),
            wobble: rand(0, TAU),
          }));
        }
        const inten = et < 0.6 ? et / 0.6 : et > 3.5 ? (dur - et) / 1.5 : 1;
        for (const pf of ev.data.puffs) {
          const cycleDur = 2.4;
          const age  = (et * 0.9 + pf.phase * cycleDur) % cycleDur;
          const prog = age / cycleDur;
          let fade;
          if (prog < 0.12)      fade = prog / 0.12;
          else if (prog < 0.58) fade = 1;
          else                  fade = 1 - (prog - 0.58) / 0.42;
          const alpha = 0.50 * fade * fade * inten;
          if (alpha < 0.003) continue;
          const sx = chx + Math.sin(t * 0.95 + pf.wobble) * S * 0.07 + pf.vx * prog * 0.5;
          const sy = chy - prog * S * 0.62;
          const sz = S * 0.044 + prog * S * 0.09;
          // dark charcoal — slightly warm near chimney, cooling to near-black as it rises
          const w  = pf.warm * Math.max(0, 1 - prog * 0.75);
          const pr = Math.round(32 + w * 14);
          const pg = Math.round(26 + w * 10);
          const pb = Math.round(22 + w *  6);
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sz);
          grad.addColorStop(0,    `rgba(${pr},${pg},${pb},${Math.min(0.999, alpha * 1.7).toFixed(3)})`);
          grad.addColorStop(0.45, `rgba(${pr},${pg},${pb},${alpha.toFixed(3)})`);
          grad.addColorStop(1,    `rgba(${pr},${pg},${pb},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(sx, sy, sz, 0, TAU); ctx.fill();
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
        // sliding clump — slightly muted, cool blue-white like painted snow
        ctx.fillStyle = 'rgba(208,228,242,0.80)';
        if (p <= slideEnd) {
          ctx.beginPath();
          ctx.ellipse(clumpX, clumpY, S * 0.050, S * 0.014, side * 0.50, 0, TAU);
          ctx.fill();
        }
        if (fallP > 0) {
          for (let i = 0; i < 12; i++) {
            const fp = Math.min(1, fallP + i * 0.025);
            const px = edgeX + side * S * (0.025 + i * 0.006) + Math.sin(i * 1.7) * S * 0.018;
            const py = this.roofBaseY + fp * fp * (this.doorY - this.roofBaseY) + i * S * 0.004;
            // vary warmth per particle — some cool blue, some slightly warm cream
            const warm = (i % 3) * 10;
            ctx.fillStyle = `rgba(${205 + warm},${226},${242 - warm * 0.5},${0.65 + (i % 2) * 0.12})`;
            ctx.globalAlpha = alpha * (1 - fp) * 0.88;
            ctx.beginPath(); ctx.arc(px, py, S * (0.010 + (i % 3) * 0.003), 0, TAU); ctx.fill();
          }
          const splatP = Math.max(0, (fallP - 0.82) / 0.18);
          const ry = S * 0.024 * splatP;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.ellipse(edgeX + side * S * 0.095, this.doorY - ry, S * 0.13 * splatP, ry, 0, 0, TAU);
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
        for (let i = 0; i < 18; i++) {
          const sway = Math.sin(t * 2.2 + i * 1.9) * S * 0.012;
          const px   = dx + sway + (i - 8.5) * S * 0.0026;
          const py   = dy + p * p * (gy - dy) + i * S * 0.002;
          const warm = (i % 3) * 9;
          ctx.fillStyle   = `rgba(${204 + warm},${225},${240 - warm * 0.4},${0.62 + (i % 2) * 0.14})`;
          ctx.globalAlpha = (p > 0.82 ? (1 - p) / 0.18 : 1) * (1 - p * 0.72);
          ctx.beginPath(); ctx.arc(px, py, S * (0.007 + (i % 3) * 0.002), 0, TAU); ctx.fill();
        }
      }

    // ── WINDOW SHADOW ──────────────────────────────────────────────────────────
    } else if (ev.active === 'windowShadow') {
      const dur = 5.0;
      if (et > dur) { ev.active = null; } else {
        if (!ev.data.init) {
          ev.data.init  = true;
          ev.data.which = Math.random() < 0.5 ? 0 : 1;
        }
        const owx = ev.data.which === 0 ? this.winLX : this.winRX;
        const ww  = this.winW, wh = this.winH, wy = this.winY;
        const p    = et / dur;
        const fade = Math.sin(p * Math.PI);
        if (windowShadowImg && fade >= 0.005) {
          // scale up in landscape so the figure is as prominent as in portrait
          const L     = W > H;
          const scale = L ? 1.3 : 1.5;
          const ir    = windowShadowImg.width / windowShadowImg.height;
          const wr    = ww / wh;
          let dw, dh;
          if (ir > wr) { dw = ww * scale; dh = dw / ir; }
          else         { dh = wh * scale; dw = dh * ir; }
          const dx = owx + (ww - dw) * 0.5;
          // bottom-anchored, with extra downward push in landscape
          const dy = wy + wh - dh + (L ? wh * 0.25 : 0);
          ctx.save();
          ctx.beginPath(); ctx.rect(owx, wy, ww, wh); ctx.clip();
          // multiply makes white pixels transparent, black pixels stay black
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = fade * 0.55;
          ctx.drawImage(windowShadowImg, dx, dy, dw, dh);
          ctx.restore();
        }
      }

    // ── RABBIT ─────────────────────────────────────────────────────────────────
    } else if (ev.active === 'rabbit') {
      const dur = 9;
      if (et > dur) { ev.active = null; } else {
        const p         = et / dur;
        const startX    = ev.dir > 0 ? -S * 0.08 : W + S * 0.08;
        const endX      = ev.dir > 0 ? W + S * 0.08 : -S * 0.08;
        const sz        = S * 0.055;
        const hopPeriod = 0.75;
        const airFrac   = 0.58;
        const tc        = (et % hopPeriod) / hopPeriod;
        const inAir     = tc < airFrac;
        const airElapsed = Math.floor(et / hopPeriod) * airFrac * hopPeriod
                         + Math.min(et % hopPeriod, airFrac * hopPeriod);
        const rx     = startX + (endX - startX) * Math.min(1, airElapsed / (dur * airFrac));
        const ry     = gy - (inAir ? Math.sin((tc / airFrac) * Math.PI) * sz * 1.05 : 0);
        const fa     = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;
        const frame  = rabbitSprites[inAir ? 'hop' : 'still'];
        if (frame) {
          const drawH = sz * 1.2;
          const drawW = drawH * (frame.naturalWidth / frame.naturalHeight);
          ctx.save();
          ctx.globalAlpha = fa;
          ctx.translate(rx, ry);
          if (ev.dir > 0) ctx.scale(-1, 1);
          ctx.drawImage(frame, -drawW * 0.5, inAir ? -drawH * 0.5 : -drawH * 0.9, drawW, drawH);
          ctx.restore();
        }
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
      const dur = 20;
      if (et > dur) { ev.active = null; } else {
        const p       = et / dur;
        const ps      = 0.40, pe = 0.58;
        const xp      = p < ps ? p / ps * 0.5 : p < pe ? 0.5 : 0.5 + (p - pe) / (1 - pe) * 0.5;
        const sz      = S * (W > H ? 0.14 : 0.28);
        const margin  = sz * 1.5;
        const startX  = ev.dir > 0 ? -margin : W + margin;
        const endX    = ev.dir > 0 ? W + margin : -margin;
        const dx      = startX + (endX - startX) * xp;
        const pausing = p >= ps && p < pe;
        const fa      = p < 0.07 ? p / 0.07 : p > 0.93 ? (1 - p) / 0.07 : 1;

        const walkTime = pausing ? ps * dur : et;
        const frameIdx = Math.floor(walkTime * (4.6 / (Math.PI * 2)) * DEER_WALK_FRAMES) % DEER_WALK_FRAMES;
        const frame    = pausing ? (deerSprites['pause'] || deerSprites['walk-0'])
                                 : deerSprites[`walk-${frameIdx}`];
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
            // nose offset from foot anchor in sprite coords
            const noseX = drawW * 0.38;
            const noseY = -drawH * 0.55;
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
          const frame = owlSprites['swoop'];
          if (frame) {
            const drawH = sz * 2.3;
            const drawW = drawH * (frame.naturalWidth / frame.naturalHeight);
            ctx.save();
            ctx.globalAlpha = edgeFade;
            ctx.translate(owlX, owlY);
            ctx.rotate(-.10 - ease * .10);
            ctx.drawImage(frame, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
            ctx.restore();
          } else {
            flyingOwl(owlX, owlY, et * 2.15, 1, -.10 - ease * .10, edgeFade, 'departing');
          }
        }
      }
    }

    ctx.restore();
  }
}

// ─── TINY CABIN — AURORA SHIMMER ─────────────────────────────────────────────
class AuroraShimmerOverlay {
  constructor() {
    this.bands   = null;
    this._skyBot = 0;
  }

  init(W, H, img) {
    this.W = W; this.H = H;
    const L = W > H;
    if (img) {
      const pk = paintToCanvas(L ? 818 : 467, L ? 537 : 1046, img, W, H);
      this._skyBot = pk.y * 0.90;
    } else {
      this._skyBot = H * (L ? 0.50 : 0.60);
    }
    if (!this.bands) {
      this.bands = [
        { rgb: [  0, 230, 120], yFrac: 0.10, hFrac: rand(0.14, 0.20), freq: rand(0.004, 0.010), ampFrac: rand(0.04, 0.08), phase: rand(0, TAU), drift: rand(-0.12, 0.12), alpha: rand(0.07, 0.11), pulse: rand(0.20, 0.50), pulsePhase: rand(0, TAU) },
        { rgb: [  0, 210, 160], yFrac: 0.24, hFrac: rand(0.15, 0.22), freq: rand(0.005, 0.012), ampFrac: rand(0.05, 0.09), phase: rand(0, TAU), drift: rand(-0.10, 0.10), alpha: rand(0.06, 0.10), pulse: rand(0.18, 0.45), pulsePhase: rand(0, TAU) },
        { rgb: [  0, 190, 215], yFrac: 0.38, hFrac: rand(0.16, 0.24), freq: rand(0.005, 0.011), ampFrac: rand(0.04, 0.08), phase: rand(0, TAU), drift: rand(-0.14, 0.14), alpha: rand(0.06, 0.09), pulse: rand(0.22, 0.55), pulsePhase: rand(0, TAU) },
        { rgb: [ 60, 190, 255], yFrac: 0.52, hFrac: rand(0.13, 0.20), freq: rand(0.004, 0.009), ampFrac: rand(0.03, 0.07), phase: rand(0, TAU), drift: rand(-0.08, 0.08), alpha: rand(0.05, 0.08), pulse: rand(0.25, 0.60), pulsePhase: rand(0, TAU) },
        { rgb: [170,  90, 255], yFrac: 0.64, hFrac: rand(0.12, 0.18), freq: rand(0.006, 0.013), ampFrac: rand(0.03, 0.06), phase: rand(0, TAU), drift: rand(-0.11, 0.11), alpha: rand(0.04, 0.07), pulse: rand(0.28, 0.65), pulsePhase: rand(0, TAU) },
      ];
    }
  }

  draw(ctx, W, H, t) {
    if (!this.bands) return;
    const sb = this._skyBot;
    if (sb <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const N = 40;
    for (const b of this.bands) {
      const pulse = 0.50 + 0.50 * Math.sin(t * b.pulse + b.pulsePhase);
      const alpha = b.alpha * pulse;
      if (alpha < 0.005) continue;

      const by    = b.yFrac * sb;
      const bh    = b.hFrac * sb;
      const amp   = b.ampFrac * sb;
      const phase = b.phase + t * b.drift;

      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W;
        const y = by + Math.sin(x * b.freq + phase) * amp;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let i = N; i >= 0; i--) {
        const x = (i / N) * W;
        const y = by + bh + Math.sin(x * b.freq + phase + 1.2) * amp * 0.65;
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      const [r, g, bl] = b.rgb;
      const grad = ctx.createLinearGradient(0, by - amp, 0, by + bh + amp);
      grad.addColorStop(0,    `rgba(${r},${g},${bl},0)`);
      grad.addColorStop(0.28, `rgba(${r},${g},${bl},${alpha.toFixed(3)})`);
      grad.addColorStop(0.72, `rgba(${r},${g},${bl},${alpha.toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }
}

// ─── TINY CABIN — WINDOW GLOW ────────────────────────────────────────────────
class WindowGlowOverlay {
  constructor() {
    this._phase = rand(0, TAU);
  }

  init(W, H, img) {
    this.W = W; this.H = H;
    const L = W > H;
    if (!img) return;
    const p2c = (px, py) => paintToCanvas(px, py, img, W, H);
    const wl = p2c(...(L ? [761, 688] : [398, 1237]));
    const wr = p2c(...(L ? [877, 688] : [543, 1236]));
    this._winW  = W * (L ? 0.052 : 0.065);
    this._winH  = H * (L ? 0.058 : 0.065);
    this._winLX = wl.x;
    this._winRX = wr.x;
    this._winCY = (wl.y + wr.y) * 0.5;
  }

  draw(ctx, W, H, t) {
    if (!this._winLX) return;
    // Four-frequency candle flicker — incommensurate frequencies produce irregular beat
    const flicker = ph =>
        0.55
      + 0.20 * Math.sin(t * 0.38  + ph)
      + 0.15 * Math.sin(t * 2.30  + ph * 1.4)
      + 0.09 * Math.sin(t * 6.10  + ph * 2.3)
      + 0.06 * Math.sin(t * 13.70 + ph * 4.1);
    const { _winLX: lx, _winRX: rx, _winCY: cy, _winW: ww, _winH: wh } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Each window gets its own phase so they flicker independently
    for (const [cx, ph] of [[lx, this._phase], [rx, this._phase + 2.1]]) {
      const pulse = flicker(ph);
      // Amber radial halo centered on each window
      const glowR = ww * 2.6;
      const ga    = 0.13 * pulse;
      const halo  = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      halo.addColorStop(0,    `rgba(255,195, 75,${(ga * 1.9).toFixed(3)})`);
      halo.addColorStop(0.30, `rgba(255,165, 45,${ga.toFixed(3)})`);
      halo.addColorStop(0.65, `rgba(220,115, 18,${(ga * 0.32).toFixed(3)})`);
      halo.addColorStop(1,    'rgba(200,80,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, TAU); ctx.fill();

      // Warm cone of light spilling down onto the snow below the window
      const spillTop  = cy + wh * 0.5;
      const spillLen  = wh * 3.8 * pulse;
      const spillBot  = spillTop + spillLen;
      const spreadTop = ww * 0.38;
      const spreadBot = ww * 1.9 * pulse;
      const sa        = 0.048 * pulse;
      const spill = ctx.createLinearGradient(cx, spillTop, cx, spillBot);
      spill.addColorStop(0, `rgba(255,175,55,${sa.toFixed(3)})`);
      spill.addColorStop(1, 'rgba(255,130,20,0)');
      ctx.fillStyle = spill;
      ctx.beginPath();
      ctx.moveTo(cx - spreadTop, spillTop);
      ctx.lineTo(cx + spreadTop, spillTop);
      ctx.lineTo(cx + spreadBot, spillBot);
      ctx.lineTo(cx - spreadBot, spillBot);
      ctx.closePath(); ctx.fill();
    }

    ctx.restore();
  }
}

// ─── TINY CABIN — STARS TWINKLE ──────────────────────────────────────────────
class StarsTwinkleOverlay {
  constructor() { this.stars = null; this._skyBot = 0; }

  init(W, H, img) {
    this.W = W; this.H = H;
    const L = W > H;
    if (img) {
      // Anchor to the highest tree top — that's the true sky/silhouette boundary
      // Portrait: left tree top (190, 926); Landscape: right tree top (1504, 315)
      const tt = paintToCanvas(L ? 1504 : 190, L ? 315 : 926, img, W, H);
      this._skyBot = tt.y * 0.96;
    } else {
      this._skyBot = H * (L ? 0.36 : 0.50);
    }
    if (!this.stars) {
      // Seed once — normalized coords so stars scale with viewport across orientations
      this.stars = [
        // 5 prominent "focal" stars
        ...Array.from({ length: 5 }, () => ({
          nx: Math.random(), ny: Math.random() * 0.82,
          r: rand(1.8, 3.0), f1: rand(0.20, 0.58), f2: rand(1.20, 2.60),
          ph1: rand(0, TAU), ph2: rand(0, TAU), base: rand(0.65, 0.90),
          rgb: Math.random() < 0.30 ? [212, 228, 255] : [255, 253, 242],
        })),
        // 50 background stars
        ...Array.from({ length: 50 }, () => ({
          nx: Math.random(), ny: Math.random() * 0.97,
          r: rand(0.5, 1.6), f1: rand(0.28, 1.10), f2: rand(1.60, 4.00),
          ph1: rand(0, TAU), ph2: rand(0, TAU), base: rand(0.30, 0.75),
          rgb: Math.random() < 0.18 ? [200, 220, 255]
             : Math.random() < 0.10 ? [255, 228, 168]
             : [255, 253, 242],
        })),
      ];
    }
  }

  update(dt, t) {}

  draw(ctx, W, H, t) {
    if (!this.stars) return;
    const sb = this._skyBot;
    if (sb <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const s of this.stars) {
      const sx = s.nx * W;
      const sy = s.ny * sb;

      // Two incommensurate frequencies for organic, non-periodic twinkle
      const tw = 0.50 + 0.30 * Math.sin(t * s.f1 + s.ph1)
                      + 0.20 * Math.sin(t * s.f2 + s.ph2);
      const brightness = clamp(s.base * tw, 0, 1);
      if (brightness < 0.02) continue;

      const [r, g, b] = s.rgb;

      // Soft glow corona
      const glowR = s.r * 4.5;
      const ga    = brightness * 0.38;
      const glow  = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      glow.addColorStop(0,    `rgba(${r},${g},${b},${Math.min(0.999, ga * 1.7).toFixed(3)})`);
      glow.addColorStop(0.40, `rgba(${r},${g},${b},${ga.toFixed(3)})`);
      glow.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, TAU); ctx.fill();

      // Sharp center point
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.999, brightness * 0.85).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, TAU); ctx.fill();
    }

    ctx.restore();
  }
}

// ─── TECH-RUIN SCENE ──────────────────────────────────────────────────────────

const techRuinLeafImgs = [];
async function preloadTechRuinSprites() {
  for (let i = 1; i <= 10; i++) {
    techRuinLeafImgs.push(await loadImage(
      `assets/scenes/tech-ruin/sprites/leaf_${String(i).padStart(2, '0')}.png`
    ));
  }
}

// Measure with ?debug mode on the new background — all null until then.
// Portrait (941×1672) and landscape (1672×941) are different compositions; measure each separately.
const TR_ANCHORS = {
  portrait: {
    serverCenter:    [354, 762],
    serverRight:     [614, 727],
    laptopScreen:    [578, 813],
    darkCavity:      [475, 890],
    mushroomClumps:  [[742, 1249], [228, 1386], [319, 1222], [213, 1263]],
    waterfallTL:     [164, 428],
    waterfallTR:     [181, 427],
    waterfallBL:     [170, 642],
    waterfallBR2:    [200, 646],
    waterfallBotL:   [170, 642],
    waterfallBotL2:  [172, 643],
    waterfallBushTL: null,
    waterfallBushTR: null,
    waterfallBotR:   [200, 646],
  },
  landscape: {
    serverCenter:    [545, 460],
    serverRight:     [956, 445],
    laptopScreen:    [910, 524],
    darkCavity:      [779, 619],
    mushroomClumps:  [[432,609],[474,656],[590,650],[685,554],[567,735],[623,729],[618,774],[644,760],[1090,735],[1103,724],[1126,731],[1115,705],[1102,688],[1515,627],[1500,660],[1471,672],[1473,691],[1350,817],[1349,865],[1519,799],[277,776],[341,828],[321,875],[585,855]],
    waterfallTL:     [266, 187],
    waterfallTR:     [313, 199],
    waterfallBL:     [280, 388],
    waterfallBR2:    [349, 414],
    waterfallBotL:   [296, 404],
    waterfallBotL2:  [310, 406],
    waterfallBushTL: [309, 390],
    waterfallBushTR: [325, 391],
    waterfallBotR:   [331, 409],
  },
};

class TechRuinOverlay {
  // ── Helpers ────────────────────────────────────────────────────────────────
  _s() {
    if (!this.img) return 1;
    const { sw } = _coverParams(this.img, this.W, this.H);
    return this.W / sw;
  }
  _ptc(px, py) { return paintToCanvas(px, py, this.img, this.W, this.H); }
  _anchors() { return this.W > this.H ? TR_ANCHORS.landscape : TR_ANCHORS.portrait; }

  // ── Init ───────────────────────────────────────────────────────────────────
  init(W, H, img) {
    this.W = W; this.H = H; this.img = img;
    this._initSpores();
    this._initFireflies();
    this._initRainAmb();
    this._initWaterfallArrays();
    this._rainStir = 0; this._t = 0;
    this._glitchTimer = 0; this._glitchMul = 1;
    this._glowSurgeT0 = -Infinity;
    this._surgeT0 = -Infinity; this._surgeFF = [];
    this._birds = [];
    this._sparks = [];
    this._dataDrift = { t0: -Infinity, pts: [] };
    this._leafGust  = { t0: -Infinity, leaves: [], dir: 1 };
    this._fallingLeaf = { t0: -Infinity, imgIdx: 0, startX: 0.5, sz: 64, rotS: 0, rotE: 0 };
    this._sunbeam = { t0: -Infinity, startNX: 0.42, endNX: 0.55, angle0: 0.10 };
    this._night   = { t0: -Infinity };
    this._creature = { t0: -Infinity, dir: 1, gFrac: 0.82 };
    this._sporeCloud = { t0: -Infinity, pts: [] };
    this._eyes = { t0: -Infinity, blink: false, blinkT: 0 };
    this._powerArc = { t0: -Infinity };
    this._monStat = { t0: -Infinity };
    this._monMsg  = { t0: -Infinity, msg: '' };
    this._monScan = { t0: -Infinity };
    this._initEventTimers();
  }

  triggerEvent(name, t) {
    if (!EV_NAMES_TECH_RUIN.includes(name)) return;
    this._fireEvent(name, t);
  }

  stir(s) { this._rainStir = s; }

  _def(min, max) { return { min, max, next: min * (0.4 + Math.random() * 0.8) }; }
  _initEventTimers() {
    this._ev = {
      server_glitch:   this._def(20, 45),
      firefly_surge:   this._def(60, 120),
      bird_fly:        this._def(30, 65),
      glow_surge:      this._def(22, 50),
      cable_spark:     this._def(12, 28),
      data_drift:      this._def(20, 42),
      leaf_gust:       this._def(20, 45),
      rain_drips:      this._def(32, 68),
      monitor_static:  this._def(20, 42),
      screen_message:  this._def(25, 55),
      scanner_sweep:   this._def(22, 48),
      spore_cloud:     this._def(25, 55),
      eyes_appear:     this._def(35, 75),
      creature_scurry: this._def(28, 58),
      falling_leaf:    this._def(18, 40),
      sunbeam_shift:   this._def(30, 65),
      night_shift:     this._def(120, 240),
      power_arc:       this._def(30, 68),
    };
  }

  _fireEvent(name, t) {
    const tm = this._ev[name];
    if (tm) tm.next = t + tm.min + Math.random() * (tm.max - tm.min);
    switch (name) {
      case 'server_glitch':   this._glitchTimer = 3.2; break;
      case 'firefly_surge':   this._triggerFFSurge(t); break;
      case 'bird_fly':        this._triggerBird(t); break;
      case 'glow_surge':      this._glowSurgeT0 = t; break;
      case 'cable_spark':     this._triggerSpark(t); break;
      case 'data_drift':      this._triggerDataDrift(t); break;
      case 'leaf_gust':       this._triggerLeafGust(t); break;
      case 'rain_drips':      this._triggerHeavyRain(t); break;
      case 'monitor_static':  if (this._anchors().laptopScreen) this._monStat.t0 = t; break;
      case 'screen_message':  this._triggerMonMsg(t); break;
      case 'scanner_sweep':   if (this._anchors().laptopScreen) this._monScan.t0 = t; break;
      case 'spore_cloud':     this._triggerSporeCloud(t); break;
      case 'eyes_appear':     if (this._anchors().darkCavity) { this._eyes.t0 = t; this._eyes.blink = false; } break;
      case 'creature_scurry': this._triggerCreature(t); break;
      case 'falling_leaf':    this._triggerFallingLeaf(t); break;
      case 'sunbeam_shift':   this._triggerSunbeam(t); break;
      case 'night_shift':     this._night.t0 = t; break;
      case 'power_arc':       this._triggerPowerArc(t); break;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(dt, t) {
    this._t = t;
    for (const [name, tm] of Object.entries(this._ev)) {
      if (t >= tm.next) this._fireEvent(name, t);
    }
    if (this._glitchTimer > 0) {
      this._glitchTimer -= dt / 1000;
      this._glitchMul = Math.random() < 0.28 ? 0.04 + Math.random() * 0.12 : 0.55 + Math.random() * 0.45;
      if (this._glitchTimer <= 0) { this._glitchTimer = 0; this._glitchMul = 1; }
    }
    this._updateSpores(dt, t);
    this._updateFireflies(dt, t);
    this._updateRainAmb(dt, t);
    this._updateLeafGust(dt, t);
    this._updateDataDrift(dt, t);
    this._updateSporeCloud(dt, t);
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  draw(ctx, W, H, t) {
    this.W = W; this.H = H;
    this._drawNightShift(ctx, W, H, t);
    this._drawGodRays(ctx, W, H, t);
    this._drawSunbeam(ctx, W, H, t);
    this._drawServerGlow(ctx, W, H, t);
    this._drawWaterfall(ctx, W, H, t);
    this._drawFogPatches(ctx, W, H, t);
    this._drawCableSpark(ctx, W, H, t);
    this._drawPowerArc(ctx, W, H, t);
    this._drawDataDrift(ctx, W, H, t);
    this._drawSpores(ctx, W, H, t);
    this._drawSporeCloud(ctx, W, H, t);
    this._drawFireflies(ctx, W, H, t);
    this._drawMonitorEvents(ctx, W, H, t);
    this._drawEyesAppear(ctx, W, H, t);
    this._drawBird(ctx, W, H, t);
    this._drawLeafGust(ctx, W, H, t);
    this._drawFallingLeaf(ctx, W, H, t);
    this._drawCreature(ctx, W, H, t);
    this._drawRainDrips(ctx, W, H, t);
  }

  // ── Night Shift ────────────────────────────────────────────────────────────
  _drawNightShift(ctx, W, H, t) {
    const age = t - this._night.t0;
    if (age < 0) return;
    const DUR = 32, FADE_IN = 8, HOLD = 14, FADE_OUT = 10;
    if (age >= DUR) return;
    let opacity;
    if (age < FADE_IN)            opacity = (age / FADE_IN) * 0.62;
    else if (age < FADE_IN + HOLD) opacity = 0.62;
    else                           opacity = (1 - (age - FADE_IN - HOLD) / FADE_OUT) * 0.62;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, opacity).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  _nightMul(t) {
    const age = t - this._night.t0;
    if (age < 0 || age >= 32) return 1.0;
    const FADE_IN = 8, HOLD = 14, FADE_OUT = 10;
    let frac;
    if (age < FADE_IN)             frac = age / FADE_IN;
    else if (age < FADE_IN + HOLD) frac = 1.0;
    else                           frac = 1 - (age - FADE_IN - HOLD) / FADE_OUT;
    return 1.0 - frac * 0.80;
  }

  // ── God Rays ───────────────────────────────────────────────────────────────
  _drawGodRays(ctx, W, H, t) {
    const shafts = [
      { nx: 0.36, angle:  0.12, phase: 0.00 },
      { nx: 0.48, angle:  0.02, phase: 1.40 },
      { nx: 0.56, angle: -0.06, phase: 2.70 },
      { nx: 0.42, angle:  0.20, phase: 0.75 },
      { nx: 0.53, angle: -0.15, phase: 4.10 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const sh of shafts) {
      const ox  = sh.nx * W, oy = H * 0.01;
      const len = H * 1.28;
      const rw  = W * (0.055 + 0.025 * Math.sin(t * 0.38 + sh.phase));
      const pulse = 0.56 + 0.26 * Math.sin(t * 0.26  + sh.phase)
                         + 0.12 * Math.sin(t * 0.88  + sh.phase * 1.6)
                         + 0.06 * Math.sin(t * 2.10  + sh.phase * 2.4);
      const ex = ox + Math.sin(sh.angle) * len, ey = oy + Math.cos(sh.angle) * len;
      const perp = sh.angle + Math.PI / 2;
      const phx = Math.cos(perp) * rw * 0.5, phy = Math.sin(perp) * rw * 0.5;
      const grad = ctx.createLinearGradient(ox, oy, ex, ey);
      const a0 = 0.050 * pulse, a1 = 0.017 * pulse;
      grad.addColorStop(0,    `rgba(255,238,165,${a0.toFixed(3)})`);
      grad.addColorStop(0.38, `rgba(255,222,125,${a1.toFixed(3)})`);
      grad.addColorStop(1,    'rgba(230,200,85,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(ox - phx * 0.12, oy - phy * 0.12);
      ctx.lineTo(ox + phx * 0.12, oy + phy * 0.12);
      ctx.lineTo(ex + phx, ey + phy);
      ctx.lineTo(ex - phx, ey - phy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Sunbeam Shift ──────────────────────────────────────────────────────────
  _triggerSunbeam(t) {
    this._sunbeam.t0     = t;
    this._sunbeam.startNX = rand(0.22, 0.58);
    this._sunbeam.endNX   = this._sunbeam.startNX + rand(-0.16, 0.16);
    this._sunbeam.angle0  = rand(-0.04, 0.22);
  }

  _drawSunbeam(ctx, W, H, t) {
    const { t0, startNX, endNX, angle0 } = this._sunbeam;
    const DUR = 13;
    const age = t - t0;
    if (age < 0 || age >= DUR) return;
    const p   = age / DUR;
    const env = Math.min(p / 0.20, 1) * Math.min(1, (1 - p) / 0.25);
    if (env < 0.01) return;
    const nx    = startNX + (endNX - startNX) * p;
    const ox    = nx * W, oy = 0;
    const len   = H * 1.34;
    const angle = angle0 + Math.sin(p * Math.PI) * 0.055;
    const rw    = W * (0.09 + 0.04 * Math.sin(p * Math.PI * 2.8));
    const ex    = ox + Math.sin(angle) * len, ey = oy + Math.cos(angle) * len;
    const perp  = angle + Math.PI * 0.5;
    const phx   = Math.cos(perp) * rw * 0.5, phy = Math.sin(perp) * rw * 0.5;
    const pulse = env * (0.70 + 0.22 * Math.sin(p * Math.PI));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createLinearGradient(ox, oy, ex, ey);
    grad.addColorStop(0,    `rgba(255,248,185,${(0.115 * pulse).toFixed(3)})`);
    grad.addColorStop(0.28, `rgba(248,225,115,${(0.058 * pulse).toFixed(3)})`);
    grad.addColorStop(0.68, `rgba(225,195,72,${(0.022 * pulse).toFixed(3)})`);
    grad.addColorStop(1,    'rgba(200,162,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ox - phx * 0.08, oy - phy * 0.08);
    ctx.lineTo(ox + phx * 0.08, oy + phy * 0.08);
    ctx.lineTo(ex + phx, ey + phy);
    ctx.lineTo(ex - phx, ey - phy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Server Glow ────────────────────────────────────────────────────────────
  _glowSurgeMul(t) {
    const DUR = 9;
    const age = t - this._glowSurgeT0;
    if (age < 0 || age >= DUR) return 1;
    const p = age / DUR;
    const env = p < 0.25 ? p / 0.25 : p < 0.68 ? 1 : (1 - p) / 0.32;
    return 1 + 1.8 * env;
  }

  _drawServerGlow(ctx, W, H, t) {
    const A = this._anchors();
    if (!A.serverCenter || !this.img) return;
    const C   = this._ptc(...A.serverCenter);
    const s   = this._s();
    const R   = 160 * s;
    const mul = this._glitchMul * this._glowSurgeMul(t);
    const pulse = (0.52
      + 0.22 * Math.sin(t * 0.84)
      + 0.15 * Math.sin(t * 2.13)
      + 0.09 * Math.sin(t * 6.41)
      + 0.02 * Math.sin(t * 14.8)
    ) * mul;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ga = 0.090 * pulse;
    const amb = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R * 2.5);
    amb.addColorStop(0,    `rgba(255,165,50,${Math.min(0.999, ga * 2.3).toFixed(3)})`);
    amb.addColorStop(0.22, `rgba(238,135,38,${(ga * 1.5).toFixed(3)})`);
    amb.addColorStop(0.50, `rgba(180,85,18,${ga.toFixed(3)})`);
    amb.addColorStop(0.80, `rgba(105,48,8,${(ga * 0.22).toFixed(3)})`);
    amb.addColorStop(1,    'rgba(65,22,2,0)');
    ctx.fillStyle = amb;
    ctx.beginPath(); ctx.arc(C.x, C.y, R * 2.5, 0, TAU); ctx.fill();
    const gp  = Math.max(0, 0.38 + 0.32 * Math.sin(t * 3.42 + 1.18)) * mul;
    const ga2 = 0.040 * gp;
    const gcx = C.x - R * 0.30;
    const grn = ctx.createRadialGradient(gcx, C.y, 0, gcx, C.y, R * 0.92);
    grn.addColorStop(0,    `rgba(80,255,118,${(ga2 * 2.2).toFixed(3)})`);
    grn.addColorStop(0.42, `rgba(45,195,72,${ga2.toFixed(3)})`);
    grn.addColorStop(1,    'rgba(0,88,25,0)');
    ctx.fillStyle = grn;
    ctx.beginPath(); ctx.arc(gcx, C.y, R * 0.92, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ── Waterfall ──────────────────────────────────────────────────────────────
  _initWaterfallArrays() {
    const THREADS = 18;
    this._wfThreads = Array.from({ length: THREADS }, (_, i) => ({
      t: (i + 0.5) / THREADS, phase: rand(0, TAU), speed: rand(0.26, 0.54),
      alpha: rand(0.16, 0.36), wFreq: rand(0.14, 0.30), wAmp: rand(0.4, 1.0),
    }));
    this._wfMistL = Array.from({ length: 5 }, () => ({ t: rand(0, 1), phase: rand(0, TAU), r: rand(1.75, 4), alpha: rand(0.022, 0.045) }));
    this._wfMistR = Array.from({ length: 7 }, () => ({ t: rand(0, 1), phase: rand(0, TAU), r: rand(2.25, 5), alpha: rand(0.025, 0.05) }));
    this._wfBillow = Array.from({ length: 6 }, () => ({
      t: rand(0.05, 0.95), phase: rand(0, TAU), rBase: rand(7.5, 13.75),
      rVar: rand(2.5, 5), alpha: rand(0.022, 0.04), driftAmp: rand(5, 12),
      driftFreq: rand(0.18, 0.36),
    }));
    // Portrait-only: larger puffs filling the bottom quarter of the fall
    this._wfBillowPortrait = Array.from({ length: 10 }, () => ({
      t:         rand(0.0, 1.0),
      vy:        rand(0, 1),
      phase:     rand(0, TAU),
      rBase:     rand(13.75, 25),
      rVar:      rand(5, 10),
      alpha:     rand(0.03, 0.055),
      driftAmp:  rand(12, 25),
      driftFreq: rand(0.12, 0.26),
    }));
  }

  _drawWaterfall(ctx, W, H, t) {
    const A = this._anchors();
    if (!A.waterfallTL || !A.waterfallBR2 || !this.img) return;
    const tl    = this._ptc(...A.waterfallTL);
    const tr    = this._ptc(...A.waterfallTR);
    const bl    = this._ptc(...A.waterfallBL);
    const br2   = this._ptc(...A.waterfallBR2);
    const botL  = this._ptc(...A.waterfallBotL);
    const botL2 = this._ptc(...A.waterfallBotL2);
    const botR  = this._ptc(...A.waterfallBotR);
    const bshTL = A.waterfallBushTL ? this._ptc(...A.waterfallBushTL) : botL2;
    const bshTR = A.waterfallBushTR ? this._ptc(...A.waterfallBushTR) : botR;
    const sc    = this._s();
    const lerp  = (a, b, f) => a + (b - a) * f;
    const nm    = this._nightMul(t);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br2.x, br2.y);
    ctx.lineTo(botR.x, botR.y); ctx.lineTo(bshTR.x, bshTR.y); ctx.lineTo(bshTL.x, bshTL.y);
    ctx.lineTo(botL2.x, botL2.y); ctx.lineTo(botL.x, botL.y); ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = nm;

    const mTx = lerp(tl.x, tr.x, 0.5), mTy = lerp(tl.y, tr.y, 0.5);
    const mBx = lerp(bl.x, br2.x, 0.5), mBy = lerp(bl.y, br2.y, 0.5);
    const bA  = 0.046 + 0.020 * Math.sin(t * 0.34 + 1.1);
    const bGr = ctx.createLinearGradient(mTx, mTy, mBx, mBy);
    bGr.addColorStop(0,    `rgba(200,238,255,${(bA * 0.55).toFixed(3)})`);
    bGr.addColorStop(0.3,  `rgba(220,248,255,${bA.toFixed(3)})`);
    bGr.addColorStop(0.65, `rgba(205,238,255,${(bA * 0.85).toFixed(3)})`);
    bGr.addColorStop(1,    `rgba(185,225,255,${(bA * 0.32).toFixed(3)})`);
    ctx.fillStyle = bGr;
    ctx.fillRect(
      Math.min(tl.x, bl.x) - 2, Math.min(tl.y, tr.y) - 2,
      Math.max(tr.x, br2.x) - Math.min(tl.x, bl.x) + 4,
      Math.max(bl.y, br2.y) - Math.min(tl.y, tr.y) + 4
    );

    for (const th of this._wfThreads) {
      const topX = lerp(tl.x, tr.x, th.t), topY = lerp(tl.y, tr.y, th.t);
      const botX = lerp(bl.x, br2.x, th.t), botY = lerp(bl.y, br2.y, th.t);
      const len  = Math.hypot(botX - topX, botY - topY);
      if (len < 1) continue;
      const dx = (botX - topX) / len, dy = (botY - topY) / len;
      const wave = Math.sin(t * th.wFreq * TAU + th.phase) * th.wAmp * sc;
      for (let k = 0; k < 2; k++) {
        const frac = ((t * th.speed + th.phase / TAU + k * 0.5) % 1.0);
        const env  = Math.sin(frac * Math.PI);
        const a    = th.alpha * env;
        if (a < 0.01) continue;
        const cx = topX + (botX - topX) * frac + wave;
        const cy = topY + (botY - topY) * frac;
        const hhl = len * 0.17;
        const hGr = ctx.createLinearGradient(cx - dx * hhl, cy - dy * hhl, cx + dx * hhl, cy + dy * hhl);
        hGr.addColorStop(0,   'rgba(215,246,255,0)');
        hGr.addColorStop(0.5, `rgba(238,254,255,${Math.min(0.99, a).toFixed(3)})`);
        hGr.addColorStop(1,   'rgba(215,246,255,0)');
        ctx.strokeStyle = hGr;
        ctx.lineWidth   = (1.2 + th.t * 1.0) * sc;
        ctx.beginPath();
        ctx.moveTo(cx - dx * hhl + wave * 0.15, cy - dy * hhl);
        ctx.lineTo(cx + dx * hhl - wave * 0.08, cy + dy * hhl);
        ctx.stroke();
      }
    }

    const drawMist = (m, bx, by, fA, fB) => {
      const pulse = 0.5 + 0.38 * Math.sin(t * fA + m.phase) + 0.12 * Math.sin(t * fB + m.phase * 1.8);
      const a = m.alpha * pulse;
      if (a < 0.006) return;
      const r = m.r * sc;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r * 2.6);
      g.addColorStop(0,    `rgba(225,250,255,${Math.min(0.99, a * 1.9).toFixed(3)})`);
      g.addColorStop(0.40, `rgba(205,242,255,${Math.min(0.99, a * 1.2).toFixed(3)})`);
      g.addColorStop(0.70, `rgba(188,230,255,${a.toFixed(3)})`);
      g.addColorStop(1,    'rgba(165,215,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, r * 2.6, 0, TAU); ctx.fill();
    };

    for (const m of this._wfMistL) drawMist(m, lerp(bl.x, botL2.x, m.t), lerp(bl.y, botL2.y, m.t), 0.56, 1.40);
    for (const m of this._wfMistR) drawMist(m, lerp(botR.x, br2.x, m.t), lerp(botR.y, br2.y, m.t), 0.62, 1.48);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = nm;
    for (const b of this._wfBillow) {
      const sc2 = this._s();
      const bx = lerp(bl.x, br2.x, b.t) + Math.sin(t * b.driftFreq + b.phase) * b.driftAmp * sc2;
      const by = lerp(bl.y, br2.y, b.t) + Math.cos(t * b.driftFreq * 0.7 + b.phase * 1.3) * b.driftAmp * 0.45 * sc2;
      const pulse = 0.5 + 0.34 * Math.sin(t * 0.58 + b.phase) + 0.16 * Math.sin(t * 1.34 + b.phase * 1.7);
      const r = (b.rBase + b.rVar * pulse) * sc2;
      const a = b.alpha * (0.52 + 0.48 * pulse);
      if (a < 0.008) continue;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      bg.addColorStop(0,    `rgba(238,254,255,${Math.min(0.99, a * 2.0).toFixed(3)})`);
      bg.addColorStop(0.38, `rgba(215,246,255,${Math.min(0.99, a * 1.1).toFixed(3)})`);
      bg.addColorStop(0.70, `rgba(192,234,255,${(a * 0.45).toFixed(3)})`);
      bg.addColorStop(1,    'rgba(172,220,255,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // Portrait-only: enhanced billowing mist cloud in the bottom quarter of the fall
    if (this.W < this.H) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = nm;
      const sc2 = this._s();
      // Anchor points spanning the bottom quarter (75% down the fall to the base)
      const q3xl = lerp(tl.x, bl.x, 0.75), q3yl = lerp(tl.y, bl.y, 0.75);
      const q3xr = lerp(tr.x, br2.x, 0.75), q3yr = lerp(tr.y, br2.y, 0.75);
      for (const b of this._wfBillowPortrait) {
        const lx = lerp(q3xl, bl.x, b.vy), ly = lerp(q3yl, bl.y, b.vy);
        const rx = lerp(q3xr, br2.x, b.vy), ry = lerp(q3yr, br2.y, b.vy);
        const bx = lerp(lx, rx, b.t) + Math.sin(t * b.driftFreq + b.phase) * b.driftAmp * sc2;
        const by = lerp(ly, ry, b.t) + Math.cos(t * b.driftFreq * 0.7 + b.phase * 1.3) * b.driftAmp * 0.7 * sc2;
        const pulse = 0.5 + 0.34 * Math.sin(t * 0.48 + b.phase) + 0.16 * Math.sin(t * 1.12 + b.phase * 1.7);
        const r = (b.rBase + b.rVar * pulse) * sc2;
        const a = b.alpha * (0.52 + 0.48 * pulse);
        if (a < 0.008) continue;
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        bg.addColorStop(0,    `rgba(238,254,255,${Math.min(0.99, a * 2.2).toFixed(3)})`);
        bg.addColorStop(0.35, `rgba(220,248,255,${Math.min(0.99, a * 1.3).toFixed(3)})`);
        bg.addColorStop(0.65, `rgba(195,235,255,${(a * 0.55).toFixed(3)})`);
        bg.addColorStop(1,    'rgba(172,220,255,0)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── Fog Patches ────────────────────────────────────────────────────────────
  _drawFogPatches(ctx, W, H, t) {
    const PATCHES = [
      { nx: 0.15, ny: 0.82, rNx: 0.185, rNy: 0.072, ph: 0.00, dax: 0.040, day: 0.014, dfx: 0.178, dfy: 0.238, a: 0.510 },
      { nx: 0.48, ny: 0.75, rNx: 0.205, rNy: 0.090, ph: 2.10, dax: 0.034, day: 0.019, dfx: 0.212, dfy: 0.182, a: 0.465 },
      { nx: 0.82, ny: 0.80, rNx: 0.162, rNy: 0.068, ph: 1.20, dax: 0.030, day: 0.013, dfx: 0.162, dfy: 0.255, a: 0.540 },
      { nx: 0.33, ny: 0.91, rNx: 0.152, rNy: 0.056, ph: 3.80, dax: 0.044, day: 0.011, dfx: 0.196, dfy: 0.292, a: 0.480 },
      { nx: 0.68, ny: 0.70, rNx: 0.138, rNy: 0.082, ph: 0.90, dax: 0.028, day: 0.017, dfx: 0.242, dfy: 0.158, a: 0.420 },
      { nx: 0.24, ny: 0.62, rNx: 0.120, rNy: 0.062, ph: 5.20, dax: 0.026, day: 0.021, dfx: 0.176, dfy: 0.214, a: 0.345 },
      { nx: 0.76, ny: 0.65, rNx: 0.132, rNy: 0.060, ph: 4.48, dax: 0.032, day: 0.015, dfx: 0.204, dfy: 0.188, a: 0.375 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of PATCHES) {
      const cx = (p.nx + Math.sin(t * p.dfx + p.ph) * p.dax) * W;
      const cy = (p.ny + Math.cos(t * p.dfy + p.ph * 0.78) * p.day) * H;
      const breathe = 0.56 + 0.28 * Math.sin(t * 0.124 + p.ph) + 0.16 * Math.sin(t * 0.276 + p.ph * 1.55);
      const alpha = p.a * breathe * this._nightMul(t);
      if (alpha < 0.008) continue;
      const rx = p.rNx * W, ry = p.rNy * H;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0,    `rgba(205,222,218,${Math.min(0.999, alpha * 1.35).toFixed(3)})`);
      grd.addColorStop(0.40, `rgba(195,215,210,${alpha.toFixed(3)})`);
      grd.addColorStop(0.72, `rgba(185,208,202,${(alpha * 0.52).toFixed(3)})`);
      grd.addColorStop(1,    'rgba(175,200,195,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Spores / Dust ──────────────────────────────────────────────────────────
  _makeSporePt(H, startY) {
    return {
      x: rand(0, this.W), y: startY ?? rand(0, H),
      vy: rand(-0.20, -0.56), vx: rand(-0.06, 0.06),
      r: rand(0.6, 1.9), phase: rand(0, TAU),
      freq: rand(0.90, 2.65), op: rand(0.08, 0.27),
      warm: Math.random() < 0.72,
    };
  }
  _initSpores() {
    this._sporePts = Array.from({ length: 88 }, () => this._makeSporePt(this.H));
  }
  _updateSpores(dt, t) {
    const step = dt / 16.667;
    for (const p of this._sporePts) {
      p.x += (p.vx + Math.sin(t * p.freq + p.phase) * 0.50) * step;
      p.y += p.vy * step;
      if (p.y < -12) Object.assign(p, this._makeSporePt(this.H, this.H + 8));
      if (p.x < -12) p.x = this.W + 12;
      if (p.x > this.W + 12) p.x = -12;
    }
  }
  _drawSpores(ctx, W, H, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this._sporePts) {
      const twinkle = 0.55 + 0.30 * Math.sin(t * p.freq * 3.2 + p.phase)
                           + 0.15 * Math.sin(t * p.freq * 7.8 + p.phase * 1.7);
      const alpha = p.op * twinkle;
      if (alpha < 0.018) continue;
      const [r, g, b] = p.warm ? [255, 230, 150] : [190, 255, 168];
      const gR  = p.r * 3.1;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gR);
      grd.addColorStop(0,   `rgba(${r},${g},${b},${Math.min(0.999, alpha * 1.55).toFixed(3)})`);
      grd.addColorStop(0.5, `rgba(${r},${g},${b},${(alpha * 0.82).toFixed(3)})`);
      grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, gR, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Fireflies ──────────────────────────────────────────────────────────────
  _makeFF(nyLo, nyHi) {
    return {
      x: rand(this.W * 0.04, this.W * 0.96), y: rand(this.H * nyLo, this.H * nyHi),
      vx: rand(-0.20, 0.20), vy: rand(-0.12, 0.12),
      ax: rand(-0.0038, 0.0038), ay: rand(-0.0026, 0.0026),
      ph: rand(0, TAU), freq: rand(0.0028, 0.0082),
      r: rand(3.5, 9.0), warm: Math.random() < 0.56,
    };
  }
  _initFireflies() {
    this._ambFF = Array.from({ length: 11 }, () => this._makeFF(0.28, 0.90));
  }
  _triggerFFSurge(t) {
    this._surgeT0 = t;
    this._surgeFF = Array.from({ length: 42 }, () => this._makeFF(0.18, 0.93));
  }
  _updateFireflies(dt, t) {
    const step = dt / 16.667;
    const SURGE_DUR = 20, SURGE_FADE = 3.2;
    const surgeAge = t - this._surgeT0;
    const all = [...this._ambFF];
    if (surgeAge < SURGE_DUR + SURGE_FADE) all.push(...this._surgeFF);
    for (const f of all) {
      f.vx += (f.ax + rand(-0.002, 0.002)) * step;
      f.vy += (f.ay + rand(-0.001, 0.001)) * step;
      f.vx = clamp(f.vx, -0.30, 0.30); f.vy = clamp(f.vy, -0.20, 0.20);
      f.x += f.vx * step; f.y += f.vy * step;
      if (f.x < -40) f.x = this.W + 40;
      if (f.x > this.W + 40) f.x = -40;
      if (f.y < this.H * 0.12) f.vy =  Math.abs(f.vy) * 0.5;
      if (f.y > this.H * 0.97) f.vy = -Math.abs(f.vy) * 0.5;
    }
  }
  _drawFireflies(ctx, W, H, t) {
    const SURGE_DUR = 20, SURGE_FADE = 3.2;
    const surgeAge = t - this._surgeT0;
    const surgeA = clamp(
      Math.min(surgeAge / SURGE_FADE, 1) * Math.max(0, 1 - (surgeAge - SURGE_DUR) / SURGE_FADE),
      0, 1
    );
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sets = [{ list: this._ambFF, fa: 1 }];
    if (surgeA > 0.005) sets.push({ list: this._surgeFF, fa: surgeA });
    for (const { list, fa } of sets) {
      for (const f of list) {
        const blink = Math.max(0, Math.sin(t * f.freq * 1000 + f.ph));
        const alpha = blink * blink * 0.52 * fa;
        if (alpha < 0.018) continue;
        const [r, g, b] = f.warm ? [255, 228, 72] : [112, 255, 90];
        const gR = f.r * (1.2 + blink * 1.0);
        const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, gR);
        grd.addColorStop(0,    `rgba(${r},${g},${b},${Math.min(0.999, alpha * 1.8).toFixed(3)})`);
        grd.addColorStop(0.28, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
        grd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(f.x, f.y, gR, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.999, alpha).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.35, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── Cable Spark ────────────────────────────────────────────────────────────
  _triggerSpark(t) {
    const A = this._anchors();
    if (!A.serverCenter || !this.img) return;
    const [cpx, cpy] = A.serverCenter;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      this._sparks.push({
        t0: t + i * 0.16 + rand(0, 0.06),
        px: cpx + rand(-40, 30), py: cpy + rand(-15, 48),
        angle: rand(-Math.PI * 0.45, Math.PI * 0.45),
        len: rand(9, 22),
      });
    }
  }
  _drawCableSpark(ctx, W, H, t) {
    if (!this._sparks.length || !this.img) return;
    const DUR = 0.32;
    const alive = [];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const s of this._sparks) {
      const age = t - s.t0;
      if (age < 0) { alive.push(s); continue; }
      if (age >= DUR) continue;
      alive.push(s);
      const p = age / DUR;
      const alpha = p < 0.12 ? p / 0.12 : 1 - p;
      if (alpha < 0.02) continue;
      const c   = this._ptc(s.px, s.py);
      const sc  = this._s();
      const len = s.len * sc;
      const ex = c.x + Math.cos(s.angle) * len, ey = c.y + Math.sin(s.angle) * len;
      const mx = (c.x + ex) * 0.5 + rand(-len * 0.28, len * 0.28);
      const my = (c.y + ey) * 0.5 + rand(-len * 0.28, len * 0.28);
      ctx.globalAlpha = alpha * 0.92;
      ctx.strokeStyle = 'rgba(200,232,255,1)';
      ctx.lineWidth   = 1.8 * sc;
      ctx.shadowColor = 'rgba(120,185,255,0.9)';
      ctx.shadowBlur  = 8 * sc;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
      const hr  = len * 0.58;
      const hrd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, hr);
      hrd.addColorStop(0, `rgba(160,215,255,${(alpha * 0.52).toFixed(3)})`);
      hrd.addColorStop(1, 'rgba(60,120,255,0)');
      ctx.fillStyle = hrd; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(c.x, c.y, hr, 0, TAU); ctx.fill();
    }
    ctx.restore();
    this._sparks = alive;
  }

  // ── Power Arc ──────────────────────────────────────────────────────────────
  _triggerPowerArc(t) {
    const A = this._anchors();
    if (!A.serverCenter || !A.serverRight) return;
    this._powerArc.t0 = t;
  }
  _drawPowerArc(ctx, W, H, t) {
    const A = this._anchors();
    if (!A.serverCenter || !A.serverRight || !this.img) return;
    const DUR = 1.6, FLASHES = 3;
    const age = t - this._powerArc.t0;
    if (age < 0 || age >= DUR) return;
    const flashPeriod = DUR / FLASHES;
    const flashP = (age % flashPeriod) / flashPeriod;
    const alpha  = flashP < 0.18 ? flashP / 0.18 : 1 - flashP;
    if (alpha < 0.02) return;
    const envFade = Math.max(0, 1 - (age - DUR * 0.68) / (DUR * 0.32));
    const a  = this._ptc(...A.serverCenter);
    const b  = this._ptc(...A.serverRight);
    const sc = this._s();
    const makePath = (x1, y1, x2, y2) => {
      const SEGS = 7, dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const px = -dy / len, py = dx / len;
      const path = [{ x: x1, y: y1 }];
      for (let i = 1; i < SEGS; i++) {
        const tt = i / SEGS;
        const j  = (Math.random() - 0.5) * len * 0.13;
        path.push({ x: x1 + dx * tt + px * j, y: y1 + dy * tt + py * j });
      }
      path.push({ x: x2, y: y2 }); return path;
    };
    const path = makePath(a.x, a.y, b.x, b.y);
    const strokePath = () => {
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    };
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha * envFade;
    ctx.shadowColor = 'rgba(100,165,255,0.9)'; ctx.shadowBlur = 18 * sc;
    ctx.strokeStyle = 'rgba(115,180,255,0.72)'; ctx.lineWidth = 5 * sc;
    strokePath();
    ctx.shadowBlur = 5 * sc; ctx.strokeStyle = 'rgba(222,242,255,1)'; ctx.lineWidth = 1.5 * sc;
    strokePath();
    ctx.shadowBlur = 0;
    for (const pt of [a, b]) {
      const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 20 * sc);
      grd.addColorStop(0, 'rgba(205,232,255,0.82)'); grd.addColorStop(1, 'rgba(50,105,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 20 * sc, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Data Drift ─────────────────────────────────────────────────────────────
  _triggerDataDrift(t) {
    const A = this._anchors();
    if (!A.serverCenter || !this.img) return;
    this._dataDrift.t0 = t;
    const c = this._ptc(...A.serverCenter);
    this._dataDrift.pts = Array.from({ length: 38 }, () => ({
      x: c.x + rand(-62, 62), y: c.y + rand(0, 28),
      vy: rand(-0.5, -1.7), vx: rand(-0.10, 0.10),
      r: rand(1.2, 2.8), ph: rand(0, TAU),
      freq: rand(2.5, 6.5), warm: Math.random() < 0.28,
      delay: rand(0, 2.8),
    }));
  }
  _updateDataDrift(dt, t) {
    const DUR = 11;
    const age = t - this._dataDrift.t0;
    if (age < 0 || age >= DUR) return;
    const step = dt / 16.667;
    for (const p of this._dataDrift.pts) {
      if (age < p.delay) continue;
      p.x += (p.vx + Math.sin(t * p.freq + p.ph) * 0.28) * step;
      p.y += p.vy * step;
    }
  }
  _drawDataDrift(ctx, W, H, t) {
    const DUR = 11;
    const age = t - this._dataDrift.t0;
    if (age < 0 || age >= DUR) return;
    const envFade = Math.min(age / 0.8, 1) * Math.min(1, (DUR - age) / 2.0);
    if (envFade < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this._dataDrift.pts) {
      if (age < p.delay) continue;
      const lifeAge  = age - p.delay;
      const lifeFade = Math.min(1, (DUR - p.delay - lifeAge) / 2.0);
      const alpha    = 0.68 * lifeFade * envFade;
      if (alpha < 0.01) continue;
      const [r, g, b] = p.warm ? [255, 195, 70] : [70, 215, 255];
      const gR  = p.r * 3.8;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gR);
      grd.addColorStop(0,   `rgba(${r},${g},${b},${Math.min(0.999, alpha * 2.1).toFixed(3)})`);
      grd.addColorStop(0.4, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
      grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, gR, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Spore Cloud ────────────────────────────────────────────────────────────
  _triggerSporeCloud(t) {
    const clumps = this._anchors().mushroomClumps;
    if (!clumps || !clumps.length || !this.img) return;
    this._sporeCloud.t0 = t;
    const pick = clumps[Math.floor(Math.random() * clumps.length)];
    const c  = this._ptc(...pick);
    const s  = this._s();
    const ox = c.x, oy = c.y;
    this._sporeCloud.pts = Array.from({ length: 80 }, () => {
      const spd = rand(0.55, 1.65);
      const sa  = rand(-0.32, 0.32);
      return {
        x: ox + rand(-3, 3), y: oy,
        vx: Math.sin(sa) * spd, vy: -Math.cos(sa) * spd,
        r: rand(0.32, 0.82), delay: rand(0, 0.28),
        capY: oy - rand(35, 50) * s, drifting: false,
        dvx: rand(-0.14, 0.14), dvy: rand(-0.06, 0.10),
      };
    });
  }
  _updateSporeCloud(dt, t) {
    const DUR = 11;
    const age = t - this._sporeCloud.t0;
    if (age < 0 || age >= DUR) return;
    const step = dt / 16.667;
    for (const p of this._sporeCloud.pts) {
      if (age < p.delay) continue;
      if (!p.drifting) {
        p.x += p.vx * step; p.y += p.vy * step;
        p.vx *= 0.990; p.vy *= 0.988;
        if (p.y <= p.capY || Math.abs(p.vy) < 0.06) {
          p.drifting = true; p.vx = p.dvx; p.vy = p.dvy;
        }
      } else {
        p.x += p.vx * step; p.y += p.vy * step;
        p.vx *= 0.997; p.vy *= 0.997;
        p.vx += rand(-0.007, 0.007); p.vy += rand(-0.004, 0.005);
        p.vx = clamp(p.vx, -0.18, 0.18); p.vy = clamp(p.vy, -0.14, 0.16);
      }
    }
  }
  _drawSporeCloud(ctx, W, H, t) {
    const DUR = 11;
    const age = t - this._sporeCloud.t0;
    if (age < 0 || age >= DUR) return;
    const env = Math.min(age / 0.38, 1) * Math.min(1, (DUR - age) / 4.2);
    if (env < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this._sporeCloud.pts) {
      if (age < p.delay) continue;
      const alpha = 0.38 * env;
      const gR  = p.r * 5.8;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gR);
      grd.addColorStop(0,   `rgba(228,220,185,${Math.min(0.999, alpha * 2.8).toFixed(3)})`);
      grd.addColorStop(0.4, `rgba(210,202,162,${alpha.toFixed(3)})`);
      grd.addColorStop(1,   'rgba(185,175,130,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, gR, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Eyes Appear ────────────────────────────────────────────────────────────
  _drawEyesAppear(ctx, W, H, t) {
    const A = this._anchors();
    if (!A.darkCavity || !this.img) return;
    const DUR = 5.5;
    const age = t - this._eyes.t0;
    if (age < 0 || age >= DUR) return;
    const p = age / DUR;
    let alpha = p < 0.18 ? p / 0.18 : p > 0.78 ? (1 - p) / 0.22 : 1;
    if (!this._eyes.blink && Math.random() < 0.004) { this._eyes.blink = true; this._eyes.blinkT = t; }
    if (this._eyes.blink) {
      const ba = (t - this._eyes.blinkT) / 0.08;
      alpha *= ba < 0.5 ? 1 - ba * 2 : (ba - 0.5) * 2;
      if (ba >= 1) this._eyes.blink = false;
    }
    if (alpha < 0.02) return;
    const c  = this._ptc(...A.darkCavity);
    const sc = this._s();
    const eR = 3.5 * sc, sep = 10 * sc;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    for (const ex of [c.x - sep * 0.5, c.x + sep * 0.5]) {
      const grd = ctx.createRadialGradient(ex, c.y, 0, ex, c.y, eR * 2.8);
      grd.addColorStop(0,   'rgba(255,192,52,0.9)');
      grd.addColorStop(0.4, 'rgba(218,142,22,0.5)');
      grd.addColorStop(1,   'rgba(120,60,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(ex, c.y, eR * 2.8, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,222,82,0.95)';
      ctx.beginPath(); ctx.arc(ex, c.y, eR, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(10,5,0,0.92)';
      ctx.beginPath(); ctx.ellipse(ex, c.y, eR * 0.22, eR * 0.84, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Monitor Events ─────────────────────────────────────────────────────────
  _triggerMonMsg(t) {
    if (!this._anchors().laptopScreen) return;
    const MSGS = ['SIGNAL LOST', 'REBOOTING...', 'LOW POWER', '> KERNEL PANIC', 'SYS OFFLINE', 'ERR: 0x4F'];
    this._monMsg.msg = MSGS[Math.floor(Math.random() * MSGS.length)];
    this._monMsg.t0  = t;
  }
  _monRect() {
    const MON_W = 39, MON_H = 30;
    const c  = this._ptc(...this._anchors().laptopScreen);
    const sc = this._s();
    const hw = MON_W * sc * 0.5, hh = MON_H * sc * 0.5;
    return { cx: c.x, cy: c.y, x: c.x - hw, y: c.y - hh, w: MON_W * sc, h: MON_H * sc, sc };
  }
  _drawMonitorEvents(ctx, W, H, t) {
    if (!this._anchors().laptopScreen || !this.img) return;
    const m = this._monRect();
    let maxEvA = 0;
    const check = (t0, dur, inF, outF) => {
      const age = t - t0;
      if (age < 0 || age >= dur) return;
      const p = age / dur;
      maxEvA = Math.max(maxEvA, Math.min(p / inF, 1) * Math.min(1, (1 - p) / outF));
    };
    check(this._monStat.t0, 4.2, 0.18, 0.15);
    check(this._monMsg.t0,  3.0, 0.12, 0.18);
    check(this._monScan.t0, 3.2, 0.12, 0.15);
    const baseA = (1 - maxEvA) * 0.82;
    if (baseA > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(4,10,6,${baseA.toFixed(3)})`;
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(m.cx, m.cy, 0, m.cx, m.cy, m.w * 0.6);
      g.addColorStop(0, `rgba(30,80,40,${(0.12 * (1 - maxEvA)).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(m.cx, m.cy, m.w * 0.6, m.h * 0.55, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    this._drawMonStat(ctx, m, t);
    this._drawMonMsg(ctx, m, t);
    this._drawMonScan(ctx, m, t);
  }
  _drawMonStat(ctx, m, t) {
    const DUR = 4.2;
    const age = t - this._monStat.t0;
    if (age < 0 || age >= DUR) return;
    const p = age / DUR;
    const alpha = Math.min(p / 0.18, 1) * Math.min(1, (1 - p) / 0.15);
    if (alpha < 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    const cols = 26, rows = 18, cw = m.w / cols, ch = m.h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const g = Math.floor(rand(0, 210));
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(m.x + c * cw, m.y + r * ch, cw + 0.5, ch + 0.5);
    }
    ctx.globalCompositeOperation = 'screen';
    const grd = ctx.createRadialGradient(m.cx, m.cy, 0, m.cx, m.cy, m.w * 0.68);
    grd.addColorStop(0, `rgba(100,175,110,${(alpha * 0.28).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(30,90,40,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(m.cx, m.cy, m.w * 0.68, m.h * 0.58, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  _drawMonMsg(ctx, m, t) {
    const DUR = 3.0;
    const age = t - this._monMsg.t0;
    if (age < 0 || age >= DUR) return;
    const p = age / DUR;
    const alpha = Math.min(p / 0.12, 1) * Math.min(1, (1 - p) / 0.18);
    if (alpha < 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,10,2,0.88)';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.globalAlpha = alpha * (Math.random() < 0.04 ? 0.3 : 1);
    const fs = m.h * 0.155;
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(72,255,96,1)';
    ctx.shadowColor = 'rgba(0,255,60,0.8)'; ctx.shadowBlur = fs * 0.4;
    ctx.fillText(this._monMsg.msg, m.cx, m.cy);
    ctx.restore();
  }
  _drawMonScan(ctx, m, t) {
    const DUR = 3.2;
    const age = t - this._monScan.t0;
    if (age < 0 || age >= DUR) return;
    const p = age / DUR;
    const alpha = Math.min(p / 0.12, 1) * Math.min(1, (1 - p) / 0.15);
    if (alpha < 0.01) return;
    const lineY = m.y + m.h * ((p * 1.15) % 1.0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,8,2,0.62)';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.globalCompositeOperation = 'screen';
    const lg = ctx.createLinearGradient(m.cx, lineY - m.h * 0.065, m.cx, lineY + m.h * 0.065);
    lg.addColorStop(0,   'rgba(0,0,0,0)');
    lg.addColorStop(0.5, `rgba(72,225,115,${(alpha * 0.65).toFixed(3)})`);
    lg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(m.x, lineY - m.h * 0.065, m.w, m.h * 0.13);
    ctx.restore();
  }

  // ── Bird Flythrough ────────────────────────────────────────────────────────
  _triggerBird(t) {
    if (this._birds.length > 0) return;
    this._birds.push({ t0: t, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  _drawBird(ctx, W, H, t) {
    const DUR = 7.5;
    if (!this._birds.length) return;
    const a = this._birds[0], et = t - a.t0;
    if (et >= DUR) { this._birds.shift(); return; }
    const p = et / DUR;
    const fadeIn  = p < 0.08 ? p / 0.08 : 1;
    const fadeOut = p > 0.90 ? (1 - p) / 0.10 : 1;
    const startX = a.dir > 0 ? -90 : W + 90;
    const endX   = a.dir > 0 ? W + 90 : -90;
    const cx = startX + (endX - startX) * p;
    const cy = H * 0.25 * (0.42 + 0.18 * Math.sin(p * Math.PI * 1.05 - 0.25));
    const wAngle = Math.sin(et * 18.85);
    const sz = Math.min(W, H) * 0.021;
    ctx.save();
    ctx.globalAlpha = fadeIn * fadeOut;
    ctx.translate(cx, cy);
    if (a.dir < 0) ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(18,12,7,0.90)';
    ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.30, sz * 0.10, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-sz * 0.26, sz * 0.02); ctx.lineTo(-sz * 0.54, sz * 0.12);
    ctx.lineTo(-sz * 0.29, sz * 0.14); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(sz * 0.30, -sz * 0.02, sz * 0.10, 0, TAU); ctx.fill();
    ctx.save(); ctx.rotate(wAngle * 0.46);
    ctx.beginPath();
    ctx.moveTo(-sz * 0.04, -sz * 0.02);
    ctx.quadraticCurveTo(-sz * 0.62, -sz * (0.44 * (wAngle + 0.20) + 0.02), -sz * 1.06, sz * 0.04);
    ctx.quadraticCurveTo(-sz * 0.52,  sz * 0.09, -sz * 0.04, sz * 0.04);
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(-wAngle * 0.46);
    ctx.beginPath();
    ctx.moveTo(sz * 0.04, -sz * 0.02);
    ctx.quadraticCurveTo(sz * 0.62, -sz * (0.44 * (wAngle + 0.20) + 0.02), sz * 1.06, sz * 0.04);
    ctx.quadraticCurveTo(sz * 0.52,  sz * 0.09, sz * 0.04, sz * 0.04);
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
  }

  // ── Leaf Gust ──────────────────────────────────────────────────────────────
  _triggerLeafGust(t) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const W = this.W, H = this.H;
    this._leafGust = {
      t0: t, dir,
      leaves: Array.from({ length: 22 }, () => ({
        x:      dir > 0 ? rand(-80, -10) : rand(W + 10, W + 80),
        y:      rand(H * 0.54, H * 0.94),
        vx:     dir * rand(1.8, 4.5),
        vy:     rand(-0.6, 0.7),
        rot:    rand(0, TAU),
        rotV:   rand(-0.04, 0.055) * dir,
        sz:     H * rand(0.022, 0.062),
        imgIdx: Math.floor(Math.random() * 10),
        delay:  rand(0, 1.8),
      })),
    };
  }
  _updateLeafGust(dt, t) {
    const DUR = 5.5;
    const age = t - this._leafGust.t0;
    if (age < 0 || age >= DUR) return;
    const step = dt / 16.667;
    for (const l of this._leafGust.leaves) {
      if (age < l.delay) continue;
      l.x += l.vx * step;
      l.y += (l.vy + Math.sin(t * 3.8 + l.rot) * 0.28) * step;
      l.rot += l.rotV * step;
    }
  }
  _drawLeafGust(ctx, W, H, t) {
    if (!techRuinLeafImgs.length) return;
    const DUR = 5.5;
    const age = t - this._leafGust.t0;
    if (age < 0 || age >= DUR) return;
    const env = Math.min(age / 0.4, 1) * Math.min(1, (DUR - age) / 0.6);
    if (env < 0.01) return;
    ctx.save();
    for (const l of this._leafGust.leaves) {
      if (age < l.delay) continue;
      const img = techRuinLeafImgs[l.imgIdx];
      if (!img || !img.complete || !img.naturalWidth) continue;
      const half = l.sz * 0.5;
      ctx.save();
      ctx.globalAlpha = env * 0.90;
      ctx.translate(l.x, l.y); ctx.rotate(l.rot);
      ctx.drawImage(img, -half, -half, l.sz, l.sz);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Falling Leaf ───────────────────────────────────────────────────────────
  _triggerFallingLeaf(t) {
    this._fallingLeaf = {
      t0: t, imgIdx: Math.floor(Math.random() * 10),
      startX: rand(0.18, 0.82),
      sz: rand(0.030, 0.055) * Math.min(this.W, this.H),
      rotS: rand(0, TAU), rotE: 0,
    };
    this._fallingLeaf.rotE = this._fallingLeaf.rotS + rand(-TAU * 1.2, TAU * 1.2);
  }
  _drawFallingLeaf(ctx, W, H, t) {
    if (!techRuinLeafImgs.length) return;
    const DUR = 9;
    const { t0, imgIdx, startX, sz, rotS, rotE } = this._fallingLeaf;
    const age = t - t0;
    if (age < 0 || age >= DUR) return;
    const p = age / DUR;
    const alpha = p < 0.06 ? p / 0.06 : p > 0.90 ? (1 - p) / 0.10 : 1;
    if (alpha < 0.01) return;
    const img = techRuinLeafImgs[imgIdx];
    if (!img || !img.complete || !img.naturalWidth) return;
    const cx   = W * startX + Math.sin(p * Math.PI * 2.4) * W * 0.038;
    const cy   = H * (-0.03 + p * 1.06);
    const rot  = rotS + (rotE - rotS) * p;
    const half = sz * 0.5;
    ctx.save();
    ctx.globalAlpha = alpha * 0.90;
    ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.drawImage(img, -half, -half, sz, sz);
    ctx.restore();
  }

  // ── Creature Scurry ────────────────────────────────────────────────────────
  _triggerCreature(t) {
    this._creature = { t0: t, dir: Math.random() < 0.5 ? 1 : -1, gFrac: rand(0.78, 0.86) };
  }
  _drawCreature(ctx, W, H, t) {
    const DUR = 3.8;
    const { t0, dir, gFrac } = this._creature;
    const age = t - t0;
    if (age < 0 || age >= DUR) return;
    const p = age / DUR;
    const fadeIn  = p < 0.08 ? p / 0.08 : 1;
    const fadeOut = p > 0.88 ? (1 - p) / 0.12 : 1;
    const startX  = dir > 0 ? -42 : W + 42;
    const endX    = dir > 0 ? W + 42 : -42;
    const cx      = startX + (endX - startX) * p;
    const bobY    = Math.abs(Math.sin(age * 28.0)) * H * 0.006;
    const sc      = this._s();
    ctx.save();
    ctx.globalAlpha = fadeIn * fadeOut;
    ctx.translate(cx, H * gFrac - bobY);
    if (dir < 0) ctx.scale(-1, 1);
    const cw = 18 * sc, ch = 8 * sc;
    ctx.fillStyle = 'rgba(14,9,4,0.90)';
    ctx.beginPath(); ctx.ellipse(0, 0, cw * 0.50, ch * 0.50, -0.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cw * 0.42, -ch * 0.05, ch * 0.42, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cw * 0.62, -ch * 0.05, ch * 0.22, ch * 0.16, 0.18, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-cw * 0.44, ch * 0.1);
    ctx.quadraticCurveTo(-cw * 0.68, -ch * 0.38, -cw * 0.58, -ch * 0.68);
    ctx.strokeStyle = 'rgba(14,9,4,0.90)'; ctx.lineWidth = ch * 0.18; ctx.stroke();
    ctx.restore();
  }

  // ── Rain Drips ─────────────────────────────────────────────────────────────
  _makeAmbSheet(scattered) {
    const W = this.W, H = this.H;
    return {
      x: rand(-W * 0.18, W * 1.08), y: scattered ? rand(-H * 0.08, H * 1.08) : rand(-H * 0.22, 0),
      vx: rand(-1.7, -0.45), vy: rand(8.5, 15.5), len: rand(22, 44), a: rand(0.45, 1.0),
    };
  }
  _makeAmbDrip(scattered) {
    const W = this.W, H = this.H;
    const floorY = H * rand(0.72, 0.90);
    return { x: rand(W * 0.03, W * 0.97), y: scattered ? rand(0, floorY) : rand(-H * 0.10, 0),
      vy: rand(4.0, 7.2), len: rand(12, 23), floorY, splashT: -Infinity, splashed: false };
  }
  _initRainAmb() {
    this._ambDrips  = Array.from({ length: 486 }, () => this._makeAmbDrip(true));
    this._ambSheets = Array.from({ length: 2340 }, () => this._makeAmbSheet(true));
    this._ambPH1 = rand(0, TAU); this._ambPH2 = rand(0, TAU);
    this._heavyRain = { t0: -Infinity, pts: [], mist: [], splashes: [] };
  }
  _ambIntensity(t) {
    const vis = Math.min(1, this._rainStir / 8);
    if (vis <= 0) return 0;
    const raw = Math.sin(t * 0.095 + this._ambPH1) * Math.sin(t * 0.143 + this._ambPH2);
    return clamp((0.42 + Math.max(0, raw) * 0.58) * vis, 0, 1);
  }
  _triggerHeavyRain(t) {
    const W = this.W, H = this.H;
    this._heavyRain.t0 = t;
    this._heavyRain.pts = Array.from({ length: 1500 }, () => ({
      x: rand(-W * 0.16, W * 1.08), y: rand(-H * 0.10, H * 1.05),
      vx: rand(-1.9, -0.55), vy: rand(16, 31), len: rand(18, 42), w: rand(0.65, 1.35), a: rand(0.46, 1.0),
    }));
    this._heavyRain.mist = Array.from({ length: 14 }, (_, i) => ({
      x: rand(-W * 0.65, W * 1.10), y: rand(-H * 0.08, H * 1.05),
      rx: W * rand(0.22, 0.52), ry: H * rand(0.12, 0.32),
      vx: rand(0.45, 1.65), vy: rand(-0.18, 0.18), rot: rand(-0.28, 0.18),
      phase: i * 1.17 + rand(0, TAU), a: rand(0.14, 0.38),
    }));
    this._heavyRain.splashes = Array.from({ length: 90 }, () => ({
      x: rand(W * 0.02, W * 0.98), floorY: H * rand(0.73, 0.96),
      splashT: t + rand(-0.42, 0.9), nextIn: rand(0.13, 0.52), scale: rand(0.55, 1.45),
    }));
  }
  _updateRainAmb(dt, t) {
    this._rainStir *= Math.pow(0.93, dt / 16.667);
    if (this._rainStir < 0.001) this._rainStir = 0;
    const step = dt / 16.667;
    const W = this.W, H = this.H;
    if (this._rainStir > 0) {
      for (const d of this._ambSheets) {
        d.x += d.vx * step; d.y += d.vy * step;
        if (d.y > H + d.len || d.x < -W * 0.25) Object.assign(d, this._makeAmbSheet(false));
      }
      for (const d of this._ambDrips) {
        if (d.splashed) { if (t - d.splashT > 0.45) Object.assign(d, this._makeAmbDrip(false)); continue; }
        d.y += d.vy * step;
        if (d.y > d.floorY) { d.splashed = true; d.splashT = t; }
      }
    }
    const hr = this._heavyRain;
    const hAge = t - hr.t0;
    const HEAVY_DUR = 6.5, HEAVY_FADE = 1.4;
    if (hAge >= 0 && hAge < HEAVY_DUR + HEAVY_FADE) {
      for (const d of hr.pts) {
        d.x += d.vx * step; d.y += d.vy * step;
        if (hAge < HEAVY_DUR && (d.y > H + d.len || d.x < -W * 0.28)) Object.assign(d, { x: rand(-W * 0.16, W * 1.08), y: rand(-H * 0.18, 0), vx: rand(-1.9, -0.55), vy: rand(16, 31) });
      }
      if (hAge < HEAVY_DUR) {
        for (const b of hr.mist) {
          b.x += b.vx * step; b.y += b.vy * step;
          if (b.x > W + b.rx * 0.75) Object.assign(b, { x: -b.rx * 1.25 });
        }
        for (const s of hr.splashes) {
          if (t - s.splashT > s.nextIn) {
            s.x = rand(W * 0.02, W * 0.98); s.floorY = H * rand(0.73, 0.96);
            s.splashT = t; s.nextIn = rand(0.13, 0.52); s.scale = rand(0.55, 1.45);
          }
        }
      }
    }
  }
  _drawRainDrips(ctx, W, H, t) {
    ctx.save();
    const ai = this._ambIntensity(t);
    if (ai > 0.01) {
      const baseAlpha = ai * 0.72;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(64,92,108,${(ai * 0.085).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      for (const d of this._ambSheets) {
        ctx.strokeStyle = `rgba(170,215,232,${(baseAlpha * d.a * 0.58).toFixed(3)})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * d.len * 0.34, d.y - d.len); ctx.stroke();
      }
      for (const d of this._ambDrips) {
        if (d.splashed) {
          const sp = (t - d.splashT) / 0.45;
          if (sp < 1) {
            ctx.strokeStyle = `rgba(160,205,225,${(baseAlpha * (1 - sp) * 0.65).toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.ellipse(d.x, d.floorY, sp * 6, sp * 2.0, 0, 0, TAU); ctx.stroke();
          }
          continue;
        }
        ctx.strokeStyle = `rgba(160,205,225,${baseAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.15;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.len * 0.14, d.y - d.len); ctx.stroke();
      }
    }
    const hr = this._heavyRain;
    const hAge = t - hr.t0;
    const HEAVY_DUR = 6.5, HEAVY_FADE = 1.4;
    if (hAge >= 0 && hAge < HEAVY_DUR + HEAVY_FADE) {
      const env = Math.min(hAge / 0.75, 1) * Math.min(1, Math.max(0, (HEAVY_DUR - hAge) / HEAVY_FADE));
      if (env > 0.01) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(34,52,62,${(env * 0.46).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = `rgba(168,184,182,${(env * 0.10).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
        for (const b of hr.mist) {
          const wx = Math.sin(t * 1.1 + b.phase) * b.rx * 0.07;
          const wy = Math.cos(t * 1.7 + b.phase * 0.7) * b.ry * 0.10;
          const grd = ctx.createRadialGradient(b.x + wx, b.y + wy, 0, b.x + wx, b.y + wy, Math.max(b.rx, b.ry));
          const a = env * b.a;
          grd.addColorStop(0,    `rgba(190,202,198,${(a * 0.30).toFixed(3)})`);
          grd.addColorStop(0.38, `rgba(150,170,170,${(a * 0.18).toFixed(3)})`);
          grd.addColorStop(0.72, `rgba(100,124,132,${(a * 0.09).toFixed(3)})`);
          grd.addColorStop(1,    'rgba(110,130,136,0)');
          ctx.fillStyle = grd;
          ctx.save(); ctx.translate(b.x + wx, b.y + wy);
          ctx.rotate(b.rot + Math.sin(t * 0.7 + b.phase) * 0.05);
          ctx.beginPath(); ctx.ellipse(0, 0, b.rx, b.ry, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (const d of hr.pts) {
          const alpha = env * d.a * 0.88;
          if (alpha < 0.035) continue;
          ctx.strokeStyle = `rgba(218,238,242,${alpha.toFixed(3)})`;
          ctx.lineWidth = d.w;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * d.len * 0.24, d.y - d.len); ctx.stroke();
        }
        for (const s of hr.splashes) {
          const sp = (t - s.splashT) / 0.36;
          if (sp < 0 || sp >= 1) continue;
          const a = env * (1 - sp) * 0.48;
          ctx.strokeStyle = `rgba(185,225,238,${a.toFixed(3)})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath(); ctx.ellipse(s.x, s.floorY, sp * 20 * s.scale, sp * 4.6 * s.scale, 0, 0, TAU); ctx.stroke();
          if (sp < 0.45) {
            ctx.strokeStyle = `rgba(225,242,248,${(a * 0.8).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(s.x - 5 * s.scale, s.floorY - sp * 8 * s.scale);
            ctx.lineTo(s.x + 5 * s.scale, s.floorY - sp * 10 * s.scale);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }
}

// ─── SPACE-CHURCH SCENE ───────────────────────────────────────────────────────

const SC_ANCHORS = {
  plasmaCenter:     [836, 473],
  archArcLeft:      [371,  76],
  archArcRight:     [1300, 76],
  pillar1TopLeft:   [557, 625], pillar1TopRight:  [617, 623], pillar1ImageTop:  [592, 512], pillar1Lowest:   [607, 626],
  pillar2TopLeft:   [131, 681], pillar2TopRight:  [284, 674], pillar2ImageTop:  [225, 414], pillar2Lowest:   [223, 684],
  pillar3TopLeft:  [1052, 623], pillar3TopRight: [1121, 626], pillar3ImageTop: [1082, 512], pillar3Lowest:  [1061, 627],
  pillar4TopLeft:  [1192, 640], pillar4TopRight: [1281, 645], pillar4ImageTop: [1242, 491], pillar4Lowest:  [1215, 646],
  pillar5TopLeft:  [1386, 676], pillar5TopRight: [1555, 683], pillar5ImageTop: [1438, 366], pillar5Lowest:  [1443, 686],
  pillar6TopLeft:   [381, 645], pillar6TopRight:  [481, 641], pillar6ImageTop:  [435, 480], pillar6Lowest:   [444, 647],
  robotLeftEntry:   [474, 670], robotCenter:      [840, 676], robotRightEntry: [1200, 676], robotExit:       [849, 938],
  robotOccLeft1:    [558, 666], robotOccLeft2:    [613, 666], robotOccRight1: [1059, 671],  robotOccRight2: [1115, 674],
  robotEntryOccLeft1:  [434, 645], robotEntryOccLeft2:  [489, 645],
  robotEntryOccRight1: [1240, 643], robotEntryOccRight2: [1182, 645],
};

// Portrait image (941×1672) — measured with ?debug 2026-05-31
const SC_ANCHORS_P = {
  plasmaCenter:  [466, 891],
  archArcLeft:   [255, 555],
  archArcRight:  [685, 555],
  // Pillar anchors — measured with ?debug 2026-06-03 (TL=TR=pedestal-top-center; ImageTop offset by depth)
  pillar1TopLeft:  [311,1071], pillar1TopRight:  [311,1071], pillar1ImageTop:  [311, 931], pillar1Lowest:  [311,1071],
  pillar2TopLeft:  [ 96,1144], pillar2TopRight:  [ 96,1144], pillar2ImageTop:  [ 96, 897], pillar2Lowest:  [ 96,1144],
  pillar3TopLeft:  [624,1069], pillar3TopRight:  [624,1069], pillar3ImageTop:  [624, 929], pillar3Lowest:  [624,1069],
  pillar4TopLeft:  [704,1096], pillar4TopRight:  [704,1096], pillar4ImageTop:  [704, 911], pillar4Lowest:  [704,1096],
  pillar5TopLeft:  [845,1147], pillar5TopRight:  [845,1147], pillar5ImageTop:  [845, 829], pillar5Lowest:  [845,1147],
  pillar6TopLeft:  [232,1098], pillar6TopRight:  [232,1098], pillar6ImageTop:  [232, 913], pillar6Lowest:  [232,1098],
};

const scHoloImgs   = { sword: [], soldier: [], angel: [], abstract: [], priest: [], alien: [] };
const scRobotImgs  = {};
async function preloadSpaceChurchSprites() {
  const base = 'assets/scenes/space-church/sprites/';
  const sets  = [['sword','sword_holo'],['soldier','soldier_holo'],['angel','angel_holo'],
                 ['abstract','abstract_holo'],['priest','priest_holo'],['alien','alien_holo']];
  await Promise.all([
    ...sets.flatMap(([key, pfx]) =>
      Array.from({ length: 10 }, (_, i) =>
        loadImage(`${base}${pfx}_${String(i + 1).padStart(2, '0')}.png`).then(img => { scHoloImgs[key].push(img); })
      )
    ),
    loadImage(`${base}robot_side.png`).then(      img => { scRobotImgs.side      = img; }),
    loadImage(`${base}robot_turn_left.png`).then( img => { scRobotImgs.turnLeft  = img; }),
    loadImage(`${base}robot_turn_right.png`).then(img => { scRobotImgs.turnRight = img; }),
    loadImage(`${base}robot_front.png`).then(     img => { scRobotImgs.front     = img; }),
    loadImage(`${base}float_robot_descent.png`).then(img => { scRobotImgs.floatDescent = img; }),
    loadImage(`${base}float_robot_side.png`).then(   img => { scRobotImgs.floatSide    = img; }),
    loadImage(`${base}float_robot_look.png`).then(   img => { scRobotImgs.floatLook    = img; }),
  ]);
}

class SpaceChurchOverlay {
  // ── Helpers ──────────────────────────────────────────────────────────────────
  _s()         { if (!this.img) return 1; const { sw } = _coverParams(this.img, this.W, this.H); return this.W / sw; }
  _ptc(px, py) { return paintToCanvas(px, py, this.img, this.W, this.H); }
  _anc(key)    { return ((this.W <= this.H) ? SC_ANCHORS_P : SC_ANCHORS)[key] || SC_ANCHORS[key]; }
  _ready()     { return this.img && this.img.naturalWidth; }

  // ── Init ─────────────────────────────────────────────────────────────────────
  init(W, H, img) {
    this.W = W; this.H = H; this.img = img;
    this._initPillars();
    this._plasmaArms  = []; this._plasmaRegenAt = -999;
    this._eruptArms   = []; this._eruptRegenAt  = -999;
    this._initStars();
    this._catDimEnv   = 0; this._catDim  = { active: false, startAt: -1 };
    this._archArc     = { active: false, startAt: -1 };
    this._portalSurge = { active: false, startAt: -1 };
    this._eruption    = { active: false, startAt: -1 };
    this._runeFlash   = { active: false, startAt: -1, targets: [] };
    this._floorConv   = { active: false, startT: -1, mul: 1.0, adjs: null, env: 0, phaseAdjs: [] };
    this._robot       = { active: false, startAt: -1, dir: 0 };
    this._floatRobot  = { active: false, startAt: -1, dir: 0 };
    this._pulsarRipple = { active: false, startAt: -1 };
    this._initEventTimers();
  }

  _def(min, max) { return { min, max, next: min * (0.4 + Math.random() * 0.8) }; }
  _initEventTimers() {
    this._ev = {
      hologram_glitch:   this._def(18, 40),
      floor_convergence: this._def(30, 65),
      arch_arc:          this._def(22, 48),
      portal_surge:      this._def(35, 80),
      plasma_eruption:   this._def(40, 90),
      cathedral_dimming: this._def(120, 240),
      rune_flash:        this._def(30, 70),
      robot_procession:  this._def(45, 100),
      float_robot:       this._def(50, 110),
      pulsar_ripple:     this._def(28, 60),
    };
  }

  // ── Pillar display factory ────────────────────────────────────────────────────
  _initPillars() {
    const SWITCH_MS = 12000, FADE_MS = 1000;
    const self = this;
    function makePillar(imgs, tl, tr, it, lo, scale, offsetMS) {
      let curIdx = 0, nextIdx = 1, switchAt = -1, fading = false, fadeStart = 0;
      let glitching = false, glitchStart = -1;
      const GLITCH_DUR  = 3000;
      const GLITCH_FMSEC = GLITCH_DUR / (imgs.length * 3);
      const MAX_P = 7, parts = [];
      function getRect() {
        if (!self._ready()) return null;
        const ancTL = self._anc(tl), ancTR = self._anc(tr), ancTC = self._anc(it);
        if (!ancTL || !ancTR || !ancTC) return null;
        const sTL = self._ptc(...ancTL), sTR = self._ptc(...ancTR), sTC = self._ptc(...ancTC);
        const s    = self._s();
        const loAnc = self._anc(lo);
        const pillarY = loAnc ? self._ptc(...loAnc).y : (sTL.y + sTR.y) / 2;
        const img0 = imgs[0];
        if (!img0 || !img0.complete || !img0.naturalWidth) return null;
        const h = (pillarY - sTC.y) * scale;
        const w = h * (img0.naturalWidth / img0.naturalHeight);
        return { x: (sTL.x + sTR.x) / 2 - w / 2, y: pillarY - h, w, h };
      }
      function drawGlow(ctx, now) {
        const r = getRect(); if (!r) return;
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.0013);
        const alpha = 0.13 + pulse * 0.07;
        const halo  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.62);
        halo.addColorStop(0,   `rgba(120,190,255,${alpha})`);
        halo.addColorStop(0.5, `rgba(60,130,255,${alpha * 0.5})`);
        halo.addColorStop(1,   'rgba(0,0,80,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.ellipse(cx, cy, r.w * 0.62, r.h * 0.52, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      function drawParticles(ctx, dt) {
        const r = getRect(); if (!r) return;
        if (parts.length < MAX_P && Math.random() < 0.05)
          parts.push({ x: r.x + rand(0, r.w), y: r.y + rand(0, r.h),
            vx: rand(-0.12, 0.12), vy: rand(-0.30, -0.06), life: 0, maxLife: rand(900, 1800), r: rand(0.7, 1.5) });
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.life += dt; p.x += p.vx; p.y += p.vy;
          if (p.life >= p.maxLife) { parts.splice(i, 1); continue; }
          const al = Math.sin((p.life / p.maxLife) * Math.PI) * 0.55;
          const g  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
          g.addColorStop(0,   `rgba(200,230,255,${al})`);
          g.addColorStop(0.5, `rgba(100,180,255,${al * 0.4})`);
          g.addColorStop(1,   'rgba(0,40,180,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.5, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      function startGlitch() { glitching = true; glitchStart = -1; }
      function drawImage(ctx, now) {
        const r = getRect(); if (!r) return;
        if (glitching) {
          if (glitchStart < 0) glitchStart = now;
          const el = now - glitchStart;
          if (el >= GLITCH_DUR) { glitching = false; glitchStart = -1; }
          else { const gi = imgs[Math.floor(el / GLITCH_FMSEC) % imgs.length]; if (gi && gi.complete && gi.naturalWidth) ctx.drawImage(gi, r.x, r.y, r.w, r.h); return; }
        }
        const img0 = imgs[curIdx];
        if (!img0 || !img0.complete || !img0.naturalWidth) return;
        if (switchAt < 0) switchAt = now + offsetMS;
        if (!fading && now >= switchAt) { fading = true; fadeStart = now; }
        if (!fading) {
          ctx.drawImage(img0, r.x, r.y, r.w, r.h);
        } else {
          const p = Math.min(1, (now - fadeStart) / FADE_MS);
          ctx.save(); ctx.globalAlpha = 1 - p; ctx.drawImage(img0, r.x, r.y, r.w, r.h); ctx.restore();
          const img1 = imgs[nextIdx];
          if (img1 && img1.complete && img1.naturalWidth) { ctx.save(); ctx.globalAlpha = p; ctx.drawImage(img1, r.x, r.y, r.w, r.h); ctx.restore(); }
          if (p >= 1) { curIdx = nextIdx; nextIdx = (nextIdx + 1) % imgs.length; fading = false; switchAt = now + SWITCH_MS; }
        }
      }
      return { drawGlow, drawImage, drawParticles, startGlitch };
    }
    const h = scHoloImgs;
    this._pillars = [
      makePillar(h.sword,    'pillar1TopLeft','pillar1TopRight','pillar1ImageTop','pillar1Lowest', 1.0,    2000),
      makePillar(h.soldier,  'pillar2TopLeft','pillar2TopRight','pillar2ImageTop','pillar2Lowest', 1.25,   4000),
      makePillar(h.angel,    'pillar3TopLeft','pillar3TopRight','pillar3ImageTop','pillar3Lowest', 1.0,    6000),
      makePillar(h.abstract, 'pillar4TopLeft','pillar4TopRight','pillar4ImageTop','pillar4Lowest', 1.1,    8000),
      makePillar(h.priest,   'pillar5TopLeft','pillar5TopRight','pillar5ImageTop','pillar5Lowest', 0.972, 10000),
      makePillar(h.alien,    'pillar6TopLeft','pillar6TopRight','pillar6ImageTop','pillar6Lowest', 1.1,   12000),
    ];
  }

  // ── Starfield seed ────────────────────────────────────────────────────────────
  _initStars() {
    const OUTER = [[713,537],[712,364],[750,319],[839,178],[921,317],[954,364],[957,553]];
    const INNER = [[728,545],[736,462],[836,318],[922,448],[949,516],[942,552]];
    // Portrait arch polygon (941×1672 paint space) — measured with ?debug 2026-05-31
    const OUTERP = [[370,945],[370,815],[399,779],[468,621],[533,771],[558,813],[561,945]];
    const INNERP  = [[550,935],[522,892],[487,786],[446,783],[404,898],[382,942]];
    function pip(px, py, poly) {
      let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) ins = !ins;
      }
      return ins;
    }
    const PALS = [
      ['255,255,255','200,215,255','90,110,255'], ['255,255,255','190,255,245','40,200,180'],
      ['255,230,255','225,160,255','160,80,255'], ['255,255,210','255,225,140','210,155,50'],
      ['255,240,255','255,165,220','210,75,160'], ['210,245,255','130,205,255','50,140,245'],
      ['255,255,255','200,255,210','60,200,120'],
    ];
    function seedStars(outer, inner, count) {
      const minX = Math.min(...outer.map(p => p[0])), maxX = Math.max(...outer.map(p => p[0]));
      const minY = Math.min(...outer.map(p => p[1])), maxY = Math.max(...outer.map(p => p[1]));
      const out = []; let tries = 0;
      while (out.length < count && tries < 20000) {
        tries++;
        const px = minX + Math.random() * (maxX - minX), py = minY + Math.random() * (maxY - minY);
        if (!pip(px, py, outer) || pip(px, py, inner)) continue;
        const roll = Math.random();
        out.push({ px, py, phase: Math.random() * TAU, freq: 0.0005 + Math.random() * 0.0015,
          r: roll < 0.07 ? rand(2.5, 4.5) : roll < 0.25 ? rand(1.2, 2.5) : rand(0.4, 1.2),
          tier: roll < 0.07 ? 2 : roll < 0.25 ? 1 : 0, pal: Math.floor(Math.random() * PALS.length) });
      }
      return out;
    }
    this._stars  = seedStars(OUTER,  INNER,  80);
    this._starsP = seedStars(OUTERP, INNERP, 80);
    this._starOUTER = OUTER; this._starINNER = INNER;
    this._starOUTERP = OUTERP; this._starINNERP = INNERP;
    this._starPALS = PALS;
  }

  // ── Update ────────────────────────────────────────────────────────────────────
  update(dt, t) {
    this._t = t; this._lastDt = dt;
    for (const [name, tm] of Object.entries(this._ev)) {
      if (t >= tm.next) this._fireEvent(name, t);
    }
  }

  _fireEvent(name, t) {
    const tm = this._ev[name];
    if (tm) tm.next = t + tm.min + Math.random() * (tm.max - tm.min);
    const now = t * 1000;
    switch (name) {
      case 'hologram_glitch':   this._pillars[Math.floor(Math.random() * 6)].startGlitch(); break;
      case 'floor_convergence': this._triggerFloorConv(now); break;
      case 'arch_arc':          this._archArc  = { active: true, startAt: -1 }; break;
      case 'portal_surge':      this._portalSurge = { active: true, startAt: -1 }; break;
      case 'plasma_eruption':   if (!this._eruption.active) { this._eruption = { active: true, startAt: -1 }; this._eruptArms = []; this._eruptRegenAt = -999; } break;
      case 'cathedral_dimming': if (!this._catDim.active) this._catDim = { active: true, startAt: -1 }; break;
      case 'rune_flash':        this._triggerRuneFlash(); break;
      case 'robot_procession':  if (!this._robot.active)      this._robot      = { active: true, startAt: -1, dir: Math.random() < 0.5 ? -1 : 1 }; break;
      case 'float_robot':       if (!this._floatRobot.active) this._floatRobot = { active: true, startAt: -1, dir: Math.random() < 0.5 ? -1 : 1 }; break;
      case 'pulsar_ripple':     if (!this._pulsarRipple.active) this._pulsarRipple = { active: true, startAt: -1 }; break;
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────
  draw(ctx, W, H, t) {
    this.W = W; this.H = H;
    const now = t * 1000;
    if (W <= H) {
      this._tickCatDim(now);
      this._drawCathedralDimming(ctx, W, H);
      this._drawBackWindowStars(ctx, W, H, now);
      this._drawGodRaysPortrait(ctx, W, H, t);
      this._drawPlasmaBall(ctx, W, H, now);
      this._tickFloorConv(now);
      this._drawFloorLines(ctx, W, H, now);
      for (const p of this._pillars) p.drawGlow(ctx, now);
      for (const p of this._pillars) p.drawImage(ctx, now);
      for (const p of this._pillars) p.drawParticles(ctx, this._lastDt || 16);
      return;
    }
    this._tickCatDim(now);
    this._drawCathedralDimming(ctx, W, H);
    this._drawBackWindowStars(ctx, W, H, now);
    this._drawGodRays(ctx, W, H, now);
    this._drawPlasmaBall(ctx, W, H, now);
    this._drawPlasmaEruption(ctx, W, H, now);
    this._drawPortalSurge(ctx, W, H, now);
    this._drawArchArc(ctx, W, H, now);
    for (const p of this._pillars) p.drawGlow(ctx, now);
    for (const p of this._pillars) p.drawImage(ctx, now);
    this._drawRuneFlash(ctx, W, H, now);
    this._tickFloorConv(now);
    this._drawFloorLines(ctx, W, H, now);
    this._drawGroundFog(ctx, W, H, now);
    this._drawPulsarRipple(ctx, W, H, now);
    this._drawRobotProcession(ctx, W, H, now);
    for (const p of this._pillars) p.drawParticles(ctx, this._lastDt || 16);
    this._drawFloatRobot(ctx, W, H, now);
  }

  // ── Portrait fallback ─────────────────────────────────────────────────────────
  _drawGodRaysPortrait(ctx, W, H, t) {
    const SHAFTS = [
      { nx: 0.20, angle: -0.08, phase: 0.0 },
      { nx: 0.40, angle: -0.03, phase: 1.2 },
      { nx: 0.60, angle:  0.03, phase: 2.6 },
      { nx: 0.80, angle:  0.08, phase: 4.1 },
    ];
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const sh of SHAFTS) {
      const pulse = 0.45 + 0.35 * Math.sin(t * 0.22 + sh.phase) + 0.20 * Math.sin(t * 0.57 + sh.phase * 1.5);
      const cx  = W * sh.nx;
      const tip = -H * 0.05;
      const len = H * 1.1;
      const hw  = W * 0.08;
      const bx0 = cx - hw + Math.tan(sh.angle) * len * 0.5;
      const bx1 = cx + hw + Math.tan(sh.angle) * len * 0.5;
      const grad = ctx.createLinearGradient(cx, tip, cx, tip + len);
      const a0 = 0.06 * pulse, a1 = 0.0;
      grad.addColorStop(0,   `rgba(200,180,255,${a0.toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(160,120,255,${(a0 * 0.55).toFixed(3)})`);
      grad.addColorStop(1,   `rgba(120,80,220,${a1})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, tip);
      ctx.lineTo(bx0, tip + len);
      ctx.lineTo(bx1, tip + len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Cathedral dimming ──────────────────────────────────────────────────────────
  _tickCatDim(now) {
    const cd = this._catDim;
    if (!cd.active) { this._catDimEnv = 0; return; }
    if (cd.startAt < 0) cd.startAt = now;
    const e = now - cd.startAt;
    const FI = 5000, HO = 20000, FO = 5000, TOT = FI + HO + FO;
    if (e >= TOT) { cd.active = false; this._catDimEnv = 0; return; }
    const p = e < FI ? e / FI : e < FI + HO ? 1.0 : 1 - (e - FI - HO) / FO;
    this._catDimEnv = p * p * (3 - 2 * p);
  }
  _catBB() { return 1 + this._catDimEnv * 0.5; }
  _drawCathedralDimming(ctx, W, H) {
    if (this._catDimEnv < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,20,${(this._catDimEnv * 0.35).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Back window stars ──────────────────────────────────────────────────────────
  _drawBackWindowStars(ctx, W, H, now) {
    if (!this._ready()) return;
    const portrait = W <= H;
    const OUTER = portrait ? this._starOUTERP : this._starOUTER;
    const INNER = portrait ? this._starINNERP : this._starINNER;
    const stars  = portrait ? this._starsP    : this._stars;
    const PALS = this._starPALS;
    const s = this._s();
    ctx.save();
    ctx.beginPath();
    const os = OUTER.map(([px, py]) => this._ptc(px, py));
    ctx.moveTo(os[0].x, os[0].y);
    for (let i = 1; i < os.length; i++) ctx.lineTo(os[i].x, os[i].y);
    ctx.closePath();
    const is = INNER.map(([px, py]) => this._ptc(px, py));
    ctx.moveTo(is[0].x, is[0].y);
    for (let i = 1; i < is.length; i++) ctx.lineTo(is[i].x, is[i].y);
    ctx.closePath();
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'screen';
    for (const star of stars) {
      const sc    = this._ptc(star.px, star.py);
      const pulse = 0.5 + 0.5 * Math.sin(now * star.freq + star.phase);
      const r     = star.r * s;
      const [core, mid, glow] = PALS[star.pal];
      if (star.tier === 2) {
        const al = 0.5 + pulse * 0.5;
        const gr = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, r * 5);
        gr.addColorStop(0,   `rgba(255,255,255,${al})`);
        gr.addColorStop(0.2, `rgba(${mid},${al * 0.7})`);
        gr.addColorStop(0.6, `rgba(${glow},${al * 0.25})`);
        gr.addColorStop(1,   `rgba(${glow},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sc.x, sc.y, r * 5, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(${core},${al * 0.55})`; ctx.lineWidth = r * 0.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sc.x - r * 2.5, sc.y); ctx.lineTo(sc.x + r * 2.5, sc.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sc.x, sc.y - r * 2.5); ctx.lineTo(sc.x, sc.y + r * 2.5); ctx.stroke();
      } else if (star.tier === 1) {
        const al = 0.3 + pulse * 0.55;
        const gr = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, r * 4);
        gr.addColorStop(0,   `rgba(255,255,255,${al})`); gr.addColorStop(0.3, `rgba(${mid},${al * 0.5})`); gr.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sc.x, sc.y, r * 4, 0, TAU); ctx.fill();
      } else {
        const al = 0.15 + pulse * 0.65;
        const gr = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, r * 3);
        gr.addColorStop(0,   `rgba(255,255,255,${al})`); gr.addColorStop(0.4, `rgba(${mid},${al * 0.35})`); gr.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sc.x, sc.y, r * 3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── God rays ───────────────────────────────────────────────────────────────────
  _drawGodRays(ctx, W, H, now) {
    if (!this._ready() || !this._anc('plasmaCenter')) return;
    const BEAMS = [
      { tl: 'pillar1TopLeft', tr: 'pillar1TopRight', phase: 0.0  },
      { tl: 'pillar2TopLeft', tr: 'pillar2TopRight', phase: 1.6  },
      { tl: 'pillar3TopLeft', tr: 'pillar3TopRight', phase: 3.1  },
      { tl: 'pillar4TopLeft', tr: 'pillar4TopRight', phase: 4.8  },
      { tl: 'pillar5TopLeft', tr: 'pillar5TopRight', phase: 2.25 },
      { tl: 'pillar6TopLeft', tr: 'pillar6TopRight', phase: 0.9  },
    ];
    const src = this._ptc(...SC_ANCHORS.plasmaCenter);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const bm of BEAMS) {
      const tl = SC_ANCHORS[bm.tl], tr = SC_ANCHORS[bm.tr];
      if (!tl || !tr) continue;
      const stl = this._ptc(...tl), str = this._ptc(...tr);
      const pcx = (stl.x + str.x) / 2, pcy = (stl.y + str.y) / 2;
      const pulse = 0.56 + 0.26 * Math.sin(now * 0.00025 + bm.phase)
                       + 0.12 * Math.sin(now * 0.00082 + bm.phase * 1.7)
                       + 0.06 * Math.sin(now * 0.00200 + bm.phase * 2.3);
      const grad = ctx.createLinearGradient(src.x, src.y, pcx, pcy);
      const a0 = 0.20 * pulse, a1 = 0.40 * pulse;
      grad.addColorStop(0,   `rgba(200,180,255,${a0.toFixed(3)})`);
      grad.addColorStop(0.7, `rgba(180,140,255,${a1.toFixed(3)})`);
      grad.addColorStop(1,   `rgba(210,190,255,${(a1 * 0.5).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(str.x, str.y); ctx.lineTo(stl.x, stl.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ── Plasma ball ────────────────────────────────────────────────────────────────
  _plasmaZZ(x0, y0, x1, y1, d, sp, pts) {
    if (d === 0) { if (!pts.length) pts.push(x0, y0); pts.push(x1, y1); return; }
    const mx = (x0+x1)/2+(Math.random()-0.5)*sp, my = (y0+y1)/2+(Math.random()-0.5)*sp;
    this._plasmaZZ(x0,y0,mx,my,d-1,sp*0.58,pts); this._plasmaZZ(mx,my,x1,y1,d-1,sp*0.58,pts);
  }
  _plasmaLerp(a, b, p) { const o = new Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i]+(b[i]-a[i])*p; return o; }
  _plasmaStroke(ctx, pts, lw, al, rgb) {
    if (pts.length < 4) return;
    ctx.strokeStyle = `rgba(${rgb},${al})`; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i+1]);
    ctx.stroke();
  }
  _plasmaRegen(c, R, drift, arms, N, branchChance) {
    if (!arms.length) {
      for (let k = 0; k < N; k++) {
        const ang = (k/N)*TAU + drift + (Math.random()-0.5)*0.25;
        const pts = []; this._plasmaZZ(c.x, c.y, c.x+Math.cos(ang)*R, c.y+Math.sin(ang)*R, 4, R*0.30, pts);
        let bpts = null;
        if (Math.random() < branchChance) {
          const bi = Math.floor(2+Math.random()*(pts.length/2-3))*2;
          const bang = ang + (Math.random()-0.5)*1.7, bR = R*(0.28+Math.random()*0.38);
          bpts = []; this._plasmaZZ(pts[bi],pts[bi+1],pts[bi]+Math.cos(bang)*bR,pts[bi+1]+Math.sin(bang)*bR,3,bR*0.36,bpts);
        }
        arms.push({ fromPts: pts, toPts: pts, fromBpts: bpts, toBpts: bpts, phase: Math.random()*TAU });
      }
    } else {
      for (let k = 0; k < arms.length; k++) {
        arms[k].fromPts = arms[k].toPts; arms[k].fromBpts = arms[k].toBpts;
        const ang = (k/N)*TAU + drift + (Math.random()-0.5)*0.25;
        const pts = []; this._plasmaZZ(c.x, c.y, c.x+Math.cos(ang)*R, c.y+Math.sin(ang)*R, 4, R*0.30, pts);
        let bpts = null;
        if (Math.random() < 0.42) {
          const bi = Math.floor(2+Math.random()*(pts.length/2-3))*2;
          const bang = ang+(Math.random()-0.5)*1.7, bR = R*(0.28+Math.random()*0.38);
          bpts=[]; this._plasmaZZ(pts[bi],pts[bi+1],pts[bi]+Math.cos(bang)*bR,pts[bi+1]+Math.sin(bang)*bR,3,bR*0.36,bpts);
        }
        arms[k].toPts = pts; arms[k].toBpts = bpts;
      }
    }
  }
  _drawPlasmaBall(ctx, W, H, now) {
    if (!this._ready() || !this._anc('plasmaCenter')) return;
    const REGEN = 2000, TRANS = 2000, RADIUS_PX = 160, TENDRIL_N = 4;
    const s = this._s();
    const c = this._ptc(...this._anc('plasmaCenter'));
    const R = RADIUS_PX * s;
    const drift = now * 0.000048;
    if (now - this._plasmaRegenAt > REGEN) { this._plasmaRegen(c, R, drift, this._plasmaArms, TENDRIL_N, 0.42); this._plasmaRegenAt = now; }
    if (!this._plasmaArms.length) return;
    const transP = (function sm(p){return p*p*(3-2*p)})(Math.min(1,(now-this._plasmaRegenAt)/TRANS));
    const bb  = this._catBB();
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.00097);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const sph = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R * 1.15);
    sph.addColorStop(0,    `rgba(230,180,255,${((0.32+pulse*0.18)*bb).toFixed(3)})`);
    sph.addColorStop(0.25, `rgba(160,80,255,${((0.22+pulse*0.10)*bb).toFixed(3)})`);
    sph.addColorStop(0.65, `rgba(80,20,200,${(0.10*bb).toFixed(3)})`);
    sph.addColorStop(1,    'rgba(30,0,100,0)');
    ctx.fillStyle = sph; ctx.beginPath(); ctx.arc(c.x, c.y, R*1.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(190,130,255,${((0.20+pulse*0.09)*bb).toFixed(3)})`; ctx.lineWidth = s*1.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(240,210,255,${((0.28+pulse*0.10)*bb).toFixed(3)})`; ctx.lineWidth = s*0.7;
    ctx.beginPath(); ctx.arc(c.x, c.y, R, Math.PI*1.15, Math.PI*1.72); ctx.stroke();
    for (const { fromPts, toPts, fromBpts, toBpts, phase } of this._plasmaArms) {
      const fl  = 0.65 + 0.35 * Math.sin(now * 0.0018 + phase);
      const pts = this._plasmaLerp(fromPts, toPts, transP);
      this._plasmaStroke(ctx, pts, s*3.8, fl*0.20*bb, '140,60,255');
      this._plasmaStroke(ctx, pts, s*1.5, fl*0.58*bb, '185,105,255');
      this._plasmaStroke(ctx, pts, s*0.5, fl*0.92*bb, '235,210,255');
      if (fromBpts && toBpts) {
        const bpts = this._plasmaLerp(fromBpts, toBpts, transP);
        this._plasmaStroke(ctx,bpts,s*2.4,fl*0.17*bb,'155,80,255'); this._plasmaStroke(ctx,bpts,s*0.9,fl*0.50*bb,'205,155,255'); this._plasmaStroke(ctx,bpts,s*0.3,fl*0.85*bb,'245,225,255');
      } else if (toBpts) {
        ctx.save(); ctx.globalAlpha = transP;
        this._plasmaStroke(ctx,toBpts,s*2.4,fl*0.17*bb,'155,80,255'); this._plasmaStroke(ctx,toBpts,s*0.9,fl*0.50*bb,'205,155,255'); this._plasmaStroke(ctx,toBpts,s*0.3,fl*0.85*bb,'245,225,255');
        ctx.restore();
      } else if (fromBpts) {
        ctx.save(); ctx.globalAlpha = 1 - transP;
        this._plasmaStroke(ctx,fromBpts,s*2.4,fl*0.17*bb,'155,80,255'); this._plasmaStroke(ctx,fromBpts,s*0.9,fl*0.50*bb,'205,155,255'); this._plasmaStroke(ctx,fromBpts,s*0.3,fl*0.85*bb,'245,225,255');
        ctx.restore();
      }
    }
    const corA = 0.62 + pulse * 0.38;
    const core = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R*0.20);
    core.addColorStop(0,    `rgba(255,248,255,${corA})`); core.addColorStop(0.45, `rgba(215,175,255,${(corA*0.55).toFixed(3)})`); core.addColorStop(1, 'rgba(140,70,255,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(c.x, c.y, R*0.20, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ── Floor convergence ──────────────────────────────────────────────────────────
  _triggerFloorConv(now) {
    const fc = this._floorConv;
    if (fc.active) return;
    fc.active = true; fc.startT = -1;
    const PEAK_MS = 3000, MAX_MUL = 5.0;
    const tPeak = now + PEAK_MS;
    fc.phaseAdjs = this._floorDefs().map(def => {
      if (!def) return 0;
      const raw = -((tPeak * def.speed * MAX_MUL) + def.phase);
      return ((raw % 1.0) + 1.0) % 1.0;
    });
  }
  _tickFloorConv(now) {
    const fc = this._floorConv;
    if (!fc.active) { fc.mul = 1.0; fc.adjs = null; fc.env = 0; return; }
    if (fc.startT < 0) fc.startT = now;
    const e = now - fc.startT;
    const RAMP = 2000, HOLD = 2000, DECAY = 3000, TOT = RAMP + HOLD + DECAY, MAX_MUL = 5.0;
    if (e >= TOT) { fc.active = false; fc.mul = 1.0; fc.adjs = null; fc.env = 0; return; }
    const sm = p => p*p*(3-2*p);
    fc.env  = e < RAMP ? sm(e/RAMP) : e < RAMP+HOLD ? 1.0 : 1-sm((e-RAMP-HOLD)/DECAY);
    fc.mul  = 1 + fc.env * (MAX_MUL - 1);
    fc.adjs = fc.phaseAdjs.map(adj => adj * fc.env);
  }
  _floorDefs() {
    if (this.W <= this.H) return this._floorDefsP();
    return [
      { points:[[7,883],[137,828],[274,784],[389,742],[469,715],[555,687]], segs:[true,false,true,false,true], speed:0.00012, phase:0.0  },
      { points:[[1668,885],[1534,829],[1398,783],[1287,744],[1201,716],[1114,683]], segs:[true,false,true,false,true], speed:0.00012, phase:0.5  },
      { points:[[466,892],[723,679]],  segs:[true], speed:0.00013, phase:0.15 },
      { points:[[573,895],[755,678]],  segs:[true], speed:0.00015, phase:0.65 },
      { points:[[1102,897],[920,681]], segs:[true], speed:0.00014, phase:0.38 },
      { points:[[1203,892],[950,679]], segs:[true], speed:0.00012, phase:0.88 },
    ];
  }
  // Portrait floor channels (941×1672 paint space) — measured with ?debug 2026-05-31
  _floorDefsP() {
    return [
      { points:[[3,1301],[56,1261],[145,1209],[202,1174],[261,1140],[286,1120]],   segs:[true,false,true,false,true], speed:0.00012, phase:0.0  },
      { points:[[940,1300],[879,1258],[785,1209],[734,1176],[678,1142],[646,1123]], segs:[true,false,true,false,true], speed:0.00012, phase:0.5  },
      { points:[[77,1610],[389,1115]],  segs:[true], speed:0.00013, phase:0.15 },
      { points:[[164,1620],[419,1106]], segs:[true], speed:0.00015, phase:0.65 },
      { points:[[781,1629],[520,1116]], segs:[true], speed:0.00014, phase:0.38 },
      { points:[[870,1617],[548,1116]], segs:[true], speed:0.00012, phase:0.88 },
    ];
  }
  _drawFloorLines(ctx, W, H, now) {
    if (!this._ready()) return;
    const fc = this._floorConv;
    const bb = this._catBB() * (1 + (fc.env || 0) * 1.2);
    const defs = this._floorDefs();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < defs.length; i++) {
      const { points, segs, speed, phase } = defs[i];
      const pts = points.map(([px, py]) => this._ptc(px, py));
      const dists = [0];
      for (let j = 0; j < pts.length - 1; j++) {
        const dx = pts[j+1].x - pts[j].x, dy = pts[j+1].y - pts[j].y;
        dists.push(dists[j] + Math.sqrt(dx*dx+dy*dy));
      }
      const total = dists[dists.length-1];
      if (total < 1) continue;
      const cMul = fc.mul || 1.0;
      const cAdj = (fc.adjs && fc.adjs[i]) || 0;
      const breathe = 0.5 + 0.5 * Math.sin(now * 0.00083);
      const baseA   = (0.05 + breathe * 0.025) * bb;
      for (let j = 0; j < segs.length; j++) {
        if (!segs[j]) continue;
        const p0 = pts[j], p1 = pts[j+1];
        for (const [lw, al] of [[12, baseA*0.22],[5, baseA*0.50],[2, baseA]]) {
          ctx.strokeStyle = `rgba(190,100,255,${al})`; ctx.lineWidth = lw; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
      }
      const PR = Math.max(3, Math.min(6, total * 0.022)), CAP_HL = PR * 1.2;
      for (let k = 0; k < 2; k++) {
        const frac = (now * speed * cMul + phase + cAdj + k * 0.5) % 1.0;
        const dist = frac * total;
        let seg = segs.length - 1;
        for (let j = 0; j < segs.length; j++) { if (dist < dists[j+1]) { seg = j; break; } }
        if (!segs[seg]) continue;
        const segLen = dists[seg+1] - dists[seg];
        const sf = segLen > 0 ? (dist - dists[seg]) / segLen : 0;
        const p0 = pts[seg], p1 = pts[seg+1];
        const px = p0.x + (p1.x - p0.x) * sf, py = p0.y + (p1.y - p0.y) * sf;
        const sdx = p1.x - p0.x, sdy = p1.y - p0.y, sl = Math.sqrt(sdx*sdx+sdy*sdy)||1;
        const nx = sdx/sl, ny = sdy/sl;
        const env = clamp(frac*8,0,1)*clamp((1-frac)*8,0,1);
        const pA = env * 0.55 * bb;
        if (pA < 0.01) continue;
        const fa = Math.min(CAP_HL, dists[seg+1]-dist), ba = Math.min(CAP_HL, dist-dists[seg]);
        const cx0 = px - nx*ba, cy0 = py - ny*ba, cx1 = px + nx*fa, cy1 = py + ny*fa;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(190,100,255,${pA*0.22})`; ctx.lineWidth = PR*4.5; ctx.beginPath(); ctx.moveTo(cx0,cy0); ctx.lineTo(cx1,cy1); ctx.stroke();
        ctx.strokeStyle = `rgba(190,100,255,${pA*0.60})`; ctx.lineWidth = PR*1.8; ctx.beginPath(); ctx.moveTo(cx0,cy0); ctx.lineTo(cx1,cy1); ctx.stroke();
        ctx.strokeStyle = `rgba(255,230,255,${pA})`;      ctx.lineWidth = PR*0.45; ctx.beginPath(); ctx.moveTo(cx0,cy0); ctx.lineTo(cx1,cy1); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Ground fog ─────────────────────────────────────────────────────────────────
  _drawGroundFog(ctx, W, H, now) {
    if (!this._ready()) return;
    const BLOBS = [
      [150,888,260,110,0.00,1.0],[540,885,230,105,1.20,0.95],[836,886,215,100,2.50,0.95],
      [1120,885,232,105,0.70,0.97],[1510,888,255,110,1.90,1.0],
      [60,800,145,75,4.20,0.88],[340,800,162,78,3.10,0.85],[625,798,155,74,0.45,0.82],
      [836,800,150,72,2.10,0.82],[1020,798,155,74,1.65,0.82],[1320,800,162,78,0.90,0.85],[1605,800,145,75,2.80,0.88],
      [50,752,125,58,1.70,0.80],[1640,752,125,58,0.50,0.80],
      [200,732,112,48,0.55,0.68],[615,732,98,50,2.80,0.70],[836,730,94,48,0.30,0.68],[1055,732,98,50,1.50,0.70],[1450,732,112,48,3.20,0.68],
      [400,690,75,34,1.10,0.55],[715,690,62,32,2.20,0.52],[836,690,64,32,3.50,0.52],[958,690,62,32,0.80,0.52],[1265,690,75,34,1.90,0.55],
    ];
    const s = this._s();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const [px, py, rx, ry, phase, baseAlpha] of BLOBS) {
      const dx = 4.5*Math.sin(now*0.00031+phase), dy = 2.0*Math.cos(now*0.00047+phase*1.3);
      const c   = this._ptc(px+dx, py+dy);
      const crx = rx*s, cry = ry*s;
      const breathe = 0.72 + 0.28 * Math.sin(now*0.00062+phase*0.8);
      const a = baseAlpha * breathe * 0.75;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(crx, cry);
      const g = ctx.createRadialGradient(0,0,0,0,0,1);
      g.addColorStop(0,    `rgba(218,208,255,${a})`);
      g.addColorStop(0.45, `rgba(208,198,255,${(a*0.55).toFixed(3)})`);
      g.addColorStop(1,    'rgba(195,185,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,1,0,TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Pulsar ripple event ────────────────────────────────────────────────────────
  _drawPulsarRipple(ctx, W, H, now) {
    const pr = this._pulsarRipple;
    if (!pr.active || !this._ready()) return;
    if (pr.startAt < 0) pr.startAt = now;
    const elapsed = now - pr.startAt;
    const DUR = 6000, N_RINGS = 6, RING_SPACING = DUR * 0.55 / N_RINGS;
    if (elapsed >= DUR) { pr.active = false; return; }
    const c = this._ptc(...this._anc('plasmaCenter'));
    const s = this._s();
    const MAX_R = Math.max(W, H) * 0.75;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < N_RINGS; i++) {
      const ringStart = i * RING_SPACING;
      const ringElapsed = elapsed - ringStart;
      if (ringElapsed <= 0) continue;
      const ringDur = DUR * 0.78;
      if (ringElapsed >= ringDur) continue;
      const p = ringElapsed / ringDur;
      const r = MAX_R * p;
      const env = p < 0.08 ? p / 0.08 : Math.max(0, 1 - (p - 0.08) / 0.92);
      if (env < 0.01) continue;
      const lw = s * (4.5 - p * 2.5);
      ctx.strokeStyle = `rgba(190,100,255,${(env * 0.40).toFixed(3)})`; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(240,200,255,${(env * 0.22).toFixed(3)})`; ctx.lineWidth = lw * 0.35;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Plasma eruption event ──────────────────────────────────────────────────────
  _drawPlasmaEruption(ctx, W, H, now) {
    const er = this._eruption;
    if (!er.active || !this._ready() || !SC_ANCHORS.plasmaCenter) return;
    if (er.startAt < 0) er.startAt = now;
    const elapsed = now - er.startAt;
    const DUR = 12000, RISE = 1800, FALL = 2500, HOLD = DUR - RISE - FALL;
    if (elapsed >= DUR) { er.active = false; return; }
    const sm = p => p*p*(3-2*p);
    let env = elapsed < RISE ? sm(elapsed/RISE) : elapsed < RISE+HOLD ? 1.0 : 1-sm((elapsed-RISE-HOLD)/FALL);
    if (env < 0.01) return;
    const RADIUS_PX = 160, EXT_R = RADIUS_PX*2.5, REGEN_MS = 2500, ARM_N = 7;
    const s = this._s();
    const c = this._ptc(...this._anc('plasmaCenter'));
    const R = EXT_R * s;
    const drift = now * 0.000048;
    if (now - this._eruptRegenAt > REGEN_MS) { this._plasmaRegen(c, R, drift, this._eruptArms, ARM_N, 0); this._eruptRegenAt = now; }
    if (!this._eruptArms.length) return;
    const transP = sm(Math.min(1,(now-this._eruptRegenAt)/REGEN_MS));
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const hR = RADIUS_PX*s*(1+env*1.8);
    const hl = ctx.createRadialGradient(c.x,c.y,RADIUS_PX*s*0.4,c.x,c.y,hR);
    hl.addColorStop(0,   `rgba(255,220,255,${(env*0.32).toFixed(3)})`); hl.addColorStop(0.3, `rgba(190,110,255,${(env*0.20).toFixed(3)})`);
    hl.addColorStop(0.7, `rgba(110,45,230,${(env*0.10).toFixed(3)})`);  hl.addColorStop(1,   'rgba(60,10,190,0)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(c.x,c.y,hR,0,TAU); ctx.fill();
    for (const { fromPts, toPts, phase } of this._eruptArms) {
      const fl = 0.55+0.45*Math.sin(now*0.0015+phase), pts = this._plasmaLerp(fromPts,toPts,transP), a = env*fl;
      this._plasmaStroke(ctx,pts,s*5.5,a*0.16,'155,75,255'); this._plasmaStroke(ctx,pts,s*2.2,a*0.52,'200,130,255'); this._plasmaStroke(ctx,pts,s*0.8,a*0.90,'245,220,255');
    }
    const cR = RADIUS_PX*s*0.42;
    const cor = ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,cR);
    cor.addColorStop(0,   `rgba(255,255,255,${(env*0.80).toFixed(3)})`); cor.addColorStop(0.4, `rgba(235,185,255,${(env*0.45).toFixed(3)})`); cor.addColorStop(1, 'rgba(160,80,255,0)');
    ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(c.x,c.y,cR,0,TAU); ctx.fill();
    ctx.restore();
  }

  // ── Portal surge event ─────────────────────────────────────────────────────────
  _drawPortalSurge(ctx, W, H, now) {
    const ps = this._portalSurge;
    if (!ps.active || !this._ready()) return;
    if (ps.startAt < 0) {
      ps.startAt = now;
      const RAY_N = 14;
      ps.rays = Array.from({length: RAY_N}, (_, i) => ({
        tx: 715+(i/(RAY_N-1))*245, ty: 510, hw: 0.028+Math.random()*0.048, phase: Math.random()*TAU, freq: 0.0010+Math.random()*0.0028 }));
      ps.motes = Array.from({length: 30}, () => ({
        px: 718+Math.random()*238, py: 185+Math.random()*310, r: 0.45+Math.random()*1.8, phase: Math.random()*TAU, freq: 0.0022+Math.random()*0.0048 }));
    }
    const elapsed = now - ps.startAt;
    const DUR = 8000;
    if (elapsed >= DUR) { ps.active = false; return; }
    const env = Math.sin((elapsed/DUR)*Math.PI);
    if (env < 0.01) return;
    const OUTER = [[713,537],[712,364],[750,319],[837,119],[921,317],[954,364],[957,553]];
    const s = this._s();
    ctx.save();
    const os = OUTER.map(([px, py]) => this._ptc(px, py));
    ctx.beginPath(); ctx.moveTo(os[0].x, os[0].y);
    for (let i = 1; i < os.length; i++) ctx.lineTo(os[i].x, os[i].y);
    ctx.closePath(); ctx.clip();
    const peak = this._ptc(837, 119), base = this._ptc(836, 553);
    const burstR = Math.hypot(base.x-peak.x, base.y-peak.y)*1.1;
    ctx.globalCompositeOperation = 'screen';
    const gr = ctx.createRadialGradient(peak.x,peak.y,0,peak.x,peak.y,burstR);
    gr.addColorStop(0,    `rgba(255,245,255,${env})`); gr.addColorStop(0.10, `rgba(220,165,255,${env*0.90})`);
    gr.addColorStop(0.30, `rgba(160,90,255,${env*0.68})`); gr.addColorStop(0.60, `rgba(95,35,230,${env*0.38})`); gr.addColorStop(1, 'rgba(45,10,190,0)');
    ctx.fillStyle = gr; ctx.fillRect(0,0,W,H);
    for (const ray of ps.rays) {
      const fl = 0.35+0.65*Math.sin(now*ray.freq+ray.phase);
      const a = env*fl*0.42; if (a < 0.01) continue;
      const tgt = this._ptc(ray.tx, ray.ty);
      const rdx = tgt.x-peak.x, rdy = tgt.y-peak.y, rlen = Math.hypot(rdx,rdy)||1;
      const ux = rdx/rlen, uy = rdy/rlen, perx = -uy, pery = ux;
      const hw = Math.sin(ray.hw)*burstR;
      const tx2 = peak.x+ux*burstR, ty2 = peak.y+uy*burstR;
      const rg = ctx.createLinearGradient(peak.x,peak.y,tx2,ty2);
      rg.addColorStop(0,'rgba(255,250,255,'+a+')'); rg.addColorStop(0.45,`rgba(200,145,255,${a*0.55})`); rg.addColorStop(1,'rgba(130,70,255,0)');
      ctx.fillStyle=rg; ctx.beginPath(); ctx.moveTo(peak.x,peak.y); ctx.lineTo(tx2+perx*hw,ty2+pery*hw); ctx.lineTo(tx2-perx*hw,ty2-pery*hw); ctx.closePath(); ctx.fill();
    }
    for (const m of ps.motes) {
      const fl = 0.5+0.5*Math.sin(now*m.freq+m.phase), a = env*fl*fl*0.92;
      if (a < 0.03) continue;
      const mc = this._ptc(m.px, m.py), r = m.r*s;
      const mg = ctx.createRadialGradient(mc.x,mc.y,0,mc.x,mc.y,r*5);
      mg.addColorStop(0,`rgba(255,255,255,${a})`); mg.addColorStop(0.25,`rgba(230,195,255,${a*0.65})`); mg.addColorStop(1,'rgba(160,100,255,0)');
      ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(mc.x,mc.y,r*5,0,TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Arch arc event ─────────────────────────────────────────────────────────────
  _drawArchArc(ctx, W, H, now) {
    const aa = this._archArc;
    if (!aa.active || !this._ready()) return;
    if (aa.startAt < 0) aa.startAt = now;
    const elapsed = now - aa.startAt;
    const DUR = 2200, FLASHES = 4;
    if (elapsed >= DUR) { aa.active = false; return; }
    const FLASH_P = DUR / FLASHES;
    const fp = (elapsed % FLASH_P) / FLASH_P;
    const env = fp < 0.12 ? fp/0.12 : fp < 0.62 ? 1.0 : Math.max(0, 1-(fp-0.62)/0.38);
    if (env < 0.01) return;
    const s = this._s();
    const a0 = this._ptc(...SC_ANCHORS.archArcLeft), a1 = this._ptc(...SC_ANCHORS.archArcRight);
    function jag(x0,y0,x1,y1,segs) {
      const dx=x1-x0,dy=y1-y0,len=Math.sqrt(dx*dx+dy*dy),sp=len*0.13;
      const pts=[x0,y0];
      for(let i=1;i<segs;i++) pts.push(x0+dx*(i/segs)+(Math.random()-0.5)*sp*2, y0+dy*(i/segs)+(Math.random()-0.5)*sp);
      pts.push(x1,y1); return pts;
    }
    function strokePts(pts,lw,col) {
      ctx.lineWidth=lw; ctx.strokeStyle=col;
      ctx.beginPath(); ctx.moveTo(pts[0],pts[1]);
      for(let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i],pts[i+1]);
      ctx.stroke();
    }
    const main = jag(a0.x,a0.y,a1.x,a1.y,14);
    ctx.save(); ctx.globalCompositeOperation='screen'; ctx.lineCap='round'; ctx.lineJoin='round';
    strokePts(main,s*22,`rgba(110,40,255,${env*0.20})`);
    strokePts(main,s*8,`rgba(185,110,255,${env*0.48})`);
    strokePts(main,s*2,`rgba(235,215,255,${env*0.92})`);
    for (const pt of [a0,a1]) {
      const gr = ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,s*26);
      gr.addColorStop(0,`rgba(255,240,255,${env*0.88})`); gr.addColorStop(0.45,`rgba(165,85,255,${env*0.36})`); gr.addColorStop(1,'rgba(90,30,220,0)');
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(pt.x,pt.y,s*26,0,TAU); ctx.fill();
    }
    for (let b = 0; b < 3; b++) {
      const si = Math.floor(1+Math.random()*(main.length/2-2))*2;
      const bx0=main[si],by0=main[si+1],bLen=s*rand(55,115);
      const bx1=bx0+(Math.random()-0.5)*s*38,by1=by0+bLen;
      const br=jag(bx0,by0,bx1,by1,5);
      strokePts(br,s*9,`rgba(130,60,255,${env*0.16})`);
      strokePts(br,s*3,`rgba(200,140,255,${env*0.40})`);
      strokePts(br,s*0.9,`rgba(240,225,255,${env*0.78})`);
    }
    ctx.restore();
  }

  // ── Rune flash event ───────────────────────────────────────────────────────────
  _triggerRuneFlash() {
    const rf = this._runeFlash;
    if (rf.active) return;
    rf.active = true; rf.startAt = -1;
    const KEYS = [
      ['pillar1TopLeft','pillar1TopRight','pillar1ImageTop','pillar1Lowest'],
      ['pillar2TopLeft','pillar2TopRight','pillar2ImageTop','pillar2Lowest'],
      ['pillar3TopLeft','pillar3TopRight','pillar3ImageTop','pillar3Lowest'],
      ['pillar4TopLeft','pillar4TopRight','pillar4ImageTop','pillar4Lowest'],
      ['pillar5TopLeft','pillar5TopRight','pillar5ImageTop','pillar5Lowest'],
      ['pillar6TopLeft','pillar6TopRight','pillar6ImageTop','pillar6Lowest'],
    ];
    const TMPL = [
      [[[0,0],[0,-1.0]],[[0,0],[0,0.65]],[[0,-0.25],[-0.70,0.40]],[[0,-0.25],[0.70,0.40]],[[0,-0.10],[-0.45,-0.10]],[[0,-0.10],[0.45,-0.10]]],
      [[[0,0.20],[0,1.0]],[[0,0.20],[-0.70,-0.90]],[[0,0.20],[0.70,-0.90]],[[0,-0.10],[-0.45,-0.10]],[[0,-0.10],[0.45,-0.10]]],
      [[[0,0],[0,-1.0]],[[0,0],[0,1.0]],[[0,0],[-0.65,0]],[[0,0],[0.65,0]],[[0,-0.50],[0.45,-0.20]],[[0,-0.50],[-0.45,-0.20]]],
      [[[0,0],[0,-1.0]],[[0,-0.75],[-0.50,-0.30]],[[0,-0.75],[0.50,-0.30]],[[0,0],[-0.50,0.75]],[[0,0],[0.50,0.75]],[[0,0.40],[-0.40,0.40]],[[0,0.40],[0.40,0.40]]],
      [[[0,0],[-0.80,-0.85]],[[0,0],[0.80,-0.85]],[[0,0],[0.65,0.90]],[[0,0],[-0.65,0.90]],[[0,-0.40],[-0.45,-0.40]],[[0,-0.40],[0.45,-0.40]],[[0,0.30],[0.40,0.30]]],
    ];
    const count = Math.random() < 0.35 ? 2 : 1;
    const shuf  = [...KEYS].sort(() => Math.random()-0.5);
    rf.targets  = shuf.slice(0, count).map(([tl,tr,it,lo]) => ({ tl,tr,it,lo, tmpl: Math.floor(Math.random()*TMPL.length) }));
    rf.TMPL     = TMPL;
  }
  _drawRuneFlash(ctx, W, H, now) {
    const rf = this._runeFlash;
    if (!rf.active || !this._ready()) return;
    if (rf.startAt < 0) rf.startAt = now;
    const elapsed = now - rf.startAt;
    const IG = 500, HO = 1800, FA = 900, TOT = IG+HO+FA;
    if (elapsed >= TOT) { rf.active = false; return; }
    const sm = p => p*p*(3-2*p);
    let env = elapsed < IG ? sm(elapsed/IG) : elapsed < IG+HO ? 1.0 : 1-sm((elapsed-IG-HO)/FA);
    const drawFrac = elapsed < IG ? sm(elapsed/IG) : 1.0;
    const flicker = (elapsed > IG && elapsed < IG+HO) ? 0.82+0.18*Math.sin(now*0.021) : 1.0;
    const alpha = env * flicker;
    if (alpha < 0.01) return;
    const flashT = Math.max(0, 1-elapsed/200);
    const gR = Math.round(205+flashT*50), gG = Math.round(150+flashT*105), gB = Math.round(flashT*255);
    const s = this._s();
    ctx.save(); ctx.globalCompositeOperation='screen'; ctx.lineCap='round'; ctx.lineJoin='round';
    for (const { tl, tr, it, lo, tmpl } of rf.targets) {
      const aTL=SC_ANCHORS[tl],aTR=SC_ANCHORS[tr],aIT=SC_ANCHORS[it],aLO=SC_ANCHORS[lo];
      if (!aTL||!aTR||!aIT||!aLO) continue;
      const sTL=this._ptc(...aTL),sTR=this._ptc(...aTR),sIT=this._ptc(...aIT),sLO=this._ptc(...aLO);
      const cx=(sTL.x+sTR.x)/2, cy=(sIT.y+sLO.y)/2;
      const runeW=(sTR.x-sTL.x)*0.72, runeH=(sLO.y-sIT.y)*0.58;
      const toPt=(nx,ny)=>({x:cx+nx*runeW/2,y:cy+ny*runeH/2});
      function strokePart(rawPts, frac) {
        const pts = rawPts.map(([nx,ny])=>toPt(nx,ny));
        if (frac <= 0 || pts.length < 2) return;
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
        if (frac >= 1) { for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); }
        else {
          const lens=[0];
          for(let i=0;i<pts.length-1;i++){const ddx=pts[i+1].x-pts[i].x,ddy=pts[i+1].y-pts[i].y;lens.push(lens[i]+Math.sqrt(ddx*ddx+ddy*ddy));}
          const target=lens[lens.length-1]*frac;
          for(let i=0;i<pts.length-1;i++){if(lens[i+1]<=target){ctx.lineTo(pts[i+1].x,pts[i+1].y);}else{const sf=lens[i+1]>lens[i]?(target-lens[i])/(lens[i+1]-lens[i]):0;ctx.lineTo(pts[i].x+(pts[i+1].x-pts[i].x)*sf,pts[i].y+(pts[i+1].y-pts[i].y)*sf);break;}}
        }
        ctx.stroke();
      }
      for (const rawPts of rf.TMPL[tmpl]) {
        ctx.strokeStyle=`rgba(${gR},${gG},${gB},${alpha*0.22})`; ctx.lineWidth=s*7;   strokePart(rawPts, drawFrac);
        ctx.strokeStyle=`rgba(${gR},${gG},${gB},${alpha*0.60})`; ctx.lineWidth=s*2.2; strokePart(rawPts, drawFrac);
        ctx.strokeStyle=`rgba(255,${Math.round(240+flashT*15)},${Math.round(180+flashT*75)},${alpha*0.95})`; ctx.lineWidth=Math.max(0.8,s*0.55); strokePart(rawPts, drawFrac);
      }
      if (flashT > 0.01) {
        const br=s*(3+flashT*14);
        const bst=ctx.createRadialGradient(cx,cy,0,cx,cy,br);
        bst.addColorStop(0,`rgba(255,255,255,${flashT*alpha})`); bst.addColorStop(0.5,`rgba(255,210,80,${flashT*alpha*0.55})`); bst.addColorStop(1,'rgba(255,160,0,0)');
        ctx.fillStyle=bst; ctx.beginPath(); ctx.arc(cx,cy,br,0,TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── Robot procession event ─────────────────────────────────────────────────────
  _drawRobotProcession(ctx, W, H, now) {
    const rb = this._robot;
    if (!rb.active || !this._ready()) return;
    if (rb.startAt < 0) rb.startAt = now;
    const elapsed = now - rb.startAt;
    const EMERGE=2000,WALK=4500,TURN=1500,FWD=6000,TOT=EMERGE+WALK+TURN+FWD;
    if (elapsed >= TOT) { rb.active = false; return; }
    const H_FAR=75, H_NEAR=220;
    const OCC_L1=558,OCC_L2=613,OCC_R1=1059,OCC_R2=1115,OCC_FADE=32;
    const OCC_EL1=434,OCC_EL2=489,OCC_ER1=1182,OCC_ER2=1240,OCC_EF=20;
    const eio = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    function occA(px,zA,zB,fw=OCC_FADE) {
      const mn=Math.min(zA,zB),mx=Math.max(zA,zB);
      if(px>mn&&px<mx)return 0; if(px<=mn-fw||px>=mx+fw)return 1;
      return px<=mn?(mn-px)/fw:(px-mx)/fw;
    }
    const s = this._s();
    const lEntry=this._ptc(474,670),rEntry=this._ptc(1200,676),center=this._ptc(840,676),exit=this._ptc(849,938);
    const lEmerge=this._ptc(450,670),rEmerge=this._ptc(1210,676);
    let img, cx, cy, alpha=1.0, paintH=H_FAR, flipX=false;
    if (elapsed < EMERGE) {
      const p=eio(elapsed/EMERGE);
      if (rb.dir===-1) { cx=lEmerge.x+(lEntry.x-lEmerge.x)*p; cy=lEmerge.y+(lEntry.y-lEmerge.y)*p; img=scRobotImgs.side; flipX=false; alpha=occA(450+(474-450)*p,OCC_EL1,OCC_EL2,OCC_EF); }
      else             { cx=rEmerge.x+(rEntry.x-rEmerge.x)*p; cy=rEmerge.y+(rEntry.y-rEmerge.y)*p; img=scRobotImgs.side; flipX=true;  alpha=occA(1210+(1200-1210)*p,OCC_ER1,OCC_ER2,OCC_EF); }
    } else if (elapsed < EMERGE+WALK) {
      const p=eio((elapsed-EMERGE)/WALK);
      if (rb.dir===-1) { cx=lEntry.x+(center.x-lEntry.x)*p; cy=lEntry.y+(center.y-lEntry.y)*p; img=scRobotImgs.side; flipX=false; const px2=474+(840-474)*p; alpha=Math.min(occA(px2,OCC_EL1,OCC_EL2,OCC_EF),occA(px2,OCC_L1,OCC_L2)); }
      else             { cx=rEntry.x+(center.x-rEntry.x)*p; cy=rEntry.y+(center.y-rEntry.y)*p; img=scRobotImgs.side; flipX=true;  const px2=1200+(840-1200)*p; alpha=Math.min(occA(px2,OCC_ER1,OCC_ER2,OCC_EF),occA(px2,OCC_R1,OCC_R2)); }
    } else if (elapsed < EMERGE+WALK+TURN) {
      cx=center.x; cy=center.y; img=rb.dir===-1?scRobotImgs.turnLeft:scRobotImgs.turnRight; flipX=false; alpha=1.0;
    } else {
      const p=eio((elapsed-EMERGE-WALK-TURN)/FWD);
      paintH=H_FAR+(H_NEAR-H_FAR)*p;
      const rollY=exit.y+(H_NEAR+20)*s;
      cx=center.x+(exit.x-center.x)*p; cy=center.y+(rollY-center.y)*p; img=scRobotImgs.front; flipX=false; alpha=1.0;
    }
    if (!img||!img.complete||!img.naturalWidth) return;
    const dh=paintH*s, dw=dh*(img.naturalWidth/img.naturalHeight);
    ctx.save(); ctx.globalAlpha=clamp(alpha,0,1);
    if (flipX) { ctx.translate(cx,0); ctx.scale(-1,1); ctx.drawImage(img,-dw/2,cy-dh,dw,dh); }
    else        { ctx.drawImage(img,cx-dw/2,cy-dh,dw,dh); }
    ctx.restore();
  }

  // ── Float robot event ──────────────────────────────────────────────────────────
  _drawFloatRobot(ctx, W, H, now) {
    const fr = this._floatRobot;
    if (!fr.active || !this._ready()) return;
    if (fr.startAt < 0) fr.startAt = now;
    const elapsed = now - fr.startAt;
    const DESC=3000,FLOAT=4000,LOOK=3000,EXIT=3500,TOT=DESC+FLOAT+LOOK+EXIT;
    if (elapsed >= TOT) { fr.active = false; return; }
    const LEFT_X=250,RIGHT_X=1422,CENTER_X=836,FLOAT_Y=500,PAINT_H=160;
    const s = this._s();
    const dh = PAINT_H * s;
    const eio = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    const entryX  = fr.dir===-1 ? LEFT_X : RIGHT_X;
    const sidePos  = this._ptc(entryX,  FLOAT_Y);
    const centerPos= this._ptc(CENTER_X,FLOAT_Y);
    let img, cx, cy, alpha=1.0, flipX=false;
    if (elapsed < DESC) {
      const p=eio(elapsed/DESC); img=scRobotImgs.floatDescent; cx=sidePos.x; cy=sidePos.y*p; alpha=Math.min(1,elapsed/600); flipX=fr.dir===1;
    } else if (elapsed < DESC+FLOAT) {
      const p=eio((elapsed-DESC)/FLOAT); img=scRobotImgs.floatSide; cx=sidePos.x+(centerPos.x-sidePos.x)*p; cy=sidePos.y; flipX=fr.dir===1;
    } else if (elapsed < DESC+FLOAT+LOOK) {
      const lt=elapsed-DESC-FLOAT; img=scRobotImgs.floatLook; cx=centerPos.x; cy=centerPos.y+Math.sin(lt*0.0028)*dh*0.05;
    } else {
      const p=eio((elapsed-DESC-FLOAT-LOOK)/EXIT);
      const exitCX=fr.dir===-1?W+dh:-dh;
      img=scRobotImgs.floatSide; cx=centerPos.x+(exitCX-centerPos.x)*p; cy=centerPos.y; flipX=fr.dir===1; alpha=p>0.85?Math.max(0,1-(p-0.85)/0.15):1.0;
    }
    if (!img||!img.complete||!img.naturalWidth) return;
    const dw=dh*(img.naturalWidth/img.naturalHeight);
    ctx.save(); ctx.globalAlpha=clamp(alpha,0,1);
    if (flipX) { ctx.translate(cx,0); ctx.scale(-1,1); ctx.drawImage(img,-dw/2,cy-dh,dw,dh); }
    else        { ctx.drawImage(img,cx-dw/2,cy-dh,dw,dh); }
    ctx.restore();
  }
}

// ─── OVERLAY REGISTRY ─────────────────────────────────────────────────────────
const OVERLAY_REGISTRY = {
  stars:           (W, H, img) => { const o = new StarsTwinkleOverlay();     o.init(W, H, img); return o; },
  auroraShimmer:   (W, H, img) => { const o = new AuroraShimmerOverlay();   o.init(W, H, img); return o; },
  windowGlow:      (W, H, img) => { const o = new WindowGlowOverlay();      o.init(W, H, img); return o; },
  snow:            (W, H, img) => { const o = new SnowOverlay();            o.init(W, H, img); return o; },
  smoke:           (W, H, img) => { const o = new SmokeOverlay().setChimneyPx({ px: 540, py: 1058 }, { px: 890, py: 552 }); o.init(W, H, img); return o; },
  cabinEvents:     (W, H, img) => { const o = new CabinEventsOverlay();     o.init(W, H, img); return o; },
  birds:           (W, H, img) => { const o = new BirdsOverlay();           o.init(W, H, img); return o; },
  waterGlints:     (W, H, img) => { const o = new WaterGlintsOverlay();     o.init(W, H, img); return o; },
  seaMist:         (W, H, img) => { const o = new SeaMistOverlay();         o.init(W, H, img); return o; },
  bubbles:         (W, H, img) => { const o = new BubblesOverlay();         o.init(W, H, img); return o; },
  lightRays:       (W, H, img) => { const o = new LightRaysOverlay();       o.init(W, H, img); return o; },
  fishSilhouettes: (W, H, img) => { const o = new FishSilhouettesOverlay(); o.init(W, H, img); return o; },
  techRuin:        (W, H, img) => { const o = new TechRuinOverlay();        o.init(W, H, img); return o; },
  spaceChurch:     (W, H, img) => { const o = new SpaceChurchOverlay();     o.init(W, H, img); return o; },
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

    Promise.all([preloadScenes(SCENES), preloadDeerSprites(), preloadOwlSprites(), preloadRabbitSprites(), preloadWindowShadow(), preloadTechRuinSprites(), preloadSpaceChurchSprites()]).then(() => {
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
      const sceneOverlays = this.overlays[scene.id] || {};
      let evOverlay = null, evNames = null;
      if (sceneOverlays.cabinEvents) { evOverlay = sceneOverlays.cabinEvents; evNames = EV_NAMES_CABIN; }
      else if (sceneOverlays.techRuin) { evOverlay = sceneOverlays.techRuin; evNames = EV_NAMES_TECH_RUIN; }
      if (!evOverlay) return;
      if (e.key === '[') {
        e.preventDefault();
        this._dbgEventIdx = ((this._dbgEventIdx - 1) + evNames.length) % evNames.length;
        console.info(`[${scene.id} event] selected: ${evNames[this._dbgEventIdx]} (${this._dbgEventIdx + 1}/${evNames.length})`);
      } else if (e.key === ']') {
        e.preventDefault();
        this._dbgEventIdx = (this._dbgEventIdx + 1) % evNames.length;
        console.info(`[${scene.id} event] selected: ${evNames[this._dbgEventIdx]} (${this._dbgEventIdx + 1}/${evNames.length})`);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const t = (performance.now() - this.startTime) * 0.001;
        evOverlay.triggerEvent(evNames[this._dbgEventIdx], t);
      }
    });
  }

  _stir() {
    if (this._ensureMotionPermission) this._ensureMotionPermission();
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
    let listening = false;
    const btn = document.getElementById('motion-btn');
    const setButtonText = text => {
      if (!btn) return;
      btn.textContent = text;
    };
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
    const startListening = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('devicemotion', handle);
    };
    if (!window.isSecureContext) {
      if (btn && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) {
        setButtonText('shake needs https');
        btn.hidden = false;
      }
      return;
    }
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      const dismissBtn = () => {
        if (!btn) return;
        btn.classList.add('fade');
        btn.addEventListener('transitionend', () => { btn.hidden = true; }, { once: true });
      };
      const requestMotionPermission = event => {
        if (event) event.preventDefault();
        if (this._requestingMotionPermission) return;
        this._requestingMotionPermission = true;
        setButtonText('enabling shake');
        DeviceMotionEvent.requestPermission()
          .then(permission => {
            if (permission === 'granted') {
              startListening();
              dismissBtn();
              return;
            }
            this._requestingMotionPermission = false;
            setButtonText('shake denied');
          })
          .catch(() => {
            this._requestingMotionPermission = false;
            setButtonText('enable shake');
          });
      };
      if (btn) {
        btn.hidden = false;
        btn.addEventListener('touchend', requestMotionPermission, { passive: false });
        btn.addEventListener('click', requestMotionPermission);
      }
    } else {
      startListening();
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

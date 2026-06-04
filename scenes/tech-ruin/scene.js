import { TAU, rand, clamp, paintToCanvas, _coverParams, loadImage } from '../../core.js';

const EV_NAMES_TECH_RUIN = [
  'server_glitch', 'glow_surge', 'cable_spark', 'power_arc',
  'data_drift', 'monitor_static', 'screen_message', 'scanner_sweep',
  'spore_cloud', 'eyes_appear', 'firefly_surge', 'bird_fly',
  'leaf_gust', 'falling_leaf', 'rain_drips', 'creature_scurry',
  'sunbeam_shift', 'night_shift',
];


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

export { TechRuinOverlay, preloadTechRuinSprites, EV_NAMES_TECH_RUIN };

import { TAU, rand, clamp, paintToCanvas, _coverParams, loadImage } from '../../core.js';


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

export { SpaceChurchOverlay, preloadSpaceChurchSprites };

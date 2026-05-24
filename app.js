'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const CFG = {
  particleCount: 90,
  shakeThreshold: 13,
  turbulenceDecay: 0.965,
  transitionSpeed: 0.038,
  shakeDelay: 380,
};

const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash  = (n) => ((n * 2654435761) >>> 0) % 100;

// ─── PARTICLE ─────────────────────────────────────────────────────────────────
class Particle {
  constructor(type, W, H) {
    this.type = type;
    this.W = W; this.H = H;
    this.pH = H * 0.87; // active zone above bottom UI strip
    this.init();
  }

  init() {
    const { W, H, pH } = this;
    switch (this.type) {

      case 'snow':
        this.x  = rand(0, W);
        this.y  = rand(-H * 0.1, pH * 0.55);
        this.vx = rand(-0.5, 0.5);
        this.vy = rand(0.3, 1.0);
        this.sz = rand(1.5, 4);
        this.a  = rand(0.5, 1.0);
        this.ph = rand(0, TAU);
        break;

      case 'bubble':
        this.x  = rand(0, W);
        this.y  = rand(pH * 0.35, pH);
        this.vx = rand(-0.3, 0.3);
        this.vy = rand(-0.9, -0.3);
        this.sz = rand(3, 8);
        this.a  = rand(0.18, 0.5);
        break;

      case 'ember':
        this.x   = rand(0, W);
        this.y   = rand(pH * 0.2, pH * 0.85);
        this.vx  = rand(-0.6, 0.6);
        this.vy  = rand(-0.8, -0.15);
        this.sz  = rand(1.2, 3);
        this.a   = rand(0.4, 0.85);
        this.hue = rand(18, 45);
        this.ph  = rand(0, TAU);
        break;

      case 'sand':
        this.x  = rand(0, W);
        this.y  = rand(pH * 0.38, pH * 0.88);
        this.vx = rand(-1.5, 1.5);
        this.vy = rand(-0.6, 0.6);
        this.sz = rand(1, 2.5);
        this.a  = rand(0.3, 0.65);
        break;

      case 'star':
        this.x  = rand(W * 0.02, W * 0.98);
        this.y  = rand(H * 0.04, H * 0.60);
        this.vx = 0; this.vy = 0;
        this.sz = rand(0.6, 2.2);
        this.a  = rand(0.4, 1.0);
        this.ts = rand(0.018, 0.06);
        this.ph = rand(0, TAU);
        break;
    }
  }

  kick() {
    this.vx += (Math.random() - 0.5) * 13;
    this.vy += (Math.random() - 0.5) * 13;
  }

  update(turb, dt) {
    const { W, pH } = this;
    const T = dt * 0.06;

    if (this.type !== 'star') {
      this.x += this.vx * T + (Math.random() - 0.5) * 0.2 * turb;
    }
    this.y += this.vy * T;

    if (turb > 0.05 && this.type !== 'star') {
      this.vx += (Math.random() - 0.5) * 0.4 * turb;
      this.vy += (Math.random() - 0.5) * 0.4 * turb;
      this.vx = clamp(this.vx, -8, 8);
      this.vy = clamp(this.vy, -8, 8);
    }

    switch (this.type) {
      case 'snow':
        this.vy = Math.min(this.vy + 0.018, 3.5);
        if (this.x < -12) this.x = W + 12;
        if (this.x > W + 12) this.x = -12;
        if (this.y > pH * 0.92 && Math.random() < 0.03) this.init();
        break;

      case 'bubble':
        this.vy = Math.max(this.vy - 0.01, -2.5);
        if (this.x < -12) this.x = W + 12;
        if (this.x > W + 12) this.x = -12;
        if (this.y < -30) this.init();
        break;

      case 'ember':
        this.vy = Math.max(this.vy - 0.012, -2);
        if (this.x < -12) this.x = W + 12;
        if (this.x > W + 12) this.x = -12;
        if (this.y < -30) this.init();
        break;

      case 'sand': {
        const mx = W / 2, my = pH * 0.62;
        const dx = this.x - mx, dy = this.y - my;
        const dl = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx += (-dy / dl) * 0.055;
        this.vy += (dx  / dl) * 0.04 + 0.022;
        this.vx = clamp(this.vx, -5, 5);
        this.vy = clamp(this.vy, -5, 5);
        if (this.x < 0) this.x = W;
        if (this.x > W) this.x = 0;
        if (this.y > pH) this.init();
        break;
      }
    }
  }

  draw(ctx, t) {
    ctx.save();
    switch (this.type) {
      case 'snow': {
        const tw = 0.82 + 0.18 * Math.sin(t * 2.3 + this.ph);
        ctx.globalAlpha = this.a * tw;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.sz, 0, TAU); ctx.fill();
        break;
      }
      case 'bubble': {
        ctx.globalAlpha = this.a;
        ctx.strokeStyle = 'rgba(140,220,255,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.sz, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(this.x - this.sz * 0.3, this.y - this.sz * 0.32, this.sz * 0.38, 0, TAU);
        ctx.fill();
        break;
      }
      case 'ember': {
        const fl = 0.65 + 0.35 * Math.sin(t * 5.5 + this.ph);
        ctx.globalAlpha = this.a * fl;
        ctx.fillStyle = `hsl(${this.hue},100%,68%)`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `hsl(${this.hue},100%,55%)`;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.sz, 0, TAU); ctx.fill();
        break;
      }
      case 'sand': {
        ctx.globalAlpha = this.a;
        ctx.fillStyle = 'rgba(205,175,115,0.85)';
        ctx.fillRect(this.x, this.y, this.sz, this.sz * 0.5);
        break;
      }
      case 'star': {
        const tw2 = 0.45 + 0.55 * Math.sin(t * this.ts * 60 + this.ph);
        ctx.globalAlpha = this.a * tw2;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.sz, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

// ─── DRAW HELPERS ─────────────────────────────────────────────────────────────
function drawStarField(ctx, W, H, count, t) {
  const skyH = H * 0.7;
  for (let i = 0; i < count; i++) {
    const s1 = i * 13.731 + 0.1;
    const s2 = i * 7.391  + 0.3;
    const x  = ((s1 * 3.14159) % 1) * W;
    const y  = ((s2 * 2.71828) % 1) * skyH;
    const tw = 0.45 + 0.55 * Math.sin(t * 1.4 + i * 0.7);
    const big = i % 7 === 0;
    ctx.globalAlpha = (big ? 0.9 : 0.45) * tw;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, big ? 1.8 : 1.0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSnowGround(ctx, W, H, gy) {
  ctx.fillStyle = '#dce8f4';
  ctx.fillRect(0, gy, W, H);
  const soft = ctx.createLinearGradient(0, gy - 24, 0, gy + 8);
  soft.addColorStop(0, 'rgba(220,232,244,0)');
  soft.addColorStop(1, '#dce8f4');
  ctx.fillStyle = soft;
  ctx.fillRect(0, gy - 24, W, 32);
}

function drawMoon(ctx, mx, my, size, phase) {
  const glow = ctx.createRadialGradient(mx, my, size * 0.4, mx, my, size * 2.2);
  glow.addColorStop(0, 'rgba(255,252,210,0.22)');
  glow.addColorStop(1, 'rgba(255,252,210,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(mx, my, size * 2.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fffde4';
  ctx.beginPath(); ctx.arc(mx, my, size, 0, TAU); ctx.fill();
  if (phase === 'crescent') {
    ctx.fillStyle = 'rgba(10,6,28,0.88)';
    ctx.beginPath(); ctx.arc(mx + size * 0.42, my, size * 0.88, 0, TAU); ctx.fill();
  }
}

// ─── SCENES ───────────────────────────────────────────────────────────────────
const SCENES = [

  // 1. TINY CABIN ─────────────────────────────────────────────────────────────
  {
    name: 'Tiny Cabin',
    particleType: 'snow',
    particleCount: 500,
    draw(ctx, W, H, t) {
      const S  = Math.min(W, H) * 0.46;
      const cx = W / 2;
      const gy = H * 0.74;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#060e1a');
      sky.addColorStop(0.65, '#0d1c30');
      sky.addColorStop(1, '#1c2d42');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Aurora Borealis — three slow undulating curtains
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const aBase = 0.72 + 0.28 * Math.sin(t * 0.34);
      const auroraBand = (baseY, bw, hue, phase, sp) => {
        const steps = 64;
        const ag = ctx.createLinearGradient(0, baseY - bw, 0, baseY + bw);
        ag.addColorStop(0,   `hsla(${hue},88%,52%,0)`);
        ag.addColorStop(0.28,`hsla(${hue},88%,52%,${0.22 * aBase})`);
        ag.addColorStop(0.5, `hsla(${hue},90%,66%,${0.34 * aBase})`);
        ag.addColorStop(0.72,`hsla(${hue},88%,52%,${0.22 * aBase})`);
        ag.addColorStop(1,   `hsla(${hue},88%,52%,0)`);
        ctx.fillStyle = ag;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const p = i / steps;
          const x = p * W;
          const y = baseY - bw
            + Math.sin(p * Math.PI * 2.7 + t * sp + phase)       * bw * 0.72
            + Math.sin(p * Math.PI * 5.2 + t * sp * 1.7 + phase) * bw * 0.22;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        for (let i = steps; i >= 0; i--) {
          const p = i / steps;
          const x = p * W;
          const y = baseY + bw
            + Math.sin(p * Math.PI * 2.7 + t * sp + phase + 0.7) * bw * 0.72
            + Math.sin(p * Math.PI * 5.2 + t * sp * 1.7 + phase) * bw * 0.22;
          ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      };
      auroraBand(H * 0.14, H * 0.056, 148, 0.0, 0.27);
      auroraBand(H * 0.21, H * 0.044, 168, 2.2, 0.21);
      auroraBand(H * 0.09, H * 0.068, 140, 4.6, 0.17);
      ctx.restore();

      drawStarField(ctx, W, H, 40, t);
      drawSnowGround(ctx, W, H, gy);

      // Pine trees spanning scene width
      const pine = (tx, ty, h) => {
        for (let layer = 0; layer < 3; layer++) {
          const lh = h * (0.5 + layer * 0.13);
          const lw = h * 0.34 * (1 - layer * 0.1);
          const ly = ty - layer * h * 0.18;
          ctx.fillStyle = '#152d1e';
          ctx.beginPath();
          ctx.moveTo(tx, ly - lh);
          ctx.lineTo(tx - lw, ly);
          ctx.lineTo(tx + lw, ly);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(205,222,238,0.82)';
        ctx.beginPath();
        ctx.moveTo(tx, ty - h + 2);
        ctx.lineTo(tx - h * 0.1, ty - h * 0.65);
        ctx.lineTo(tx + h * 0.1, ty - h * 0.65);
        ctx.closePath(); ctx.fill();
      };

      pine(cx - S * 0.72, gy, S * 0.65);
      pine(cx + S * 0.74, gy, S * 0.60);
      pine(cx - S * 1.02, gy, S * 0.50);
      pine(cx + S * 1.05, gy, S * 0.46);
      pine(cx - S * 1.32, gy, S * 0.38);
      pine(cx + S * 1.36, gy, S * 0.35);

      // Cabin geometry — computed early so light cone can reference it
      const cw = S * 0.44, ch = S * 0.38;
      const cbx = cx - cw / 2, cby = gy - ch;
      const rh  = S * 0.28;

      // Window positions — raised high and spread wide so door never overlaps
      const ww = S * 0.12, wh = S * 0.12;
      const wx  = cx - S * 0.195, wy  = cby + ch * 0.10; // left window
      const wx2 = cx + S * 0.075, wy2 = wy;               // right window

      // Firelight flicker — multi-frequency noise keeps it organic
      const flk = 0.80
        + 0.10 * Math.sin(t * 6.8)
        + 0.06 * Math.sin(t * 11.4 + 1.3)
        + 0.04 * Math.sin(t *  3.2 + 0.8);

      // Window light cone cast onto snow (drawn before cabin walls)
      const winCx  = wx + ww / 2;
      const coneW  = S * 0.52;
      const coneG  = ctx.createLinearGradient(winCx, wy + wh, winCx, gy);
      coneG.addColorStop(0,   `rgba(255,170,50,${0.32 * flk})`);
      coneG.addColorStop(0.55,`rgba(255,158,38,${0.13 * flk})`);
      coneG.addColorStop(1,   'rgba(255,150,30,0)');
      ctx.fillStyle = coneG;
      ctx.beginPath();
      ctx.moveTo(winCx - ww * 0.28, wy + wh);
      ctx.lineTo(winCx - coneW, gy);
      ctx.lineTo(winCx + coneW, gy);
      ctx.lineTo(winCx + ww * 0.28, wy + wh);
      ctx.closePath(); ctx.fill();

      // Cabin body
      ctx.fillStyle = '#4a3628';
      ctx.fillRect(cbx, cby, cw, ch);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cbx, cby + ch * i / 4);
        ctx.lineTo(cbx + cw, cby + ch * i / 4);
        ctx.stroke();
      }

      // Roof
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.moveTo(cx, cby - rh);
      ctx.lineTo(cbx - S * 0.07, cby + 2);
      ctx.lineTo(cbx + cw + S * 0.07, cby + 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c5d6e8';
      ctx.beginPath();
      ctx.moveTo(cx, cby - rh + 2);
      ctx.lineTo(cbx - S * 0.04, cby + 5);
      ctx.lineTo(cbx + cw + S * 0.04, cby + 5);
      ctx.closePath(); ctx.fill();

      // Chimney + smoke
      const chx = cx + S * 0.09, chy = cby - rh * 0.52;
      ctx.fillStyle = '#6b4c3b';
      ctx.fillRect(chx, chy, S * 0.07, rh * 0.46);
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.42 + i * 0.38) % 1.6;
        const sx = chx + S * 0.035 + Math.sin(t * 1.1 + i * 1.8) * S * 0.03;
        const sy = chy - p * S * 0.38;
        ctx.globalAlpha = (1 - p / 1.6) * 0.2;
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath(); ctx.arc(sx, sy, S * 0.032 + p * S * 0.05, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Helper: draw a flickering warm window
      const drawWindow = (owx, owy) => {
        const wLum = 56 + flk * 14;
        const wAlpha = 0.32 + flk * 0.08;
        const rg = ctx.createRadialGradient(owx+ww/2, owy+wh/2, 0, owx+ww/2, owy+wh/2, S * 0.24);
        rg.addColorStop(0, `rgba(255,${Math.round(172 + flk * 28)},55,${wAlpha})`);
        rg.addColorStop(1, 'rgba(255,185,60,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(owx+ww/2, owy+wh/2, S * 0.24, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsl(40,96%,${Math.round(wLum)}%)`;
        ctx.fillRect(owx, owy, ww, wh);
        ctx.strokeStyle = '#3d2d1e'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(owx + ww/2, owy);       ctx.lineTo(owx + ww/2, owy + wh);
        ctx.moveTo(owx,        owy + wh/2); ctx.lineTo(owx + ww,   owy + wh/2);
        ctx.stroke();
      };

      drawWindow(wx,  wy);
      drawWindow(wx2, wy2);

      // Door — frame, panelled body, knob, porch step, overhead lantern
      const dw = S * 0.11, dh = S * 0.20;
      const dx = cx - dw / 2, dy = gy - dh;

      // Frame (dark trim, slightly proud of cabin wall)
      ctx.fillStyle = '#1a0c05';
      ctx.fillRect(dx - 3, dy - 2, dw + 6, dh + 2);
      ctx.beginPath(); ctx.arc(cx, dy, dw / 2 + 3, Math.PI, 0); ctx.fill();

      // Door body
      ctx.fillStyle = '#5c3318';
      ctx.fillRect(dx, dy, dw, dh);
      ctx.beginPath(); ctx.arc(cx, dy, dw / 2, Math.PI, 0); ctx.fill();

      // Two raised panels (inner shadow gives depth)
      const panW = dw * 0.64, panH = dh * 0.27, panX = cx - panW / 2;
      ctx.strokeStyle = '#1a0c05'; ctx.lineWidth = 1.5;
      ctx.strokeRect(panX,     dy + dh * 0.07,  panW, panH);
      ctx.strokeStyle = 'rgba(255,160,80,0.12)'; ctx.lineWidth = 1;
      ctx.strokeRect(panX + 2, dy + dh * 0.07 + 2, panW - 4, panH - 4);
      ctx.strokeStyle = '#1a0c05'; ctx.lineWidth = 1.5;
      ctx.strokeRect(panX,     dy + dh * 0.43,  panW, panH);
      ctx.strokeStyle = 'rgba(255,160,80,0.12)'; ctx.lineWidth = 1;
      ctx.strokeRect(panX + 2, dy + dh * 0.43 + 2, panW - 4, panH - 4);

      // Porch step
      ctx.fillStyle = '#2c1808';
      ctx.fillRect(cx - dw * 0.88, gy, dw * 1.76, S * 0.048);
      ctx.fillStyle = 'rgba(205,222,238,0.65)';
      ctx.fillRect(cx - dw * 0.88, gy, dw * 1.76, S * 0.009);

      // Log pile — stacked end-on to the right of the cabin
      const logR   = S * 0.027;
      const lpCx   = cbx + cw + S * 0.02 + logR * 4;
      const logRows = [
        { cols: 4, xOff: 0      },
        { cols: 3, xOff: logR   },
        { cols: 2, xOff: logR * 2 },
      ];
      logRows.forEach(({ cols, xOff }, row) => {
        for (let col = 0; col < cols; col++) {
          const lx = lpCx - (cols - 1) * logR + col * logR * 2 + xOff * 0;
          const ly = gy - logR * (2 * row + 1);
          ctx.fillStyle = row === 1 ? '#4a2812' : '#3b2010';
          ctx.beginPath(); ctx.arc(lx + (row * logR * 0.5), ly, logR, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#6b3c1e'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(lx + (row * logR * 0.5), ly, logR * 0.55, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(lx + (row * logR * 0.5), ly, logR * 0.28, 0, TAU); ctx.stroke();
        }
      });
      // Snow cap on top logs — row 2 arc centers are lpCx and lpCx + 2*logR
      ctx.fillStyle = 'rgba(210,228,245,0.88)';
      const topY = gy - logR * 5;
      [lpCx, lpCx + logR * 2].forEach(lx => {
        ctx.beginPath(); ctx.ellipse(lx, topY - logR * 0.8, logR * 0.92, logR * 0.30, 0, 0, TAU); ctx.fill();
      });

      // ── Timed events ──────────────────────────────────────────────────────
      const EV_NAMES = ['deer','owl','rabbit','shootingStar','curtainShift','smokeBurst'];
      if (!this._ev) {
        const lf = {};
        EV_NAMES.forEach(n => lf[n] = t - 999);
        this._ev = { nextT: t + 3, active: null, start: 0, dir: 1, lastFired: lf };
      }
      const ev = this._ev;
      const EV_MIN = 0.01, EV_MAX = 1.0, EV_RECOVERY = 0.012; // ~82s to full weight
      if (!ev.active && t >= ev.nextT) {
        const weights = EV_NAMES.map(n => Math.min(EV_MAX, EV_MIN + (t - ev.lastFired[n]) * EV_RECOVERY));
        const total   = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let chosen = EV_NAMES[EV_NAMES.length - 1];
        for (let i = 0; i < EV_NAMES.length; i++) { r -= weights[i]; if (r <= 0) { chosen = EV_NAMES[i]; break; } }
        ev.active            = chosen;
        ev.lastFired[chosen] = t;
        ev.start             = t;
        ev.dir               = Math.random() < 0.5 ? 1 : -1;
        ev.data              = {};
        ev.nextT             = t + 10 + Math.random() * 8;
      }

      if (ev.active) {
        const et = t - ev.start;
        ctx.save();

        // ── DEER ────────────────────────────────────────────────────────────
        if (ev.active === 'deer') {
          const dur = 11;
          if (et > dur) { ev.active = null; } else {
            const p  = et / dur;
            const ps = 0.40, pe = 0.58;
            const xp = p < ps ? p / ps * 0.5 : p < pe ? 0.5 : 0.5 + (p - pe) / (1 - pe) * 0.5;
            const startX  = ev.dir > 0 ? -S * 0.15 : W + S * 0.15;
            const endX    = ev.dir > 0 ? W + S * 0.15 : -S * 0.15;
            const dx      = startX + (endX - startX) * xp;
            const sz      = S * 0.13;
            const pausing = p >= ps && p < pe;
            const lookUp  = pausing && (et - ps * dur) > 0.7;

            ctx.globalAlpha = p < 0.07 ? p / 0.07 : p > 0.93 ? (1 - p) / 0.07 : 1;
            ctx.fillStyle = '#150d05'; ctx.strokeStyle = '#150d05';

            ctx.save();
            ctx.translate(dx, gy);
            if (ev.dir < 0) ctx.scale(-1, 1);

            // Legs — two pairs, swinging alternately
            const swing = pausing ? 0 : Math.sin(et * 5.2) * sz * 0.10;
            ctx.lineWidth = sz * 0.09; ctx.lineCap = 'round';
            [[-sz*0.28, -sz*0.12], [sz*0.10, sz*0.26]].forEach(([x1, x2]) => {
              ctx.beginPath(); ctx.moveTo(x1, -sz*0.16); ctx.lineTo(x1 + swing,  0); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(x2, -sz*0.16); ctx.lineTo(x2 - swing,  0); ctx.stroke();
            });

            // Body
            ctx.beginPath(); ctx.ellipse(0, -sz*0.40, sz*0.52, sz*0.22, -0.08, 0, TAU); ctx.fill();

            // Neck + head
            const na = lookUp ? -1.25 : -0.72;
            const nx = sz * 0.36, ny = -sz * 0.50;
            const hx = nx + Math.cos(na) * sz * 0.28;
            const hy = ny + Math.sin(na) * sz * 0.28;
            ctx.lineWidth = sz * 0.11;
            ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(hx, hy, sz*0.115, sz*0.09, lookUp ? -0.55 : 0.18, 0, TAU); ctx.fill();

            // Antlers (two simple forked beams)
            ctx.lineWidth = sz * 0.038; ctx.lineCap = 'round';
            const ax = hx + sz*0.03, ay = hy - sz*0.09;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax-sz*0.05, ay-sz*0.18); ctx.lineTo(ax-sz*0.12, ay-sz*0.26); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax-sz*0.03, ay-sz*0.12); ctx.lineTo(ax+sz*0.05, ay-sz*0.21); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax-sz*0.04, ay); ctx.lineTo(ax-sz*0.04, ay-sz*0.13); ctx.lineTo(ax-sz*0.10, ay-sz*0.20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax-sz*0.04, ay-sz*0.08); ctx.lineTo(ax+sz*0.03, ay-sz*0.16); ctx.stroke();

            ctx.restore();
          }
        }

        // ── OWL ─────────────────────────────────────────────────────────────
        else if (ev.active === 'owl') {
          const dur = 14;
          if (et > dur) { ev.active = null; } else {
            const p      = et / dur;
            const sz     = S * 0.065;
            const treeX  = cx - S * 0.72;
            const treeTopY = gy - S * 0.65;
            const flyIn  = Math.min(1, et / 1.5);
            const flyOut = p > 0.72 ? (p - 0.72) / 0.28 : 0;
            const owlX   = treeX + flyOut * (W - treeX + sz * 2);
            const owlY   = treeTopY - sz * 0.5 - (1 - flyIn) * H * 0.20;
            const edgeFade = owlX > W * 0.9 ? 1 - (owlX - W * 0.9) / (sz * 2) : 1;

            ctx.globalAlpha = Math.min(flyIn, edgeFade);
            ctx.fillStyle = '#150d05'; ctx.strokeStyle = '#150d05';

            // Body
            ctx.beginPath(); ctx.ellipse(owlX, owlY + sz*0.28, sz*0.36, sz*0.50, 0, 0, TAU); ctx.fill();

            // Head (rotates)
            ctx.save();
            ctx.translate(owlX, owlY - sz*0.14);
            ctx.rotate(Math.sin(et * 1.1) * 0.42);
            ctx.beginPath(); ctx.arc(0, 0, sz*0.32, 0, TAU); ctx.fill();
            // Ear tufts
            [[- sz*0.15, sz*0.07], [sz*0.15, -sz*0.07]].forEach(([ox, tip]) => {
              ctx.beginPath();
              ctx.moveTo(ox, -sz*0.26); ctx.lineTo(ox + tip, -sz*0.46); ctx.lineTo(ox * 0.45, -sz*0.30);
              ctx.closePath(); ctx.fill();
            });
            // Eyes
            ctx.fillStyle = 'rgba(255,215,130,0.95)';
            [-sz*0.11, sz*0.11].forEach(ex => {
              ctx.beginPath(); ctx.arc(ex, 0, sz*0.09, 0, TAU); ctx.fill();
            });
            ctx.fillStyle = '#0e0808';
            [-sz*0.11, sz*0.11].forEach(ex => {
              ctx.beginPath(); ctx.arc(ex, 0, sz*0.048, 0, TAU); ctx.fill();
            });
            ctx.restore();

            // Talons
            ctx.lineWidth = sz * 0.07; ctx.lineCap = 'round';
            [[-sz*0.10, -sz*0.24], [-sz*0.10, -sz*0.13], [sz*0.10, sz*0.24], [sz*0.10, sz*0.13]].forEach(([bx, tx]) => {
              ctx.beginPath(); ctx.moveTo(owlX + bx, owlY + sz*0.78); ctx.lineTo(owlX + tx, owlY + sz*0.88); ctx.stroke();
            });
          }
        }

        // ── RABBIT ──────────────────────────────────────────────────────────
        else if (ev.active === 'rabbit') {
          const dur = 6;
          if (et > dur) { ev.active = null; } else {
            const p      = et / dur;
            const startX = ev.dir > 0 ? -S * 0.08 : W + S * 0.08;
            const endX   = ev.dir > 0 ? W + S * 0.08 : -S * 0.08;
            const sz     = S * 0.055;
            const rx     = startX + (endX - startX) * p;
            const hopAng = et * 5.5;
            const inAir  = Math.abs(Math.sin(hopAng)) > 0.1;
            const ry     = gy - Math.abs(Math.sin(hopAng)) * sz * 1.05;

            ctx.globalAlpha = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;

            ctx.save();
            ctx.translate(rx, ry);
            ctx.scale(ev.dir * (inAir ? 1.0 : 1.26), inAir ? 1.0 : 0.74);

            ctx.fillStyle = '#cde0f0';
            ctx.beginPath(); ctx.ellipse(0, 0, sz*0.50, sz*0.34, 0.12, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sz*0.38, -sz*0.16, sz*0.25, sz*0.21, -0.18, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sz*0.28, -sz*0.50, sz*0.07, sz*0.22, -0.12, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sz*0.43, -sz*0.52, sz*0.07, sz*0.22,  0.14, 0, TAU); ctx.fill();
            ctx.fillStyle = '#1a0808';
            ctx.beginPath(); ctx.arc(sz*0.50, -sz*0.20, sz*0.055, 0, TAU); ctx.fill();
            ctx.fillStyle = '#e8f2ff';
            ctx.beginPath(); ctx.arc(-sz*0.48, sz*0.05, sz*0.13, 0, TAU); ctx.fill();

            ctx.restore();
          }
        }

        // ── SHOOTING STAR ────────────────────────────────────────────────
        else if (ev.active === 'shootingStar') {
          const dur = 1.8;
          if (et > dur) { ev.active = null; } else {
            if (!ev.data.init) {
              ev.data.init  = true;
              ev.data.x     = W * 0.08 + Math.random() * W * 0.55;
              ev.data.y     = H * 0.04 + Math.random() * H * 0.18;
              ev.data.angle = 0.38 + Math.random() * 0.32;
            }
            const p       = et / dur;
            const alpha   = p < 0.12 ? p / 0.12 : p > 0.70 ? 1 - (p - 0.70) / 0.30 : 1;
            const dist    = p * W * 0.42;
            const tailLen = Math.min(dist, W * 0.22);
            const hx = ev.data.x + Math.cos(ev.data.angle) * dist;
            const hy = ev.data.y + Math.sin(ev.data.angle) * dist;
            const tx = hx - Math.cos(ev.data.angle) * tailLen;
            const ty = hy - Math.sin(ev.data.angle) * tailLen;

            ctx.globalAlpha = alpha;
            const streak = ctx.createLinearGradient(tx, ty, hx, hy);
            streak.addColorStop(0,   'rgba(255,255,255,0)');
            streak.addColorStop(0.38, 'rgba(255,245,170,0.50)');
            streak.addColorStop(0.78, 'rgba(180,225,255,0.85)');
            streak.addColorStop(1,   'rgba(255,255,255,1)');
            ctx.shadowBlur = 16;
            ctx.shadowColor = 'rgba(200,230,255,0.95)';
            ctx.strokeStyle = streak; ctx.lineWidth = 4; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.globalAlpha = alpha * 0.36;
            ctx.strokeStyle = 'rgba(160,210,255,0.65)';
            ctx.lineWidth = 10;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.globalAlpha = alpha;
            const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14);
            hg.addColorStop(0, 'rgba(255,255,255,0.95)');
            hg.addColorStop(1, 'rgba(255,245,180,0)');
            ctx.fillStyle = hg;
            ctx.beginPath(); ctx.arc(hx, hy, 14, 0, TAU); ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        // ── CURTAIN SHIFT ────────────────────────────────────────────────
        else if (ev.active === 'curtainShift') {
          const dur = 3.0;
          if (et > dur) { ev.active = null; } else {
            if (!ev.data.init) {
              ev.data.init  = true;
              ev.data.which = Math.random() < 0.5 ? 0 : 1;
            }
            const owx = ev.data.which === 0 ? wx : wx2;
            const dim = Math.sin((et / dur) * Math.PI) * 0.72;
            ctx.fillStyle = `rgba(6,3,1,${dim})`;
            ctx.fillRect(owx, wy, ww, wh);
          }
        }

        // ── SMOKE BURST ──────────────────────────────────────────────────
        else if (ev.active === 'smokeBurst') {
          const dur = 5.0;
          if (et > dur) { ev.active = null; } else {
            const intensity = et < 0.6 ? et / 0.6 : et > 3.5 ? (dur - et) / 1.5 : 1;
            for (let i = 0; i < 10; i++) {
              const p  = (t * 0.9 + i * 0.21) % 2.4;
              const sx = chx + S * 0.035 + Math.sin(t * 0.95 + i * 1.5) * S * 0.07;
              const sy = chy - p * S * 0.62;
              ctx.globalAlpha = (1 - p / 2.4) * 0.50 * intensity;
              ctx.fillStyle = '#c8c8c8';
              ctx.beginPath(); ctx.arc(sx, sy, S * 0.044 + p * S * 0.09, 0, TAU); ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }

        ctx.restore();
      }

    }
  },

  // 2. MOON CITY ──────────────────────────────────────────────────────────────
  {
    name: 'Moon City',
    particleType: 'star',
    draw(ctx, W, H, t) {
      const gy = H * 0.78;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#030110');
      sky.addColorStop(0.5, '#07021e');
      sky.addColorStop(1, '#130830');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      drawMoon(ctx, W * 0.2, H * 0.18, Math.min(W, H) * 0.1, 'crescent');

      // Buildings span full width
      const bldgs = [
        { x: 0,      w: W*0.12, h: H*0.30 },
        { x: W*0.10, w: W*0.16, h: H*0.45 },
        { x: W*0.24, w: W*0.17, h: H*0.62 },
        { x: W*0.39, w: W*0.20, h: H*0.74 },
        { x: W*0.57, w: W*0.18, h: H*0.66 },
        { x: W*0.73, w: W*0.15, h: H*0.50 },
        { x: W*0.86, w: W*0.14, h: H*0.36 },
      ];

      bldgs.forEach((b, bi) => {
        const by = gy - b.h;
        ctx.fillStyle = '#0a0618';
        ctx.fillRect(b.x, by, b.w, b.h + 4);

        const cols = Math.max(2, Math.floor(b.w / (W * 0.038)));
        const rows = Math.max(2, Math.floor(b.h / (H * 0.065)));
        for (let row = 1; row <= rows; row++) {
          for (let col = 0; col < cols; col++) {
            const s = bi * 200 + row * 17 + col * 7;
            if (hash(s) >= 60) continue;
            const wwx = b.x + col * (b.w / cols) + b.w / cols * 0.12;
            const wwy = by  + row * (b.h / (rows + 1)) - (b.h / (rows + 1)) * 0.28;
            const ww  = b.w / cols * 0.58;
            const wh  = b.h / (rows + 1) * 0.44;
            const hue = hash(s * 3) < 28 ? 210 : 42;
            ctx.fillStyle = `hsl(${hue},72%,72%)`;
            ctx.fillRect(wwx, wwy, ww, wh);
          }
        }
        if (b.h > H * 0.55) {
          ctx.strokeStyle = '#14082a'; ctx.lineWidth = 1.5;
          const ax = b.x + b.w / 2;
          ctx.beginPath(); ctx.moveTo(ax, by); ctx.lineTo(ax, by - H * 0.05); ctx.stroke();
          ctx.globalAlpha = Math.sin(t * 3.2 + bi) > 0 ? 0.9 : 0.12;
          ctx.fillStyle = '#ff3838';
          ctx.beginPath(); ctx.arc(ax, by - H * 0.05, 2.5, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // Road
      const road = ctx.createLinearGradient(0, gy, 0, H);
      road.addColorStop(0, '#160c28'); road.addColorStop(1, '#090616');
      ctx.fillStyle = road; ctx.fillRect(0, gy, W, H);

      // Moon puddle
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#fff8e0';
      ctx.beginPath();
      ctx.ellipse(W * 0.2, gy + H * 0.04, W * 0.04, H * 0.012, 0, 0, TAU);
      ctx.fill(); ctx.globalAlpha = 1;
    }
  },

  // 3. AQUARIUM ───────────────────────────────────────────────────────────────
  {
    name: 'Aquarium',
    particleType: 'bubble',
    draw(ctx, W, H, t) {
      const sandY = H * 0.82;

      // Water
      const water = ctx.createLinearGradient(0, 0, 0, H);
      water.addColorStop(0, '#001420');
      water.addColorStop(0.55, '#002840');
      water.addColorStop(1, '#003255');
      ctx.fillStyle = water; ctx.fillRect(0, 0, W, H);

      // Light rays
      ctx.save();
      for (let i = 0; i < 7; i++) {
        const rx = W * 0.08 + i * W * 0.14 + Math.sin(t * 0.5 + i * 1.3) * W * 0.03;
        const rg = ctx.createLinearGradient(rx, 0, rx + W * 0.06, H * 0.55);
        rg.addColorStop(0, 'rgba(70,180,255,0.1)');
        rg.addColorStop(1, 'rgba(70,180,255,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(rx - W * 0.03, 0);
        ctx.lineTo(rx + W * 0.14, H * 0.56);
        ctx.lineTo(rx + W * 0.20, H * 0.56);
        ctx.lineTo(rx + W * 0.04, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      // Sand
      const sand = ctx.createLinearGradient(0, sandY, 0, H);
      sand.addColorStop(0, '#7a6040'); sand.addColorStop(1, '#9a7e56');
      ctx.fillStyle = sand; ctx.fillRect(0, sandY, W, H);
      const sandEdge = ctx.createLinearGradient(0, sandY - 18, 0, sandY + 6);
      sandEdge.addColorStop(0, 'rgba(122,96,64,0)'); sandEdge.addColorStop(1, '#7a6040');
      ctx.fillStyle = sandEdge; ctx.fillRect(0, sandY - 18, W, 24);

      // Coral (deterministic branches)
      const coral = (ox, oy, h, color) => {
        ctx.strokeStyle = color; ctx.lineCap = 'round';
        const branch = (x, y, a, len, d) => {
          if (d === 0 || len < 2) return;
          const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
          ctx.lineWidth = Math.max(0.8, d * 1.3);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
          branch(ex, ey, a - 0.38, len * 0.64, d - 1);
          branch(ex, ey, a + 0.38, len * 0.64, d - 1);
        };
        branch(ox, oy, -Math.PI / 2, h, 4);
      };

      const coralPositions = [0.08, 0.22, 0.42, 0.60, 0.76, 0.90];
      const coralColors    = ['#b5312a','#d46a1a','#9b45c0','#c0392b','#d4801a','#8e3faa'];
      const coralHeights   = [0.12, 0.09, 0.14, 0.11, 0.08, 0.13];
      coralPositions.forEach((rx, i) => {
        coral(W * rx, sandY, H * coralHeights[i], coralColors[i]);
      });

      // Seaweed
      const weedH  = [0.18, 0.14, 0.22, 0.16, 0.20];
      const weedX  = [0.14, 0.32, 0.50, 0.67, 0.84];
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = `rgba(0,${90 + i * 18},65,0.88)`;
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(W * weedX[i], sandY);
        const wh = H * weedH[i];
        for (let j = 1; j <= 8; j++) {
          const p = j / 8;
          const sx = W * weedX[i] + Math.sin(t * 1.4 + i * 1.3 + p * Math.PI) * W * 0.015;
          ctx.lineTo(sx, sandY - p * wh);
        }
        ctx.stroke();
      }

      // Fish helper
      const fish = (fx, fy, sz, dir, color) => {
        ctx.save(); ctx.translate(fx, fy);
        if (dir < 0) ctx.scale(-1, 1);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.46, 0, 0, TAU); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-sz, 0); ctx.lineTo(-sz * 1.6, -sz * 0.5); ctx.lineTo(-sz * 1.6, sz * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(sz * 0.4, -sz * 0.1, sz * 0.16, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(sz * 0.44, -sz * 0.1, sz * 0.08, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = sz * 0.09;
        ctx.beginPath(); ctx.moveTo(0, -sz * 0.38); ctx.lineTo(0, sz * 0.38); ctx.stroke();
        ctx.restore();
      };

      const fS = Math.min(W, H) * 0.05;
      fish(W/2 + Math.sin(t * 0.38) * W * 0.38, H * 0.32 + Math.sin(t * 0.8)  * H * 0.06, fS * 2.0, Math.cos(t * 0.38) > 0 ? 1 : -1, '#e8920e');
      fish(W/2 + Math.sin(t * 0.27 + 2) * W * 0.32, H * 0.52 + Math.sin(t * 0.6 + 1) * H * 0.05, fS * 1.5, Math.cos(t * 0.27 + 2) > 0 ? 1 : -1, '#2e8fdb');
      fish(W/2 + Math.sin(t * 0.45 + 4) * W * 0.28, H * 0.20 + Math.sin(t * 0.7 + 3) * H * 0.04, fS * 1.2, Math.cos(t * 0.45 + 4) > 0 ? 1 : -1, '#e03a2a');
      fish(W/2 + Math.sin(t * 0.33 + 6) * W * 0.42, H * 0.42 + Math.sin(t * 0.9 + 5) * H * 0.05, fS * 1.0, Math.cos(t * 0.33 + 6) > 0 ? 1 : -1, '#a020c0');
      fish(W/2 + Math.sin(t * 0.55 + 8) * W * 0.22, H * 0.64 + Math.sin(t * 0.5 + 7) * H * 0.04, fS * 0.9, Math.cos(t * 0.55 + 8) > 0 ? 1 : -1, '#20a060');
    }
  },

  // 4. HAUNTED FOREST ─────────────────────────────────────────────────────────
  {
    name: 'Haunted Forest',
    particleType: 'ember',
    draw(ctx, W, H, t) {
      const gy = H * 0.72;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#050008');
      sky.addColorStop(0.6, '#180c2c');
      sky.addColorStop(1, '#0a0618');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      drawMoon(ctx, W * 0.78, H * 0.16, Math.min(W, H) * 0.09, 'full');

      // Trees spanning full width
      const tree = (tx, baseY, h) => {
        const branch = (x, y, angle, len, depth) => {
          if (depth === 0 || len < Math.min(W, H) * 0.012) return;
          const sway = Math.sin(t * 0.7 + tx * 0.005) * 0.05;
          const ex = x + Math.cos(angle + sway) * len;
          const ey = y + Math.sin(angle + sway) * len;
          ctx.strokeStyle = depth > 3 ? '#0e0822' : '#120a28';
          ctx.lineWidth = Math.max(0.5, depth * 1.4);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
          branch(ex, ey, angle - 0.46 + sway, len * 0.63, depth - 1);
          branch(ex, ey, angle + 0.46 + sway, len * 0.63, depth - 1);
          if (depth > 2) branch(ex, ey, angle + sway, len * 0.75, depth - 1);
        };
        branch(tx, baseY, -Math.PI / 2, h, 7);
      };

      tree(W * 0.08,  gy, H * 0.55);
      tree(W * 0.22,  gy, H * 0.62);
      tree(W * 0.38,  gy, H * 0.70);
      tree(W * 0.58,  gy, H * 0.65);
      tree(W * 0.74,  gy, H * 0.58);
      tree(W * 0.90,  gy, H * 0.50);

      // Gravestones
      const grave = (gx, gw, gh) => {
        ctx.fillStyle = '#281838';
        ctx.fillRect(gx - gw/2, gy - gh, gw, gh);
        ctx.beginPath(); ctx.arc(gx, gy - gh, gw/2, Math.PI, 0); ctx.fill();
      };
      grave(W * 0.30, W * 0.046, H * 0.10);
      grave(W * 0.52, W * 0.038, H * 0.08);
      grave(W * 0.68, W * 0.042, H * 0.09);

      // Ground
      ctx.fillStyle = '#100820';
      ctx.fillRect(0, gy, W, H);

      // Fog layer
      const fog = ctx.createLinearGradient(0, gy - H * 0.12, 0, gy + H * 0.06);
      fog.addColorStop(0, 'rgba(65,30,100,0)');
      fog.addColorStop(1, 'rgba(65,30,100,0.52)');
      ctx.fillStyle = fog; ctx.fillRect(0, gy - H * 0.12, W, H * 0.18);

      // Bats
      const bat = (bx, by, sz) => {
        const flap = Math.sin(t * 8.5 + bx * 0.01) * 0.4;
        ctx.fillStyle = '#070318';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.bezierCurveTo(bx - sz*0.7, by + flap*sz*1.6, bx - sz*1.8, by - sz*0.9, bx - sz*2.2, by - sz*0.4);
        ctx.bezierCurveTo(bx - sz*1.4, by - sz*0.1, bx - sz*0.5, by + flap*sz, bx, by);
        ctx.bezierCurveTo(bx + sz*0.5, by + flap*sz, bx + sz*1.4, by - sz*0.1, bx + sz*2.2, by - sz*0.4);
        ctx.bezierCurveTo(bx + sz*1.8, by - sz*0.9, bx + sz*0.7, by + flap*sz*1.6, bx, by);
        ctx.fill();
      };

      const bsz = Math.min(W, H) * 0.03;
      bat(W/2 + Math.sin(t * 0.6)  * W * 0.35, H * 0.22 + Math.sin(t * 0.4 + 1) * H * 0.08, bsz * 1.0);
      bat(W/2 + Math.sin(t * 0.45 + 2) * W * 0.28, H * 0.38 + Math.sin(t * 0.65) * H * 0.06, bsz * 0.8);
      bat(W/2 + Math.sin(t * 0.7 + 4) * W * 0.22, H * 0.12 + Math.sin(t * 0.5 + 3) * H * 0.05, bsz * 0.65);
    }
  },

  // 5. DESERT NIGHT ───────────────────────────────────────────────────────────
  {
    name: 'Desert Night',
    particleType: 'sand',
    draw(ctx, W, H, t) {
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#000008');
      sky.addColorStop(0.6, '#090418');
      sky.addColorStop(1, '#1a1008');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Milky way band
      ctx.save();
      ctx.translate(W/2, H/2); ctx.rotate(-0.28);
      const mw = ctx.createLinearGradient(-W, 0, W, 0);
      mw.addColorStop(0, 'rgba(185,165,255,0)');
      mw.addColorStop(0.35, 'rgba(185,165,255,0.07)');
      mw.addColorStop(0.65, 'rgba(185,165,255,0.07)');
      mw.addColorStop(1, 'rgba(185,165,255,0)');
      ctx.fillStyle = mw; ctx.fillRect(-W, -H * 0.15, W * 2, H * 0.3);
      ctx.restore();

      drawStarField(ctx, W, H, 60, t);
      drawMoon(ctx, W * 0.82, H * 0.14, Math.min(W, H) * 0.07, 'crescent');

      // Layered dunes
      const dune = (phase, color, hFrac, yFrac) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let i = 0; i <= 40; i++) {
          const p = i / 40;
          const x = p * W;
          const dh = H * hFrac;
          const y = H * yFrac + Math.sin(p * Math.PI * 3.2 + phase) * dh * 0.5 - dh * 0.5;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      };
      dune(0,   '#2e2012', 0.48, 0.62);
      dune(1.4, '#3c2c18', 0.36, 0.68);
      dune(2.8, '#4e3a22', 0.26, 0.74);
      dune(4.0, '#5e4828', 0.18, 0.80);

      // Saguaro cacti
      const cactus = (kx, ky, h) => {
        const tw = Math.min(W, H) * 0.024;
        ctx.fillStyle = '#152610';
        ctx.fillRect(kx - tw/2, ky - h, tw, h);
        // Left arm
        ctx.fillRect(kx - tw * 2.4, ky - h * 0.55 - tw, tw * 1.9, tw);
        ctx.fillRect(kx - tw * 2.4, ky - h * 0.55 - tw - h * 0.3, tw, h * 0.3 + tw);
        // Right arm
        ctx.fillRect(kx + tw * 0.5, ky - h * 0.44, tw * 1.9, tw);
        ctx.fillRect(kx + tw * 2.0, ky - h * 0.44 - h * 0.24, tw, h * 0.24 + tw);
      };

      const gy = H * 0.78;
      cactus(W * 0.12, gy, H * 0.22);
      cactus(W * 0.32, gy, H * 0.18);
      cactus(W * 0.55, gy, H * 0.26);
      cactus(W * 0.74, gy, H * 0.20);
      cactus(W * 0.90, gy, H * 0.15);
    }
  },

  // 6. MINI OFFICE ────────────────────────────────────────────────────────────
  {
    name: 'Mini Office',
    particleType: 'star',
    draw(ctx, W, H, t) {
      const streetY = H * 0.82;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#030810');
      sky.addColorStop(1, '#081222');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      drawStarField(ctx, W, H, 22, t);

      // Background buildings
      [
        { x: 0,      w: W * 0.18, h: H * 0.42 },
        { x: W*0.14, w: W * 0.14, h: H * 0.36 },
        { x: W*0.68, w: W * 0.16, h: H * 0.38 },
        { x: W*0.82, w: W * 0.18, h: H * 0.44 },
      ].forEach((b, bi) => {
        const by = streetY - b.h;
        ctx.fillStyle = '#080e1e';
        ctx.fillRect(b.x, by, b.w, b.h);
        for (let row = 1; row < 6; row++) {
          for (let col = 0; col < 3; col++) {
            const s = bi * 200 + row * 13 + col * 5;
            if (hash(s) >= 48) continue;
            ctx.fillStyle = 'rgba(255,210,100,0.2)';
            ctx.fillRect(b.x + col * (b.w/3) + 2, by + row * (b.h/7) + 2, b.w/3 - 4, b.h/7 - 4);
          }
        }
      });

      // Main building
      const bw = W * 0.40, bh = H * 0.92;
      const bx = (W - bw) / 2, by = streetY - bh;
      ctx.fillStyle = '#0c1828';
      ctx.fillRect(bx, by, bw, bh);

      // Floor lines
      const floors = 11;
      ctx.strokeStyle = 'rgba(20,50,90,0.55)'; ctx.lineWidth = 0.5;
      for (let f = 1; f < floors; f++) {
        const fy = by + f * (bh / floors);
        ctx.beginPath(); ctx.moveTo(bx, fy); ctx.lineTo(bx + bw, fy); ctx.stroke();
      }

      // Windows
      const cols = 4, rows = floors;
      const ww  = bw / (cols + 1) * 0.60;
      const wh  = bh / (rows + 1) * 0.50;
      const wpx = (bw - cols * ww) / (cols + 1);
      const wpy = (bh - rows * wh) / (rows + 1);
      const elevFloor = Math.floor((Math.sin(t * 0.28) * 0.5 + 0.5) * (rows - 1));

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const s   = row * 100 + col;
          if (hash(s * 7) >= 68) continue;
          if (Math.sin(t * 0.28 + s * 0.5) > 0.92) continue;
          const wwx = bx + wpx + col * (ww + wpx);
          const wwy = by + wpy + row * (wh + wpy);
          const isElev = col === 3 && row === elevFloor;
          const hue = isElev ? 195 : (hash(s * 5) < 26 ? 208 : 42);
          ctx.fillStyle = `hsla(${hue},72%,72%,${isElev ? 0.95 : 0.88})`;
          ctx.fillRect(wwx, wwy, ww, wh);
          const wg = ctx.createRadialGradient(wwx+ww/2, wwy+wh/2, 0, wwx+ww/2, wwy+wh/2, ww*1.5);
          wg.addColorStop(0, `hsla(${hue},72%,72%,0.1)`);
          wg.addColorStop(1, `hsla(${hue},72%,72%,0)`);
          ctx.fillStyle = wg;
          ctx.fillRect(wwx - ww, wwy - wh, ww * 3, wh * 3);
        }
      }

      // Rooftop + antenna
      ctx.fillStyle = '#0a1422';
      ctx.fillRect(bx - 2, by - H * 0.022, bw + 4, H * 0.022);
      ctx.strokeStyle = '#0c1830'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W/2, by - H*0.022);
      ctx.lineTo(W/2, by - H*0.085);
      ctx.stroke();
      ctx.globalAlpha = Math.sin(t * 3.8) > 0 ? 0.9 : 0.15;
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(W/2, by - H*0.085, 3, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;

      // Street
      const road = ctx.createLinearGradient(0, streetY, 0, H);
      road.addColorStop(0, '#080e1c'); road.addColorStop(1, '#04080e');
      ctx.fillStyle = road; ctx.fillRect(0, streetY, W, H);

      // Street lamps
      const lamp = (lx) => {
        ctx.strokeStyle = '#162230'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, streetY); ctx.lineTo(lx, streetY - H*0.18);
        ctx.lineTo(lx + (lx < W/2 ? W*0.04 : -W*0.04), streetY - H*0.18);
        ctx.stroke();
        const lh = lx + (lx < W/2 ? W*0.04 : -W*0.04);
        const lg = ctx.createRadialGradient(lh, streetY - H*0.18, 0, lh, streetY - H*0.18, W*0.08);
        lg.addColorStop(0, 'rgba(255,195,70,0.32)'); lg.addColorStop(1, 'rgba(255,195,70,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(lh, streetY - H*0.18, W*0.08, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,195,70,0.95)';
        ctx.beginPath(); ctx.arc(lh, streetY - H*0.18, 3, 0, TAU); ctx.fill();
      };
      lamp(W * 0.14);
      lamp(W * 0.86);
    }
  },
];

// ─── OVERLAY UI ───────────────────────────────────────────────────────────────
function renderUI(ctx, W, H, sceneIdx, safeTop, safeBot) {
  // Top gradient — keeps title legible over any scene
  const topG = ctx.createLinearGradient(0, 0, 0, H * 0.18);
  topG.addColorStop(0, 'rgba(0,0,0,0.55)');
  topG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topG; ctx.fillRect(0, 0, W, H * 0.18);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(200,218,255,0.55)';
  ctx.font = `${Math.round(H * 0.020)}px Georgia, 'Times New Roman', serif`;
  ctx.fillText('M O M E N T A R I U M', W / 2, safeTop + H * 0.058);

  // Bottom gradient — reserved for future scene picker
  const botG = ctx.createLinearGradient(0, H * 0.83, 0, H);
  botG.addColorStop(0, 'rgba(0,0,0,0)');
  botG.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = botG; ctx.fillRect(0, H * 0.83, W, H * 0.17);

  // Scene name
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(190,210,255,0.55)';
  ctx.font = `${Math.round(H * 0.015)}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(SCENES[sceneIdx].name.toUpperCase(), W / 2, H - safeBot - H * 0.072);

  // Dot indicators (placeholder for scene picker)
  const dotY     = H - safeBot - H * 0.034;
  const spacing  = Math.min(24, W / (SCENES.length + 2));
  const startX   = W / 2 - (SCENES.length - 1) * spacing / 2;
  SCENES.forEach((_, i) => {
    ctx.globalAlpha = i === sceneIdx ? 0.88 : 0.28;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(startX + i * spacing, dotY, i === sceneIdx ? 4.5 : 3, 0, TAU);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ─── APP ──────────────────────────────────────────────────────────────────────
class Momentarium {
  constructor() {
    this.canvas = document.getElementById('c');
    this.ctx    = this.canvas.getContext('2d');
    this.hint   = document.getElementById('hint');

    this.sceneIdx     = Math.floor(Math.random() * SCENES.length);
    this.nextSceneIdx = 0;
    this.particles    = [];
    this.turbulence   = 0;
    this.fade         = 0;
    this.fadeDir      = 0;
    this.t            = 0;
    this.lastTs       = 0;
    this.lastShakeMs  = 0;
    this.hintShown    = true;
    this.safeTop      = 0;
    this.safeBot      = 0;

    this.readSafeArea();
    this.resize();
    this.buildParticles();
    this.bindInput();
    requestAnimationFrame(ts => this.loop(ts));
  }

  readSafeArea() {
    // Read CSS env() safe area insets if available
    const el = document.documentElement;
    const cs = getComputedStyle(el);
    this.safeTop = parseInt(cs.getPropertyValue('--sat')) || 0;
    this.safeBot = parseInt(cs.getPropertyValue('--sab')) || 0;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width  = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width  = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.readSafeArea();
  }

  buildParticles(fromShake) {
    const { W, H } = this;
    const scene = SCENES[this.sceneIdx];
    const type  = scene.particleType;
    const count = scene.particleCount ?? CFG.particleCount;
    this.particles = Array.from({ length: count }, () => {
      const p = new Particle(type, W, H);
      if (fromShake) p.kick();
      return p;
    });
  }

  bindInput() {
    let ptrStartX = 0, ptrStartY = 0, didSwipe = false;

    this.canvas.addEventListener('pointerdown', (e) => {
      ptrStartX = e.clientX;
      ptrStartY = e.clientY;
      didSwipe  = false;
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - ptrStartX) > 10) didSwipe = true;
    });

    this.canvas.addEventListener('pointerup', (e) => {
      e.preventDefault();
      const dx = e.clientX - ptrStartX;
      const dy = e.clientY - ptrStartY;

      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        // Horizontal swipe — change scene
        this.changeScene(this.sceneIdx + (dx < 0 ? 1 : -1));
      } else if (!didSwipe) {
        // Tap — check dots first, otherwise turbulence
        const dot = this.getDotAt(e.clientX, e.clientY);
        if (dot >= 0) {
          this.changeScene(dot);
        } else {
          this.onTap();
        }
      }

      if (this.hintShown) {
        this.hintShown = false;
        this.hint.classList.add('fade');
      }
    });

    let prevMag = 0;
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      const mag   = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
      const delta = Math.abs(mag - prevMag);
      prevMag = mag;
      if (delta > CFG.shakeThreshold) {
        const now = Date.now();
        if (now - this.lastShakeMs > 500) {
          this.lastShakeMs = now;
          this.onShake();
        }
      }
    });

    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      this.canvas.addEventListener('pointerdown', () => {
        DeviceMotionEvent.requestPermission().catch(() => {});
      }, { once: true });
    }

    window.addEventListener('resize', () => {
      this.resize();
      this.buildParticles(false);
    });
  }

  // Turbulence only — no scene change
  onShake() {
    this.turbulence = 2.0;
    this.particles.forEach(p => p.kick());
  }

  // Tap on scene area — light turbulence
  onTap() {
    this.turbulence = 1.4;
    this.particles.forEach(p => p.kick());
  }

  // Deliberate scene jump — swipe or dot tap
  changeScene(idx) {
    if (this.fadeDir !== 0 || this.changeTimer >= 0) return;
    const n = ((idx % SCENES.length) + SCENES.length) % SCENES.length;
    if (n === this.sceneIdx) return;
    this.nextSceneIdx = n;
    this.fadeDir      = 1; // start fading immediately
    this.turbulence   = 1.0;
    this.particles.forEach(p => p.kick());
  }

  // Return scene index for the dot under (x, y), or -1
  getDotAt(x, y) {
    const { W, H, safeBot } = this;
    const dotY   = H - safeBot - H * 0.034;
    const spacing = Math.min(24, W / (SCENES.length + 2));
    const startX  = W / 2 - (SCENES.length - 1) * spacing / 2;
    for (let i = 0; i < SCENES.length; i++) {
      const ddx = x - (startX + i * spacing);
      const ddy = y - dotY;
      if (ddx * ddx + ddy * ddy < 22 * 22) return i;
    }
    return -1;
  }

  update(dt) {
    this.t += dt * 0.001;
    this.turbulence = Math.max(0, this.turbulence * Math.pow(CFG.turbulenceDecay, dt / 16));
    this.particles.forEach(p => p.update(this.turbulence, dt));

    const spd = CFG.transitionSpeed * (dt / 16);
    if (this.fadeDir === 1) {
      this.fade = Math.min(1, this.fade + spd);
      if (this.fade >= 1) {
        this.sceneIdx = this.nextSceneIdx;
        this.fadeDir  = -1;
        this.buildParticles(true);
      }
    } else if (this.fadeDir === -1) {
      this.fade = Math.max(0, this.fade - spd);
      if (this.fade <= 0) this.fadeDir = 0;
    }
  }

  draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    // Draw scene to full canvas
    SCENES[this.sceneIdx].draw(ctx, W, H, this.t);

    // Transition fade
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Particles on top of scene, under UI
    this.particles.forEach(p => p.draw(ctx, this.t));

    // UI overlay always on top
    renderUI(ctx, W, H, this.sceneIdx, this.safeTop, this.safeBot);
  }

  loop(ts) {
    const dt = Math.min(50, ts - (this.lastTs || ts));
    this.lastTs = ts;
    this.update(dt);
    this.draw();
    requestAnimationFrame(next => this.loop(next));
  }
}

window.addEventListener('load', () => new Momentarium());

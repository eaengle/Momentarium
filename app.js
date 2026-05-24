'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const CFG = {
  particleCount: 72,
  shakeThreshold: 13,
  turbulenceDecay: 0.96,
  transitionSpeed: 0.038,
  shakeDelay: 420,      // ms before scene starts fading after shake
};

// ─── MATH ─────────────────────────────────────────────────────────────────────
const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Deterministic hash for stable per-frame values
const hash  = (n) => ((n * 2654435761) >>> 0) % 100;

// ─── PARTICLE ─────────────────────────────────────────────────────────────────
class Particle {
  constructor(type, cx, cy, r) {
    this.type = type;
    this.cx = cx; this.cy = cy; this.r = r;
    this.init(false);
  }

  init(fromShake) {
    const { cx, cy, r } = this;
    switch (this.type) {

      case 'snow': {
        this.x  = cx + rand(-r * 0.8, r * 0.8);
        this.y  = fromShake ? rand(cy - r, cy + r * 0.5)
                            : cy - rand(0, r * 0.9);
        this.vx = rand(-0.4, 0.4);
        this.vy = rand(0.3, 0.9);
        this.sz = rand(1.5, 3.5);
        this.a  = rand(0.55, 1.0);
        this.ph = rand(0, TAU); // twinkle phase
        break;
      }

      case 'bubble': {
        const ang = rand(0, TAU), dist = rand(0, r * 0.8);
        this.x  = cx + Math.cos(ang) * dist;
        this.y  = cy + rand(0, r * 0.6);
        this.vx = rand(-0.25, 0.25);
        this.vy = rand(-0.7, -0.25);
        this.sz = rand(2.5, 7);
        this.a  = rand(0.2, 0.5);
        break;
      }

      case 'ember': {
        const ang2 = rand(0, TAU), dist2 = rand(0, r * 0.6);
        this.x  = cx + Math.cos(ang2) * dist2;
        this.y  = cy + rand(-r * 0.2, r * 0.5);
        this.vx = rand(-0.5, 0.5);
        this.vy = rand(-0.7, -0.15);
        this.sz = rand(1.2, 3);
        this.a  = rand(0.4, 0.85);
        this.hue = rand(18, 45);
        this.ph = rand(0, TAU);
        break;
      }

      case 'sand': {
        const ang3 = rand(0, TAU), dist3 = rand(0, r * 0.75);
        this.x  = cx + Math.cos(ang3) * dist3;
        this.y  = cy + Math.sin(ang3) * dist3;
        this.vx = rand(-1.2, 1.2);
        this.vy = rand(-0.4, 0.6);
        this.sz = rand(1, 2.5);
        this.a  = rand(0.3, 0.65);
        break;
      }

      case 'star': {
        // Stars live in the upper 2/3 of the globe
        const ang4 = rand(Math.PI * 1.05, Math.PI * 1.95);
        const dist4 = rand(r * 0.08, r * 0.82);
        this.x  = cx + Math.cos(ang4) * dist4;
        this.y  = cy + Math.sin(ang4) * dist4;
        this.vx = 0; this.vy = 0;
        this.sz = rand(0.6, 2.2);
        this.a  = rand(0.4, 1.0);
        this.ts = rand(0.015, 0.055); // twinkle speed
        this.ph = rand(0, TAU);
        break;
      }
    }
  }

  kick() {
    this.vx += (Math.random() - 0.5) * 11;
    this.vy += (Math.random() - 0.5) * 11;
  }

  update(turb, dt) {
    const { cx, cy, r } = this;
    const T = dt * 0.06;

    // Drift
    if (this.type !== 'star') {
      this.x += this.vx * T + (Math.random() - 0.5) * 0.18 * turb;
    }
    this.y += this.vy * T;

    // Turbulence kick (stars immune)
    if (turb > 0.05 && this.type !== 'star') {
      this.vx += (Math.random() - 0.5) * 0.35 * turb;
      this.vy += (Math.random() - 0.5) * 0.35 * turb;
      this.vx = clamp(this.vx, -6, 6);
      this.vy = clamp(this.vy, -6, 6);
    }

    // Type-specific physics
    switch (this.type) {
      case 'snow':
        this.vy = Math.min(this.vy + 0.018, 3.5);
        if (this.y > cy + r * 0.78 && Math.abs(this.vy) < 0.5) {
          if (Math.random() < 0.025) this.init(false);
        }
        break;
      case 'bubble':
        this.vy = Math.max(this.vy - 0.01, -2.5);
        if (this.y < cy - r * 0.72) this.init(false);
        break;
      case 'ember':
        this.vy = Math.max(this.vy - 0.012, -2);
        if (this.y < cy - r * 0.72) this.init(false);
        break;
      case 'sand': {
        // Gentle circular swirl + gravity
        const dx = this.x - cx, dy = this.y - cy;
        const dlen = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx += (-dy / dlen) * 0.04;
        this.vy += ( dx / dlen) * 0.04 + 0.025;
        this.vx = clamp(this.vx, -4, 4);
        this.vy = clamp(this.vy, -4, 4);
        if (this.y > cy + r * 0.82) this.init(false);
        break;
      }
    }

    // Globe boundary collision
    const bdx = this.x - cx, bdy = this.y - cy;
    const bd  = Math.sqrt(bdx * bdx + bdy * bdy);
    const max = r - this.sz - 1;
    if (bd > max) {
      const nx = bdx / bd, ny = bdy / bd;
      this.x = cx + nx * max;
      this.y = cy + ny * max;
      const dot = this.vx * nx + this.vy * ny;
      this.vx = (this.vx - dot * nx) * 0.45;
      this.vy = (this.vy - dot * ny) * 0.45;
    }
  }

  draw(ctx, t) {
    ctx.save();
    switch (this.type) {

      case 'snow': {
        const tw = 0.82 + 0.18 * Math.sin(t * 2.3 + this.ph);
        ctx.globalAlpha = this.a * tw;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.sz, 0, TAU);
        ctx.fill();
        break;
      }

      case 'bubble': {
        ctx.globalAlpha = this.a;
        ctx.strokeStyle = 'rgba(140, 220, 255, 0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.sz, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(this.x - this.sz * 0.3, this.y - this.sz * 0.32, this.sz * 0.38, 0, TAU);
        ctx.fill();
        break;
      }

      case 'ember': {
        const fl = 0.65 + 0.35 * Math.sin(t * 5.5 + this.ph);
        ctx.globalAlpha = this.a * fl;
        ctx.fillStyle = `hsl(${this.hue}, 100%, 68%)`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `hsl(${this.hue}, 100%, 55%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.sz, 0, TAU);
        ctx.fill();
        break;
      }

      case 'sand': {
        ctx.globalAlpha = this.a;
        ctx.fillStyle = 'rgba(205, 175, 115, 0.85)';
        ctx.fillRect(this.x, this.y, this.sz, this.sz * 0.5);
        break;
      }

      case 'star': {
        const tw2 = 0.45 + 0.55 * Math.sin(t * this.ts * 60 + this.ph);
        ctx.globalAlpha = this.a * tw2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.sz, 0, TAU);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

// ─── SHARED DRAW HELPERS ──────────────────────────────────────────────────────
function drawStarField(ctx, cx, cy, r, count, t) {
  for (let i = 0; i < count; i++) {
    const seed = i * 7.391;
    const ang  = seed * 2.3999;
    const dist = Math.sqrt((i + 1) / count) * r * 0.86;
    const sx = cx + Math.cos(ang) * dist;
    const sy = cy + Math.sin(ang - Math.PI) * Math.abs(dist) - r * 0.04;
    const tw  = 0.45 + 0.55 * Math.sin(t * 1.4 + seed);
    const big = i % 7 === 0;
    ctx.globalAlpha = (big ? 0.9 : 0.45) * tw;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, big ? 1.6 : 0.9, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSnowGround(ctx, cx, cy, r) {
  ctx.fillStyle = '#dce8f4';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.16 * Math.PI, 0.84 * Math.PI);
  ctx.closePath();
  ctx.fill();
  // Soft upper edge
  const g = ctx.createLinearGradient(cx, cy + r * 0.5, cx, cy + r * 0.28);
  g.addColorStop(0, 'rgba(220,232,244,1)');
  g.addColorStop(1, 'rgba(220,232,244,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.16 * Math.PI, 0.84 * Math.PI);
  ctx.closePath();
  ctx.fill();
}

function drawMoon(ctx, mx, my, size, phase) {
  // Glow halo
  const glow = ctx.createRadialGradient(mx, my, size * 0.4, mx, my, size * 2);
  glow.addColorStop(0, 'rgba(255,252,210,0.18)');
  glow.addColorStop(1, 'rgba(255,252,210,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(mx, my, size * 2, 0, TAU); ctx.fill();

  ctx.fillStyle = '#fffde4';
  ctx.beginPath(); ctx.arc(mx, my, size, 0, TAU); ctx.fill();

  if (phase === 'crescent') {
    ctx.fillStyle = 'rgba(10, 6, 28, 0.88)';
    ctx.beginPath(); ctx.arc(mx + size * 0.42, my, size * 0.88, 0, TAU); ctx.fill();
  }
}

// ─── SCENES ───────────────────────────────────────────────────────────────────
const SCENES = [

  // 1. TINY CABIN ─────────────────────────────────────────────────────────────
  {
    name: 'Tiny Cabin',
    particleType: 'snow',
    draw(ctx, cx, cy, r, t) {
      // Sky
      const sky = ctx.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r * 1.1);
      sky.addColorStop(0, '#1c2b40');
      sky.addColorStop(1, '#0b1220');
      ctx.fillStyle = sky; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      drawStarField(ctx, cx, cy, r, 28, t);
      drawSnowGround(ctx, cx, cy, r);

      // Pine trees
      const pine = (tx, ty, h) => {
        for (let layer = 0; layer < 3; layer++) {
          const lh = h * (0.48 + layer * 0.14);
          const lw = h * 0.32 * (1 - layer * 0.12);
          const ly = ty - layer * h * 0.18;
          ctx.fillStyle = '#193828';
          ctx.beginPath();
          ctx.moveTo(tx, ly - lh);
          ctx.lineTo(tx - lw, ly);
          ctx.lineTo(tx + lw, ly);
          ctx.closePath(); ctx.fill();
        }
        // Snow cap
        ctx.fillStyle = 'rgba(215,228,242,0.75)';
        ctx.beginPath();
        ctx.moveTo(tx, ty - h + 1);
        ctx.lineTo(tx - h * 0.09, ty - h * 0.68);
        ctx.lineTo(tx + h * 0.09, ty - h * 0.68);
        ctx.closePath(); ctx.fill();
      };

      const gy = cy + r * 0.62;
      pine(cx - r * 0.58, gy, r * 0.54);
      pine(cx + r * 0.58, gy, r * 0.50);
      pine(cx - r * 0.76, gy, r * 0.40);

      // Cabin body
      const cw = r * 0.38, ch = r * 0.32;
      const cbx = cx - cw / 2, cby = gy - ch;
      ctx.fillStyle = '#4a3628';
      ctx.fillRect(cbx, cby, cw, ch);
      // Log lines
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 0.8;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cbx, cby + ch * i / 4);
        ctx.lineTo(cbx + cw, cby + ch * i / 4);
        ctx.stroke();
      }

      // Roof
      const rh = r * 0.24;
      ctx.fillStyle = '#242424';
      ctx.beginPath();
      ctx.moveTo(cx, cby - rh);
      ctx.lineTo(cbx - r * 0.06, cby);
      ctx.lineTo(cbx + cw + r * 0.06, cby);
      ctx.closePath(); ctx.fill();
      // Snow on roof
      ctx.fillStyle = '#cad8e8';
      ctx.beginPath();
      ctx.moveTo(cx, cby - rh + 2);
      ctx.lineTo(cbx - r * 0.03, cby + 4);
      ctx.lineTo(cbx + cw + r * 0.03, cby + 4);
      ctx.closePath(); ctx.fill();

      // Chimney
      const chx = cx + r * 0.08, chy = cby - rh * 0.55;
      ctx.fillStyle = '#6b4c3b';
      ctx.fillRect(chx, chy, r * 0.065, rh * 0.48);
      // Animated smoke
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.45 + i * 0.45) % 1.5;
        const sx = chx + r * 0.032 + Math.sin(t * 1.2 + i * 1.7) * r * 0.028;
        const sy = chy - p * r * 0.3;
        ctx.globalAlpha = (1 - p / 1.5) * 0.22;
        ctx.fillStyle = '#b0b0b0';
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.03 + p * r * 0.045, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Window warm glow
      const wx = cx - r * 0.055, wy = cby + ch * 0.28;
      const ww = r * 0.1, wh = r * 0.1;
      const wglow = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 0,
                                              wx + ww / 2, wy + wh / 2, r * 0.2);
      wglow.addColorStop(0, 'rgba(255,195,70,0.28)');
      wglow.addColorStop(1, 'rgba(255,195,70,0)');
      ctx.fillStyle = wglow;
      ctx.beginPath(); ctx.arc(wx + ww / 2, wy + wh / 2, r * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fde090';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = '#4a3628'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();

      // Door
      const dw = r * 0.09, dh = r * 0.15;
      ctx.fillStyle = '#1e1008';
      ctx.fillRect(cx - dw / 2, gy - dh, dw, dh);
      ctx.beginPath();
      ctx.arc(cx, gy - dh, dw / 2, Math.PI, 0);
      ctx.fill();
    }
  },

  // 2. MOON CITY ──────────────────────────────────────────────────────────────
  {
    name: 'Moon City',
    particleType: 'star',
    draw(ctx, cx, cy, r, t) {
      // Sky gradient
      const sky = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      sky.addColorStop(0, '#040110');
      sky.addColorStop(0.55, '#080320');
      sky.addColorStop(1, '#150a32');
      ctx.fillStyle = sky; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      drawMoon(ctx, cx - r * 0.28, cy - r * 0.5, r * 0.2, 'crescent');

      // City buildings
      const gy = cy + r * 0.58;
      const bldgs = [
        { rx: -0.72, rw: 0.14, rh: 0.52 },
        { rx: -0.56, rw: 0.18, rh: 0.76 },
        { rx: -0.36, rw: 0.22, rh: 0.88 },
        { rx: -0.12, rw: 0.21, rh: 0.98 },
        { rx:  0.11, rw: 0.19, rh: 0.82 },
        { rx:  0.32, rw: 0.16, rh: 0.64 },
        { rx:  0.50, rw: 0.21, rh: 0.72 },
      ];

      bldgs.forEach((b, bi) => {
        const bx = cx + b.rx * r;
        const bw = b.rw * r;
        const bh = b.rh * r;
        const by = gy - bh;

        ctx.fillStyle = '#0c0720';
        ctx.fillRect(bx, by, bw, bh + 4);

        const cols = Math.max(1, Math.floor(bw / (r * 0.058)));
        const rows = Math.max(1, Math.floor(bh / (r * 0.085)));
        for (let row = 1; row <= rows; row++) {
          for (let col = 0; col < cols; col++) {
            const seed = bi * 100 + row * 11 + col * 3;
            if (hash(seed) >= 58) continue;
            const wwx = bx + col * (bw / cols) + bw / cols * 0.15;
            const wwy = by + row * (bh / (rows + 1)) - (bh / (rows + 1)) * 0.25;
            const ww  = bw / cols * 0.55;
            const wh  = bh / (rows + 1) * 0.45;
            const hue = hash(seed * 3) < 30 ? 210 : 42;
            ctx.fillStyle = `hsl(${hue}, 72%, 72%)`;
            ctx.fillRect(wwx, wwy, ww, wh);
          }
        }
        // Antenna on tall bldgs
        if (b.rh > 0.7) {
          ctx.strokeStyle = '#14082a'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + bw / 2, by);
          ctx.lineTo(bx + bw / 2, by - r * 0.09);
          ctx.stroke();
          ctx.globalAlpha = Math.sin(t * 3.2 + bi) > 0 ? 0.9 : 0.12;
          ctx.fillStyle = '#ff3838';
          ctx.beginPath(); ctx.arc(bx + bw / 2, by - r * 0.09, 2.2, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // Ground
      const gnd = ctx.createLinearGradient(cx, gy, cx, cy + r);
      gnd.addColorStop(0, '#180c30');
      gnd.addColorStop(1, '#08061a');
      ctx.fillStyle = gnd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI);
      ctx.closePath(); ctx.fill();

      // Moon puddle reflection
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#fff8e0';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.28, gy + r * 0.08, r * 0.065, r * 0.018, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  // 3. AQUARIUM ───────────────────────────────────────────────────────────────
  {
    name: 'Aquarium',
    particleType: 'bubble',
    draw(ctx, cx, cy, r, t) {
      // Water
      const water = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      water.addColorStop(0, '#001520');
      water.addColorStop(0.55, '#002a40');
      water.addColorStop(1, '#003350');
      ctx.fillStyle = water; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Light rays from surface
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const rx = cx - r * 0.35 + i * r * 0.175 + Math.sin(t * 0.55 + i * 1.3) * r * 0.04;
        const rg = ctx.createLinearGradient(rx, cy - r, rx + r * 0.06, cy + r * 0.25);
        rg.addColorStop(0, 'rgba(80,190,255,0.09)');
        rg.addColorStop(1, 'rgba(80,190,255,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(rx - r * 0.04, cy - r);
        ctx.lineTo(rx + r * 0.18, cy + r * 0.28);
        ctx.lineTo(rx + r * 0.28, cy + r * 0.28);
        ctx.lineTo(rx + r * 0.06, cy - r);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      // Sand
      const sand = ctx.createLinearGradient(cx, cy + r * 0.5, cx, cy + r);
      sand.addColorStop(0, '#8b7050'); sand.addColorStop(1, '#a08862');
      ctx.fillStyle = sand;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0.22 * Math.PI, 0.78 * Math.PI); ctx.closePath(); ctx.fill();

      // Coral (deterministic branching)
      const coral = (ox, oy, h, color) => {
        ctx.strokeStyle = color; ctx.lineCap = 'round';
        const branch = (x, y, angle, len, depth) => {
          if (depth === 0 || len < 2) return;
          const ex = x + Math.cos(angle) * len;
          const ey = y + Math.sin(angle) * len;
          ctx.lineWidth = Math.max(0.8, depth * 1.4);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
          branch(ex, ey, angle - 0.38, len * 0.64, depth - 1);
          branch(ex, ey, angle + 0.38, len * 0.64, depth - 1);
        };
        branch(ox, oy, -Math.PI / 2, h, 4);
      };

      const sy = cy + r * 0.56;
      coral(cx - r * 0.55, sy, r * 0.24, '#b5312a');
      coral(cx + r * 0.44, sy, r * 0.20, '#d46a1a');
      coral(cx - r * 0.18, sy, r * 0.16, '#8e3faa');

      // Seaweed (deterministic heights)
      const weedHeights = [0.28, 0.22, 0.36, 0.20];
      for (let i = 0; i < 4; i++) {
        const wx = cx + (i - 1.5) * r * 0.28;
        const wh = weedHeights[i] * r;
        ctx.strokeStyle = `rgba(0, ${95 + i * 22}, 72, 0.85)`;
        ctx.lineWidth = r * 0.02;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(wx, sy);
        for (let j = 1; j <= 8; j++) {
          const prog = j / 8;
          const swx = wx + Math.sin(t * 1.4 + i * 1.3 + prog * Math.PI) * r * 0.04;
          const swy = sy - prog * wh;
          ctx.lineTo(swx, swy);
        }
        ctx.stroke();
      }

      // Fish helper
      const fish = (fx, fy, sz, facing, color) => {
        ctx.save();
        ctx.translate(fx, fy);
        if (facing < 0) ctx.scale(-1, 1);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.48, 0, 0, TAU); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-sz, 0);
        ctx.lineTo(-sz * 1.6, -sz * 0.5);
        ctx.lineTo(-sz * 1.6,  sz * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(sz * 0.4, -sz * 0.1, sz * 0.16, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(sz * 0.44, -sz * 0.1, sz * 0.08, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = sz * 0.09;
        ctx.beginPath(); ctx.moveTo(0, -sz * 0.38); ctx.lineTo(0, sz * 0.38); ctx.stroke();
        ctx.restore();
      };

      fish(cx + Math.sin(t * 0.42) * r * 0.52,
           cy - r * 0.12 + Math.sin(t * 0.82) * r * 0.1,
           r * 0.1, Math.cos(t * 0.42) > 0 ? 1 : -1, '#e8920e');

      fish(cx + Math.sin(t * 0.31 + 2.1) * r * 0.42,
           cy + r * 0.22 + Math.sin(t * 0.61 + 1.1) * r * 0.08,
           r * 0.072, Math.cos(t * 0.31 + 2.1) > 0 ? 1 : -1, '#2e8fdb');

      fish(cx + Math.sin(t * 0.52 + 4.2) * r * 0.36,
           cy - r * 0.28 + Math.sin(t * 0.72 + 3.1) * r * 0.11,
           r * 0.058, Math.cos(t * 0.52 + 4.2) > 0 ? 1 : -1, '#e03a2a');
    }
  },

  // 4. HAUNTED FOREST ─────────────────────────────────────────────────────────
  {
    name: 'Haunted Forest',
    particleType: 'ember',
    draw(ctx, cx, cy, r, t) {
      // Sky
      const sky = ctx.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r * 1.1);
      sky.addColorStop(0, '#180c2c');
      sky.addColorStop(1, '#040008');
      ctx.fillStyle = sky; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      drawMoon(ctx, cx + r * 0.32, cy - r * 0.44, r * 0.18, 'full');

      // Trees
      const tree = (tx, baseY, h) => {
        const branch = (x, y, angle, len, depth) => {
          if (depth === 0 || len < r * 0.018) return;
          const sway = Math.sin(t * 0.7 + tx * 0.02) * 0.04;
          const ex = x + Math.cos(angle + sway) * len;
          const ey = y + Math.sin(angle + sway) * len;
          ctx.strokeStyle = '#0e0820';
          ctx.lineWidth = Math.max(0.5, depth * 1.3);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
          branch(ex, ey, angle - 0.48 + sway, len * 0.64, depth - 1);
          branch(ex, ey, angle + 0.48 + sway, len * 0.64, depth - 1);
          if (depth > 2) branch(ex, ey, angle + sway, len * 0.74, depth - 1);
        };
        branch(tx, baseY, -Math.PI / 2, h, 6);
      };

      const gy = cy + r * 0.55;
      tree(cx - r * 0.62, gy, r * 0.65);
      tree(cx + r * 0.60, gy, r * 0.60);
      tree(cx - r * 0.18, gy, r * 0.70);
      tree(cx + r * 0.35, gy, r * 0.50);

      // Gravestones
      const grave = (gx, gy2, gw, gh) => {
        ctx.fillStyle = '#281838';
        ctx.fillRect(gx - gw / 2, gy2 - gh, gw, gh);
        ctx.beginPath(); ctx.arc(gx, gy2 - gh, gw / 2, Math.PI, 0); ctx.fill();
      };
      grave(cx - r * 0.44, gy, r * 0.1, r * 0.15);
      grave(cx + r * 0.20, gy, r * 0.09, r * 0.12);

      // Fog
      const fog = ctx.createLinearGradient(cx, gy + r * 0.05, cx, gy - r * 0.18);
      fog.addColorStop(0, 'rgba(75, 38, 115, 0.48)');
      fog.addColorStop(1, 'rgba(75, 38, 115, 0)');
      ctx.fillStyle = fog;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0.16 * Math.PI, 0.84 * Math.PI); ctx.closePath(); ctx.fill();

      // Bats
      const bat = (bx, by, sz) => {
        const flap = Math.sin(t * 8.5 + bx * 0.01) * 0.38;
        ctx.fillStyle = '#080418';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.bezierCurveTo(bx - sz * 0.7, by + flap * sz * 1.6, bx - sz * 1.8, by - sz * 0.9, bx - sz * 2.1, by - sz * 0.4);
        ctx.bezierCurveTo(bx - sz * 1.4, by - sz * 0.1, bx - sz * 0.5, by + flap * sz, bx, by);
        ctx.bezierCurveTo(bx + sz * 0.5, by + flap * sz, bx + sz * 1.4, by - sz * 0.1, bx + sz * 2.1, by - sz * 0.4);
        ctx.bezierCurveTo(bx + sz * 1.8, by - sz * 0.9, bx + sz * 0.7, by + flap * sz * 1.6, bx, by);
        ctx.fill();
      };

      bat(cx + Math.sin(t * 0.62) * r * 0.42, cy - r * 0.28 + Math.sin(t * 0.41 + 1) * r * 0.1, r * 0.058);
      bat(cx + Math.sin(t * 0.48 + 2.2) * r * 0.32, cy - r * 0.12 + Math.sin(t * 0.7) * r * 0.08, r * 0.042);
    }
  },

  // 5. DESERT NIGHT ───────────────────────────────────────────────────────────
  {
    name: 'Desert Night',
    particleType: 'sand',
    draw(ctx, cx, cy, r, t) {
      // Deep sky
      const sky = ctx.createLinearGradient(cx, cy - r, cx, cy + r * 0.3);
      sky.addColorStop(0, '#000008');
      sky.addColorStop(0.65, '#090418');
      sky.addColorStop(1, '#1a1008');
      ctx.fillStyle = sky; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Milky way band
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.28);
      const mw = ctx.createLinearGradient(-r, 0, r, 0);
      mw.addColorStop(0, 'rgba(190,170,255,0)');
      mw.addColorStop(0.38, 'rgba(190,170,255,0.065)');
      mw.addColorStop(0.62, 'rgba(190,170,255,0.065)');
      mw.addColorStop(1, 'rgba(190,170,255,0)');
      ctx.fillStyle = mw;
      ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.44);
      ctx.restore();

      drawStarField(ctx, cx, cy, r, 55, t);
      drawMoon(ctx, cx + r * 0.42, cy - r * 0.52, r * 0.135, 'crescent');

      // Sand dunes (layered)
      const dune = (phase, color, hs) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy + r);
        for (let i = 0; i <= 32; i++) {
          const p  = i / 32;
          const x  = cx - r + p * r * 2;
          const dh = r * hs;
          const y  = cy + r * 0.28 + Math.sin(p * Math.PI * 2.6 + phase) * dh * 0.48 - dh * 0.52;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(cx + r, cy + r);
        ctx.lineTo(cx - r, cy + r);
        ctx.closePath(); ctx.fill();
      };
      dune(0,   '#3e2e1a', 0.56);
      dune(1.3, '#4e3c22', 0.44);
      dune(2.7, '#5f4828', 0.32);

      // Saguaro cacti
      const cactus = (kx, ky, h) => {
        const tw = r * 0.042;
        ctx.fillStyle = '#172810';
        ctx.fillRect(kx - tw / 2, ky - h, tw, h);
        // Left arm
        ctx.fillRect(kx - tw * 2.2, ky - h * 0.52 - tw, tw * 1.8, tw);
        ctx.fillRect(kx - tw * 2.2, ky - h * 0.52 - tw - h * 0.32, tw, h * 0.32 + tw);
        // Right arm
        ctx.fillRect(kx + tw * 0.6, ky - h * 0.42, tw * 1.8, tw);
        ctx.fillRect(kx + tw * 2.0, ky - h * 0.42 - h * 0.26, tw, h * 0.26 + tw);
      };
      const gy = cy + r * 0.32;
      cactus(cx - r * 0.5,  gy, r * 0.42);
      cactus(cx + r * 0.46, gy, r * 0.36);
      cactus(cx - r * 0.14, gy, r * 0.28);
    }
  },

  // 6. MINI OFFICE ────────────────────────────────────────────────────────────
  {
    name: 'Mini Office',
    particleType: 'star',
    draw(ctx, cx, cy, r, t) {
      // Night sky
      const sky = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      sky.addColorStop(0, '#040a18');
      sky.addColorStop(1, '#0a1428');
      ctx.fillStyle = sky; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      drawStarField(ctx, cx, cy - r * 0.3, r * 0.68, 18, t);

      // Background buildings
      [
        { rx: -0.84, rw: 0.3,  rh: 0.48 },
        { rx:  0.54, rw: 0.34, rh: 0.44 },
      ].forEach((b, bi) => {
        const bx = cx + b.rx * r, bw = b.rw * r;
        const bh = b.rh * r, by = cy + r * 0.58 - bh;
        ctx.fillStyle = '#090e1e'; ctx.fillRect(bx, by, bw, bh);
        for (let row = 1; row < 6; row++) {
          for (let col = 0; col < 3; col++) {
            const s = bi * 300 + row * 17 + col * 7;
            if (hash(s) >= 50) continue;
            ctx.fillStyle = 'rgba(255,215,110,0.18)';
            ctx.fillRect(bx + col * (bw / 3) + 2, by + row * (bh / 7) + 2, bw / 3 - 4, bh / 7 - 4);
          }
        }
      });

      // Main office tower
      const gy = cy + r * 0.60;
      const bw = r * 0.52, bh = r * 1.32;
      const bx = cx - bw / 2, by = gy - bh;
      ctx.fillStyle = '#0d1a2e'; ctx.fillRect(bx, by, bw, bh);

      // Floor separator lines
      ctx.strokeStyle = 'rgba(25, 55, 95, 0.55)'; ctx.lineWidth = 0.5;
      const floors = 9;
      for (let f = 1; f < floors; f++) {
        const fy = by + f * (bh / floors);
        ctx.beginPath(); ctx.moveTo(bx, fy); ctx.lineTo(bx + bw, fy); ctx.stroke();
      }

      // Windows
      const cols = 4, rows = floors;
      const ww   = bw / (cols + 1) * 0.58;
      const wh   = bh / (rows + 1) * 0.48;
      const wpx  = (bw - cols * ww) / (cols + 1);
      const wpy  = (bh - rows * wh) / (rows + 1);

      // Elevator column (animated)
      const elevFloor = Math.floor((Math.sin(t * 0.28) * 0.5 + 0.5) * (rows - 1));

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const s    = row * 100 + col;
          const lit  = hash(s * 7) < 66;
          if (!lit) continue;
          const flick = Math.sin(t * 0.28 + s * 0.5) > 0.92;
          if (flick) continue;
          const wwx = bx + wpx + col * (ww + wpx);
          const wwy = by + wpy + row * (wh + wpy);
          const isElev = (col === 3 && row === elevFloor);
          const hue  = isElev ? 195 : (hash(s * 5) < 28 ? 205 : 42);
          ctx.fillStyle = `hsla(${hue}, 70%, 70%, ${isElev ? 0.95 : 0.88})`;
          ctx.fillRect(wwx, wwy, ww, wh);
          // Window glow
          const wg = ctx.createRadialGradient(wwx + ww / 2, wwy + wh / 2, 0, wwx + ww / 2, wwy + wh / 2, ww * 1.4);
          wg.addColorStop(0, `hsla(${hue}, 70%, 70%, 0.09)`);
          wg.addColorStop(1, `hsla(${hue}, 70%, 70%, 0)`);
          ctx.fillStyle = wg;
          ctx.fillRect(wwx - ww, wwy - wh, ww * 3, wh * 3);
        }
      }

      // Rooftop slab
      ctx.fillStyle = '#0a1526';
      ctx.fillRect(bx - r * 0.02, by - r * 0.035, bw + r * 0.04, r * 0.035);
      // Antenna
      ctx.strokeStyle = '#0e1b2d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, by - r * 0.035); ctx.lineTo(cx, by - r * 0.15); ctx.stroke();
      ctx.globalAlpha = Math.sin(t * 3.8) > 0 ? 0.9 : 0.15;
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(cx, by - r * 0.15, 2.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;

      // Street
      const gnd = ctx.createLinearGradient(cx, gy, cx, cy + r);
      gnd.addColorStop(0, '#09101e'); gnd.addColorStop(1, '#060810');
      ctx.fillStyle = gnd;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.closePath(); ctx.fill();

      // Street lamp
      const lx = cx + r * 0.66, ly = gy;
      ctx.strokeStyle = '#1a2838'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - r * 0.3); ctx.lineTo(lx - r * 0.075, ly - r * 0.3);
      ctx.stroke();
      const lg = ctx.createRadialGradient(lx - r * 0.075, ly - r * 0.3, 0, lx - r * 0.075, ly - r * 0.3, r * 0.16);
      lg.addColorStop(0, 'rgba(255,195,70,0.3)'); lg.addColorStop(1, 'rgba(255,195,70,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(lx - r * 0.075, ly - r * 0.3, r * 0.16, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,195,70,0.9)';
      ctx.beginPath(); ctx.arc(lx - r * 0.075, ly - r * 0.3, 2.8, 0, TAU); ctx.fill();
    }
  },
];

// ─── GLOBE RENDERER ───────────────────────────────────────────────────────────
function renderGlobe(ctx, cx, cy, r, scene, particles, t, fadeAlpha) {
  // Clip and draw scene inside circle
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  scene.draw(ctx, cx, cy, r, t);
  // Transition fade
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Particles on top
  particles.forEach(p => p.draw(ctx, t));
  ctx.restore();

  // Glass rim
  ctx.strokeStyle = 'rgba(170,215,255,0.52)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

  // Rim glow fill
  const rim = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
  rim.addColorStop(0, 'rgba(100,155,210,0)');
  rim.addColorStop(0.7, 'rgba(120,175,230,0.08)');
  rim.addColorStop(1, 'rgba(175,220,255,0.32)');
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();

  // Glass highlight crescent
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, TAU); ctx.clip();
  const hl = ctx.createRadialGradient(cx - r * 0.33, cy - r * 0.38, 0, cx - r * 0.33, cy - r * 0.38, r * 0.72);
  hl.addColorStop(0, 'rgba(255,255,255,0.2)');
  hl.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.restore();

  // Stand neck
  const sy = cy + r + 2;
  const sw = r * 0.46;
  const sh = r * 0.13;
  const neck = ctx.createLinearGradient(cx - sw * 0.14, sy, cx + sw * 0.14, sy);
  neck.addColorStop(0, 'rgba(65,48,32,0.92)');
  neck.addColorStop(0.45, 'rgba(155,125,95,0.92)');
  neck.addColorStop(1, 'rgba(65,48,32,0.92)');
  ctx.fillStyle = neck;
  ctx.beginPath();
  ctx.moveTo(cx - sw * 0.13, sy);
  ctx.lineTo(cx - sw * 0.22, sy + sh * 0.42);
  ctx.lineTo(cx + sw * 0.22, sy + sh * 0.42);
  ctx.lineTo(cx + sw * 0.13, sy);
  ctx.closePath(); ctx.fill();

  // Stand base
  const base = ctx.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);
  base.addColorStop(0, 'rgba(50,38,24,0.96)');
  base.addColorStop(0.3, 'rgba(138,108,76,0.96)');
  base.addColorStop(0.7, 'rgba(138,108,76,0.96)');
  base.addColorStop(1, 'rgba(50,38,24,0.96)');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(cx, sy + sh * 0.52, sw / 2, sh * 0.38, 0, 0, TAU);
  ctx.fill();

  // Scene label
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(185,210,255,0.45)';
  ctx.font = `${Math.round(r * 0.088)}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(scene.name.toUpperCase(), cx, sy + sh * 0.52 + r * 0.1);
}

// ─── APP ─────────────────────────────────────────────────────────────────────
class Momentarium {
  constructor() {
    this.canvas = document.getElementById('c');
    this.ctx    = this.canvas.getContext('2d');
    this.hint   = document.getElementById('hint');

    this.sceneIdx     = Math.floor(Math.random() * SCENES.length);
    this.nextSceneIdx = 0;
    this.particles    = [];
    this.turbulence   = 0;
    this.fade         = 0;       // 0=clear, 1=black
    this.fadeDir      = 0;       // 1=darkening, -1=brightening
    this.changeTimer  = -1;      // countdown before scene swap begins
    this.t            = 0;
    this.lastTs       = 0;
    this.lastShakeMs  = 0;
    this.hintShown    = true;

    this.resize();
    this.buildParticles();
    this.bindInput();
    requestAnimationFrame(ts => this.loop(ts));
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const W = this.W = window.innerWidth;
    const H = this.H = window.innerHeight;
    this.canvas.width  = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width  = W + 'px';
    this.canvas.style.height = H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.gR  = Math.min(W, H) * 0.365;
    this.gCx = W / 2;
    this.gCy = H * 0.43;
  }

  buildParticles(fromShake) {
    const type = SCENES[this.sceneIdx].particleType;
    this.particles = Array.from({ length: CFG.particleCount }, () => {
      const p = new Particle(type, this.gCx, this.gCy, this.gR);
      if (fromShake) p.kick();
      return p;
    });
  }

  bindInput() {
    // Tap / click
    this.canvas.addEventListener('pointerup', (e) => {
      e.preventDefault();
      this.onShake();
    });

    // Device motion (real phone shake)
    let prevMag = 0;
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      const mag   = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
      const delta = Math.abs(mag - prevMag);
      prevMag = mag;
      if (delta > CFG.shakeThreshold) {
        const now = Date.now();
        if (now - this.lastShakeMs > 480) {
          this.lastShakeMs = now;
          this.onShake();
        }
      }
    });

    // iOS 13+ permission
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      this.canvas.addEventListener('pointerup', () => {
        DeviceMotionEvent.requestPermission().catch(() => {});
      }, { once: true });
    }

    window.addEventListener('resize', () => {
      this.resize();
      this.buildParticles(false);
    });
  }

  onShake() {
    // Kick all particles immediately
    this.turbulence = 1.8;
    this.particles.forEach(p => p.kick());

    // Schedule scene transition unless already in progress
    if (this.fadeDir === 0 && this.changeTimer < 0) {
      this.nextSceneIdx = (this.sceneIdx + 1) % SCENES.length;
      this.changeTimer  = CFG.shakeDelay;
    }

    // Hide hint
    if (this.hintShown) {
      this.hintShown = false;
      this.hint.classList.add('fade');
    }
  }

  update(dt) {
    this.t += dt * 0.001;

    // Turbulence decay
    this.turbulence = Math.max(0, this.turbulence * Math.pow(CFG.turbulenceDecay, dt / 16));

    // Particles
    this.particles.forEach(p => p.update(this.turbulence, dt));

    // Shake delay countdown
    if (this.changeTimer >= 0) {
      this.changeTimer -= dt;
      if (this.changeTimer < 0 && this.fadeDir === 0) {
        this.fadeDir = 1; // start fading to black
      }
    }

    // Transition
    const spd = CFG.transitionSpeed * (dt / 16);
    if (this.fadeDir === 1) {
      this.fade = Math.min(1, this.fade + spd);
      if (this.fade >= 1) {
        // Swap scene
        this.sceneIdx   = this.nextSceneIdx;
        this.fadeDir    = -1;
        this.changeTimer = -1;
        this.buildParticles(true);
      }
    } else if (this.fadeDir === -1) {
      this.fade = Math.max(0, this.fade - spd);
      if (this.fade <= 0) this.fadeDir = 0;
    }
  }

  draw() {
    const { ctx, W, H, gCx, gCy, gR } = this;
    ctx.clearRect(0, 0, W, H);

    // App background
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#0c0f1e'); bg.addColorStop(1, '#04050c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Ambient glow behind globe
    const amb = ctx.createRadialGradient(gCx, gCy, 0, gCx, gCy, gR * 1.35);
    amb.addColorStop(0, 'rgba(55,80,145,0.14)'); amb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = amb;
    ctx.beginPath(); ctx.arc(gCx, gCy, gR * 1.35, 0, TAU); ctx.fill();

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(165,190,240,0.28)';
    ctx.font = `${Math.round(H * 0.021)}px Georgia, 'Times New Roman', serif`;
    ctx.fillText('M O M E N T A R I U M', W / 2, H * 0.075);

    renderGlobe(ctx, gCx, gCy, gR, SCENES[this.sceneIdx], this.particles, this.t, this.fade);
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

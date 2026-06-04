import { TAU, rand, clamp } from '../../core.js';

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

export { BirdsOverlay, WaterGlintsOverlay, SeaMistOverlay };

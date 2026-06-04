import { TAU, rand, clamp } from '../../core.js';

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

export { BubblesOverlay, LightRaysOverlay, FishSilhouettesOverlay };

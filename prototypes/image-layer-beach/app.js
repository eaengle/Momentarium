const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W = 0;
let H = 0;

const background = new Image();
let bgLoaded = false;

const birds = [];
const particles = [];
const glints = [];

// ── resize ────────────────────────────────────────────────────────────────────

function resize() {
  W = canvas.width = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
  buildBirds();
}

window.addEventListener('resize', resize);
resize();

// ── asset loading ─────────────────────────────────────────────────────────────

function loadAssets() {
  background.onload = () => { bgLoaded = true; };
  background.src = 'assets/beach-background.png';
}

// ── helpers ───────────────────────────────────────────────────────────────────

function drawImageCover(ctx, image, W, H) {
  const imageRatio = image.width / image.height;
  const viewRatio = W / H;
  let sx = 0, sy = 0, sw = image.width, sh = image.height;
  if (imageRatio > viewRatio) {
    sw = image.height * viewRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / viewRatio;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, W, H);
}

function rand(min, max) { return min + Math.random() * (max - min); }
function lerp(a, b, t) { return a + (b - a) * t; }

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return s / 0xffffffff;
  };
}

// ── birds ─────────────────────────────────────────────────────────────────────

function buildBirds() {
  birds.length = 0;
  const rng = seededRand(55);
  for (let i = 0; i < 10; i++) {
    birds.push({
      offX:   rng() * (W + 200),
      baseY:  H * (0.05 + rng() * 0.32),
      spd:    22 + rng() * 40,
      sc:     0.45 + rng() * 0.85,
      bobA:   H * (0.007 + rng() * 0.014),
      bobF:   0.35 + rng() * 0.55,
      bobPh:  rng() * Math.PI * 2,
      flapF:  2.2 + rng() * 3.5,
      flapPh: rng() * Math.PI * 2,
    });
  }
}

function drawBirds(t) {
  ctx.lineCap = 'round';
  for (const b of birds) {
    const x    = ((t * b.spd + b.offX) % (W + 200)) - 100;
    const y    = b.baseY + Math.sin(t * b.bobF + b.bobPh) * b.bobA;
    const flap = Math.sin(t * b.flapF + b.flapPh);
    const wy   = flap * 5.5 * b.sc;
    const ws   = 13 * b.sc;

    ctx.strokeStyle = `rgba(8, 2, 21, 0.72)`;
    ctx.lineWidth = 1.6 * b.sc;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - ws * 0.5, y - 3.5 * b.sc + wy, x - ws, y + wy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + ws * 0.5, y - 3.5 * b.sc + wy, x + ws, y + wy);
    ctx.stroke();
  }
}

// ── atmospheric particles ─────────────────────────────────────────────────────

function spawnParticle() {
  particles.push({
    x: rand(0, W),
    y: rand(0, H),
    vx: rand(-0.15, 0.15),
    vy: rand(-0.05, -0.25),
    radius: rand(0.8, 2.5),
    alpha: rand(0.1, 0.35),
    life: 1,
    decay: rand(0.0008, 0.0025),
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.life -= p.decay * dt * 60;
    if (p.life <= 0) particles.splice(i, 1);
  }
  while (particles.length < 80) spawnParticle();
}

function drawParticles() {
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 240, 200, ${p.alpha * p.life})`;
    ctx.fill();
  }
}

// ── water sparkles (composite lighter) ───────────────────────────────────────

function spawnGlint() {
  glints.push({
    x:     rand(W * 0.05, W * 0.95),
    y:     rand(H * 0.52, H * 0.72),
    r:     rand(1.5, 5),
    phase: rand(0, Math.PI * 2),
    speed: rand(1.2, 3.0),
    peak:  rand(0.12, 0.32),
  });
}

function updateGlints(dt) {
  for (let i = glints.length - 1; i >= 0; i--) {
    const g = glints[i];
    g.phase += g.speed * dt;
    if (g.phase > Math.PI * 2.2) glints.splice(i, 1);
  }
  if (glints.length < 18 && Math.random() < 0.025) spawnGlint();
}

function drawGlints() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of glints) {
    const alpha = Math.max(0, Math.sin(g.phase) * g.peak);
    if (alpha <= 0) continue;
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * 2.5);
    grad.addColorStop(0,   `rgba(255, 245, 200, ${alpha})`);
    grad.addColorStop(0.4, `rgba(255, 210, 120, ${alpha * 0.5})`);
    grad.addColorStop(1,   `rgba(255, 180, 60, 0)`);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

// ── vignette ──────────────────────────────────────────────────────────────────

function drawVignette() {
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ── warm light pulse ──────────────────────────────────────────────────────────

function drawLightPulse(t) {
  const pulse = 0.03 + 0.015 * Math.sin(t * 0.4);
  const grad = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, W * 0.55);
  grad.addColorStop(0, `rgba(255, 180, 60, ${pulse})`);
  grad.addColorStop(1, 'rgba(255, 140, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ── main loop ─────────────────────────────────────────────────────────────────

let lastTs = null;

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  const t = ts / 1000;

  ctx.clearRect(0, 0, W, H);

  if (bgLoaded) {
    drawImageCover(ctx, background, W, H);
  } else {
    ctx.fillStyle = '#1a0a05';
    ctx.fillRect(0, 0, W, H);
  }

  drawLightPulse(t);
  updateGlints(dt);
  drawGlints();
  updateParticles(dt);
  drawParticles();
  drawBirds(t);
  drawVignette();

  requestAnimationFrame(loop);
}

loadAssets();
requestAnimationFrame(loop);

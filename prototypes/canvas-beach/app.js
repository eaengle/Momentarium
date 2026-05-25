'use strict';

const TAU  = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

// Layered pseudo-noise for organic motion
const noise = (x) =>
  Math.sin(x * 1.7)  * 0.500 +
  Math.sin(x * 3.13) * 0.250 +
  Math.sin(x * 5.77) * 0.125;

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

let W, H, horizonY, sandY;

const palms  = [];
const birds  = [];
const clouds = [];

// ─── INIT ─────────────────────────────────────────────────────────────────────

function initScene() {
  palms.length  = 0;
  birds.length  = 0;
  clouds.length = 0;

  // Two palms left, two right
  palms.push({ x: W * 0.08, scale: 1.15, phase: 0.0 });
  palms.push({ x: W * 0.17, scale: 0.80, phase: 1.4 });
  palms.push({ x: W * 0.86, scale: 1.00, phase: 2.5 });
  palms.push({ x: W * 0.94, scale: 0.75, phase: 0.6 });

  for (let i = 0; i < 6; i++) {
    birds.push({
      offset:    rand(0, W * 2.0),
      speed:     rand(24, 44),
      scale:     rand(0.55, 1.10),
      pathY:     rand(horizonY * 0.10, horizonY * 0.48),
      phase:     rand(0, TAU),
      flapSpeed: rand(2.8, 4.8),
    });
  }

  for (let i = 0; i < 6; i++) {
    clouds.push({
      x:     rand(-W * 0.1, W * 1.1),
      y:     rand(H * 0.04, horizonY * 0.60),
      w:     rand(W * 0.10, W * 0.22),
      h:     rand(H * 0.018, H * 0.038),
      alpha: rand(0.05, 0.13),
      speed: rand(2, 7),
    });
  }
}

function resize() {
  W        = canvas.width  = window.innerWidth;
  H        = canvas.height = window.innerHeight;
  horizonY = H * 0.60;
  sandY    = H * 0.70;
  initScene();
}

// ─── SKY ──────────────────────────────────────────────────────────────────────

function drawSky(t) {
  // Five-stop sunset gradient
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0.00, '#0d0620'); // midnight indigo
  sky.addColorStop(0.25, '#2c0d45'); // deep violet
  sky.addColorStop(0.55, '#7a1530'); // deep crimson
  sky.addColorStop(0.80, '#c84010'); // burnt orange
  sky.addColorStop(1.00, '#f07228'); // warm orange at horizon
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizonY + 2);

  // Sun glow — radial bloom at horizon centre
  const sx = W * 0.50;
  const sg = ctx.createRadialGradient(sx, horizonY, 0, sx, horizonY, W * 0.24);
  sg.addColorStop(0.00, 'rgba(255, 230, 120, 0.52)');
  sg.addColorStop(0.30, 'rgba(255, 150,  40, 0.22)');
  sg.addColorStop(0.65, 'rgba(255,  60,   0, 0.08)');
  sg.addColorStop(1.00, 'rgba(255,   0,   0, 0.00)');
  ctx.fillStyle = sg;
  // Upper half of the radial — sky only
  ctx.beginPath();
  ctx.arc(sx, horizonY, W * 0.24, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Cloud wisps — three-pass soft radial ellipses, no filter needed
  for (const c of clouds) {
    const cx = ((c.x + t * c.speed * 0.5) % (W * 1.3 + c.w)) - c.w * 0.5;
    for (let p = 0; p < 3; p++) {
      const r = 1 - p * 0.28;
      const a = c.alpha * (1 - p * 0.35);
      const cg = ctx.createRadialGradient(cx, c.y, 0, cx, c.y, c.w * r);
      cg.addColorStop(0.0, `rgba(255, 185,  80, ${a})`);
      cg.addColorStop(0.5, `rgba(255, 120,  30, ${a * 0.4})`);
      cg.addColorStop(1.0, 'rgba(255, 60,    0, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cx, c.y, c.w * r, c.h * r * 2.5, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// ─── OCEAN ────────────────────────────────────────────────────────────────────

function drawOcean(t) {
  const top = horizonY;
  const bot = sandY + H * 0.025;

  // Base water gradient — orange at horizon, deep teal below
  const wg = ctx.createLinearGradient(0, top, 0, bot);
  wg.addColorStop(0.00, '#c04010');
  wg.addColorStop(0.12, '#7a2812');
  wg.addColorStop(0.35, '#1c3d55');
  wg.addColorStop(1.00, '#0c1e2e');
  ctx.fillStyle = wg;
  ctx.fillRect(0, top, W, bot - top);

  // Shimmer bands — additive glowing horizontal waves
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bandCount = 16;
  for (let i = 0; i < bandCount; i++) {
    const frac  = i / bandCount;
    const bandY = top + (bot - top) * frac;
    const amp   = lerp(14, 2, frac);
    const freq  = lerp(0.009, 0.016, frac);
    const spd   = lerp(1.10, 0.40, frac);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.9 + i * 0.55);
    const alpha = lerp(0.09, 0.015, frac) * pulse;

    ctx.beginPath();
    ctx.moveTo(0, bandY);
    for (let x = 0; x <= W; x += 5) {
      ctx.lineTo(x, bandY + Math.sin(x * freq + t * spd + i * 0.9) * amp);
    }
    ctx.lineTo(W, bot);
    ctx.lineTo(0, bot);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 155, 50, ${alpha})`;
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Sun reflection column — narrow at horizon, widens toward viewer
  const sx     = W * 0.50;
  const refW   = W * 0.06;
  const shimmer = 0.85 + 0.15 * Math.sin(t * 2.1);
  const rg = ctx.createLinearGradient(0, top, 0, top + (bot - top) * 0.72);
  rg.addColorStop(0, `rgba(255, 215, 100, ${0.55 * shimmer})`);
  rg.addColorStop(1, 'rgba(255, 120,  20, 0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(sx - refW * 0.18, top);
  ctx.lineTo(sx + refW * 0.18, top);
  ctx.lineTo(sx + refW * 1.9,  top + (bot - top) * 0.72);
  ctx.lineTo(sx - refW * 1.9,  top + (bot - top) * 0.72);
  ctx.closePath();
  ctx.fill();

  // Boat silhouette on the water
  drawBoat(W * 0.70, horizonY + (sandY - horizonY) * 0.20, t);

  // Shore foam edge
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.moveTo(0, sandY);
  for (let x = 0; x <= W; x += 6) {
    ctx.lineTo(x, sandY + Math.sin(x * 0.014 + t * 0.85) * H * 0.009);
  }
  ctx.lineTo(W, sandY + H * 0.04);
  ctx.lineTo(0, sandY + H * 0.04);
  ctx.closePath();
  ctx.fillStyle = '#ffe0b0';
  ctx.fill();
  ctx.restore();
}

// ─── BOAT ─────────────────────────────────────────────────────────────────────

function drawBoat(bx, by, t) {
  ctx.save();
  ctx.translate(bx, by + Math.sin(t * 0.38) * 2.5);
  ctx.rotate(Math.sin(t * 0.27) * 0.022);

  // Sail — drawn first so hull clips over its base
  ctx.globalAlpha = 0.68;
  ctx.fillStyle = '#c07830';
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.quadraticCurveTo(17, -13, 6, 0);
  ctx.lineTo(0, -30);
  ctx.fill();

  // Hull
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#180c06';
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.quadraticCurveTo(-18, 8, 0, 9);
  ctx.quadraticCurveTo(18, 8, 24, 0);
  ctx.closePath();
  ctx.fill();

  // Mast
  ctx.fillStyle = '#241008';
  ctx.fillRect(-1.5, -30, 3, 30);

  ctx.restore();
}

// ─── SAND ─────────────────────────────────────────────────────────────────────

function drawSand(t) {
  const sg = ctx.createLinearGradient(0, sandY, 0, H);
  sg.addColorStop(0.00, '#c07840');
  sg.addColorStop(0.25, '#a86030');
  sg.addColorStop(1.00, '#6a3818');
  ctx.fillStyle = sg;

  // Mounded profile — raised under palm clusters, gently curved between
  ctx.beginPath();
  ctx.moveTo(0, sandY + H * 0.08);
  ctx.quadraticCurveTo(W * 0.07,  sandY - H * 0.050, W * 0.20, sandY + H * 0.025);
  ctx.quadraticCurveTo(W * 0.50,  sandY + H * 0.008, W * 0.80, sandY + H * 0.025);
  ctx.quadraticCurveTo(W * 0.93,  sandY - H * 0.040, W,        sandY + H * 0.07);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Subtle sand ripple lines
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#4a2008';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const ry = sandY + H * 0.10 + i * H * 0.035;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    for (let x = 0; x <= W; x += 10) {
      ctx.lineTo(x, ry + Math.sin(x * 0.018 + i * 1.5) * H * 0.005);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ─── PALM ─────────────────────────────────────────────────────────────────────

function drawPalm(px, t, phase, scale) {
  const trunkH = H * 0.28 * scale;
  // Two-frequency layered sway for organic feel
  const sway  = noise(t * 0.38 + phase) * 0.09 + noise(t * 0.85 + phase * 1.8) * 0.03;
  const tipX  = sway * trunkH * 1.3;
  const tipY  = -trunkH;
  const ctlX  = sway * trunkH * 0.55;
  const ctlY  = -trunkH * 0.52;

  ctx.save();
  ctx.translate(px, sandY);

  // Trunk — quadratic bezier with gradient
  const tg = ctx.createLinearGradient(-9 * scale, 0, 9 * scale, 0);
  tg.addColorStop(0.0, '#2a1608');
  tg.addColorStop(0.5, '#5c3018');
  tg.addColorStop(1.0, '#1a0c04');
  ctx.strokeStyle = tg;
  ctx.lineWidth   = 11 * scale;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(ctlX, ctlY, tipX, tipY);
  ctx.stroke();

  // Bark rings
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 1;
  for (let i = 1; i < 9; i++) {
    const frac = i / 9;
    const bx   = lerp(ctlX * frac, tipX, frac * frac); // approximate along bezier
    const by   = lerp(ctlY * frac, tipY, frac * frac);
    ctx.beginPath();
    ctx.moveTo(bx - 4.5 * scale * (1 - frac * 0.5), by);
    ctx.lineTo(bx + 4.5 * scale * (1 - frac * 0.5), by);
    ctx.stroke();
  }
  ctx.restore();

  // Fronds
  ctx.translate(tipX, tipY);
  const frondCount = 8;
  for (let i = 0; i < frondCount; i++) {
    const baseAngle  = -Math.PI / 2;
    const spread     = Math.PI * 1.55;
    const angle      = baseAngle - spread / 2 + (spread / (frondCount - 1)) * i;
    const frondSway  = noise(t * 0.45 + phase + i * 0.75) * 0.14 + sway * 0.55;
    const finalAngle = angle + frondSway;
    const frondLen   = H * 0.13 * scale * (0.75 + 0.25 * Math.abs(Math.cos(angle)));

    // Endpoint droops with gravity
    const ex      = Math.cos(finalAngle) * frondLen;
    const ey      = Math.sin(finalAngle) * frondLen;
    const droopX  = ex * 0.85 + Math.sin(finalAngle) * frondLen * 0.08;
    const droopY  = ey + frondLen * 0.20;
    const mcx     = Math.cos(finalAngle) * frondLen * 0.38;
    const mcy     = Math.sin(finalAngle) * frondLen * 0.38;

    ctx.save();
    ctx.globalAlpha = 0.90;
    ctx.strokeStyle  = i % 2 === 0 ? '#162c0e' : '#2a5018';
    ctx.lineWidth    = 2.2 * scale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(mcx, mcy, droopX, droopY);
    ctx.stroke();

    // Leaflets — perpendicular strokes along the frond
    const leafCount = 6;
    for (let j = 1; j <= leafCount; j++) {
      const frac = j / (leafCount + 1);
      // Approximate point along quadratic bezier
      const qx   = lerp(lerp(0, mcx, frac), lerp(mcx, droopX, frac), frac);
      const qy   = lerp(lerp(0, mcy, frac), lerp(mcy, droopY, frac), frac);
      const perp = finalAngle + Math.PI * 0.5;
      const ll   = frondLen * 0.10 * (1 - frac * 0.5);

      ctx.globalAlpha = 0.68;
      ctx.lineWidth   = 1.2 * scale;
      ctx.strokeStyle = j % 2 === 0 ? '#1e4010' : '#2c5e18';
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(qx + Math.cos(perp) * ll * sign, qy + Math.sin(perp) * ll * sign);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

// ─── BIRDS ────────────────────────────────────────────────────────────────────

function drawBird(bird, t) {
  const totalSpan = W * 2.0;
  const progress  = ((bird.offset + t * bird.speed) % totalSpan) / totalSpan;
  // Travel right→left across extended canvas
  const bx = W + W * 0.5 - progress * totalSpan;
  const by = bird.pathY + Math.sin(progress * TAU * 2 + bird.phase) * H * 0.035;

  const flapT   = t * bird.flapSpeed + bird.phase;
  const glide   = Math.max(0, Math.sin(flapT * 0.28)); // periodic glide moment
  const wingDip = lerp(0.55, 0.0, glide) * Math.sin(flapT) + 0.06;

  const s = bird.scale * (W / 900);

  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.80;
  ctx.strokeStyle = '#140806';
  ctx.fillStyle   = '#140806';
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';

  // Body ellipse
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.5, 2.2, 0, 0, TAU);
  ctx.fill();

  const ws = 20;
  // Wings — quadratic arcs that rise on upstroke, droop on downstroke
  ctx.beginPath();
  ctx.moveTo(-1.5, 0);
  ctx.quadraticCurveTo(-ws * 0.45, -wingDip * ws * 0.85, -ws, wingDip * 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1.5, 0);
  ctx.quadraticCurveTo(ws * 0.45, -wingDip * ws * 0.85, ws, wingDip * 5);
  ctx.stroke();

  ctx.restore();
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────

function loop(ts) {
  const t = ts / 1000;

  ctx.clearRect(0, 0, W, H);
  drawSky(t);
  drawOcean(t);
  drawSand(t);
  for (const p of palms) drawPalm(p.x, t, p.phase, p.scale);
  for (const b of birds) drawBird(b, t);

  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);

// ─── CORE UTILITIES ───────────────────────────────────────────────────────────
// Shared constants, math helpers, image loading, and canvas coordinate helpers.
// Imported by app.js and all scene modules.

export const TAU   = Math.PI * 2;
export const rand  = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const CFG = {
  transitionMs:    400,
  swipeThreshold:  45,
  tapKickStrength: 6,
  shakeThreshold:  8,
};

export function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ─── CANVAS HELPERS ───────────────────────────────────────────────────────────

export function drawImageCover(ctx, img, W, H) {
  if (!img) return;
  const ir = img.width / img.height;
  const vr = W / H;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > vr) { sw = img.height * vr;  sx = (img.width  - sw) / 2; }
  else         { sh = img.width  / vr;  sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

export function _coverParams(img, W, H) {
  const ir = img.width / img.height;
  const vr = W / H;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > vr) { sw = img.height * vr; sx = (img.width  - sw) / 2; }
  else         { sh = img.width  / vr; sy = (img.height - sh) / 2; }
  return { sx, sy, sw, sh };
}

// paintToCanvas: painting pixel (px,py) → canvas point {x,y}
export function paintToCanvas(px, py, img, W, H) {
  if (!img) return { x: px / 100 * W, y: py / 100 * H };
  const { sx, sy, sw, sh } = _coverParams(img, W, H);
  return { x: (px - sx) / sw * W, y: (py - sy) / sh * H };
}

// canvasToPaint: canvas point (cx,cy) → painting pixel {px,py}
// Used by the ?debug measurement tool — click a feature, get its paint coords.
export function canvasToPaint(cx, cy, img, W, H) {
  const { sx, sy, sw, sh } = _coverParams(img, W, H);
  return { px: Math.round(sx + (cx / W) * sw), py: Math.round(sy + (cy / H) * sh) };
}

import { TAU, rand, clamp, CFG, loadImage, drawImageCover, canvasToPaint } from './core.js';
import { SnowOverlay, SmokeOverlay, CabinEventsOverlay, AuroraShimmerOverlay, WindowGlowOverlay, StarsTwinkleOverlay, preloadTinyCabinAssets, EV_NAMES_CABIN } from './scenes/tiny-cabin/scene.js';
import { BirdsOverlay, WaterGlintsOverlay, SeaMistOverlay } from './scenes/beach/scene.js';
import { BubblesOverlay, LightRaysOverlay, FishSilhouettesOverlay } from './scenes/aquarium/scene.js';
import { TechRuinOverlay, preloadTechRuinSprites, EV_NAMES_TECH_RUIN } from './scenes/tech-ruin/scene.js';
import { SpaceChurchOverlay, preloadSpaceChurchSprites } from './scenes/space-church/scene.js';

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

    Promise.all([preloadScenes(SCENES), preloadTinyCabinAssets(), preloadTechRuinSprites(), preloadSpaceChurchSprites()]).then(() => {
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

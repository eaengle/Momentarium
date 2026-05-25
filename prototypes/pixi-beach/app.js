(async () => {

  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    antialias: true,
    backgroundColor: 0x080215,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);

  // ── Layers (back → front) ────────────────────────────────────────────────
  const skyLayer        = new PIXI.Container();
  const starLayer       = new PIXI.Container();
  const atmosphereLayer = new PIXI.Container();
  const sunLayer        = new PIXI.Container();
  const oceanLayer      = new PIXI.Container();
  const palmBackLayer   = new PIXI.Container();
  const foreLayer       = new PIXI.Container();
  const birdLayer       = new PIXI.Container();
  const palmFrontLayer  = new PIXI.Container();
  const effectLayer     = new PIXI.Container();

  for (const l of [skyLayer, starLayer, atmosphereLayer, sunLayer, oceanLayer,
                   palmBackLayer, foreLayer, birdLayer, palmFrontLayer, effectLayer]) {
    app.stage.addChild(l);
  }

  let W = 0, H = 0, HZ = 0;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function seededRand(seed) {
    let s = seed >>> 0;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17; s >>>= 0;
      s ^= s << 5;  s >>>= 0;
      return s / 0xffffffff;
    };
  }

  function gradCanvas(w, h, stops, horiz = false) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const ctx = c.getContext('2d');
    const g = horiz
      ? ctx.createLinearGradient(0, 0, c.width, 0)
      : ctx.createLinearGradient(0, 0, 0, c.height);
    stops.forEach(([t, col]) => g.addColorStop(t, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ── Sky ──────────────────────────────────────────────────────────────────

  function buildSky() {
    skyLayer.removeChildren();
    const c = gradCanvas(W, HZ + 4, [
      [0.00, '#06010f'],
      [0.18, '#180330'],
      [0.42, '#4a0f40'],
      [0.65, '#a02838'],
      [0.83, '#d85822'],
      [1.00, '#f08520'],
    ]);
    const s = new PIXI.Sprite(PIXI.Texture.from(c));
    s.width = W; s.height = HZ + 4;
    skyLayer.addChild(s);
  }

  // ── Stars ────────────────────────────────────────────────────────────────

  const starObjs = [];
  function buildStars() {
    starLayer.removeChildren();
    starObjs.length = 0;
    const rng = seededRand(7);
    for (let i = 0; i < 55; i++) {
      const x = rng() * W;
      const y = rng() * HZ * 0.55;
      const r = 0.5 + rng() * 1.4;
      const base = 0.3 + rng() * 0.55;
      const g = new PIXI.Graphics();
      g.circle(x, y, r).fill({ color: 0xfff0e8, alpha: base });
      starLayer.addChild(g);
      starObjs.push({ g, base, phase: rng() * Math.PI * 2, spd: 0.6 + rng() * 1.8 });
    }
  }

  // ── Atmosphere ───────────────────────────────────────────────────────────

  function buildAtmosphere() {
    atmosphereLayer.removeChildren();
    const hazeH = HZ * 0.3;
    const c = gradCanvas(W, hazeH, [
      [0.0, 'rgba(255,110,30,0)'],
      [0.45, 'rgba(255,95,25,0.20)'],
      [0.8, 'rgba(240,80,20,0.08)'],
      [1.0, 'rgba(220,60,10,0)'],
    ]);
    const s = new PIXI.Sprite(PIXI.Texture.from(c));
    s.width = W; s.height = hazeH; s.y = HZ - hazeH;
    atmosphereLayer.addChild(s);

    // Thin glowing horizon line
    const lineG = new PIXI.Graphics();
    lineG.rect(0, HZ - 1.5, W, 3).fill({ color: 0xffa040, alpha: 0.45 });
    atmosphereLayer.addChild(lineG);
  }

  // ── Sun ──────────────────────────────────────────────────────────────────

  function buildSun() {
    sunLayer.removeChildren();
    const sx = W * 0.62;
    const sy = HZ - H * 0.018;
    const R  = H * 0.048;

    const layers = [
      { r: R * 5.5, c: 0xd04010, a: 0.035 },
      { r: R * 4.0, c: 0xe05818, a: 0.055 },
      { r: R * 2.8, c: 0xf07530, a: 0.10  },
      { r: R * 1.8, c: 0xf5a040, a: 0.18  },
      { r: R * 1.2, c: 0xffd060, a: 0.40  },
      { r: R * 0.85, c: 0xffe890, a: 0.80  },
      { r: R * 0.55, c: 0xfff8e0, a: 0.95  },
      { r: R * 0.28, c: 0xffffff, a: 1.00  },
    ];
    layers.forEach(({ r, c, a }) => {
      const g = new PIXI.Graphics();
      g.circle(sx, sy, r).fill({ color: c, alpha: a });
      g.blendMode = 'add';
      sunLayer.addChild(g);
    });

    // Sun reflection column on water
    const rw = R * 0.6;
    const rh = (H - HZ) * 0.55;
    const rc = gradCanvas(rw * 2, rh, [
      [0.0, 'rgba(255,190,70,0.40)'],
      [0.3, 'rgba(255,150,50,0.22)'],
      [0.7, 'rgba(255,110,30,0.08)'],
      [1.0, 'rgba(255,80,10,0)'],
    ]);
    const rs = new PIXI.Sprite(PIXI.Texture.from(rc));
    rs.x = sx - rw; rs.y = HZ;
    rs.width = rw * 2; rs.height = rh;
    rs.blendMode = 'add';
    sunLayer.addChild(rs);

    // Boat silhouette on horizon
    buildBoat(sx);
  }

  function buildBoat(sunX) {
    const bx = sunX * 0.6;
    const by = HZ - 1;
    const bw = W * 0.022;
    const bh = H * 0.014;
    const g  = new PIXI.Graphics();

    // Hull
    g.moveTo(bx - bw, by)
     .lineTo(bx + bw, by)
     .lineTo(bx + bw * 0.65, by + bh * 0.7)
     .lineTo(bx - bw * 0.65, by + bh * 0.7)
     .closePath()
     .fill({ color: 0x0e1a24, alpha: 0.85 });

    // Mast
    g.rect(bx - bw * 0.06, by - bh * 2.8, bw * 0.12, bh * 2.8)
     .fill({ color: 0x0e1a24, alpha: 0.75 });

    // Main sail
    g.moveTo(bx + bw * 0.06, by - bh * 2.7)
     .lineTo(bx + bw * 0.9, by - bh * 0.8)
     .lineTo(bx + bw * 0.06, by - bh * 0.3)
     .closePath()
     .fill({ color: 0x9a8060, alpha: 0.55 });

    sunLayer.addChild(g);
  }

  // ── Ocean ────────────────────────────────────────────────────────────────

  let waveG;
  function buildOcean() {
    oceanLayer.removeChildren();
    const oh = H - HZ + 2;
    const c = gradCanvas(W, oh, [
      [0.00, '#1e6880'],
      [0.12, '#145870'],
      [0.32, '#0c3855'],
      [0.60, '#071e35'],
      [0.85, '#040e20'],
      [1.00, '#020810'],
    ]);
    const s = new PIXI.Sprite(PIXI.Texture.from(c));
    s.width = W; s.height = oh; s.y = HZ - 1;
    oceanLayer.addChild(s);

    waveG = new PIXI.Graphics();
    oceanLayer.addChild(waveG);
  }

  function updateOcean(t) {
    if (!waveG) return;
    waveG.clear();

    // 12 wave crest bands at increasing depth
    for (let i = 0; i < 12; i++) {
      const frac  = i / 12;
      const baseY = HZ + (H - HZ) * (0.04 + frac * 0.82);
      const spd   = 0.25 + frac * 0.65;
      const amp   = 2.5 + frac * 7;
      const freq  = 0.007 - frac * 0.002;
      const alpha = 0.05 + frac * 0.10;
      const lw    = 0.6 + frac * 1.8;

      waveG.moveTo(0, baseY);
      for (let x = 0; x <= W; x += 8) {
        waveG.lineTo(x, baseY + Math.sin(x * freq + t * spd) * amp
                              + Math.sin(x * freq * 1.7 - t * spd * 0.6) * amp * 0.35);
      }
      waveG.stroke({ color: 0xb8e4f8, width: lw, alpha });
    }

    // Shimmer flecks — re-seeded each frame for sparkle
    const rng = seededRand(Math.floor(t * 3.5) * 17);
    for (let i = 0; i < 18; i++) {
      const fx  = rng() * W;
      const fy  = HZ + (H - HZ) * (0.04 + rng() * 0.62);
      const fw  = 4 + rng() * 22;
      const fa  = 0.06 + rng() * 0.16;
      waveG.moveTo(fx, fy).lineTo(fx + fw, fy)
           .stroke({ color: 0xd8f2ff, width: 1.2, alpha: fa });
    }
  }

  // ── Beach ─────────────────────────────────────────────────────────────────

  function buildBeach() {
    foreLayer.removeChildren();

    // Water/sand transition strip
    const transG = new PIXI.Graphics();
    transG.rect(0, HZ, W, H * 0.035).fill({ color: 0x38849a, alpha: 0.28 });
    foreLayer.addChild(transG);

    // Main sand
    const sandY = H * 0.68;
    const sandH = H - sandY + 2;
    const sc = gradCanvas(W, sandH, [
      [0.00, '#e0c080'],
      [0.25, '#d0a860'],
      [0.55, '#b88840'],
      [0.80, '#9a6828'],
      [1.00, '#7a4c14'],
    ]);
    const ss = new PIXI.Sprite(PIXI.Texture.from(sc));
    ss.width = W; ss.height = sandH; ss.y = sandY;
    foreLayer.addChild(ss);

    // Wet sand shine near water edge
    const wetH = (H - HZ) * 0.14;
    const wetY = HZ + (H - HZ) * 0.04;
    const wc = gradCanvas(W, wetH, [
      [0.0, 'rgba(80,180,210,0.22)'],
      [0.5, 'rgba(60,160,190,0.10)'],
      [1.0, 'rgba(40,140,170,0)'],
    ]);
    const ws = new PIXI.Sprite(PIXI.Texture.from(wc));
    ws.width = W; ws.height = wetH; ws.y = wetY;
    ws.blendMode = 'add';
    foreLayer.addChild(ws);
  }

  // ── Palms ─────────────────────────────────────────────────────────────────

  const palmObjects = [];

  function buildPalms() {
    palmBackLayer.removeChildren();
    palmFrontLayer.removeChildren();
    palmObjects.length = 0;

    const defs = [
      { xf: 0.08,  yf: 0.76, sc: 1.45, ph: 0.0,  layer: palmBackLayer  },
      { xf: 0.035, yf: 0.84, sc: 0.80, ph: 1.6,  layer: palmFrontLayer },
      { xf: 0.155, yf: 0.80, sc: 1.05, ph: 0.9,  layer: palmBackLayer  },
      { xf: 0.92,  yf: 0.75, sc: 1.25, ph: 2.4,  layer: palmFrontLayer },
    ];
    defs.forEach(d => palmObjects.push(buildPalm(d.xf * W, d.yf * H, d.sc, d.ph, d.layer)));
  }

  function buildPalm(px, py, sc, phase, layer) {
    const trunkH = 128 * sc;
    const lean   = px < W * 0.5 ? 32 * sc : -28 * sc;
    const tipX   = px + lean;
    const tipY   = py - trunkH;
    const tw     = 9 * sc;

    const trunkG = new PIXI.Graphics();

    // Trunk body
    trunkG.moveTo(px - tw * 0.5, py)
          .lineTo(px + tw * 0.5, py)
          .lineTo(tipX + tw * 0.28, tipY)
          .lineTo(tipX - tw * 0.28, tipY)
          .closePath()
          .fill(0x3c2010);

    // Trunk shadow side
    trunkG.moveTo(px - tw * 0.5, py)
          .lineTo(px - tw * 0.1, py)
          .lineTo(tipX - tw * 0.1, tipY)
          .lineTo(tipX - tw * 0.28, tipY)
          .closePath()
          .fill({ color: 0x1e0e06, alpha: 0.55 });

    // Ring marks
    for (let i = 1; i < 9; i++) {
      const f  = i / 9;
      const rx = px + lean * f;
      const ry = py - trunkH * f;
      const rw = tw * (1 - f * 0.25) * 0.75;
      trunkG.rect(rx - rw * 0.5, ry - 1.5 * sc, rw, 1.5 * sc)
            .fill({ color: 0x200c04, alpha: 0.35 });
    }

    // Coconut cluster
    trunkG.circle(tipX - tw * 0.15, tipY + 3 * sc, 4 * sc).fill(0x2a1808);
    trunkG.circle(tipX + tw * 0.25, tipY + 5 * sc, 3.5 * sc).fill(0x2a1808);
    trunkG.circle(tipX, tipY + 7 * sc, 4 * sc).fill(0x2a1808);

    layer.addChild(trunkG);

    // Frond graphics
    const frondCount = 9;
    const fronds = [];
    for (let i = 0; i < frondCount; i++) {
      const fg = new PIXI.Graphics();
      layer.addChild(fg);
      fronds.push({
        g:  fg,
        ao: (i / frondCount) * Math.PI * 2 - Math.PI * 0.12,
        fp: phase + i * 0.72,
      });
    }

    return {
      fronds, tipX, tipY, sc,
      update(t) {
        fronds.forEach(({ g, ao, fp }) => {
          const sway  = Math.sin(t * 0.85 + fp) * 0.20 + Math.sin(t * 1.9 + fp * 0.7) * 0.07;
          const a     = ao + sway;
          const len   = 88 * sc;
          const droop = 0.38;

          const cp1x = tipX + Math.cos(a) * len * 0.32;
          const cp1y = tipY + Math.sin(a) * len * 0.32 + len * droop * 0.15;
          const cp2x = tipX + Math.cos(a) * len * 0.68;
          const cp2y = tipY + Math.sin(a) * len * 0.68 + len * droop * 0.65;
          const ex   = tipX + Math.cos(a) * len;
          const ey   = tipY + Math.sin(a) * len + len * droop;

          const fw   = 6.5 * sc;
          const perp = a + Math.PI * 0.5;
          const px2  = Math.cos(perp);
          const py2  = Math.sin(perp);

          g.clear();

          // Leaf blade (filled shape)
          g.moveTo(tipX, tipY)
           .bezierCurveTo(cp1x + px2 * fw, cp1y + py2 * fw,
                          cp2x + px2 * fw * 0.55, cp2y + py2 * fw * 0.55,
                          ex, ey)
           .bezierCurveTo(cp2x - px2 * fw * 0.55, cp2y - py2 * fw * 0.55,
                          cp1x - px2 * fw, cp1y - py2 * fw,
                          tipX, tipY)
           .closePath()
           .fill({ color: 0x1a5030, alpha: 0.90 });

          // Midrib
          g.moveTo(tipX, tipY)
           .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey)
           .stroke({ color: 0x38a060, width: 1.4 * sc, alpha: 0.65 });

          // Leaflet veins (tiny strokes branching off midrib at intervals)
          for (let v = 1; v <= 5; v++) {
            const vt = v / 6;
            const vx = tipX + (ex - tipX) * vt + (cp1x - tipX) * (1 - vt) * 0.4;
            const vy = tipY + (ey - tipY) * vt + (cp1y - tipY) * (1 - vt) * 0.4;
            const vl = 10 * sc * (1 - vt * 0.5);
            g.moveTo(vx, vy)
             .lineTo(vx + px2 * vl * 0.7 + Math.cos(a) * vl * 0.7,
                     vy + py2 * vl * 0.7 + Math.sin(a) * vl * 0.7)
             .stroke({ color: 0x30884a, width: 0.8 * sc, alpha: 0.30 });
            g.moveTo(vx, vy)
             .lineTo(vx - px2 * vl * 0.7 + Math.cos(a) * vl * 0.7,
                     vy - py2 * vl * 0.7 + Math.sin(a) * vl * 0.7)
             .stroke({ color: 0x30884a, width: 0.8 * sc, alpha: 0.30 });
          }
        });
      }
    };
  }

  // ── Birds ────────────────────────────────────────────────────────────────

  const birdObjs = [];
  function buildBirds() {
    birdLayer.removeChildren();
    birdObjs.length = 0;
    const rng = seededRand(55);
    for (let i = 0; i < 10; i++) {
      const g = new PIXI.Graphics();
      birdLayer.addChild(g);
      birdObjs.push({
        g,
        offX:      rng() * (W + 200),
        baseY:     H * (0.05 + rng() * 0.32),
        spd:       22 + rng() * 40,
        sc:        0.45 + rng() * 0.85,
        bobA:      H * (0.007 + rng() * 0.014),
        bobF:      0.35 + rng() * 0.55,
        bobPh:     rng() * Math.PI * 2,
        flapF:     2.2 + rng() * 3.5,
        flapPh:    rng() * Math.PI * 2,
      });
    }
  }

  function updateBirds(t) {
    birdObjs.forEach(b => {
      const { g, offX, baseY, spd, sc, bobA, bobF, bobPh, flapF, flapPh } = b;
      const x   = ((t * spd + offX) % (W + 200)) - 100;
      const y   = baseY + Math.sin(t * bobF + bobPh) * bobA;
      const flap = Math.sin(t * flapF + flapPh);
      const wy  = flap * 5.5 * sc;
      const ws  = 13 * sc;

      g.clear();
      g.moveTo(x, y)
       .quadraticCurveTo(x - ws * 0.5, y - 3.5 * sc + wy, x - ws, y + wy)
       .stroke({ color: 0x080215, width: 1.6 * sc, alpha: 0.72 });
      g.moveTo(x, y)
       .quadraticCurveTo(x + ws * 0.5, y - 3.5 * sc + wy, x + ws, y + wy)
       .stroke({ color: 0x080215, width: 1.6 * sc, alpha: 0.72 });
    });
  }

  // ── Vignette ─────────────────────────────────────────────────────────────

  function buildVignette() {
    effectLayer.removeChildren();
    const vc = document.createElement('canvas');
    vc.width  = Math.ceil(W);
    vc.height = Math.ceil(H);
    const vctx  = vc.getContext('2d');
    const vgrad = vctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.88);
    vgrad.addColorStop(0, 'rgba(0,0,0,0)');
    vgrad.addColorStop(1, 'rgba(0,0,0,0.60)');
    vctx.fillStyle = vgrad;
    vctx.fillRect(0, 0, W, H);
    const vs = new PIXI.Sprite(PIXI.Texture.from(vc));
    vs.width = W; vs.height = H;
    effectLayer.addChild(vs);
  }

  // ── Build / Rebuild ───────────────────────────────────────────────────────

  function build() {
    W  = app.screen.width;
    H  = app.screen.height;
    HZ = H * 0.525;

    buildSky();
    buildStars();
    buildAtmosphere();
    buildSun();
    buildOcean();
    buildBeach();
    buildPalms();
    buildBirds();
    buildVignette();
  }

  build();
  app.renderer.on('resize', build);

  // ── Ticker ────────────────────────────────────────────────────────────────

  app.ticker.add(ticker => {
    const t = ticker.lastTime / 1000;

    // Stars twinkle
    starObjs.forEach(s => {
      s.g.alpha = s.base * (0.55 + 0.45 * Math.sin(t * s.spd + s.phase));
    });

    // Ocean wave animation
    updateOcean(t);

    // Palm fronds sway
    palmObjects.forEach(p => p.update(t));

    // Birds fly
    updateBirds(t);

    // Gentle scene parallax
    const px = Math.sin(t * 0.045) * 5;
    palmBackLayer.x  =  px * 0.55;
    palmFrontLayer.x = -px * 0.30;
    birdLayer.x      =  px * 1.20;
  });

})();

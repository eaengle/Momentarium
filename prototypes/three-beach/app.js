import * as THREE from 'three';

// ─── Globals ──────────────────────────────────────────────────────────────────

let scene, camera, renderer, clock;
let oceanMesh, oceanGeo;
const OCEAN_SEGS = 64;

const waveLines = [];
const WAVE_COUNT = 12;

const palms = [];
const birds = [];

let starPoints;

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return s / 0xffffffff;
  };
}

function sampleGradient(stops, t) {
  // stops: [{t, c}] sorted descending by t
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t >= b.t) {
      const f = (t - b.t) / (a.t - b.t);
      return new THREE.Color().lerpColors(b.c, a.c, f);
    }
  }
  return stops[stops.length - 1].c.clone();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0118);
  scene.fog = new THREE.FogExp2(0x2a0a40, 0.006);

  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(0, 4.5, 22);
  camera.lookAt(0, 1.5, -5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  document.body.appendChild(renderer.domElement);

  createLights();
  createSky();
  createStars();
  createAtmosphere();
  createSun();
  createOcean();
  createWaveLines();
  createShimmer();
  createBeach();
  createBoat();

  createPalm({ x: -8,  z:  1, scale: 1.40, phase: 0.0, lean: -0.18 });
  createPalm({ x: -11, z:  7, scale: 0.82, phase: 1.6, lean: -0.22 });
  createPalm({ x: -5.5,z:  4, scale: 1.05, phase: 0.9, lean: -0.14 });
  createPalm({ x: 10,  z:  1, scale: 1.25, phase: 2.4, lean:  0.16 });

  for (let i = 0; i < 10; i++) createBird(i);

  createVignette();

  window.addEventListener('resize', resize);
  animate();
}

// ─── Lights ───────────────────────────────────────────────────────────────────

function createLights() {
  scene.add(new THREE.AmbientLight(0xc06080, 2.8));

  const sun = new THREE.DirectionalLight(0xffaa44, 3.5);
  sun.position.set(14, 6, -55);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xff6030, 1.2);
  fill.position.set(0, 8, 10);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x4060c0, 0.6);
  rim.position.set(-12, 3, 10);
  scene.add(rim);
}

// ─── Sky ──────────────────────────────────────────────────────────────────────

function createSky() {
  const geo = new THREE.SphereGeometry(300, 24, 14);
  const pos = geo.attributes.position;

  const stops = [
    { t: 1.00, c: new THREE.Color(0x180330) },
    { t: 0.78, c: new THREE.Color(0x3a0a58) },
    { t: 0.56, c: new THREE.Color(0x7a1848) },
    { t: 0.36, c: new THREE.Color(0xc03040) },
    { t: 0.14, c: new THREE.Color(0xe86020) },
    { t: 0.00, c: new THREE.Color(0xff9030) },
  ];

  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 300 + 1) / 2;
    const c = sampleGradient(stops, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function createStars() {
  const rng = seededRand(7);
  const positions = new Float32Array(55 * 3);
  const phases = [];
  const speeds = [];

  for (let i = 0; i < 55; i++) {
    const theta = rng() * Math.PI * 2;
    const phi   = rng() * Math.PI * 0.40;
    const r = 250;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 10;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 60;
    phases.push(rng() * Math.PI * 2);
    speeds.push(0.6 + rng() * 1.8);
  }

  const starCanvas = document.createElement('canvas');
  starCanvas.width = starCanvas.height = 32;
  const ctx = starCanvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0,   'rgba(255,240,232,1)');
  g.addColorStop(0.4, 'rgba(255,240,232,0.6)');
  g.addColorStop(1,   'rgba(255,240,232,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  starPoints = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.0,
    map: new THREE.CanvasTexture(starCanvas),
    transparent: true,
    depthWrite: false,
    color: 0xfff0e8,
    sizeAttenuation: true,
  }));
  starPoints._phases = phases;
  starPoints._speeds = speeds;
  scene.add(starPoints);
}

// ─── Atmosphere / horizon glow ────────────────────────────────────────────────

function createAtmosphere() {
  // Warm haze band above horizon
  const hazeC = document.createElement('canvas');
  hazeC.width = 512; hazeC.height = 256;
  const hctx = hazeC.getContext('2d');
  const hg = hctx.createLinearGradient(0, 0, 0, 256);
  hg.addColorStop(0.0, 'rgba(255,120,40,0)');
  hg.addColorStop(0.4, 'rgba(255,100,30,0.38)');
  hg.addColorStop(0.8, 'rgba(240,80,20,0.16)');
  hg.addColorStop(1.0, 'rgba(220,60,10,0)');
  hctx.fillStyle = hg;
  hctx.fillRect(0, 0, 512, 256);

  const hazeSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(hazeC),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  hazeSprite.scale.set(200, 28, 1);
  hazeSprite.position.set(0, 2.4, -60);
  scene.add(hazeSprite);

  // Thin horizon glow line
  const lineGeo = new THREE.PlaneGeometry(200, 0.35);
  const lineMesh = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({
    color: 0xffa040,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  lineMesh.position.set(0, 0.55, -60);
  scene.add(lineMesh);
}

// ─── Sun ──────────────────────────────────────────────────────────────────────

function createSun() {
  // Glow disc
  const sc = document.createElement('canvas');
  sc.width = sc.height = 256;
  const sctx = sc.getContext('2d');
  const sg = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  sg.addColorStop(0.00, 'rgba(255,255,255,1.0)');
  sg.addColorStop(0.10, 'rgba(255,248,200,0.95)');
  sg.addColorStop(0.22, 'rgba(255,232,140,0.80)');
  sg.addColorStop(0.35, 'rgba(255,160,64,0.55)');
  sg.addColorStop(0.52, 'rgba(240,117,48,0.28)');
  sg.addColorStop(0.70, 'rgba(208,64,16,0.12)');
  sg.addColorStop(0.88, 'rgba(180,40,8,0.04)');
  sg.addColorStop(1.00, 'rgba(0,0,0,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 256, 256);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sc),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sunSprite.scale.set(38, 38, 1);
  sunSprite.position.set(17, 2.0, -60);
  scene.add(sunSprite);

  // Reflection column
  const rc = document.createElement('canvas');
  rc.width = 64; rc.height = 256;
  const rctx = rc.getContext('2d');
  const rg = rctx.createLinearGradient(0, 0, 0, 256);
  rg.addColorStop(0.0, 'rgba(255,190,70,0.42)');
  rg.addColorStop(0.3, 'rgba(255,150,50,0.24)');
  rg.addColorStop(0.7, 'rgba(255,110,30,0.09)');
  rg.addColorStop(1.0, 'rgba(255,80,10,0)');
  rctx.fillStyle = rg;
  rctx.fillRect(0, 0, 64, 256);

  const refMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 32),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(rc),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  refMesh.rotation.x = -Math.PI / 2;
  refMesh.position.set(17, 0.08, -25);
  scene.add(refMesh);
}

// ─── Ocean ────────────────────────────────────────────────────────────────────

function createOcean() {
  oceanGeo = new THREE.PlaneGeometry(160, 110, OCEAN_SEGS, OCEAN_SEGS);

  // Vertex colors: teal at horizon (far), near-black at foreground
  const pos = oceanGeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const cNear = new THREE.Color(0x071e35);
  const cMid  = new THREE.Color(0x145870);
  const cFar  = new THREE.Color(0x2a8898);

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);             // plane Y: -55 (front) to +55 (back)
    const t = (y + 55) / 110;          // 0=front/near, 1=back/far
    let c;
    if (t < 0.45) c = new THREE.Color().lerpColors(cNear, cMid, t / 0.45);
    else          c = new THREE.Color().lerpColors(cMid,  cFar, (t - 0.45) / 0.55);
    cols[i * 3]     = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  oceanGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));

  oceanMesh = new THREE.Mesh(oceanGeo, new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
  }));
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(0, 0, -22);
  scene.add(oceanMesh);
}

function animateOcean(t) {
  const pos = oceanGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i,
      Math.sin(x * 0.14 + t * 0.85) * 0.28 +
      Math.sin(y * 0.17 + t * 0.55) * 0.20 +
      Math.sin((x + y) * 0.09 + t * 1.15) * 0.14
    );
  }
  pos.needsUpdate = true;
  oceanGeo.computeVertexNormals();
}

// ─── Wave crest lines ─────────────────────────────────────────────────────────

function createWaveLines() {
  const N = 90;
  for (let i = 0; i < WAVE_COUNT; i++) {
    const positions = new Float32Array((N + 1) * 3);
    for (let x = 0; x <= N; x++) {
      positions[x * 3]     = (x / N - 0.5) * 160;
      positions[x * 3 + 1] = 0;
      positions[x * 3 + 2] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const frac  = i / WAVE_COUNT;
    const alpha = 0.05 + frac * 0.11;
    const line  = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xb8e4f8,
      transparent: true,
      opacity: alpha,
      depthWrite: false,
    }));
    line.position.set(0, 0.10, -4 - frac * 52);
    scene.add(line);
    waveLines.push({ line, geo, frac });
  }
}

function animateWaveLines(t) {
  for (const { geo, frac } of waveLines) {
    const pos  = geo.attributes.position;
    const N    = pos.count - 1;
    const spd  = 0.25 + frac * 0.65;
    const amp  = 0.10 + frac * 0.32;
    const freq = 0.035 - frac * 0.010;
    for (let i = 0; i <= N; i++) {
      const x = pos.getX(i);
      pos.setY(i,
        Math.sin(x * freq + t * spd) * amp +
        Math.sin(x * freq * 1.7 - t * spd * 0.6) * amp * 0.35
      );
    }
    pos.needsUpdate = true;
  }
}

// ─── Shimmer flecks ───────────────────────────────────────────────────────────

let shimmerGeo, shimmerPositions;
const SHIMMER_COUNT = 22;

function createShimmer() {
  shimmerPositions = new Float32Array(SHIMMER_COUNT * 3);
  shimmerGeo = new THREE.BufferGeometry();
  shimmerGeo.setAttribute('position', new THREE.BufferAttribute(shimmerPositions, 3));

  const shimCanvas = document.createElement('canvas');
  shimCanvas.width = shimCanvas.height = 16;
  const ctx = shimCanvas.getContext('2d');
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0,   'rgba(216,242,255,1)');
  g.addColorStop(0.5, 'rgba(216,242,255,0.5)');
  g.addColorStop(1,   'rgba(216,242,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);

  scene.add(new THREE.Points(shimmerGeo, new THREE.PointsMaterial({
    size: 1.4,
    map: new THREE.CanvasTexture(shimCanvas),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })));
}

function animateShimmer(t) {
  const rng = seededRand(Math.floor(t * 3.5) * 17);
  for (let i = 0; i < SHIMMER_COUNT; i++) {
    shimmerPositions[i * 3]     = (rng() - 0.5) * 140;
    shimmerPositions[i * 3 + 1] = 0.12 + rng() * 0.3;
    shimmerPositions[i * 3 + 2] = -6 - rng() * 48;
  }
  shimmerGeo.attributes.position.needsUpdate = true;
}

// ─── Beach ────────────────────────────────────────────────────────────────────

function createBeach() {
  const geo = new THREE.PlaneGeometry(120, 36, 40, 20);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);

  const cLight = new THREE.Color(0xf0d090);
  const cMid   = new THREE.Color(0xd0a055);
  const cDark  = new THREE.Color(0xa06828);

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);                    // -18 (water edge) to +18 (foreground)
    const t = (y + 18) / 36;                  // 0=water edge, 1=foreground
    let c;
    if (t < 0.40) c = new THREE.Color().lerpColors(cLight, cMid, t / 0.40);
    else          c = new THREE.Color().lerpColors(cMid, cDark, (t - 0.40) / 0.60);
    cols[i * 3]     = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;

    // Micro-undulation
    pos.setZ(i,
      Math.sin(pos.getX(i) * 0.35 + pos.getY(i) * 0.2) * 0.06 +
      Math.cos(pos.getX(i) * 0.5) * 0.04
    );
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, 10);
  scene.add(mesh);

  // Wet sand / water-edge shimmer strip
  const wetMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 2.5),
    new THREE.MeshBasicMaterial({
      color: 0x38849a,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  wetMesh.rotation.x = -Math.PI / 2;
  wetMesh.position.set(0, 0.02, -1.5);
  scene.add(wetMesh);
}

// ─── Boat ─────────────────────────────────────────────────────────────────────

function createBoat() {
  const group = new THREE.Group();
  group.position.set(-18, 0.5, -60);

  const mat = new THREE.MeshBasicMaterial({ color: 0x0e1a24 });

  // Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 1.2), mat);
  group.add(hull);

  // Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 4), mat);
  mast.position.set(0, 3.0, 0);
  group.add(mast);

  // Sail (triangle)
  const sailVerts = new Float32Array([
    0.06, 0.0, 0,
    2.0, -3.2, 0,
    0.06, -2.6, 0,
  ]);
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.BufferAttribute(sailVerts, 3));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshBasicMaterial({
    color: 0x9a8060,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  }));
  sail.position.set(0, 3.0, 0);
  group.add(sail);

  scene.add(group);
}

// ─── Palm trees ───────────────────────────────────────────────────────────────

function createPalm({ x, z, scale, phase, lean }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const trunkMat  = new THREE.MeshBasicMaterial({ color: 0x6a4020 });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x3a2010 });
  const cocoMat   = new THREE.MeshBasicMaterial({ color: 0x4a2c10 });
  const frondMat  = new THREE.MeshBasicMaterial({ color: 0x2a7040, side: THREE.DoubleSide });

  const trunkH = 5.6 * scale;
  const segs   = 9;

  // Tapered leaning trunk
  for (let i = 0; i < segs; i++) {
    const tf   = i / segs;
    const rBot = 0.19 * (1 - tf * 0.44) * scale;
    const rTop = 0.19 * (1 - (tf + 1 / segs) * 0.44) * scale;
    const segH = trunkH / segs;
    const seg  = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH, 7), trunkMat);
    seg.position.x = lean * (i + 0.5) * segH * 0.85;
    seg.position.y = (i + 0.5) * segH;
    seg.rotation.z = lean * 0.13;
    group.add(seg);

    if (i > 0 && i % 2 === 0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rBot * 1.08, 0.011 * scale, 4, 7), shadowMat);
      ring.position.copy(seg.position);
      ring.position.y = i * segH;
      ring.rotation.z = lean * 0.13;
      group.add(ring);
    }
  }

  // Crown
  const crownX = lean * trunkH * 0.85;
  const crown  = new THREE.Group();
  crown.position.set(crownX, trunkH, 0);
  group.add(crown);

  // Coconuts
  for (let c = 0; c < 3; c++) {
    const a    = (c / 3) * Math.PI * 2;
    const cocoR = 0.17 * scale;
    const coco  = new THREE.Mesh(new THREE.SphereGeometry(cocoR, 6, 4), cocoMat);
    coco.position.set(Math.cos(a) * cocoR * 2.8, -cocoR * 0.8, Math.sin(a) * cocoR * 2.8);
    crown.add(coco);
  }

  // 9 fronds, bezier-inspired drooping leaves
  const frondCount = 9;
  const fronds = [];

  for (let f = 0; f < frondCount; f++) {
    const baseAngle = (f / frondCount) * Math.PI * 2 - Math.PI * 0.12;
    const frondGroup = new THREE.Group();
    frondGroup.rotation.y = baseAngle;
    frondGroup.rotation.z = 0.26 + (f % 3) * 0.05;

    const leafSegs = 8;
    for (let l = 0; l < leafSegs; l++) {
      const lt  = (l + 0.5) / leafSegs;
      const w   = 0.30 * (1 - lt * 0.68) * scale;
      const h   = 0.48 * scale;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, h), frondMat);
      // Droop: moves outward and curves downward (like pixi's bezier)
      leaf.position.set(lt * 2.8 * scale, -(lt * lt) * 1.5 * scale, 0);
      leaf.rotation.z = -lt * 0.50 - 0.08;
      leaf.rotation.y = Math.sin(lt * Math.PI) * 0.18;
      frondGroup.add(leaf);
    }

    frondGroup._fp = phase + f * 0.72;
    crown.add(frondGroup);
    fronds.push(frondGroup);
  }

  palms.push({ group, crown, fronds, phase });
  scene.add(group);
}

function animatePalms(t) {
  for (const p of palms) {
    const s = Math.sin(t * 0.85 + p.phase) * 0.08 + Math.sin(t * 1.9 + p.phase * 0.7) * 0.03;
    p.crown.rotation.z = s;
    p.crown.rotation.x = Math.sin(t * 0.6 + p.phase * 0.9) * 0.025;
    for (const frond of p.fronds) {
      frond.rotation.z = 0.26 + Math.sin(t * 1.1 + frond._fp) * 0.07 +
                                 Math.sin(t * 2.1 + frond._fp * 1.3) * 0.025;
    }
  }
}

// ─── Birds ────────────────────────────────────────────────────────────────────

function createBird(seed) {
  const rng   = seededRand(seed * 137 + 55);
  const group = new THREE.Group();
  const mat   = new THREE.LineBasicMaterial({ color: 0x080215, transparent: true, opacity: 0.74 });

  // Each wing: 3 points stored as Float32Array for zero-alloc updates
  function makeWing() {
    const positions = new Float32Array(9);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geo, mat);
    return { line, positions };
  }

  const left  = makeWing();
  const right = makeWing();
  group.add(left.line, right.line);

  const sc    = 0.38 + rng() * 0.70;
  group.scale.setScalar(sc);

  const baseY  = 5.5 + rng() * 5.0;
  const baseZ  = -8  - rng() * 20;
  const startX = (rng() - 0.5) * 120;
  const spd    = 16  + rng() * 36;
  const dir    = rng() > 0.5 ? 1 : -1;
  const bobA   = 0.25 + rng() * 0.55;
  const bobF   = 0.35 + rng() * 0.55;
  const bobPh  = rng() * Math.PI * 2;
  const flapF  = 2.2  + rng() * 3.5;
  const flapPh = rng() * Math.PI * 2;

  birds.push({ group, left, right, baseY, baseZ, startX, spd, dir, bobA, bobF, bobPh, flapF, flapPh });
  scene.add(group);
}

function animateBirds(t) {
  for (const b of birds) {
    const { group, left, right, baseY, baseZ, startX, spd, dir, bobA, bobF, bobPh, flapF, flapPh } = b;

    const x    = ((startX + dir * t * spd + 130) % 220) - 110;
    const y    = baseY + Math.sin(t * bobF + bobPh) * bobA;
    const flap = Math.sin(t * flapF + flapPh);
    const wy   = flap * 0.30;
    const ws   = 0.95;

    group.position.set(x, y, baseZ);
    group.rotation.y = dir < 0 ? Math.PI : 0;

    // Left wing
    const lp = left.positions;
    lp[0]=0;      lp[1]=0;            lp[2]=0;
    lp[3]=-ws*0.44; lp[4]=0.22+wy*0.55; lp[5]=0;
    lp[6]=-ws;    lp[7]=wy;           lp[8]=0;
    left.line.geometry.attributes.position.needsUpdate = true;

    // Right wing
    const rp = right.positions;
    rp[0]=0;     rp[1]=0;            rp[2]=0;
    rp[3]=ws*0.44; rp[4]=0.22+wy*0.55; rp[5]=0;
    rp[6]=ws;    rp[7]=wy;           rp[8]=0;
    right.line.geometry.attributes.position.needsUpdate = true;
  }
}

// ─── Vignette (CSS overlay) ───────────────────────────────────────────────────

function createVignette() {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:10',
    'background:radial-gradient(ellipse at 50% 50%, transparent 18%, rgba(0,0,0,0.62) 100%)',
  ].join(';');
  document.body.appendChild(div);
}

// ─── Stars twinkle ────────────────────────────────────────────────────────────

function animateStars(t) {
  const phases = starPoints._phases;
  const speeds = starPoints._speeds;
  // Shift overall opacity gently; individual twinkle via single alpha
  starPoints.material.opacity = 0.70 + Math.sin(t * 0.38) * 0.08;
  // Rotate very slowly to add 3D life
  starPoints.rotation.y = t * 0.0008;
}

// ─── Camera drift ─────────────────────────────────────────────────────────────

function animateCamera(t) {
  camera.position.x = Math.sin(t * 0.045) * 1.6;
  camera.position.y = 4.5 + Math.sin(t * 0.07) * 0.30;
  camera.lookAt(0, 1.5 + Math.sin(t * 0.055) * 0.18, -5);
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

// ─── Render loop ──────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  animateOcean(t);
  animateWaveLines(t);
  animateShimmer(t);
  animatePalms(t);
  animateBirds(t);
  animateStars(t);
  animateCamera(t);

  renderer.render(scene, camera);
}

init();

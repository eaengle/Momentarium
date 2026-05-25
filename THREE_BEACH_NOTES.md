# Three.js Beach Slice Prototype Notes

These notes are a handoff for a focused prototype conversation. The goal is to explore whether a small Three.js scene gives Momentarium enough visual depth and motion realism to justify moving beyond 2D canvas.

## Current App Context

Momentarium is currently a plain HTML/CSS/JavaScript PWA with no build step. Most of the app lives in `app.js`.

- `index.html` owns the full-screen `<canvas id="c">`, minimal page styles, and service worker registration.
- `app.js` owns the scene list, procedural drawing, particles, swipe/tap/shake controls, transitions, and render loop.
- Scenes are drawn directly with Canvas 2D through `draw(ctx, W, H, t)`.
- Animation is mostly time-based using `requestAnimationFrame`.
- Existing scene examples include procedural snow, fish, seaweed sway, bats, tree sway, stars, particles, and micro-events.

## Prototype Goal

Build the smallest useful proof of a 3D tropical beach scene using Three.js.

The prototype should answer:

> Does a minimal 3D scene provide enough atmosphere, depth, and realistic motion potential to justify the extra complexity for Momentarium?

## Suggested Location

Create a standalone prototype:

```text
Momentarium/
|-- prototypes/
|   `-- three-beach/
|       |-- index.html
|       |-- app.js
|       `-- README.md
```

Keep it independent from the main app. This should be a small experiment, not the beginning of a migration.

## Technology Scope

Use Three.js as the 3D renderer.

For the first pass, either:

- use an import map and CDN modules in `index.html`, or
- install a tiny Vite setup if module/CDN workflow becomes awkward.

Recommended first pass: CDN module import, no build step.

Example direction:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/"
  }
}
</script>
<script type="module" src="./app.js"></script>
```

Do not add React, complex UI, physics, or a full game engine for this prototype.

## Minimum Visual Target

Create a calm beach scene with:

- perspective camera
- sunset-colored sky/background
- ocean plane
- sand plane
- one or more palm trees
- small bird or placeholder bird shapes moving through the scene
- simple lighting and fog/atmosphere

The visual can be stylized and low-poly at first. The goal is depth, camera atmosphere, and motion, not final realism.

## 3D Concepts To Test

The minimum prototype should intentionally test:

- `Scene`, `PerspectiveCamera`, `WebGLRenderer`
- responsive resize handling
- basic lights
- fog or atmospheric color
- textured or shader-like ocean motion
- palm frond sway in 3D
- bird flight path in 3D space
- camera composition and field of view

## Animation Tests

The minimum prototype should include:

- Ocean motion using vertex displacement, material animation, or simple shader uniforms.
- Palm fronds swaying around their base or through simple bone-like grouping.
- Birds moving along a 3D curve, with flap/glide motion.
- Optional slow camera drift for parallax.

## Important Constraint

Do not attempt realistic assets immediately.

Use simple geometry first:

- sand: large plane
- ocean: large plane with moving vertices or shader
- trunk: tapered cylinder or stacked cylinders
- palm fronds: curved planes, cones, or simple triangle strips
- birds: small wing/body meshes or billboard sprites

Only introduce glTF models after the simple geometry test proves that Three.js feels promising.

## Useful Implementation Shape

Start with:

```js
import * as THREE from 'three';

let scene, camera, renderer, clock;
const palms = [];
const birds = [];

function init() {}
function createBeach() {}
function createOcean() {}
function createPalm(x, z, scale, phase) {}
function createBird(seed) {}
function resize() {}
function animate() {}
```

Recommended object structure:

- `scene`
- `camera`
- `renderer`
- `sunLight`
- `ambientLight`
- `oceanMesh`
- `sandMesh`
- `palmGroup`
- `birdGroup`

## Possible Ocean Approaches

Start simple:

1. Plane geometry with vertices moved by sine waves each frame.
2. Animated material color/opacity bands.
3. Later: custom shader material with time uniform.

Avoid complex water packages until after the prototype proves Three.js is worth pursuing.

## Possible Palm Approaches

Start simple:

1. Palm trunk as a slightly curved stack of cylinders or spheres.
2. Fronds as flat triangular or curved plane meshes parented to a crown group.
3. Animate each frond rotation with different phase and amplitude.

Later options:

- glTF palm model
- skeletal animation
- vertex shader wind
- instanced palms

## Possible Bird Approaches

Start simple:

1. Bird as a small group with body mesh plus two wing meshes.
2. Move bird group along a `CatmullRomCurve3`.
3. Flap wings with sine motion.
4. Use banking/rotation based on curve tangent.

Later options:

- glTF bird model with animation clips
- billboard sprite bird
- flocking behavior
- authored animation from Blender

## Success Criteria

The prototype is successful if:

- It runs as a standalone page.
- The scene has clear 3D depth and atmosphere.
- The ocean, palm, and bird motion feel more naturally spatial than the 2D prototypes.
- The code remains understandable.
- Performance is smooth on desktop and plausibly mobile.
- The visual payoff seems worth the extra complexity.

## What To Avoid

- No full Momentarium rewrite.
- No service worker/PWA work.
- No scene navigation.
- No physics engine.
- No large downloaded model packs.
- No realistic asset pipeline in the first pass.
- No complex post-processing until the base scene works.

## Comparison Against 2D Prototypes

When complete, compare against `canvas-beach` and `pixi-beach`:

- Is the depth meaningfully better?
- Are palm and bird animations more convincing?
- Is the code complexity acceptable?
- Is mobile performance acceptable?
- Does the scene still feel like Momentarium, or does it become a different kind of app?

## Follow-Up Questions For The Prototype Conversation

- Should the first Three.js prototype stay no-build with CDN imports, or use Vite?
- Should the visual style be low-poly, painterly 3D, or semi-realistic?
- Should birds be mesh-based, billboard sprites, or imported glTF models?
- Should palm sway be object rotation, vertex displacement, or skeletal animation?
- Should the camera be fixed like a painting, or slowly drifting?


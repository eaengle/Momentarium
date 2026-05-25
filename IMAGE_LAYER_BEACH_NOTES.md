# Image Layer Beach Prototype Notes

These notes are a handoff for a focused prototype conversation. The goal is to explore whether Momentarium should become more of an animated painting viewer: static or lightly layered artwork with small procedural motion on top.

## Why This Direction

The existing beach prototypes are mostly procedural. That makes the code flexible, but it also makes it hard to reach the richness of a real painting or generated illustration.

This prototype tests a different model:

```text
static illustrated image
+ small procedural overlays
+ optional animated sprites
+ optional image-layer motion
```

The goal is not to draw the whole world in code. The goal is to make a still image feel gently alive.

## Current App Context

Momentarium is currently a plain HTML/CSS/JavaScript PWA with no build step. Most of the app lives in `app.js`.

- `index.html` owns the full-screen `<canvas id="c">`, minimal page styles, and service worker registration.
- `app.js` owns the scene list, procedural drawing, particles, swipe/tap/shake controls, transitions, and render loop.
- Scenes are drawn directly with Canvas 2D through `draw(ctx, W, H, t)`.
- Animation is mostly time-based using `requestAnimationFrame`.
- Existing scene examples include procedural snow, fish, seaweed sway, bats, tree sway, stars, particles, and micro-events.

## Prototype Goal

Build the smallest useful proof of:

> One static beach painting or illustration used as the scene background, with animated birds, particles, shimmer, or weather drawn over it.

The prototype should answer:

> Does a static image plus lightweight procedural overlays produce a better Momentarium direction than fully procedural scenes?

## Suggested Location

Create a standalone prototype:

```text
Momentarium/
|-- prototypes/
|   `-- image-layer-beach/
|       |-- index.html
|       |-- app.js
|       |-- README.md
|       `-- assets/
|           `-- beach-background.webp
```

Use any temporary local image name if needed. Keep the prototype independent from the main app.

## Dependency Scope

Start with no framework:

- plain HTML
- Canvas 2D
- `requestAnimationFrame`
- local image asset

Do not add PixiJS for the first pass. If raw Canvas 2D feels too limited for image deformation, make that a later Pixi-specific prototype.

## Minimum Visual Target

Use a beach/sunset painting or illustration as a full-screen background.

The first version should include:

- background image loaded and drawn to cover the viewport
- animated birds crossing over the sky
- subtle water shimmer or light glints
- gentle atmospheric particles, such as mist, dust, sea spray, or drifting specks
- optional vignette or warm light pulse

This can be visually useful even if the background itself never moves.

## Background Image Handling

The image should be fit like CSS `object-fit: cover`.

Recommended helper:

```js
function drawImageCover(ctx, image, W, H) {
  const imageRatio = image.width / image.height;
  const viewRatio = W / H;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (imageRatio > viewRatio) {
    sw = image.height * viewRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / viewRatio;
    sy = (image.height - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, W, H);
}
```

## Animation Layers To Test

Start with overlays that do not require editing the background:

- bird silhouettes or small white seabirds
- water highlight strokes near the horizon
- drifting atmospheric particles
- slow cloud haze or mist bands
- occasional shooting star or sparkle event

Then optionally test image-linked motion:

- transparent palm frond overlay that sways
- foreground grass overlay that sways
- separate cloud layer that drifts
- separate water layer that shifts subtly

## Important Limitation

If the palm tree is baked into one flat background image, realistic swaying is hard.

Possible solutions:

- keep the palm static and animate birds/weather only
- use a separate transparent palm-frond overlay
- generate or paint the scene as multiple layers
- use masking or warping later
- move to PixiJS later for displacement filters or mesh deformation

Do not let this limitation block the first prototype. A static painting with good overlays may already be enough.

## Useful Implementation Shape

Start with:

```js
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const background = new Image();

const birds = [];
const particles = [];
const glints = [];

function resize() {}
function loadAssets() {}
function update(dt) {}
function draw(t) {}
function drawBackground() {}
function drawBirds() {}
function drawParticles() {}
function drawWaterGlints() {}
function loop(ts) {}
```

## Bird Strategy

Start with procedural birds:

- body as a small curved stroke or ellipse
- wings as two curved strokes
- flap with sine motion
- move along bezier or sine-based path
- vary scale, speed, altitude, and opacity

Later options:

- small sprite sheet
- transparent PNG bird overlays
- Rive/Spine bird rig

## Water Shimmer Strategy

Start with simple canvas strokes:

- short horizontal strokes near the water area
- alpha pulsing with time
- x position drifting slowly
- color sampled from warm sunset and pale blue highlights

This avoids needing to deform the actual background image.

## Success Criteria

The prototype is successful if:

- It runs as a standalone static page.
- The background image fills the viewport cleanly.
- The scene feels more emotionally rich than the procedural prototypes.
- Overlays feel integrated rather than pasted on.
- The code remains small and easy to understand.
- It suggests a clear path back into Momentarium scenes.

## What To Avoid

- No full app migration.
- No build step.
- No service worker/PWA work.
- No complex image segmentation.
- No PixiJS in the first pass.
- No elaborate asset pipeline.
- No attempt to animate every part of the painting.

## Comparison Against Procedural Prototypes

When complete, compare against:

- `prototypes/canvas-beach`
- `prototypes/pixi-beach`
- `prototypes/three-beach`

Ask:

- Which version feels most like the reference painting?
- Which one creates the most atmosphere for the least code?
- Do static backgrounds feel acceptable if overlays are alive?
- Does Momentarium need procedural generation, or does it need curated animated scenes?
- Would future scenes be easier to create as image assets plus overlay recipes?

## Possible Future Architecture

If this works, Momentarium scenes could become data-driven:

```js
{
  name: 'Tropical Evening',
  background: 'assets/beach-evening.webp',
  overlays: ['birds', 'waterGlints', 'seaMist'],
  events: ['shootingStar', 'boatLantern', 'windGust']
}
```

Each scene could use a still image as its base, then opt into reusable overlay systems.

## Follow-Up Questions For The Prototype Conversation

- Should the first image be a user-provided file, generated image, or placeholder?
- Should the background be one flat image or split into layers from the start?
- Should birds be silhouettes or detailed seabirds?
- Should the first atmosphere effect be water shimmer, mist, snow/rain, or drifting particles?
- Should the prototype include controls for toggling overlays on and off?


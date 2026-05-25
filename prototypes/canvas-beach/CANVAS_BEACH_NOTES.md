# Canvas Beach Prototype Notes

These notes are a handoff for a focused prototype conversation. The goal is to explore whether Momentarium can move toward a richer, more realistic painted beach scene while staying close to the current vanilla HTML5 canvas approach.

## Current App Context

Momentarium is currently a plain HTML/CSS/JavaScript PWA with no build step. Most of the app lives in `app.js`.

- `index.html` owns the full-screen `<canvas id="c">`, minimal page styles, and service worker registration.
- `app.js` owns the scene list, procedural drawing, particles, swipe/tap/shake controls, transitions, and render loop.
- Scenes are drawn directly with Canvas 2D through `draw(ctx, W, H, t)`.
- Animation is mostly time-based using `requestAnimationFrame`.
- Existing scene examples include procedural snow, fish, seaweed sway, bats, tree sway, stars, particles, and micro-events.

## Prototype Goal

Build the smallest useful proof of a richer beach scene using only vanilla canvas.

The prototype should answer:

> Can Momentarium get a more realistic, animated-painting feel without adopting PixiJS, Rive, Three.js, or another engine?

## Suggested Location

Create a standalone prototype:

```text
Momentarium/
|-- prototypes/
|   `-- canvas-beach/
|       |-- index.html
|       |-- app.js
|       `-- README.md
```

Keep it independent from the main app at first. Avoid shared abstractions until the experiment proves itself.

## Minimum Visual Target

Use the reference image direction: painted tropical beach at sunset.

Core layers:

- sunset sky gradient with soft cloud bands
- ocean horizon and animated water shimmer
- sandy foreground
- palm trunks and fronds
- small boat or shoreline detail
- birds crossing the sky

The prototype can use procedural canvas drawing first. If useful, add lightweight generated or hand-painted bitmap assets later.

## Animation Tests

The minimum prototype should include:

- Palm fronds swaying with layered sine/noise motion.
- Birds moving on curved paths, not straight lines.
- Birds using simple flap/glide cycles.
- Water shimmer or waves using horizontal bands.
- Optional parallax drift for clouds or foreground.

## Important Constraint

Do not try to build the final Momentarium architecture in this prototype. Keep the code small and direct. The purpose is to feel the limits of Canvas 2D.

## Useful Implementation Shape

Start with:

```js
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function resize() {}
function update(dt) {}
function draw(t) {}
function loop(ts) {}
```

Recommended drawing helpers:

- `drawSky(ctx, W, H, t)`
- `drawOcean(ctx, W, H, t)`
- `drawSand(ctx, W, H, t)`
- `drawPalm(ctx, x, baseY, scale, t, phase)`
- `drawBird(ctx, bird, t)`

Recommended simple state:

- `birds`: array with `offset`, `speed`, `scale`, `pathY`, `phase`
- `palms`: array with `x`, `baseY`, `scale`, `phase`
- `clouds` or `waveBands` if needed

## Success Criteria

The prototype is successful if:

- It runs as a standalone static HTML page.
- It looks meaningfully richer than the current procedural scenes.
- Palm sway feels organic rather than mechanical.
- Bird motion feels at least plausibly alive.
- It remains simple enough that parts could be folded back into Momentarium.
- It performs smoothly on desktop and likely mobile.

## What To Avoid

- No framework or build step for this first prototype.
- No service worker/PWA work.
- No scene navigation.
- No final UI polish.
- No large refactor of the main app.
- No complex asset pipeline yet.

## Follow-Up Questions For The Prototype Conversation

- Should the first version be purely procedural, or should it include generated bitmap assets?
- Should the visual style lean realistic painting, watercolor, oil-painting, or softly stylized?
- Should birds be silhouettes at sunset, or detailed white seabirds?
- Should the prototype eventually be compared side-by-side with the existing Momentarium scenes?


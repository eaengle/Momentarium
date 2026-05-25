# Pixi Beach Prototype Notes

These notes are a handoff for a focused prototype conversation. The goal is to explore whether PixiJS is a good next step for making Momentarium feel like a richer animated painting while staying in a 2D web world.

## Current App Context

Momentarium is currently a plain HTML/CSS/JavaScript PWA with no build step. Most of the app lives in `app.js`.

- `index.html` owns the full-screen `<canvas id="c">`, minimal page styles, and service worker registration.
- `app.js` owns the scene list, procedural drawing, particles, swipe/tap/shake controls, transitions, and render loop.
- Scenes are drawn directly with Canvas 2D through `draw(ctx, W, H, t)`.
- Animation is mostly time-based using `requestAnimationFrame`.
- Existing scene examples include procedural snow, fish, seaweed sway, bats, tree sway, stars, particles, and micro-events.

## Prototype Goal

Build the smallest useful proof of a richer beach scene using PixiJS.

The prototype should answer:

> Does PixiJS make richer 2D animation, layered composition, water effects, and sprite-based motion easier or smoother than raw Canvas 2D for Momentarium?

## Suggested Location

Create a standalone prototype:

```text
Momentarium/
|-- prototypes/
|   `-- pixi-beach/
|       |-- index.html
|       |-- app.js
|       `-- README.md
```

Keep it independent from the main app at first. Avoid shared abstractions until the experiment proves itself.

## Technology Scope

Use PixiJS as the renderer. For the first pass, it is acceptable to load Pixi from a CDN in `index.html` so the prototype stays small.

Possible setup:

```html
<script src="https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js"></script>
```

If the prototype later needs bundling, asset imports, or TypeScript, that should be treated as a separate decision.

## Minimum Visual Target

Use the same beach/sunset reference direction as the canvas prototype:

- sunset sky
- ocean horizon
- sandy foreground
- palm trees
- small boat or shoreline detail
- birds crossing the sky

The key difference from `canvas-beach` is that the scene should be structured as Pixi display objects instead of immediate-mode drawing.

## Pixi Concepts To Test

The minimum prototype should intentionally test:

- `Application` setup and resize behavior.
- Layering through `Container`.
- Static scene elements as `Graphics`, `Sprite`, or cached textures.
- Sprite or graphics-based birds.
- Ticker-based animation.
- Blend modes or alpha layers for painterly atmosphere.
- A displacement/filter-style water shimmer if feasible.
- Masking or mesh/deformation for palm fronds if feasible.

## Animation Tests

The minimum prototype should include:

- Palm fronds swaying independently.
- Birds moving on curved paths with flap/glide cycles.
- Water shimmer or wave motion that benefits from Pixi filters, sprites, or mesh.
- Gentle parallax between sky, ocean, palms, and foreground.

## Important Constraint

Do not try to rebuild all of Momentarium in PixiJS. This is a renderer and animation proof, not a full app migration.

Keep the prototype small enough that it can be deleted if PixiJS does not feel worthwhile.

## Useful Implementation Shape

Start with:

```js
const app = new PIXI.Application();
await app.init({
  resizeTo: window,
  antialias: true,
  backgroundAlpha: 1
});
document.body.appendChild(app.canvas);
```

Recommended containers:

- `skyLayer`
- `cloudLayer`
- `oceanLayer`
- `palmLayer`
- `birdLayer`
- `foregroundLayer`
- `effectLayer`

Recommended helpers:

- `createSky(app)`
- `createOcean(app)`
- `createPalm(x, y, scale, phase)`
- `createBird(seed)`
- `updateBird(bird, t, dt)`
- `resizeScene()`

## Asset Strategy

Start with Pixi `Graphics` or generated canvas textures so the prototype has no asset dependency.

If the first pass feels promising, add one or two bitmap assets:

- painted palm frond texture
- bird wing sprite or small sprite sheet
- water/noise displacement texture

Do not build a full asset pipeline yet.

## Success Criteria

The prototype is successful if:

- It runs as a standalone page.
- Pixi setup feels understandable and not too heavy.
- Layering and animation are easier to reason about than raw Canvas 2D.
- Water, birds, or palm animation clearly benefit from Pixi.
- Performance feels smooth.
- The code suggests a path for a future Momentarium renderer layer.

## What To Avoid

- No full Momentarium migration.
- No service worker/PWA work.
- No scene navigation unless needed for the test.
- No React/Vue/Svelte wrapper for this prototype.
- No complex bundler unless a CDN-only setup becomes a blocker.
- No large asset pipeline.

## Comparison Against Canvas Beach

When this prototype is complete, compare it directly against `canvas-beach`:

- Which version looks better with the same amount of work?
- Which code is easier to modify?
- Which one handles layered animation more cleanly?
- Which one performs better?
- Which one seems easier to fold back into Momentarium?

## Follow-Up Questions For The Prototype Conversation

- Should PixiJS be loaded by CDN or installed with a build step?
- Should the prototype use only Pixi `Graphics`, or should it test image sprites immediately?
- Should water shimmer use a displacement filter, mesh, or animated texture bands?
- Should birds be plain sprites, generated textures, or a small sprite sheet?


# Image Layer Refactor Notes

These notes are a handoff for a future conversation focused on refactoring Momentarium toward the static-image-plus-animation direction.

The goal of that conversation should be structural only:

> Move the current procedural implementation under `prototypes/`, then replace the main app with a small image-layer scene framework that can host Tiny Cabin, Beach, and Aquarium scenes.

Do not try to finish the scene art or animation quality in the refactor conversation. Scene design should happen separately after the framework exists.

## Direction

Momentarium should move away from fully procedural scenes and toward animated paintings:

```text
static or lightly layered background image
+ reusable procedural overlays
+ optional scene-specific sprite/particle effects
+ occasional micro-events
```

This should make it easier to create rich, emotionally strong scenes from artwork while keeping the codebase small.

## Current App Context

The existing app is a plain HTML/CSS/JavaScript PWA.

- `index.html` owns the full-screen canvas and service worker registration.
- `app.js` contains the current procedural scenes, particles, controls, transitions, and render loop.
- `manifest.json`, `sw.js`, and `icon.svg` support the PWA shell.
- Existing procedural scenes include Tiny Cabin, Moon City, Aquarium, Haunted Forest, Desert Night, and Mini Office.
- Prototype folders already exist under `prototypes/`.

## Main Refactor Goal

The next conversation should:

1. Preserve the current procedural app by moving it under `prototypes/`.
2. Replace the root app with a new image-layer framework.
3. Set up only three initial root scenes:
   - Tiny Cabin
   - Beach
   - Aquarium
4. Stub the scene backgrounds and overlays cleanly.
5. Keep the app runnable as a static site with no build step.

## Suggested File Movement

Move the current implementation into:

```text
Momentarium/
|-- prototypes/
|   `-- procedural-momentarium/
|       |-- index.html
|       |-- app.js
|       |-- manifest.json
|       |-- sw.js
|       `-- icon.svg
```

Then create the new root app:

```text
Momentarium/
|-- index.html
|-- app.js
|-- manifest.json
|-- sw.js
|-- icon.svg
|-- assets/
|   `-- scenes/
|       |-- tiny-cabin/
|       |   `-- background-placeholder.svg
|       |-- beach/
|       |   `-- background-placeholder.svg
|       `-- aquarium/
|           `-- background-placeholder.svg
|-- prototypes/
|   |-- procedural-momentarium/
|   |-- canvas-beach/
|   |-- pixi-beach/
|   |-- three-beach/
|   `-- image-layer-beach/
```

If `prototypes/image-layer-beach/` does not exist yet, do not block on it. The main framework is the priority.

## Root App Framework Shape

Keep the root app vanilla:

- no npm
- no build step
- no framework
- no PixiJS yet
- Canvas 2D only

Recommended main concepts:

```js
const SCENES = [
  {
    id: 'tiny-cabin',
    name: 'Tiny Cabin',
    background: 'assets/scenes/tiny-cabin/background-placeholder.svg',
    overlays: ['snow', 'windowGlow', 'smoke']
  },
  {
    id: 'beach',
    name: 'Beach',
    background: 'assets/scenes/beach/background-placeholder.svg',
    overlays: ['birds', 'waterGlints', 'seaMist']
  },
  {
    id: 'aquarium',
    name: 'Aquarium',
    background: 'assets/scenes/aquarium/background-placeholder.svg',
    overlays: ['bubbles', 'lightRays', 'fishSilhouettes']
  }
];
```

The exact overlay names can change, but the framework should support this idea.

## Minimum Framework Responsibilities

Implement only enough to prove the structure:

- Full-screen canvas.
- Responsive resize with DPR scaling.
- Preload scene background images.
- Draw active scene background using object-fit cover logic.
- Draw simple overlay systems on top.
- Swipe left/right to change scenes.
- Dot navigation at the bottom.
- Fade transition between scenes.
- Tap interaction that lightly stirs overlays.
- Keep the existing PWA shell working.

## Background Drawing

The app should include an `object-fit: cover` style helper:

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

This should be part of the new root app.

## Placeholder Scene Art

Use simple placeholder SVG files or minimal generated canvas placeholders for now.

The refactor should not depend on final art assets.

Placeholder art only needs to communicate:

- Tiny Cabin: snowy cabin mood.
- Beach: sunset ocean mood.
- Aquarium: underwater mood.

These placeholders can be replaced later.

## Overlay Systems To Stub

Create small reusable overlay systems with basic behavior. Do not make them perfect.

Suggested overlays:

- `snow`: falling white particles for Tiny Cabin.
- `smoke`: soft drifting puffs for Tiny Cabin.
- `birds`: simple flying bird shapes for Beach.
- `waterGlints`: short horizontal shimmer strokes for Beach.
- `seaMist`: faint drifting translucent particles for Beach.
- `bubbles`: rising circles for Aquarium.
- `lightRays`: subtle moving translucent beams for Aquarium.
- `fishSilhouettes`: very simple drifting fish shapes for Aquarium.

The point is to prove the framework can attach overlays to image-backed scenes.

## Suggested Code Organization

Since this is still a tiny app, one `app.js` is acceptable, but organize it clearly:

```text
constants/config
asset loading
scene definitions
image cover drawing helper
overlay classes/functions
UI drawing
Momentarium app class
bootstrap
```

If splitting files feels cleaner, keep it minimal:

```text
app.js
scenes.js
overlays.js
```

Do not introduce modules unless the browser/no-build setup remains easy.

## Things To Preserve From Current App

Preserve the spirit and basic UX:

- full-screen immersive canvas
- swipe to change scenes
- dot navigation
- tap to stir/trigger light movement
- shake support can be deferred unless easy
- scene title overlay
- offline/PWA behavior

The exact procedural scene details do not need to be ported.

## Things To Avoid In The Refactor Conversation

- Do not perfect Tiny Cabin, Beach, or Aquarium.
- Do not create final artwork.
- Do not add PixiJS or Three.js.
- Do not add npm/Vite/React/etc.
- Do not port every old scene.
- Do not preserve every old event.
- Do not over-design a full plugin system.
- Do not spend time on realistic palm/tree deformation yet.

## Acceptance Criteria

The refactor is successful when:

- The old app is available under `prototypes/procedural-momentarium/`.
- The root `index.html` loads the new image-layer app.
- Tiny Cabin, Beach, and Aquarium can be switched between.
- Each scene draws a background placeholder image.
- Each scene has at least one simple animated overlay.
- The app still runs by opening `index.html` or serving the folder.
- The PWA files are still present and reasonable.
- The code leaves obvious places to improve each scene later.

## Follow-Up Scene Work

After the refactor, future conversations can focus separately on:

- Tiny Cabin final background and snow/smoke/window effects.
- Beach final background, birds, glints, and mist.
- Aquarium final background, fish, bubbles, and light rays.
- Optional layered assets for parallax.
- Optional PixiJS experiment for image deformation if Canvas 2D becomes limiting.


# Momentarium

Momentarium is a full-screen ambient canvas app for mobile. Each scene is an animated painting: a static or lightly layered background image with reusable procedural overlays on top.

## Scenes

### Tiny Cabin
A snowy night cabin under an aurora sky. Overlays: falling snow, chimney smoke.

### Beach
A sunset ocean view. Overlays: soaring birds, water-surface glints, drifting sea mist.

### Aquarium
An underwater scene. Overlays: rising bubbles, shifting light rays, drifting fish silhouettes.

## Controls

- Swipe left or right to change scenes.
- Tap the canvas to stir the active overlays.
- Arrow keys (left / right) also change scenes on desktop.

## Running Locally

No build step. Open `index.html` directly, or serve the folder for service worker support:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project Structure

```text
.
|-- index.html          # App shell, canvas, service worker registration
|-- app.js              # Image-layer framework, overlay systems, render loop
|-- manifest.json       # PWA metadata
|-- sw.js               # Offline cache service worker (v3)
|-- icon.svg            # App icon
|-- assets/
|   `-- scenes/
|       |-- tiny-cabin/
|       |   `-- background-placeholder.svg
|       |-- beach/
|       |   `-- background-placeholder.svg
|       `-- aquarium/
|           `-- background-placeholder.svg
`-- prototypes/
    |-- procedural-momentarium/   # Original six-scene procedural app
    |-- canvas-beach/
    |-- pixi-beach/
    |-- three-beach/
    `-- image-layer-beach/
```

## Adding a Scene

1. Add an entry to the `SCENES` array in `app.js` with an `id`, `name`, `background` path, and `overlays` list.
2. Drop a background image into `assets/scenes/<id>/`.
3. Add any new overlay names to `OVERLAY_REGISTRY` in `app.js`.

## Adding an Overlay

Create a class with `init(W, H)`, `update(dt, t)`, and `draw(ctx, W, H, t)` methods. Optionally add `stir(strength)` if the overlay should react to taps. Register it in `OVERLAY_REGISTRY`.

## PWA Notes

The service worker uses a network-first strategy and falls back to cached files when offline. When adding new assets, list them in the `ASSETS` array in `sw.js` and bump the `CACHE` version string.

# Momentarium

Momentarium is a full-screen ambient canvas PWA for mobile. Each scene is an animated painting: an orientation-aware background image with procedural overlays on top. Swipe to change scenes; tap to stir them.

## Scenes

### Tiny Cabin
A snowy night cabin under an aurora sky. Dual portrait/landscape background images with orientation-aware rendering.

**Overlays:** stars twinkle, aurora shimmer, window glow, falling snow, chimney smoke, timed micro-events.

**Micro-events** fire automatically every 10–18 seconds (weighted toward long-idle events):

| Event | Duration | Description |
|---|---|---|
| `deer` | 11 s | Two-frame walking sprite crosses the snow, pauses mid-journey with breath puffs |
| `owl` | 14 s | Swoops down from tree, perches with glowing amber eyes, departs using the swoop sprite |
| `rabbit` | 9 s | Hops across the snow using hop/still sprites; pauses on the ground between hops |
| `fox` | 7.5 s | Procedural rust-and-cream fox trots across with animated leg gait |
| `shootingStar` | 1.8 s | Arcing gradient tail across the sky |
| `pondCrack` | 2.6 s | Ice crack appears and fades on the frozen pond |
| `snowSlip` | 3.2 s | Snow clump slides off the roof and splatters |
| `branchDrop` | 2.8 s | Snow particles fall from a tree branch |
| `windowShadow` | 5.0 s | Silhouette passes behind a lit window |
| `chimneySpark` | 2.2 s | HSL-colored sparks burst from the chimney (screen blend) |
| `smokeBurst` | 5.0 s | Heavy smoke surge from the chimney |

### Beach
A sunset ocean view. *(Background placeholder — overlays functional.)*

**Overlays:** soaring birds, water-surface glints, drifting sea mist.

### Aquarium
An underwater scene. *(Background placeholder — overlays functional.)*

**Overlays:** rising bubbles, shifting light rays, drifting fish silhouettes.

## Controls

| Input | Action |
|---|---|
| Swipe left / right | Change scene (≥ 45 px, more horizontal than vertical) |
| Tap | Stir active overlays |
| Arrow keys | Change scene (desktop) |
| Shake (mobile) | Force-kick all overlays; escalate snow storm |
| `[` / `]` keys | Cycle through Tiny Cabin event names (debug) |
| `Enter` key | Fire the selected event immediately (debug) |
| `S` key | Simulate a device shake (debug) |
| `?debug` URL param | Click-to-measure paint-space coordinates (debug) |

## Running Locally

No build step. Open `index.html` directly, or serve the folder for service worker support:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project Structure

```text
.
├── index.html              # App shell, canvas, service worker registration
├── app.js                  # All scenes, overlays, events, render loop
├── manifest.json           # PWA metadata
├── sw.js                   # Offline cache service worker (v3)
├── icon.svg                # App icon
└── assets/
    └── scenes/
        ├── tiny-cabin/
        │   ├── background-portrait.png     # 941×1672 primary
        │   ├── background-landscape.png    # 1672×941 primary
        │   ├── background-placeholder.svg
        │   ├── window-shadow.png           # Window silhouette sprite
        │   ├── deer/
        │   │   ├── walk-0.png
        │   │   └── walk-1.png
        │   ├── owl/
        │   │   └── swoop.png               # Departure flight sprite
        │   └── rabbit/
        │       ├── hop.png                 # Airborne frame
        │       └── still.png              # Landed frame
        ├── beach/
        │   └── background-placeholder.svg
        └── aquarium/
            └── background-placeholder.svg
```

## Overlay Interface

Each overlay is a class with:

```javascript
init(W, H, img)       // called once at startup and on resize; img is the background image
update(dt, t)         // called every frame before draw; dt = delta seconds
draw(ctx, W, H, t)    // render to canvas
stir(strength)        // optional: accumulate continuous force (tap, shake)
kick(strength)        // optional: one-shot impulse
```

Register overlays in `OVERLAY_REGISTRY` in `app.js`:

```javascript
OVERLAY_REGISTRY['myOverlay'] = (W, H, img) => {
  const o = new MyOverlay();
  o.init(W, H, img);
  return o;
};
```

Then add `'myOverlay'` to the `overlays` array of any scene in `SCENES`.

## Paint-Space Coordinates

Background images are rendered with cover-crop, so canvas pixels don't map 1:1 to image pixels. Use the two helpers in `app.js` to anchor overlays to specific background features:

```javascript
paintToCanvas(px, py, img, W, H)  // image pixel → canvas coordinate
canvasToPaint(cx, cy, img, W, H)  // canvas coordinate → image pixel (reverse)
```

Enable `?debug` in the URL to click anywhere on the canvas and log the corresponding paint-space coordinates.

## Adding a Scene

1. Add an entry to `SCENES` in `app.js` with `id`, `name`, `background`, and `overlays`.
2. Drop a background image into `assets/scenes/<id>/`.
3. List the image in the `ASSETS` array in `sw.js` and bump the `CACHE` version string.

## Adding a Micro-Event (Tiny Cabin)

1. Add the event name to `EV_NAMES_CABIN`.
2. Add a drawing branch in `CabinEventsOverlay.draw()` keyed on `ev.active === 'yourEvent'`.
3. Set `ev.active = null` when `et > dur` to end the event.

If the event needs a sprite, follow the deer/owl/rabbit pattern: add a preload function, call it in the startup `Promise.all`, and reference the loaded image in your draw branch.

## PWA / Service Worker

The service worker (`sw.js`, cache `momentarium-v3`) uses a network-first strategy with offline fallback. The `ASSETS` array currently caches SVG placeholders only — add PNG backgrounds and sprite paths when offline support for those assets is needed.

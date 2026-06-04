# Momentarium

Momentarium is a full-screen ambient canvas PWA for mobile. Each scene is an animated painting: an orientation-aware background image with procedural overlays on top. Swipe to change scenes; tap to stir them.

## Scenes

### Tiny Cabin
A snowy night cabin under an aurora sky. Dual portrait/landscape background images with orientation-aware rendering.

**Overlays:** stars twinkle, aurora shimmer, window glow, falling snow, chimney smoke, timed micro-events.

**Micro-events** fire automatically every 10–18 seconds (weighted toward long-idle events):

| Event | Duration | Description |
|---|---|---|
| `deer` | 11 s | Multi-frame walking sprite crosses the snow, pauses mid-journey with breath puffs |
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

### Tech Ruin
An overgrown tech ruin with rain and bioluminescence. Dual portrait/landscape backgrounds (different compositions; anchors measured separately).

**Ambient effects** (always active): god rays, floating spores, fireflies, fog patches, ambient rain drizzle.

**Micro-events** fire on self-timed intervals:

| Event | Description |
|---|---|
| `server_glitch` | Server racks flicker and glitch |
| `glow_surge` | Server glow surges bright |
| `cable_spark` | Sparks arc along a hanging cable |
| `power_arc` | Lightning arc between anchor points |
| `data_drift` | Glowing data particles drift upward |
| `monitor_static` | Laptop screen shows static |
| `screen_message` | Text message scrolls on laptop screen |
| `scanner_sweep` | Green scan line sweeps across the server |
| `spore_cloud` | Dense bioluminescent spore burst |
| `eyes_appear` | Glowing eyes appear in the dark cavity |
| `firefly_surge` | Surge of extra fireflies for 20 s |
| `bird_fly` | Bird silhouette flaps across the scene |
| `leaf_gust` | Gust scatters sprite leaves |
| `falling_leaf` | Single leaf tumbles down |
| `rain_drips` | Rain intensity pulse |
| `creature_scurry` | Small creature darts across the ground |
| `sunbeam_shift` | God-ray shafts sweep position |
| `night_shift` | Scene dims with a dark overlay; glowing effects remain bright |

### Space Church
A vast sci-fi cathedral interior. Dual portrait/landscape backgrounds.

**Ambient effects** (always active): cathedral dimming vignette, back-window starfield, god-ray spotlight beams, plasma ball with morphing tendrils, hologram pillars (glow + animated image + particles), floor energy pulse lines, ground fog.

**Micro-events** fire on self-timed intervals:

| Event | Description |
|---|---|
| `hologram_glitch` | Hologram pillars glitch and distort |
| `floor_convergence` | Energy lines converge to center in a pulse |
| `arch_arc` | Lightning arc spans the arch above |
| `portal_surge` | Shimmering portal energy surge in the arch |
| `plasma_eruption` | Plasma ball erupts outward |
| `cathedral_dimming` | Lights dim and slowly recover |
| `rune_flash` | Glowing rune symbols flash across the floor |
| `robot_procession` | Security robot walks across the floor, passing behind pillars |
| `float_robot` | Floating robot descends, drifts, and departs |
| `pulsar_ripple` | Expanding ring pulse from the floor center |
| `god_beams` | God-ray beams intensify briefly |

## Controls

| Input | Action |
|---|---|
| Swipe left / right | Change scene (≥ 45 px, more horizontal than vertical) |
| Tap | Stir active overlays |
| Arrow keys | Change scene (desktop) |
| Shake (mobile) | Force-kick all overlays; escalate snow storm |
| `[` / `]` keys | Cycle through the active scene's event names (debug) |
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
├── app.js                  # SCENES array, OVERLAY_REGISTRY, MomentariumApp, bootstrap
├── core.js                 # Shared utilities: TAU, rand, clamp, CFG, loadImage,
│                           #   drawImageCover, paintToCanvas, canvasToPaint, _coverParams
├── manifest.json           # PWA metadata
├── sw.js                   # Offline cache service worker (v4)
├── icon.svg                # App icon
├── scenes/
│   ├── tiny-cabin/
│   │   └── scene.js        # SnowOverlay, SmokeOverlay, CabinEventsOverlay, Aurora,
│   │                       #   WindowGlow, StarsTwinkle, preloadTinyCabinAssets
│   ├── beach/
│   │   └── scene.js        # BirdsOverlay, WaterGlintsOverlay, SeaMistOverlay
│   ├── aquarium/
│   │   └── scene.js        # BubblesOverlay, LightRaysOverlay, FishSilhouettesOverlay
│   ├── tech-ruin/
│   │   └── scene.js        # TechRuinOverlay, preloadTechRuinSprites, TR_ANCHORS
│   └── space-church/
│       └── scene.js        # SpaceChurchOverlay, preloadSpaceChurchSprites, SC_ANCHORS
└── assets/
    └── scenes/
        ├── tiny-cabin/
        │   ├── background-portrait.png     # 941×1672
        │   ├── background-landscape.png    # 1672×941
        │   ├── window-shadow.png
        │   ├── deer/
        │   │   ├── walk-0.png … walk-10.png
        │   │   └── pause.png
        │   ├── owl/
        │   │   └── swoop.png
        │   └── rabbit/
        │       ├── hop.png
        │       └── still.png
        ├── beach/
        │   └── background-placeholder.svg
        ├── aquarium/
        │   └── background-placeholder.svg
        ├── tech-ruin/
        │   ├── background-portrait.png     # 941×1672
        │   ├── background-landscape.png    # 1672×941
        │   └── sprites/
        │       └── leaf_01.png … leaf_10.png
        └── space-church/
            ├── background-portrait.png     # 941×1672
            ├── background-landscape.png    # 1672×941
            └── sprites/
                ├── abstract_holo_01.png … abstract_holo_10.png
                ├── alien_holo_01.png … alien_holo_10.png
                ├── angel_holo_01.png … angel_holo_10.png
                ├── priest_holo_01.png … priest_holo_10.png
                ├── soldier_holo_01.png … soldier_holo_10.png
                ├── sword_holo_01.png … sword_holo_10.png
                ├── robot_side.png, robot_front.png,
                │   robot_turn_left.png, robot_turn_right.png
                └── float_robot_descent.png, float_robot_side.png,
                    float_robot_look.png
```

## Architecture

The app uses native ES modules — no build step. `app.js` imports from `core.js` and from each scene's `scene.js`. All scene-specific classes and preloaders live in their own module; `app.js` only contains the wiring.

## Overlay Interface

Each overlay is a class with:

```javascript
init(W, H, img)       // called once at startup and on resize; img is the background image
update(dt, t)         // called every frame before draw; dt = ms since last frame (~16 ms at 60 fps), t = seconds since app start
draw(ctx, W, H, t)    // render to canvas; t = seconds since app start
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

Background images are rendered with cover-crop, so canvas pixels don't map 1:1 to image pixels. Use the two helpers in `core.js` to anchor overlays to specific background features:

```javascript
paintToCanvas(px, py, img, W, H)  // image pixel → canvas coordinate
canvasToPaint(cx, cy, img, W, H)  // canvas coordinate → image pixel (reverse)
```

Enable `?debug` in the URL to click anywhere on the canvas and log the corresponding paint-space coordinates.

## Adding a Scene

1. Create `scenes/<id>/scene.js` with your overlay classes and a named export for each.
2. Add `import` statements for your classes at the top of `app.js`.
3. Add an entry to `SCENES` in `app.js` with `id`, `name`, `background`, and `overlays`.
4. Register your overlay classes in `OVERLAY_REGISTRY` in `app.js`.
5. Drop background images into `assets/scenes/<id>/`.
6. Add the image paths to the `ASSETS` array in `sw.js` and bump the `CACHE` version string.

## Adding a Micro-Event (Tiny Cabin)

1. Add the event name to `EV_NAMES_CABIN` in `scenes/tiny-cabin/scene.js`.
2. Add a drawing branch in `CabinEventsOverlay.draw()` keyed on `ev.active === 'yourEvent'`.
3. Set `ev.active = null` when `et > dur` to end the event.

If the event needs a sprite, follow the deer/owl/rabbit pattern: add a preload function, call it in the startup `Promise.all`, and reference the loaded image in your draw branch.

## PWA / Service Worker

The service worker (`sw.js`, cache `momentarium-v4`) uses a network-first strategy with offline fallback. Add PNG backgrounds and sprite paths to the `ASSETS` array when offline support for those assets is needed.

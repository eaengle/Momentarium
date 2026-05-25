# Momentarium

Momentarium is a tiny procedural world viewer: a full-screen canvas app with six animated scenes, ambient particles, touch controls, and offline support as a Progressive Web App.

## Scenes

### Tiny Cabin

A snowy cabin scene with an aurora sky, mountain silhouettes, pine trees, warm window light, chimney smoke, a frozen pond, snowdrifts, brush, reeds, and falling snow.

Tiny Cabin has the richest event system. Timed micro-events are selected automatically with recovery weighting so recently played events become less likely for a while:

- `deer` - a deer crosses the snow and pauses briefly.
- `owl` - an owl swoops down into the tree line, perches with a different look, then flies away with separate flight graphics.
- `rabbit` - a rabbit hops across the foreground.
- `fox` - a fox trots across the snow.
- `shootingStar` - a bright streak crosses the upper sky.
- `pondCrack` - a glowing crack spreads across the frozen pond.
- `snowSlip` - a clump of roof snow slides down and falls.
- `branchDrop` - snow drops from a pine branch.
- `windowShadow` - a soft silhouette passes across one lit cabin window.
- `chimneySpark` - a few tiny warm sparks pop from the chimney and fade into the smoke.
- `smokeBurst` - the chimney releases a thicker burst of smoke.

While developing, press `[` or `]` to move through the active scene's event list, then press `Enter` to trigger the selected event. The selected event is logged in the browser console. Scene event lists live in `SCENE_EVENTS`, so adding more scenes with events does not require adding one shortcut per event.

### Moon City

A night skyline under a crescent moon. Tall buildings fill the horizon with deterministic window patterns, blinking rooftop beacons, a dark road, and a faint moon reflection on the pavement.

Events: no scene-specific timed events. It uses the shared star particles and responds to the global tap, shake, swipe, and dot navigation interactions.

### Aquarium

An underwater scene with a blue depth gradient, drifting light rays, sand, coral branches, swaying seaweed, bubbles, and five looping fish paths in different colors and sizes.

Events: no scene-specific timed events. Bubbles are stirred by the shared tap and shake interactions.

### Haunted Forest

A moonlit forest with bare procedural trees, gravestones, purple fog, ember particles, and animated bats moving through the sky.

Events: no scene-specific timed events. The bats and trees animate continuously, while the ember layer responds to global tap and shake turbulence.

### Desert Night

A quiet desert scene with a crescent moon, star field, Milky Way band, layered dunes, saguaro cacti, and windblown sand particles.

Events: no scene-specific timed events. The sand particles respond to the shared tap and shake interactions.

### Mini Office

A compact city office tower at night with background buildings, glowing windows, a moving elevator-lit window, a blinking antenna, street lamps, and star particles.

Events: no scene-specific timed events. Window lights and the elevator effect animate continuously, and the scene supports the shared global interactions.

## Controls

- Swipe left or right to change scenes.
- Tap a dot near the bottom of the screen to jump to a scene.
- Tap the canvas to stir the particles.
- Shake a supported mobile device to trigger a stronger storm effect.
- Press `S` on a keyboard to simulate a shake while developing.

In the Tiny Cabin scene, number keys `1` through `0` trigger debug micro-events such as wildlife, shooting stars, and cabin effects.

## Running Locally

This project is plain HTML, CSS, and JavaScript. There is no build step.

Open `index.html` directly in a browser, or serve the folder locally if you want service worker behavior:

```powershell
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Project Structure

```text
.
|-- index.html      # App shell, styles, canvas, and service worker registration
|-- app.js          # Procedural scenes, particles, controls, rendering loop
|-- manifest.json   # PWA metadata
|-- sw.js           # Offline cache service worker
`-- icon.svg        # App icon
```

## PWA Notes

Momentarium includes a web app manifest and a service worker. The service worker uses a network-first strategy and falls back to cached files when offline.

When changing cached assets, update the cache name in `sw.js` so browsers pick up the new version reliably.

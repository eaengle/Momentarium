# Momentarium

Momentarium is a tiny procedural world viewer: a full-screen canvas app with six animated scenes, ambient particles, touch controls, and offline support as a Progressive Web App.

## Scenes

- Tiny Cabin
- Moon City
- Aquarium
- Haunted Forest
- Desert Night
- Mini Office

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
├── index.html      # App shell, styles, canvas, and service worker registration
├── app.js          # Procedural scenes, particles, controls, rendering loop
├── manifest.json   # PWA metadata
├── sw.js           # Offline cache service worker
└── icon.svg        # App icon
```

## PWA Notes

Momentarium includes a web app manifest and a service worker. The service worker uses a network-first strategy and falls back to cached files when offline.

When changing cached assets, update the cache name in `sw.js` so browsers pick up the new version reliably.


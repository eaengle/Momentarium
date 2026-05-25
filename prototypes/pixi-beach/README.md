# pixi-beach

Standalone PixiJS v8 prototype. Open `index.html` in a browser — no build step required.

## What this tests

- `PIXI.Application` setup with `resizeTo: window` and `autoDensity`
- Layer compositing via `Container` (10 depth layers)
- Sky, sun, ocean, sand, and vignette as canvas-generated gradient textures (`PIXI.Texture.from(canvas)`)
- `Graphics` redrawn per-frame for animated wave crests, shimmer flecks, palm fronds, and birds
- `blendMode: 'add'` on sun glow layers and water reflection for bloom-like glow
- Ticker-based animation with `ticker.lastTime`
- Gentle parallax between depth layers
- Resize rebuild via `app.renderer.on('resize', build)`

## Visual elements

| Element | Technique |
|---|---|
| Sunset sky | Gradient canvas → Sprite |
| Stars | Graphics circles, alpha-tweened each frame |
| Sun + glow | Stacked `add`-blended Graphics circles |
| Sun water reflection | Gradient canvas Sprite with `add` blend |
| Boat silhouette | Graphics polygon at horizon |
| Ocean | Gradient canvas + per-frame wave Graphics |
| Water shimmer | Reseeded random fleck strokes each frame |
| Beach sand | Gradient canvas Sprite |
| Palm trees × 4 | Graphics trunk + 9 bezier fronds redrawn per frame |
| Frond veins | Tiny stroke branches on each frond |
| Birds × 10 | Quadratic-curve wings redrawn per frame |
| Vignette | Radial gradient canvas Sprite |

## Comparison notes (fill in after evaluating)

- **Looks better?** — compare vs `canvas-beach` with same dev time
- **Code easier to modify?** — layered Containers vs immediate-mode draw calls
- **Layered animation?** — each Container is independently transformable
- **Performance?** — check on mobile; Graphics-heavy per-frame redraw is the likely bottleneck
- **Path back to Momentarium?** — swap `draw(ctx, W, H, t)` for a Pixi stage + ticker

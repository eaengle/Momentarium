# canvas-beach prototype

Standalone proof-of-concept: richer procedural beach scene using only vanilla Canvas 2D.

## Run

Open `index.html` directly in a browser — no build step, no server required.

## What it draws

| Layer | Technique |
|---|---|
| Sunset sky | 5-stop linear gradient + radial sun bloom |
| Cloud wisps | 3-pass soft radial ellipses, no filter |
| Ocean | Gradient base + 16 additive shimmer bands |
| Sun reflection | Tapered trapezoid with animated shimmer |
| Boat | Quadratic bezier hull + sail, bobbing on sine |
| Shore foam | Sine-wave edge strip |
| Sand | Mounded quadratic bezier + ripple strokes |
| Palms | Curved trunk (quadratic bezier) + 8 drooping fronds + leaflets |
| Birds | Curved path flight + flap/glide cycle |

## Animation notes

- Palm sway uses two-frequency layered sine (`noise()`) so it never looks mechanical.
- Bird wings use a `glide` term that periodically flattens the flap — the result is flap → glide → flap.
- Water shimmer bands use `globalCompositeOperation: 'lighter'` for additive glow without extra draw passes.
- All motion is `t`-based (seconds since start), not delta-time — safe for any frame rate.

## Answers to prototype questions

- **Purely procedural?** Yes — no bitmap assets.
- **Style?** Softly stylized sunset; painterly feel from rich gradients and layered alpha blending.
- **Birds?** Dark silhouettes against the sunset sky.
- **Side-by-side with main app?** Not yet — keep independent until folding back in.

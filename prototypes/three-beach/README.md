# Three.js Beach Prototype

Standalone proof-of-concept for a 3D tropical beach scene using Three.js.

## Running

Open `index.html` directly in a browser that supports ES modules — or serve
the folder with any static server:

```sh
npx serve .
# or
python -m http.server
```

No build step. Loads Three.js 0.165.0 from jsDelivr CDN via import map.

## What's in the scene

- Gradient sky sphere (violet zenith → hot orange horizon)
- Directional sun light + ambient + rim light from water
- Exponential fog tied to the sunset palette
- Sand plane with subtle geometric undulation
- Ocean plane with per-vertex sine-wave displacement each frame
- Four palm trees: tapered trunk segments + 8 drooping fronds per crown
- Five birds: body + two wings, each flying a unique CatmullRom loop, with flap animation and flight-path banking
- Slow camera drift for parallax depth

## What this tests (from the notes)

| Concept | Implementation |
|---|---|
| Scene / Camera / Renderer | Three.js core |
| Responsive resize | window resize handler |
| Fog / atmosphere | FogExp2 + gradient sky sphere |
| Ocean vertex motion | PlaneGeometry vertex displacement each frame |
| Palm sway | frondGroup rotation + per-frond rustle |
| Bird flight in 3D | CatmullRomCurve3 + wing flap |
| Camera composition | PerspectiveCamera FOV 55 + slow drift |

## What to evaluate

- Is the depth meaningfully better than the 2D canvas beach?
- Do palm and bird animations feel more spatially convincing?
- Is code complexity acceptable for Momentarium's no-build style?
- Is frame rate smooth on mobile?
- Does it feel like Momentarium, or like a different kind of app?

## Possible next steps

1. Replace vertex-displacement ocean with a custom ShaderMaterial + time uniform
2. Add reflections or specular highlights to the water
3. Try a glTF palm model for comparison
4. Add glTF bird model with Blender animation clips
5. Try instanced palms for a denser forest edge
6. Add a sun disc / lens flare in the sky

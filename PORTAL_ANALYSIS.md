# Portal Shader Analysis — Unreal Engine Tutorial → Three.js

## Video Structure

| Frame Range | Content |
|-------------|---------|
| 1           | **Teaser** — Final purple portal result shown upfront |
| 2–20        | Material graph opened, single Texture Sample placed |
| 20–40       | `VertexCoordinateTransformation` + `Radial Coordinates` node added |
| 40–90       | `Panner` node added (animated rotation via time) |
| 90–130      | Second parallel chain (Panner + TextureSample) added |
| 130–155     | `Blend_Screen` combines both noise chains |
| 155–180     | First `RadialGradientExponential` added (inner hole) |
| 180–260     | Second `RadialGradientExponential` added + `Subtract` node wired |
| 260–280     | `Constant3Vector` (color) and material output connected |
| 280–295     | Color set to BLUE initially, material compiled |
| 295–315     | Portal applied to a flat Plane mesh in viewport (blue version) |
| 315–317     | Color changed to PURPLE/VIOLET — final result |

---

## Intermediate Results (preview progression)

1. **Frame ~20** — Black circle on grey plane (plain portal texture, no coordinates)
2. **Frame ~47** — Grey sphere with spiral pattern (Radial Coordinates hooked up)
3. **Frame ~75** — Animated swirling spiral (Panner added — rotation starts)
4. **Frame ~130** — Two overlapping spiral noise layers visible
5. **Frame ~150** — Screen-blended dual noise (bright swirling combined texture)
6. **Frame ~175** — White solid sphere (RadialGradientExponential = just a circle)
7. **Frame ~220** — White jagged circle edge on black (Subtract creates ring)
8. **Frame ~260** — Ring with opacity, white flame edges
9. **Frame ~283** — Blue flame ring (color applied, still blue)
10. **Frame ~315** — Blue portal applied to plane in viewport

---

## Complete Material Graph

### Material Settings
- **Blend Mode:** Translucent
- **Shading Model:** Unlit
- **Applied to:** Flat Plane mesh (billboard)

### Node Graph (left → right)

```
LAYER 1 (forward spin):
  TextureCoordinate
    → [VertexCoordTransform / RadialCoordinates function]
        outputs: angle UV, radius, linear distance
    → Panner(SpeedX: +0.1, SpeedY: 0)
    → TextureSample(T_Noise / cloud texture) [R channel]
    → noise1

LAYER 2 (backward spin):
  TextureCoordinate
    → [RadialCoordinates function] (same)
    → Panner(SpeedX: -0.1, SpeedY: 0)   ← opposite direction
    → TextureSample(same texture) [R channel]
    → noise2

BLEND:
  Blend_Screen(noise1, noise2) → blendedNoise

PORTAL RING:
  RadialGradientExponential(
    CentroidUVs: 0.5, 0.5
    Radius: ~0.40
    Density: ~200       ← high density = sharp edge
    Invert: false
  ) → innerGrad

  Subtract(blendedNoise, innerGrad) → clamp(0,1) → portalEdge
    (innerGrad = 1.0 at center → subtracts noise → black hole)
    (innerGrad ≈ 0.0 at edges → noise remains → flame edges)

OUTER CIRCLE CLIP:
  RadialGradientExponential(
    CentroidUVs: 0.5, 0.5
    Radius: ~0.50
    Density: ~200
    Invert: false
  ) → outerGrad   (clips everything outside the circle)

COLOR:
  Constant3Vector (purple: ~0.5, 0.0, 1.0) → color

OUTPUTS:
  Emissive Color = color × portalEdge
  Opacity        = portalEdge × outerGrad
```

### Key Radial Coordinate Trick
The UVs are converted to **(angle, radius)** space before the Panner.
Panning in the **angle** axis causes the texture to **rotate** rather than slide.
Two opposite-speed panners create counter-rotating noise → when Screen-blended,
they create a complex swirling pattern.

---

## Three.js Recreation Plan

### Approach
- `PlaneGeometry` + `ShaderMaterial` (transparent/additive)
- Procedural FBM noise in GLSL (replaces the UE4 noise texture)
- `uTime` uniform drives the Panner rotation
- Same radial UV conversion, Blend_Screen, Subtract, RadialGradExp

### Files
- `index.html` — scene setup
- `portal.js` — Three.js scene, geometry, uniforms
- `shaders/portal.vert` — vertex shader
- `shaders/portal.frag` — fragment shader with full technique

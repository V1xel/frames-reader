#define PI 3.14159265358979323846

uniform float uTime;
uniform float uNoiseScale;
uniform float uRotateSpeed;
uniform vec3  uPortalColor;
uniform vec3  uCenterColor;
uniform float uEdgeSharpness;
uniform float uOuterRadius;
uniform float uInnerRadius;
uniform float uEmissiveBoost;

varying vec2 vUv;

// ─── Noise ────────────────────────────────────────────────────────────────────

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 74.27);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),             hash(i + vec2(1,0)), f.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  return valueNoise(p)        * 0.50
       + valueNoise(p * 2.0)  * 0.28
       + valueNoise(p * 4.0)  * 0.14
       + valueNoise(p * 8.0)  * 0.08;
}

// Periodic noise — wraps x so angle seam (0==1) is seamless
float valueNoisePeriodic(vec2 p, float periodX) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x,       periodX);
  float x1 = mod(i.x + 1.0, periodX);
  return mix(
    mix(hash(vec2(x0, i.y)),        hash(vec2(x1, i.y)),        f.x),
    mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), f.x),
    f.y
  );
}

float fbmPeriodic(vec2 p, float periodX) {
  return valueNoisePeriodic(p,                         periodX)      * 0.50
       + valueNoisePeriodic(p * 2.0 + vec2(0.0, 3.7),  periodX * 2.0) * 0.28
       + valueNoisePeriodic(p * 4.0 + vec2(0.0, 7.1),  periodX * 4.0) * 0.14
       + valueNoisePeriodic(p * 8.0 + vec2(0.0, 13.8), periodX * 8.0) * 0.08;
}

// ─── RadialGradientExponential ────────────────────────────────────────────────
float radialGradExp(float dist, float radius, float density) {
  return clamp(1.0 - pow(dist / radius, density), 0.0, 1.0);
}

void main() {
  vec2  centered = vUv - 0.5;
  float dist     = length(centered);
  float angle    = atan(centered.y, centered.x) / (2.0 * PI); // [0,1)
  float radius   = dist / uOuterRadius;

  // ── Subtle spiral bias: inner slightly ahead of outer → spiral arms ────────
  // Keep small so rotation is dominant, not radial flow
  float spiralBias = 0.6 * max(0.0, 1.0 - radius);

  // ── Layer 1: forward rotation (primary spin direction) ───────────────────
  float a1  = angle + spiralBias + uTime * uRotateSpeed;
  vec2  uv1 = vec2(a1 * uNoiseScale * 3.0, radius * uNoiseScale * 1.2);
  float period = uNoiseScale * 3.0; // one full circle = this many noise units
  float n1  = fbmPeriodic(uv1, period);

  // ── Layer 2: counter-rotation (opposite, slightly slower) ─────────────────
  float a2  = angle - spiralBias * 0.5 - uTime * uRotateSpeed * 0.6;
  vec2  uv2 = vec2(a2 * uNoiseScale * 3.0, (radius + 0.3) * uNoiseScale * 1.2);
  float n2  = fbmPeriodic(uv2, period);

  // ── Per-layer angular pull: varies how much void eats into each layer ──────
  // Slow angular variation — different phase/speed per layer
  float pull1 = 0.2 + 1.1 * fbm(vec2(angle * uNoiseScale + uTime * 0.09, 0.3));
  float pull2 = 0.2 + 1.1 * fbm(vec2(angle * uNoiseScale - uTime * 0.07, 0.3) + 5.3);

  float innerGrad = radialGradExp(dist, uInnerRadius, uEdgeSharpness);

  // Subtract inner void from each layer with its own pull strength
  float edge1 = clamp(n1 - innerGrad * pull1, 0.0, 1.0);
  float edge2 = clamp(n2 - innerGrad * pull2, 0.0, 1.0);

  // ── Screen blend + contrast ───────────────────────────────────────────────
  float blended = 1.0 - (1.0 - edge1) * (1.0 - edge2);
  blended = pow(blended, 2.0);

  // ── Cartesian noise for outer chaotic blobs (breaks circular symmetry) ────
  float ns = uNoiseScale * 1.4;
  float nc = fbm(centered * ns + vec2(uTime * 0.15,  uTime * 0.07));
  float nd = fbm(centered * ns + vec2(-uTime * 0.11, uTime * 0.18) + 5.7);
  float cartBlobs = pow(1.0 - (1.0 - nc) * (1.0 - nd), 2.0);

  float portalEdge = blended;

  // ── Outer envelope: cartesian blobs + soft radial fade ───────────────────
  float radialEnv  = 1.0 - smoothstep(uOuterRadius * 0.88, uOuterRadius * 1.08, dist);
  float flameBlobs = smoothstep(0.18, 0.55, cartBlobs * radialEnv);

  // ── Void disc with noise-warped boundary (not a perfect circle) ───────────
  // ── Vortex void: spiral arms ripple the boundary as it rotates ───────────
  // Use the same angle+spiralBias so the spiral follows the noise layers
  float vortexPhase = (angle + spiralBias * 1.5 + uTime * uRotateSpeed) * 2.0 * PI;
  float spiralRipple = 0.055 * sin(vortexPhase * 2.0)  // 2 main arms
                     + 0.025 * sin(vortexPhase * 3.0); // detail
  float voidDist = max(0.0, dist + spiralRipple);
  float voidDisc = radialGradExp(voidDist, uInnerRadius, 7.0);

  // ── Final alpha ───────────────────────────────────────────────────────────
  float ringAlpha = max(portalEdge, flameBlobs) * radialEnv;
  float alpha     = max(voidDisc, ringAlpha);

  // ── Color: purple ring disturbed by its own noise (dark patches inside) ───
  // Use the raw per-layer edges to create dark/bright variation within the ring
  float ringNoise = pow(blended, 1.2);                      // raw noise in ring zone
  float disturbance = ringNoise * (1.0 - voidDisc);         // only in ring, not void
  vec3 color = mix(uCenterColor, uPortalColor, disturbance)
             * (1.0 + (uEmissiveBoost - 1.0) * disturbance);

  gl_FragColor = vec4(color, alpha);
}

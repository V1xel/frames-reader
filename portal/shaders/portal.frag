#define PI 3.14159265358979323846

// ── Step 3: Add second counter-rotating layer (frame ~130) ───────────────────
// Second chain: same texture, Panner SpeedX = -0.1 (opposite direction)
// Both layers shown side-by-side in UE5 graph before blending.

uniform float uTime;
uniform float uNoiseScale;
uniform float uRotateSpeed;

varying vec2 vUv;

// ─── Noise (approximates UE5 T_Smoke / cloud texture) ────────────────────────

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 74.27);
  return fract(p.x * p.y);
}

// Periodic value noise: wraps grid indices in x so angle 0.0 == angle 1.0 (no seam)
// periodX = the x-period in noise-space = uNoiseScale (1 full circle = 1 period)
float valueNoisePeriodic(vec2 p, float periodX) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  // Wrap x index so both sides of the angle seam see the same hash values
  float x0 = mod(i.x,        periodX);
  float x1 = mod(i.x + 1.0,  periodX);
  return mix(
    mix(hash(vec2(x0, i.y)),        hash(vec2(x1, i.y)),        f.x),
    mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), f.x),
    f.y
  );
}

// Multi-octave cloud noise — seamless in x (angle direction).
// Integer octave scales guarantee the period divides evenly.
// Offsets are y-only so they never break x periodicity.
float cloudNoise(vec2 p, float periodX) {
  float v = valueNoisePeriodic(p,                        periodX)     * 0.50
          + valueNoisePeriodic(p * 2.0 + vec2(0.0, 3.7), periodX * 2.0) * 0.30
          + valueNoisePeriodic(p * 4.0 + vec2(0.0, 7.1), periodX * 4.0) * 0.15
          + valueNoisePeriodic(p * 8.0 + vec2(0.0,13.8), periodX * 8.0) * 0.05;
  return v;
}

void main() {
  vec2  centered = vUv - 0.5;
  float dist     = length(centered);

  // ── RadialCoordinates (UE5 node) ──────────────────────────────────────────
  // angle: 0..1 around the circle (UE5 outputs [0,1])
  float angle  = atan(centered.y, centered.x) / (2.0 * PI) + 0.5; // [0, 1]
  float radius = dist * 2.0;                                        // [0, 1] at outerRadius=0.5

  // ── Layer 1: Panner SpeedX = +0.1 → forward rotation ────────────────────
  vec2  rUV1 = vec2(angle + uTime * uRotateSpeed, radius) * uNoiseScale;
  float n1   = cloudNoise(rUV1, uNoiseScale);

  // ── Layer 2: Panner SpeedX = -0.1 → backward rotation ───────────────────
  vec2  rUV2 = vec2(angle - uTime * uRotateSpeed * 0.7, radius + 0.3) * uNoiseScale;
  float n2   = cloudNoise(rUV2, uNoiseScale);

  // Show both layers added together so both are visible (pre-blend preview)
  float combined = (n1 + n2) * 0.5;

  gl_FragColor = vec4(vec3(combined), 1.0);
}

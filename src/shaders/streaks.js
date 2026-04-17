// Radial "warp" streaks — a fullscreen additive overlay anchored to the camera.
// Appears during the Passage act to sell the feeling of movement through the orb.
export const STREAKS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const STREAKS_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uIntensity;
uniform vec3  uColor;
uniform float uAspect;

float hash(float n){ return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  if (uIntensity <= 0.001) { discard; }

  // Use aspect-corrected UVs so streaks stay radial, not stretched.
  vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(c);
  float a = atan(c.y, c.x);

  // Angular slots → per-streak unique properties.
  const float NSTREAKS = 260.0;
  float slotIndex = floor((a + 3.14159265) / (6.2831853 / NSTREAKS));
  float seed = hash(slotIndex * 7.13);
  float speed = 0.25 + seed * 0.9;

  // Distance from streak center line (angular deviation).
  float slotAngle = (slotIndex + 0.5) * (6.2831853 / NSTREAKS) - 3.14159265;
  float dA = a - slotAngle;
  // Wrap dA to [-pi, pi]
  dA = mod(dA + 3.14159265, 6.2831853) - 3.14159265;

  float thinness = 0.002 + seed * 0.0045;
  float line = smoothstep(thinness, 0.0, abs(dA));

  // Radial head position — streaks flow outward.
  float phase = fract(seed + uTime * speed);
  float head  = phase * 1.25;

  // Tail length varies per streak.
  float tailLen = 0.22 + seed * 0.35;

  // A streak is visible between (head - tailLen) and head; brighter near head.
  float tail = smoothstep(head - tailLen, head, r) * smoothstep(head + 0.02, head, r);

  // Hide streaks too near the center (feels like we "come from" a tunnel).
  float innerMask = smoothstep(0.04, 0.18, r);

  // Fade near the screen edges.
  float edgeFade = smoothstep(1.1, 0.55, r);

  float v = line * tail * innerMask * edgeFade * uIntensity;

  // Slight color variance per streak.
  vec3 tint = uColor + vec3(seed * 0.05, -seed * 0.03, seed * 0.08);
  gl_FragColor = vec4(tint * v, v);
}
`;

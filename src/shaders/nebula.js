import { GLSL_NOISE } from './common.js';

// Deep-space backdrop. Intentionally DIM — most of the sky is near-black
// so the player's eye can rest, landmarks read clearly, and forward motion
// actually feels like moving through darkness.
export const NEBULA_VERTEX = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorldPos = w.xyz;
  vViewDir = normalize(w.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const NEBULA_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vViewDir;

uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform vec3  uColorA;   // near-black background
uniform vec3  uColorB;   // violet wisp
uniform vec3  uColorC;   // cyan highlight
uniform vec3  uColorD;   // dim gold
uniform vec3  uMouse;

${GLSL_NOISE}

void main() {
  vec3 d = normalize(vViewDir);

  // Slow drift so the sky isn't frozen.
  float t = uTime * 0.015;
  mat3 rot = mat3(
    cos(t), 0.0, sin(t),
    0.0,    1.0, 0.0,
   -sin(t), 0.0, cos(t)
  );
  vec3 sp = rot * d;

  float base = fbmWarp(sp * 1.0 + vec3(0.0, uTime*0.02, 0.0), uTime*0.35);
  float fine = fbm(sp * 3.8 + vec3(uTime*0.03));

  // Wisps live only in the upper portion of 0..1; most of the sky is dark.
  float wisp = smoothstep(0.55, 0.95, base * 0.6 + fine * 0.35);

  // Rare pockets of deeper color — sparse like real deep-field galaxies.
  float pockets = smoothstep(0.78, 0.98, fbm(sp * 2.0 - vec3(uTime*0.008)));

  // Start from near-black.
  vec3 col = uColorA;

  // Violet wisps (subtle).
  col = mix(col, uColorB, wisp * 0.35);

  // Cyan accent only in a very narrow forward cone.
  float forward = clamp(dot(d, vec3(0.0, 0.0, -1.0)) * 0.5 + 0.5, 0.0, 1.0);
  col += uColorC * pow(forward, 14.0) * 0.08 * (0.5 + 0.5 * uIntensity);

  // Dim gold pockets (rare).
  col += uColorD * pockets * 0.08;

  // Mouse / forward-heading warm tint — very subtle, only a hint.
  float mInf = pow(max(dot(d, normalize(uMouse + vec3(0.001))), 0.0), 12.0);
  col += uColorC * mInf * 0.06;

  // Clamp the sky brightness. No matter what, nebula output stays below
  // the bloom threshold so ONLY point lights bloom.
  col = min(col, vec3(0.35));

  // Gentle vignette around the "equator" to push depth.
  float eq = smoothstep(0.0, 0.85, abs(d.y));
  col *= mix(1.0, 0.78, eq * 0.4);

  // Subtle film grain — prevents banding across the dark field.
  float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453 + uTime);
  col += (g - 0.5) * 0.008;

  gl_FragColor = vec4(col, 1.0);
}
`;

import { GLSL_NOISE } from './common.js';

// The Helios orb — a luminous center-of-stage entity.
// Surface displaces with FBM, fresnel creates rim light,
// pulsating energy throughout its body.
export const ORB_VERTEX = /* glsl */ `
precision highp float;
${GLSL_NOISE}
uniform float uTime;
uniform float uPulse;
uniform float uProgress;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying float vNoise;

void main() {
  vec3 p = position;
  float n = fbmWarp(p * 1.3 + vec3(0.0, uTime*0.18, 0.0), uTime * 0.9);
  float ridge = fbm(p * 4.0 - vec3(uTime*0.25));
  vNoise = n;

  float amp = 0.24 + 0.18 * uPulse + 0.12 * uProgress;
  vec3 displaced = p + normal * (n * amp + ridge * 0.05);

  vec4 w = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = w.xyz;
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const ORB_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying float vNoise;

uniform float uTime;
uniform float uPulse;
uniform float uProgress;
uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform vec3 uColorRim;

${GLSL_NOISE}

void main() {
  float fres = pow(1.0 - max(dot(normalize(vNormal), vViewDir), 0.0), 3.0);

  // Inner flowing plasma
  vec3 localP = normalize(vWorldPos);
  float plasma = fbmWarp(localP * 2.4 + vec3(uTime*0.25), uTime*1.1);
  plasma = smoothstep(-0.4, 0.9, plasma);

  // Core gradient
  vec3 core = mix(uColorInner, uColorOuter, plasma);

  // Hot pulse bursts
  float pulse = 0.5 + 0.5 * sin(uTime * 0.8 + vNoise * 6.0);
  core += uColorRim * pulse * 0.15 * uPulse;

  // Rim fresnel glow
  vec3 rim = uColorRim * fres * (1.1 + uPulse * 0.6);

  // Energy veins (sharper edges of the fbm)
  float veins = smoothstep(0.55, 0.8, plasma);
  core += uColorRim * veins * 0.5;

  // Progress shifts hue toward magenta/gold
  vec3 tint = mix(vec3(1.0), vec3(1.2, 0.9, 1.05), smoothstep(0.4, 1.0, uProgress));

  vec3 col = (core + rim) * tint;

  // The orb is intentionally bright — it's the one thing that should bloom.
  col *= 0.95;

  float center = max(dot(normalize(vNormal), vViewDir), 0.0);
  col *= mix(1.0, 1.1, center);

  gl_FragColor = vec4(col, 1.0);
}
`;

// Outer halo sprite for soft bloom-friendly glow around the orb.
export const HALO_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const HALO_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

void main() {
  vec2 c = vUv - 0.5;
  float r = length(c);
  float glow = smoothstep(0.5, 0.0, r);
  glow = pow(glow, 2.6);

  // Soft rotating rays
  float ang = atan(c.y, c.x);
  float rays = 0.5 + 0.5 * sin(ang * 10.0 + uTime * 0.4);
  rays = mix(1.0, rays, 0.15);

  float a = glow * rays * uIntensity;
  vec3 col = uColor * a;

  gl_FragColor = vec4(col, a);
}
`;

import { GLSL_NOISE } from './common.js';

// Radial energy ribbon that surrounds the orb — a flat disc viewed edge-on
// with custom shader that turns it into flowing filaments of plasma.
export const FILAMENTS_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorldPos = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const FILAMENTS_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;

uniform float uTime;
uniform float uProgress;
uniform float uPulse;
uniform vec3  uColorA;
uniform vec3  uColorB;

${GLSL_NOISE}

void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;        // 0..1
  float a = atan(c.y, c.x);

  // Radial bands in polar coordinates.
  float bands = fbm(vec3(a * 3.2, r * 5.0 - uTime * 0.4, uTime * 0.2));
  float swirl = fbmWarp(vec3(cos(a)*r*2.5, sin(a)*r*2.5, uTime*0.15), uTime * 0.5);

  float ring = smoothstep(1.0, 0.7, r) * smoothstep(0.15, 0.35, r);
  float flow = smoothstep(0.1, 0.85, bands * 0.5 + swirl * 0.7);

  float intensity = ring * flow;
  intensity *= 0.6 + 0.4 * uPulse;
  intensity *= 0.5 + 0.8 * smoothstep(0.15, 0.75, uProgress);

  vec3 col = mix(uColorA, uColorB, flow);
  col *= intensity * 1.2;

  float alpha = intensity * 0.85;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

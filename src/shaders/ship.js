// Ship shader — dark faceted hull with fresnel rim glow and
// subtle iridescent shimmer. Reads very well against the nebula.
export const SHIP_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(cameraPosition - w.xyz);
  vLocalPos = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const SHIP_FRAG = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

uniform float uTime;
uniform float uThrottle;   // 0..1 (affects rim intensity)
uniform vec3  uBase;
uniform vec3  uRim;
uniform vec3  uAccent;

void main() {
  vec3 N = normalize(vNormal);
  float ndotv = max(dot(N, vViewDir), 0.0);
  float fres = pow(1.0 - ndotv, 2.6);
  float fresSharp = pow(1.0 - ndotv, 8.0);

  // Metal-ish base, slightly brighter where nearly perpendicular to view.
  vec3 col = uBase * (0.35 + ndotv * 0.55);

  // Rim glow (cyan) — the hull reads by its rim against dark space.
  col += uRim * fres * (0.55 + uThrottle * 0.5);

  // Sharper edge accent (magenta) — subtle hologram edge.
  col += uAccent * fresSharp * 0.55;

  // Iridescent shimmer along the hull.
  float shimmer = 0.5 + 0.5 * sin(uTime * 1.6 + vLocalPos.x * 8.0 + vLocalPos.z * 3.0);
  col += uAccent * 0.03 * shimmer * fres;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Engine glow — inner white-hot core shader for the thruster.
export const ENGINE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uThrottle;
uniform vec3  uColor;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c);
  float core = pow(smoothstep(0.5, 0.0, r), 2.2);
  float hot = pow(smoothstep(0.18, 0.0, r), 5.0);
  float pulse = 0.85 + 0.15 * sin(uTime * 18.0);
  float a = (core * 0.8 + hot * 2.5) * (0.45 + uThrottle * 1.2) * pulse;
  vec3 col = mix(uColor, vec3(1.0), hot * 0.8);
  gl_FragColor = vec4(col * a, a);
}
`;

export const ENGINE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Cockpit / core gem — a glowing energy sphere.
export const GEM_FRAG = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vViewDir;
uniform float uTime;
void main() {
  float ndotv = max(dot(normalize(vNormal), vViewDir), 0.0);
  float fres = pow(1.0 - ndotv, 1.2);
  vec3 core = vec3(0.45, 0.9, 1.2);
  vec3 rim  = vec3(0.9, 0.6, 1.4);
  vec3 col = core * (0.6 + fres * 1.6) + rim * fres * 0.5;
  col *= 1.0 + 0.25 * sin(uTime * 2.2);
  gl_FragColor = vec4(col, 1.0);
}
`;

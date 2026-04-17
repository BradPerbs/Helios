// Distant sun: a billboard halo with a bright pinprick core and soft rays.
// Drawn additively; reads great with bloom.
export const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SUN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uIntensity;   // revealed over progress
uniform float uFlicker;     // per-sun breathing
uniform vec3  uColor;

void main() {
  if (uIntensity <= 0.001) { discard; }

  vec2 c = vUv - 0.5;
  float r = length(c);
  float ang = atan(c.y, c.x);

  float halo = pow(smoothstep(0.5, 0.0, r), 2.0);
  float core = pow(smoothstep(0.09, 0.0, r), 6.0);
  float rays = 0.5 + 0.5 * sin(ang * 6.0 + uTime * 0.3 + uFlicker);
  rays = mix(1.0, rays, 0.25);
  float cross = pow(smoothstep(0.5, 0.0, abs(c.x)), 24.0)
              + pow(smoothstep(0.5, 0.0, abs(c.y)), 24.0);

  float breath = 0.85 + 0.15 * sin(uTime * (0.3 + uFlicker * 0.2) + uFlicker);

  float v = (halo * rays * 0.9 + core * 1.8 + cross * 0.6) * breath * uIntensity;
  vec3 col = uColor * v;
  gl_FragColor = vec4(col, clamp(v, 0.0, 1.0));
}
`;

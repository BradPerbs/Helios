// --- Distant stars (Points, wrap-based "infinite" skybox) -----------------
// Each star has a canonical position in a cube centered at origin. In the
// vertex shader we wrap it into a cube centered on the ship — so the field
// always surrounds the player, but individual stars are fixed in world space
// and parallax naturally as the ship moves.
export const STARS_VERT = /* glsl */ `
precision highp float;
attribute float aSeed;
attribute float aScale;
attribute vec3  aColor;

uniform vec3  uShipPos;
uniform float uExtent;
uniform float uPixelRatio;
uniform float uTime;

varying vec3  vColor;
varying float vAlpha;

void main() {
  // Wrap this star into a cube of side uExtent centered on the ship.
  vec3 rel = position - uShipPos;
  vec3 wrapped = rel - uExtent * floor(rel / uExtent + 0.5);
  vec3 worldPos = uShipPos + wrapped;

  vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * mv;

  float dist = max(-mv.z, 0.01);
  // Keep points small — we do NOT want the starfield to bloom.
  gl_PointSize = aScale * (220.0 / dist) * uPixelRatio;

  // Fade near the wrap-cube edges so stars don't pop when they jump.
  float d = length(wrapped);
  float edgeFade = smoothstep(uExtent * 0.5, uExtent * 0.32, d);

  // Slight twinkle.
  float tw = 0.85 + 0.15 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 31.4);

  vAlpha = edgeFade * tw;
  vColor = aColor;
}
`;

export const STARS_FRAG = /* glsl */ `
precision highp float;
varying vec3  vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float soft = smoothstep(0.5, 0.0, r);
  float core = smoothstep(0.18, 0.0, r);
  float a = (pow(soft, 2.6) * 0.45 + pow(core, 6.0) * 0.9) * vAlpha;
  if (a < 0.002) discard;
  // Keep stars fairly dim so they don't dominate the picture.
  gl_FragColor = vec4(vColor * a, a);
}
`;

// --- Speed dust (LineSegments, wrap-based, velocity-stretched) ------------
// Two vertices per particle. Vertex "end" = 0 is the head, = 1 is the tail.
// The tail is offset by -shipVelocity * streakScale so at rest the line has
// zero length (invisible) and at speed becomes a motion streak aligned
// with relative motion. This is the main visual cue for moving forward.
export const DUST_VERT = /* glsl */ `
precision highp float;
attribute float aEnd;
attribute float aSeed;

uniform vec3  uShipPos;
uniform vec3  uShipVel;
uniform float uExtent;
uniform float uStreakScale;
uniform float uTime;

varying float vAlpha;
varying float vEnd;
varying float vSpeed;

void main() {
  vec3 rel = position - uShipPos;
  vec3 wrapped = rel - uExtent * floor(rel / uExtent + 0.5);
  vec3 worldPos = uShipPos + wrapped;

  // Streak the TAIL vertex against the direction of travel.
  // (Ship moves forward → world rushes backward → streak points backward
  //  relative to motion.)
  vec3 streakOffset = -uShipVel * uStreakScale * aEnd;
  worldPos += streakOffset;

  vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * mv;

  // Fade near the cube edges.
  float d = length(wrapped);
  float edgeFade = smoothstep(uExtent * 0.5, uExtent * 0.30, d);

  // Per-particle brightness variance.
  float bright = 0.45 + 0.55 * fract(aSeed * 13.37);

  vAlpha = edgeFade * bright;
  vEnd = aEnd;
  vSpeed = length(uShipVel);
}
`;

export const DUST_FRAG = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vEnd;
varying float vSpeed;

uniform vec3 uColor;

void main() {
  // Head bright → tail dark. Overall alpha scales with speed so dust is
  // invisible at rest and dramatic streaks appear when moving.
  float headness = 1.0 - vEnd;
  float speedGate = smoothstep(0.5, 14.0, vSpeed);
  float a = vAlpha * headness * (0.05 + speedGate * 0.75);
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

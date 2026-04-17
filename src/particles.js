import * as THREE from 'three';
import {
  STARS_VERT, STARS_FRAG,
  DUST_VERT,  DUST_FRAG,
} from './shaders/particles.js';

// Two wrap-based layers create a convincing "infinite" universe:
//   • Stars  — fixed in world space, wrapped into a large cube around the
//              ship so the starfield is always surrounding the player.
//              Parallax against these sells motion.
//   • Dust   — a dense near-field speed-dust cloud rendered as lines whose
//              length = ship velocity × streakScale. At rest: invisible.
//              At speed: motion streaks.
export function createParticles() {
  const group = new THREE.Group();
  const stars = makeStars({ count: 5000, extent: 360 });
  const dust  = makeDust({ count: 1800, extent: 55 });
  group.add(stars.points);
  group.add(dust.lines);

  return {
    group,
    stars,
    dust,
    layers: [stars, dust],   // back-compat — iterate for `uPixelRatio` etc.
  };
}

// --------------------------------------------------------------------------
function makeStars({ count, extent }) {
  const positions = new Float32Array(count * 3);
  const seeds     = new Float32Array(count);
  const scales    = new Float32Array(count);
  const colors    = new Float32Array(count * 3);

  // A muted palette so stars read as points of light, not neon.
  const palette = [
    new THREE.Color('#b8c9ff'),
    new THREE.Color('#d7caff'),
    new THREE.Color('#ffe8c7'),
    new THREE.Color('#a8d4ff'),
    new THREE.Color('#ffffff'),
    new THREE.Color('#ffffff'),
    new THREE.Color('#ffffff'),
  ];

  for (let i = 0; i < count; i++) {
    positions[i*3+0] = (Math.random() - 0.5) * extent;
    positions[i*3+1] = (Math.random() - 0.5) * extent;
    positions[i*3+2] = (Math.random() - 0.5) * extent;
    seeds[i] = Math.random();
    // Heavy tail toward tiny stars; rare bright ones.
    const r = Math.random();
    scales[i] = 0.4 + Math.pow(r, 3.5) * 2.2;
    const c = palette[Math.floor(Math.random() * palette.length)];
    // Dim most stars significantly; only ~8% are visibly tinted.
    const bright = 0.45 + Math.random() * 0.45;
    colors[i*3+0] = c.r * bright;
    colors[i*3+1] = c.g * bright;
    colors[i*3+2] = c.b * bright;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
  geom.setAttribute('aScale',   new THREE.BufferAttribute(scales, 1));
  geom.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));

  const uniforms = {
    uShipPos:    { value: new THREE.Vector3() },
    uExtent:     { value: extent },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uTime:       { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: STARS_VERT,
    fragmentShader: STARS_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  return { points, uniforms };
}

// --------------------------------------------------------------------------
function makeDust({ count, extent }) {
  // 2 vertices per line. Even indices = head (aEnd=0), odd = tail (aEnd=1).
  const positions = new Float32Array(count * 2 * 3);
  const ends      = new Float32Array(count * 2);
  const seeds     = new Float32Array(count * 2);
  const indices   = new Uint32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * extent;
    const y = (Math.random() - 0.5) * extent;
    const z = (Math.random() - 0.5) * extent;
    const base = i * 2 * 3;
    positions[base+0] = x; positions[base+1] = y; positions[base+2] = z;
    positions[base+3] = x; positions[base+4] = y; positions[base+5] = z;
    ends[i*2 + 0] = 0;
    ends[i*2 + 1] = 1;
    const seed = Math.random();
    seeds[i*2 + 0] = seed;
    seeds[i*2 + 1] = seed;
    indices[i*2 + 0] = i*2 + 0;
    indices[i*2 + 1] = i*2 + 1;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aEnd',     new THREE.BufferAttribute(ends, 1));
  geom.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));

  const uniforms = {
    uShipPos:     { value: new THREE.Vector3() },
    uShipVel:     { value: new THREE.Vector3() },
    uExtent:      { value: extent },
    uStreakScale: { value: 0.09 },   // tune: length of streaks vs velocity
    uColor:       { value: new THREE.Color('#a5c8ff') },
    uTime:        { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lines = new THREE.LineSegments(geom, mat);
  lines.frustumCulled = false;
  return { lines, uniforms };
}

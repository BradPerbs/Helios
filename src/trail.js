import * as THREE from 'three';

// A ribbon trail behind each engine exhaust.
// Implemented as a ring-buffer Line2-style geometry using plain LineSegments
// with per-vertex color fading. Cheap and looks great against bloom.
export function createTrails(ship, { length = 64 } = {}) {
  const trails = [];
  const count = ship.exhaustPoints.length;

  for (let i = 0; i < count; i++) {
    const positions = new Float32Array(length * 3);
    const colors    = new Float32Array(length * 3);
    const alphas    = new Float32Array(length);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('aAlpha',   new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        attribute vec3 aColor;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.002) discard;
          gl_FragColor = vec4(vColor * vAlpha, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    line.renderOrder = 3;
    trails.push({ line, positions, colors, alphas, index: 0, lastWorld: new THREE.Vector3() });
  }

  const group = new THREE.Group();
  for (const t of trails) group.add(t.line);

  const tmp = new THREE.Vector3();
  const tmpLocal = new THREE.Vector3();

  function update(dt, throttle) {
    for (let i = 0; i < count; i++) {
      const trail = trails[i];
      // Sample the current world position of exhaust i.
      tmpLocal.copy(ship.exhaustPoints[i]);
      ship.group.localToWorld(tmp.copy(tmpLocal));

      // Shift the buffer (simple — we're limited to ~64 verts so this is cheap).
      // Head is at the end of the arrays; we push new point, drop oldest.
      for (let j = 0; j < length - 1; j++) {
        trail.positions[j*3+0] = trail.positions[(j+1)*3+0];
        trail.positions[j*3+1] = trail.positions[(j+1)*3+1];
        trail.positions[j*3+2] = trail.positions[(j+1)*3+2];
        trail.alphas[j] = trail.alphas[j+1] * 0.965;
      }
      const head = length - 1;
      trail.positions[head*3+0] = tmp.x;
      trail.positions[head*3+1] = tmp.y;
      trail.positions[head*3+2] = tmp.z;
      trail.alphas[head] = 0.9 * throttle + 0.1;

      // Colors: gradient from cyan at head to magenta tail.
      for (let j = 0; j < length; j++) {
        const t = j / (length - 1);
        trail.colors[j*3+0] = THREE.MathUtils.lerp(0.48, 1.0, t);   // r
        trail.colors[j*3+1] = THREE.MathUtils.lerp(0.72, 0.42, t);  // g
        trail.colors[j*3+2] = THREE.MathUtils.lerp(1.0, 0.9, t);    // b
      }

      trail.line.geometry.attributes.position.needsUpdate = true;
      trail.line.geometry.attributes.aColor.needsUpdate = true;
      trail.line.geometry.attributes.aAlpha.needsUpdate = true;
    }
  }

  return { group, update };
}

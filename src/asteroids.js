import * as THREE from 'three';

// Scattered asteroids — instanced rocky chunks with per-instance spin.
// Each instance has its own rotation axis + speed and slow drift, which
// gives the field a parallax-ready feel without a heavy physics sim.
//
// The base geometry is a lightly-deformed icosahedron. One geometry, one
// material, N instances — InstancedMesh keeps the draw call count at 1.
export function createAsteroids({ count = 90, extent = 1800, minR = 2.0, maxR = 18.0 } = {}) {
  const group = new THREE.Group();

  // --- Base rock geometry ---------------------------------------------------
  const geom = new THREE.IcosahedronGeometry(1, 2);
  jitterVertices(geom, 0.32);
  geom.computeVertexNormals();

  // --- Material -------------------------------------------------------------
  // Subtle colour + strong roughness so asteroids read as dusty rock under
  // the scene's directional sun. Receives fog automatically.
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6a5f55'),
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true,
  });

  const mesh = new THREE.InstancedMesh(geom, mat, count);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  // Slightly colour a few asteroids with a per-instance tint to break up
  // uniform grey across the field.
  const instanceColors = new Float32Array(count * 3);

  // --- Per-instance state (CPU-side for animation) -------------------------
  const instances = [];
  const tmpMat = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tintCold = new THREE.Color('#5a6070');
  const tintWarm = new THREE.Color('#7a6248');
  const tintIce  = new THREE.Color('#8a95a0');
  const tintBase = new THREE.Color('#6a5f55');

  for (let i = 0; i < count; i++) {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * extent,
      (Math.random() - 0.5) * extent * 0.55,   // flatter vertical spread
      (Math.random() - 0.5) * extent,
    );

    // Keep asteroids clear of the ship spawn.
    if (pos.length() < 60) pos.setLength(60 + Math.random() * 40);

    // Power-law size distribution: lots of pebbles, rare boulders.
        const r = Math.pow(Math.random(), 2.3);
        const size = minR + r * (maxR - minR);

    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    ));
    const axis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();
    const spin = (Math.random() - 0.5) * 0.12;          // rad/sec

    // Chunky non-uniform scale so asteroids aren't spheres.
    const sx = size * (0.8 + Math.random() * 0.5);
    const sy = size * (0.8 + Math.random() * 0.5);
    const sz = size * (0.8 + Math.random() * 0.5);

    // Pick a tint variation for visual variety.
    const roll = Math.random();
    const tint = roll < 0.15 ? tintIce
               : roll < 0.35 ? tintCold
               : roll < 0.55 ? tintWarm
               : tintBase;
    instanceColors[i*3+0] = tint.r;
    instanceColors[i*3+1] = tint.g;
    instanceColors[i*3+2] = tint.b;

    instances.push({ pos, quat, axis, spin, scale: new THREE.Vector3(sx, sy, sz) });
  }

  mesh.instanceColor = new THREE.InstancedBufferAttribute(instanceColors, 3);
  mesh.instanceColor.needsUpdate = true;

  // Initial matrix upload.
  for (let i = 0; i < count; i++) {
    const ins = instances[i];
    tmpMat.compose(ins.pos, ins.quat, ins.scale);
    mesh.setMatrixAt(i, tmpMat);
  }
  mesh.instanceMatrix.needsUpdate = true;

  group.add(mesh);

  function update(dt) {
    for (let i = 0; i < instances.length; i++) {
      const ins = instances[i];
      tmpQuat.setFromAxisAngle(ins.axis, ins.spin * dt);
      ins.quat.multiply(tmpQuat);
      tmpMat.compose(ins.pos, ins.quat, ins.scale);
      mesh.setMatrixAt(i, tmpMat);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { group, mesh, update };
}

// --------------------------------------------------------------------------
function jitterVertices(geom, amount) {
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Hash-ish noise per vertex so identical positions get identical offsets
    // (keeps shared-vertex seams welded).
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const n = (h - Math.floor(h)) - 0.5;
    const h2 = Math.sin(x * 4.3 + y * 9.1 + z * 2.7) * 19234.7;
    const n2 = (h2 - Math.floor(h2)) - 0.5;
    const scale = 1.0 + (n + n2) * amount;
    pos.setXYZ(i, x * scale, y * scale, z * scale);
  }
  pos.needsUpdate = true;
}

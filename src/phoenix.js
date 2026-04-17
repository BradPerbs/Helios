import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildSpaceEnvMap } from './envmap.js';

// Loads the Phoenix planet GLTF and positions it to be the imposing centerpiece
// of the scene. Returns { group, update(dt) } immediately; the model is added
// asynchronously when the GLTF finishes loading.
//
// The native model spans roughly ±22 units in X/Y and 0..44 in Z. We scale it
// way up so it dominates the skyline, place it ahead of the spawn, and give it
// a very slow axial rotation.
export function createPhoenix({ renderer } = {}) {
  const group = new THREE.Group();

  // Anchor where the loaded model will be reparented so we can rotate it
  // without inheriting scale weirdness from the GLTF's own transforms.
  const pivot = new THREE.Group();
  // Placed close to the ship's y-level so flying forward doesn't tilt the
  // view up into the planet's shadow hemisphere. A big Y offset made the
  // shadowed underside swing into frame during approach; at near-equal Y
  // the same visible hemisphere is seen from far AND close.
  pivot.position.set(0, 40, -1100);
  group.add(pivot);

  // Single dedicated key light — no fill. The intent is the high-contrast
  // "real space" look where the lit side is sculpted and the far side falls
  // off into near-black shadow.
  const keyLight = new THREE.DirectionalLight(0xffd9a8, 2.4);
  keyLight.position.set(400, 200, 300);           // relative to pivot
  pivot.add(keyLight);

  // Pre-filtered space environment map: dim void + sun + rim. Matches the
  // ship's env so reflections are visually consistent across the scene.
  let envMap = null;
  if (renderer) envMap = buildSpaceEnvMap(renderer);

  let loaded = null;

  const loader = new GLTFLoader();
  loader.load(
    './src/models/phoenix_planet/scene.gltf',
    (gltf) => {
      const model = gltf.scene;

      // Ensure PBR materials play nicely with the scene (fog on, good env).
      model.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.frustumCulled = false;
        const m = obj.material;
        if (m) {
          m.fog = true;
          // IBL at low intensity: just enough ambient to keep the shadowed
          // hemisphere from collapsing to pure black when you fly around,
          // but not so much that it flattens the sculpted key-light
          // contrast on the lit side. The dark bottom half is the hero
          // feature — that's what makes the sphere feel massive and real.
          if (envMap) {
            m.envMap = envMap;
            m.envMapIntensity = 0.22;
          }
          // Double-sided so flying near or through the huge mesh doesn't
          // reveal culled back-faces as black holes.
          m.side = THREE.DoubleSide;
          if (m.map) m.map.anisotropy = 8;
          m.needsUpdate = true;
        }
      });

      // --- Normalize + scale ------------------------------------------------
      // The model's local frame has Z as its "forward" axis and the geometry
      // starts near z=0 and extends outward. We re-center it so the pivot
      // sits at the model's center, then scale to an imposing size.
      model.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      bbox.getCenter(center);
      bbox.getSize(size);
      model.position.sub(center);

      // Target radius chosen so the spawn-view angular size matches the
      // earlier (y=180, z=-950, r=500) placement. ~580 at distance ~1115
      // gives the same ~55° arc on the sky.
      const targetRadius = 580;
      const currentRadius = Math.max(size.x, size.y, size.z) * 0.5;
      const scale = targetRadius / currentRadius;
      model.scale.setScalar(scale);

      // Tilt a touch so the silhouette isn't perfectly axis-aligned.
      model.rotation.x = -0.25;
      model.rotation.z = 0.15;

      pivot.add(model);
      loaded = model;
    },
    undefined,
    (err) => console.error('Failed to load phoenix_planet GLTF:', err),
  );

  function update(dt) {
    // Very slow axial spin — large bodies should feel ponderous.
    pivot.rotation.y += dt * 0.015;
  }

  return { group, pivot, update, isLoaded: () => !!loaded };
}

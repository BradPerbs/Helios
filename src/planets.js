import * as THREE from 'three';

// Scene lighting rig. The procedural solar system has been retired — Phoenix
// (see phoenix.js) is now the only visible celestial body. This module keeps
// the directional "sun" light and a low ambient fill so Phoenix, the ship,
// and the asteroid field stay sculpted in 3D.
//
// The public API is unchanged so main.js's existing iteration over
// `planets.planets` keeps working as a no-op.
export function createPlanets() {
  const group = new THREE.Group();

  const sunLight = new THREE.DirectionalLight(0xfff0cc, 2.6);
  sunLight.position.set(380, 220, -600);
  group.add(sunLight);

  // Very low ambient — we want the unlit sides of Phoenix + asteroids to
  // read as real space shadow, not be softened by a lifted black point.
  const ambient = new THREE.AmbientLight(0x101010, 0.12);
  group.add(ambient);

  return { group, planets: [], sun: null };
}

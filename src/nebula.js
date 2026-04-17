import * as THREE from 'three';
import { NEBULA_VERTEX, NEBULA_FRAGMENT } from './shaders/nebula.js';

export function createNebula() {
  // Large enough that the player can boost for a long time without reaching it.
  const geometry = new THREE.SphereGeometry(1500, 64, 32);
  // Inside view.
  geometry.scale(-1, 1, 1);

  const uniforms = {
    uTime:      { value: 0 },
    uProgress:  { value: 0 },
    uIntensity: { value: 0 },
    uColorA:    { value: new THREE.Color('#02030a') },  // near-black base
    uColorB:    { value: new THREE.Color('#25103e') },  // dark violet wisp
    uColorC:    { value: new THREE.Color('#3d6a9a') },  // muted cyan accent
    uColorD:    { value: new THREE.Color('#3a2a18') },  // dim gold
    uMouse:     { value: new THREE.Vector3(0, 0, -1) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERTEX,
    fragmentShader: NEBULA_FRAGMENT,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, material, uniforms };
}

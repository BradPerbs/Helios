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
    uColorA:    { value: new THREE.Color('#000000') },  // pure black base
    uColorB:    { value: new THREE.Color('#1a1a1a') },  // dark grey wisp
    uColorC:    { value: new THREE.Color('#2a2a2a') },  // neutral grey accent
    uColorD:    { value: new THREE.Color('#2a2218') },  // dim warm grey (kept as a faint highlight)
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

import * as THREE from 'three';
import { SUN_VERT, SUN_FRAG } from './shaders/suns.js';

// Four distant suns placed far away — they become visible as the traveler
// emerges past the Helios orb. Positioned across a wide field so the user
// naturally discovers them as the camera parallaxes.
const SUN_DEFS = [
  { pos: [ -40,  18, -120 ], size: 22, color: '#f5d8a8', flicker: 0.3 },
  { pos: [  55,  -8, -160 ], size: 30, color: '#b98bff', flicker: 1.7 },
  { pos: [ -18, -22, -200 ], size: 36, color: '#7de3ff', flicker: 2.4 },
  { pos: [  30,  28, -230 ], size: 28, color: '#ff7adf', flicker: 3.9 },
];

export function createSuns() {
  const group = new THREE.Group();
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const suns = [];

  for (const def of SUN_DEFS) {
    const uniforms = {
      uTime:      { value: 0 },
      uIntensity: { value: 0 },
      uFlicker:   { value: def.flicker },
      uColor:     { value: new THREE.Color(def.color) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: SUN_VERT,
      fragmentShader: SUN_FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
    mesh.scale.setScalar(def.size);
    mesh.frustumCulled = false;
    group.add(mesh);
    suns.push({ mesh, uniforms, def });
  }

  return { group, suns };
}

// Each frame: billboard-face the camera and update uniforms.
export function updateSuns(sunsApi, camera, time, intensity) {
  for (const s of sunsApi.suns) {
    s.mesh.lookAt(camera.position);
    s.uniforms.uTime.value = time;
    s.uniforms.uIntensity.value = intensity;
  }
}

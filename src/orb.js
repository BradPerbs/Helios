import * as THREE from 'three';
import { ORB_VERTEX, ORB_FRAGMENT, HALO_VERTEX, HALO_FRAGMENT } from './shaders/orb.js';
import { FILAMENTS_VERTEX, FILAMENTS_FRAGMENT } from './shaders/filaments.js';

export function createOrb() {
  const group = new THREE.Group();

  // --- Core orb ---
  const geometry = new THREE.IcosahedronGeometry(1, 64);
  const uniforms = {
    uTime:       { value: 0 },
    uPulse:      { value: 0 },
    uProgress:   { value: 0 },
    uColorInner: { value: new THREE.Color('#1a0a3c') },
    uColorOuter: { value: new THREE.Color('#6c28a8') },
    uColorRim:   { value: new THREE.Color('#7de3ff') },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: ORB_VERTEX,
    fragmentShader: ORB_FRAGMENT,
    uniforms,
    transparent: false,
  });
  const core = new THREE.Mesh(geometry, material);
  core.scale.setScalar(1.4);
  group.add(core);

  // --- Soft billboard halo ---
  const haloGeom = new THREE.PlaneGeometry(9, 9);
  const haloUniforms = {
    uTime:      { value: 0 },
    uColor:     { value: new THREE.Color('#b98bff') },
    uIntensity: { value: 0.9 },
  };
  const haloMat = new THREE.ShaderMaterial({
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    uniforms: haloUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  halo.renderOrder = 5;
  group.add(halo);

  // --- Filaments ring ---
  const ringGeom = new THREE.PlaneGeometry(8, 8);
  const filUniforms = {
    uTime:     { value: 0 },
    uProgress: { value: 0 },
    uPulse:    { value: 0 },
    uColorA:   { value: new THREE.Color('#7de3ff') },
    uColorB:   { value: new THREE.Color('#ff7adf') },
  };
  const filMat = new THREE.ShaderMaterial({
    vertexShader: FILAMENTS_VERTEX,
    fragmentShader: FILAMENTS_FRAGMENT,
    uniforms: filUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeom, filMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Second slanted ring — breaks symmetry
  const ring2 = new THREE.Mesh(ringGeom.clone(), filMat.clone());
  ring2.material.uniforms = {
    uTime:     { value: 0 },
    uProgress: filUniforms.uProgress,    // shared reference
    uPulse:    filUniforms.uPulse,
    uColorA:   { value: new THREE.Color('#ff7adf') },
    uColorB:   { value: new THREE.Color('#f5d8a8') },
  };
  ring2.rotation.set(Math.PI * 0.42, 0, Math.PI * 0.2);
  ring2.scale.setScalar(0.78);
  group.add(ring2);

  return {
    group,
    core,
    halo,
    ring,
    ring2,
    uniforms,
    haloUniforms,
    filUniforms,
    ring2Uniforms: ring2.material.uniforms,
  };
}

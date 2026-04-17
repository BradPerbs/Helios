import * as THREE from 'three';
import { STREAKS_VERT, STREAKS_FRAG } from './shaders/streaks.js';

// Creates a fullscreen billboard attached to the camera so it always fills
// the view. Renders the radial-streak pattern additively over the scene.
export function createStreaks(camera) {
  const geometry = new THREE.PlaneGeometry(2, 2);

  const uniforms = {
    uTime:      { value: 0 },
    uIntensity: { value: 0 },
    uColor:     { value: new THREE.Color('#b8d8ff') },
    uAspect:    { value: window.innerWidth / window.innerHeight },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: STREAKS_VERT,
    fragmentShader: STREAKS_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // Size/position so it perfectly fills the view at near plane.
  // With default 55° FOV at distance 1: plane height = 2*tan(27.5°) ≈ 1.042
  // We'll scale dynamically in onResize to cover view.
  mesh.position.set(0, 0, -1);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;

  camera.add(mesh);

  function resize(camera) {
    const dist = 1;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const h = 2 * Math.tan(vFov / 2) * dist;
    const w = h * camera.aspect;
    mesh.scale.set(w * 1.1, h * 1.1, 1);
    uniforms.uAspect.value = camera.aspect;
  }
  resize(camera);

  return { mesh, uniforms, resize };
}

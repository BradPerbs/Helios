import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Loads the spaceship GLTF model and exposes the same public API as before
// (group, uniforms, engineUniforms, engines, gem, exhaustPoints) so that
// main.js, controls.js and trail.js keep working unchanged.
//
// `renderer` is optional. When provided, we build a PMREM environment map so
// the PBR materials get smooth reflections instead of chunky flat ones.
export function createShip(renderer) {
  const group = new THREE.Group();

  // Stubbed uniforms kept for API compatibility with the rest of the app.
  // main.js writes uTime/uThrottle into these every frame.
  const uniforms = {
    uTime:     { value: 0 },
    uThrottle: { value: 0 },
    uBase:     { value: new THREE.Color('#0a0a16') },
    uRim:      { value: new THREE.Color('#7de3ff') },
    uAccent:   { value: new THREE.Color('#c38bff') },
  };
  const engineUniforms = {
    uTime:     { value: 0 },
    uThrottle: uniforms.uThrottle,
    uColor:    { value: new THREE.Color('#9bd8ff') },
  };

  // Local lights so the imported PBR model is visible without touching the
  // rest of the scene. They travel with the ship and don't affect the
  // scene's ShaderMaterial-based visuals.
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x1a1030, 1.2);
  group.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
  keyLight.position.set(2, 3, 2);
  group.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x8ab4ff, 0.6);
  fillLight.position.set(-3, -1, -2);
  group.add(fillLight);

  // Pre-filtered environment map for smooth PBR reflections. Without this,
  // metallic surfaces on low-poly geometry show the raw face angles as blocky
  // highlights. RoomEnvironment is a cheap neutral studio that gives soft,
  // evenly distributed reflections.
  let envMap = null;
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  // A container we can transform freely while the model loads. The model is
  // parented to this so the procedural scale/center doesn't interact with
  // the gltf's own internal matrices.
  const modelHolder = new THREE.Group();
  group.add(modelHolder);

  // The model uses KHR_materials_pbrSpecularGlossiness (Sketchfab export).
  // three r160's default GLTFLoader drops those colors, leaving everything
  // default white. Pull the diffuse factor straight out of the raw JSON
  // and push it into each MeshStandardMaterial after load.
  const loader = new GLTFLoader();
  const emissiveLights = [];        // collected so we can pulse them
  loader.load(
    './src/models/spaceship/scene.gltf',
    (gltf) => {
      const model = gltf.scene;

      const rawMaterials = (gltf.parser && gltf.parser.json && gltf.parser.json.materials) || [];
      model.traverse((obj) => {
        if (!obj.isMesh) return;
        const rawByName = rawMaterials.find((m) => m.name === obj.material.name);
        const sg = rawByName && rawByName.extensions && rawByName.extensions.KHR_materials_pbrSpecularGlossiness;
        if (sg) {
          const [r, g, b, a] = sg.diffuseFactor || [1, 1, 1, 1];
          obj.material.color = new THREE.Color(r, g, b);
          obj.material.opacity = a;
          obj.material.metalness = 0.35;
          obj.material.roughness = Math.max(0.12, 1 - (sg.glossinessFactor || 0.5));

          // Glass: keep it translucent but much softer so reflections don't
          // show the underlying polygon facets.
          if (rawByName.name === 'Glass') {
            obj.material.roughness = 0.25;
            obj.material.metalness = 0.1;
            obj.material.transparent = true;
            obj.material.opacity = 0.35;
            obj.material.depthWrite = false;
            obj.material.side = THREE.FrontSide;   // no inside faces showing through
          }

          // "Lights" material is the glowing back panels. Push their emissive
          // way up so postfx bloom turns them into real light sources.
          if (rawByName.name === 'Lights') {
            obj.material.emissive = new THREE.Color(0x9bd8ff);  // match engine hue
            obj.material.emissiveIntensity = 6.0;
            obj.material.color = new THREE.Color(0xffffff);
            obj.material.toneMapped = false;                    // let bloom blow them out
            emissiveLights.push(obj.material);
          } else if (rawByName.emissiveFactor) {
            obj.material.emissive = new THREE.Color(...rawByName.emissiveFactor);
          }

          if (rawByName.alphaMode === 'BLEND') {
            obj.material.transparent = true;
            obj.material.depthWrite = false;
          }

          if (envMap) obj.material.envMap = envMap;
          obj.material.envMapIntensity = 0.8;
          obj.material.needsUpdate = true;
        }
        obj.frustumCulled = false;
      });

      // --- Normalize scale and center --------------------------------------
      // Compute the world-space bounding box AFTER the gltf's own matrices
      // have been applied. Scale first, then center, so offsets don't fight
      // with the embedded 100x armature scale.
      modelHolder.add(model);
      modelHolder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(modelHolder);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetLength = 2.4;
      const s = targetLength / maxDim;
      modelHolder.scale.setScalar(s);

      // Recompute box after scaling, then recentre on origin.
      modelHolder.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(modelHolder);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      modelHolder.position.sub(center);

      modelHolder.rotation.y = Math.PI;

      console.log('[ship] loaded', {
        size: size.toArray(),
        scale: s,
        center: center.toArray(),
        emissiveParts: emissiveLights.length,
      });
    },
    undefined,
    (err) => {
      console.error('[ship] failed to load spaceship model:', err);
    },
  );

  return {
    group,
    uniforms,
    engineUniforms,
    engines: [],
    gem: null,
    emissiveLights,
    exhaustPoints: [
      new THREE.Vector3(-0.22, 0, 1.38),
      new THREE.Vector3( 0.22, 0, 1.38),
    ],
  };
}

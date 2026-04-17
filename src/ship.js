import * as THREE from 'three';
import { SHIP_VERT, SHIP_FRAG, ENGINE_VERT, ENGINE_FRAG, GEM_FRAG } from './shaders/ship.js';

// Procedurally-built starship. Forward = -Z (three.js default).
// The ship is a pivot group; every child is laid out relative to it.
export function createShip() {
  const group = new THREE.Group();

  const uniforms = {
    uTime:     { value: 0 },
    uThrottle: { value: 0 },
    uBase:     { value: new THREE.Color('#0a0a16') },
    uRim:      { value: new THREE.Color('#7de3ff') },
    uAccent:   { value: new THREE.Color('#c38bff') },
  };

  const hullMat = new THREE.ShaderMaterial({
    vertexShader: SHIP_VERT,
    fragmentShader: SHIP_FRAG,
    uniforms,
  });

  // --- Main hull: a 6-sided fuselage, narrowing to a point at the nose. ---
  // CylinderGeometry(radiusTop=0, radiusBottom=0.35, height=2, 6 radialSegments)
  // gives a hex cone. We rotate so the axis lies along -Z (nose forward).
  const hullGeo = new THREE.CylinderGeometry(0.0, 0.32, 2.0, 6, 1);
  hullGeo.rotateX(-Math.PI / 2);       // lay down along Z axis
  // After rotation, the "top" (radius 0) is at -Z → that's the nose. Good.
  const hull = new THREE.Mesh(hullGeo, hullMat);
  group.add(hull);

  // --- Tail piece: a short cap at the rear ---
  const tailGeo = new THREE.CylinderGeometry(0.32, 0.2, 0.35, 6);
  tailGeo.rotateX(-Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, hullMat);
  tail.position.z = 1.18;
  group.add(tail);

  // --- Wings: two angled delta panels using ExtrudeGeometry ---
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(1.1, 0.15);
  wingShape.lineTo(1.0, 0.45);
  wingShape.lineTo(0.15, 0.05);
  wingShape.lineTo(0, 0);
  const wingExtrude = {
    depth: 0.05,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.02,
    bevelThickness: 0.015,
  };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrude);
  // Shape lives in XY plane; rotate so it lies in ship's XZ plane (wing-like).
  wingGeo.rotateX(Math.PI / 2);
  wingGeo.translate(0, 0, 0.3);    // push toward rear

  const wingR = new THREE.Mesh(wingGeo, hullMat);
  wingR.rotation.y = -0.08;
  wingR.rotation.z = -0.15;
  group.add(wingR);

  const wingL = new THREE.Mesh(wingGeo.clone(), hullMat);
  wingL.scale.x = -1;              // mirror to the other side
  wingL.rotation.y = 0.08;
  wingL.rotation.z = 0.15;
  group.add(wingL);

  // --- Vertical fin (tail rudder) ---
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.5, 0.1);
  finShape.lineTo(0.4, 0.6);
  finShape.lineTo(0.0, 0.55);
  finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.04, bevelEnabled: false,
  });
  // Sit vertically along top of tail.
  finGeo.rotateY(Math.PI / 2);
  finGeo.translate(-0.02, 0.0, 0.4);
  const fin = new THREE.Mesh(finGeo, hullMat);
  group.add(fin);

  // --- Cockpit gem: a bright inner core near the nose ---
  const gemMat = new THREE.ShaderMaterial({
    vertexShader: SHIP_VERT,
    fragmentShader: GEM_FRAG,
    uniforms: { uTime: uniforms.uTime },
    transparent: false,
  });
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), gemMat);
  gem.position.set(0, 0.08, -0.55);
  group.add(gem);

  // --- Engine glows: two thruster halos at the rear ---
  const engineUniforms = {
    uTime:     { value: 0 },
    uThrottle: uniforms.uThrottle,      // shared
    uColor:    { value: new THREE.Color('#9bd8ff') },
  };
  const engineMat = new THREE.ShaderMaterial({
    vertexShader: ENGINE_VERT,
    fragmentShader: ENGINE_FRAG,
    uniforms: engineUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const engineGeo = new THREE.PlaneGeometry(0.9, 0.9);

  const engineL = new THREE.Mesh(engineGeo, engineMat);
  engineL.position.set(-0.22, 0.0, 1.38);
  engineL.renderOrder = 2;
  group.add(engineL);

  const engineR = new THREE.Mesh(engineGeo, engineMat);
  engineR.position.set(0.22, 0.0, 1.38);
  engineR.renderOrder = 2;
  group.add(engineR);

  // --- Small "wing tip" accent lights ---
  const tipGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const tipMatCyan = new THREE.MeshBasicMaterial({ color: 0x7de3ff });
  const tipMatMag  = new THREE.MeshBasicMaterial({ color: 0xff7adf });

  const tipL = new THREE.Mesh(tipGeo, tipMatCyan);
  tipL.position.set(1.05, 0.02, 0.7);
  group.add(tipL);
  const tipR = new THREE.Mesh(tipGeo, tipMatMag);
  tipR.position.set(-1.05, 0.02, 0.7);
  group.add(tipR);

  // Public API.
  return {
    group,
    uniforms,
    engineUniforms,
    engines: [engineL, engineR],
    gem,
    // World-space accessor for where the thruster exhausts.
    exhaustPoints: [new THREE.Vector3(-0.22, 0, 1.38), new THREE.Vector3(0.22, 0, 1.38)],
  };
}

import * as THREE from 'three';
import { createNebula }         from './nebula.js';
import { createPlanets }        from './planets.js';
import { createParticles }      from './particles.js';
import { createStreaks }        from './streaks.js';
import { createAsteroids }      from './asteroids.js';
import { createPhoenix }        from './phoenix.js';
import { createShip }           from './ship.js';
import { createTrails }         from './trail.js';
import { ShipControls }         from './controls.js';
import { createPostFX }         from './postfx.js';
import { CosmicAudio }          from './audio.js';
import { EngineAudio }          from './engineAudio.js';

// --- Bootstrap --------------------------------------------------------------
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.72;    // much darker baseline
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 2000);
camera.position.set(0, 3, 14);

// --- Systems ---------------------------------------------------------------
const nebula    = createNebula();
const planets   = createPlanets();
const particles = createParticles();
// Keep the pixel-starfield — it's what sells "deep space" when standing still.
const asteroids = createAsteroids({ count: 110, extent: 1800, minR: 2.0, maxR: 22.0 });
const phoenix   = createPhoenix({ renderer });
const ship      = createShip(renderer);
const trails    = createTrails(ship, { length: 60 });

// Camera in scene graph so the streak overlay (child of camera) renders.
scene.add(camera);
const streaks = createStreaks(camera);

scene.add(nebula.mesh);
scene.add(planets.group);
scene.add(phoenix.group);
scene.add(asteroids.group);
scene.add(particles.group);
scene.add(ship.group);
scene.add(trails.group);

ship.group.position.set(0, 0, 0);

const { composer, bloom, gradePass } = createPostFX(renderer, scene, camera);
const audio = new CosmicAudio({ src: './Helios.mp3', volume: 0.7 });
const engineAudio = new EngineAudio({ volume: 0.55 });
const controls = new ShipControls({
  ship,
  canvas,
  onBoostChange: (b) => {
    if (b) {
      audio.duck();
      engineAudio.boostAttack();
    }
  },
  onHyperChange: (h) => {
    if (h) {
      audio.duck();
      engineAudio.hyperBreak();
      // Retrigger the shockwave CSS animation.
      shockwaveEl.classList.remove('fire');
      void shockwaveEl.offsetWidth;
      shockwaveEl.classList.add('fire');
      warpBadgeEl.classList.add('show');
      document.body.classList.add('hyper');
    } else {
      warpBadgeEl.classList.remove('show');
      document.body.classList.remove('hyper');
    }
  },
});

// --- UI refs ----------------------------------------------------------------
const veilEl       = document.getElementById('veil');
const enterBtn     = document.getElementById('enter-btn');
const progressBar  = document.getElementById('progress-bar');
const hudEl        = document.getElementById('hud');
const speedFillEl  = document.getElementById('speed-fill');
const speedValEl   = document.getElementById('speed-val');
const statusEl     = document.getElementById('status');
const muteBtn      = document.getElementById('mute-btn');
const crosshairEl  = document.getElementById('crosshair');
const audioWarnEl  = document.getElementById('audio-warn');
const shockwaveEl  = document.getElementById('shockwave');
const warpBadgeEl  = document.getElementById('warp-badge');

let ready = false;

// --- Audio / Awaken ---------------------------------------------------------
(function preload() {
  let p = 0;
  const step = () => {
    p = Math.min(1, p + 0.07 + Math.random() * 0.02);
    progressBar.style.width = `${p * 100}%`;
    if (p < 1) setTimeout(step, 110);
    else enterBtn.disabled = false;
  };
  step();
})();

enterBtn.addEventListener('click', async () => {
  const result = await audio.start();
  engineAudio.start();
  if (!result.ok) {
    audioWarnEl.classList.add('show');
    setTimeout(() => audioWarnEl.classList.remove('show'), 9000);
  }
  ready = true;
  document.body.classList.add('awake');
  veilEl.classList.add('gone');
  setTimeout(() => veilEl.remove(), 1600);
  hudEl.classList.add('ready');
  crosshairEl.classList.add('ready');
  // Request pointer lock on the next click (users will naturally click
  // to start flying).
  statusEl.textContent = 'Click anywhere to take the helm.';
});

muteBtn.addEventListener('click', () => {
  const m = !audio.muted;
  audio.setMuted(m);
  engineAudio.setMuted(m);
  muteBtn.textContent = m ? 'Sound · Off' : 'Sound · On';
  muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  statusEl.textContent = locked
    ? 'In flight — WASD · Mouse · Shift · Space'
    : 'Click anywhere to take the helm.';
});

// --- Resize ----------------------------------------------------------------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  particles.stars.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  streaks.resize(camera);
}
window.addEventListener('resize', onResize);

// --- Camera rig (third-person follow) ---------------------------------------
const camOffsetBase   = new THREE.Vector3(0, 1.8, 6.5);   // base (behind + above)
const camOffset       = camOffsetBase.clone();            // scaled by zoom
const camLookAhead    = new THREE.Vector3(0, 0.4, -8);    // local (in front)
const tmpCamPos       = new THREE.Vector3();
const tmpCamLook      = new THREE.Vector3();
const camLookCurrent  = new THREE.Vector3();               // smoothed lookAt target
let camLookInit       = false;
const tmpMouseWorld   = new THREE.Vector3();
const ndc             = new THREE.Vector3();

// --- Orbit camera (middle-mouse hold to inspect the ship) -------------------
const orbit = {
  active: false,
  yaw: 0,                                     // radians around ship-Y
  pitch: Math.atan2(camOffset.y, camOffset.z),// match the follow-cam tilt
  distance: Math.hypot(camOffset.y, camOffset.z),
};

// --- Mouse-wheel zoom -------------------------------------------------------
const ZOOM_MIN = 0.4;    // closer to the ship
const ZOOM_MAX = 3.5;    // pulled far back
let zoom = 1;
const baseOrbitDistance = orbit.distance;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  // Exponential zoom feels smooth at any distance.
  const k = Math.exp(e.deltaY * 0.0012);
  zoom = THREE.MathUtils.clamp(zoom * k, ZOOM_MIN, ZOOM_MAX);
  camOffset.copy(camOffsetBase).multiplyScalar(zoom);
  orbit.distance = baseOrbitDistance * zoom;
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 1) return;                 // middle button only
  e.preventDefault();
  orbit.active = true;
  controls.aimEnabled = false;                // don't steer while inspecting
  orbit.yaw = 0;
  orbit.pitch = Math.atan2(camOffset.y, camOffset.z);
});
canvas.addEventListener('mouseup', (e) => {
  if (e.button !== 1) return;
  orbit.active = false;
  controls.aimEnabled = true;
});
canvas.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();     // stop browser autoscroll
});
document.addEventListener('mousemove', (e) => {
  if (!orbit.active) return;
  orbit.yaw   -= (e.movementX || 0) * 0.004;
  orbit.pitch = THREE.MathUtils.clamp(
    orbit.pitch - (e.movementY || 0) * 0.004,
    -1.3, 1.3,
  );
});

// --- Animation loop --------------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t  = clock.getElapsedTime();

  // --- Input / ship motion --------------------------------------------------
  if (ready) controls.update(dt);

  // Ensure the ship's world matrix reflects the updated transform before we
  // sample it for the camera follow, trails, and particle mouse-in-local.
  ship.group.updateMatrixWorld(true);

  const speed    = controls.speed();
  const throttle = controls.throttle;
  const boosting = controls.boosting;
  const hyper    = controls.hyperActive;
  const hyperCharge = controls.hyperCharge;

  // --- Camera follow / orbit ----------------------------------------------
  if (orbit.active) {
    // Spherical offset in ship-local space, so orbit sticks to the ship.
    const d  = orbit.distance;
    const cp = Math.cos(orbit.pitch);
    tmpCamPos.set(
      d * cp * Math.sin(orbit.yaw),
      d * Math.sin(orbit.pitch),
      d * cp * Math.cos(orbit.yaw),
    );
    ship.group.localToWorld(tmpCamPos);
    tmpCamLook.copy(ship.group.position);     // look at ship centre
  } else {
    tmpCamPos.copy(camOffset);
    ship.group.localToWorld(tmpCamPos);
    tmpCamLook.copy(camLookAhead);
    ship.group.localToWorld(tmpCamLook);

    if (boosting) {
      const shake = hyper ? 0.22 : 0.06;
      tmpCamPos.x += (Math.random() - 0.5) * shake;
      tmpCamPos.y += (Math.random() - 0.5) * shake;
      if (hyper) tmpCamPos.z += (Math.random() - 0.5) * shake * 0.5;
    }
  }

  // FOV punch — widens in boost, slams open in hyper for the warp-tunnel feel.
  const baseFov = 62;
  const targetFov = hyper ? baseFov + 18 : (boosting ? baseFov + 5 : baseFov);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4.5);
  camera.updateProjectionMatrix();

  // Smooth follow (position + look target).
  const followK = 1 - Math.exp(-dt * 6);
  camera.position.lerp(tmpCamPos, followK);
  if (!camLookInit) {
    camLookCurrent.copy(tmpCamLook);
    camLookInit = true;
  } else {
    camLookCurrent.lerp(tmpCamLook, followK);
  }
  camera.lookAt(camLookCurrent);

  // --- Trails --------------------------------------------------------------
  trails.update(dt, throttle);

  // --- Env uniforms --------------------------------------------------------
  // Nebula: reactive to ship speed (faster = brighter accents).
  nebula.uniforms.uTime.value = t;
  nebula.uniforms.uProgress.value = Math.min(1, speed / controls.boostMaxSpeed);
  nebula.uniforms.uIntensity.value = 0.3 + throttle * 0.7;
  // Use ship forward as the "mouse" vector to subtly warm the direction of travel.
  nebula.uniforms.uMouse.value.copy(controls.forward());

  // Phoenix — slow, ponderous spin.
  phoenix.update(dt);

  // Asteroids — per-instance spin.
  asteroids.update(dt);

  // Nebula follows the ship (infinite-feeling skybox).
  nebula.mesh.position.copy(ship.group.position);

  particles.dust.uniforms.uShipPos.value.copy(ship.group.position);
  particles.dust.uniforms.uShipVel.value.copy(controls.velocity);
  particles.dust.uniforms.uTime.value = t;

  // Ship visuals.
  ship.uniforms.uTime.value = t;
  ship.uniforms.uThrottle.value = throttle;
  ship.engineUniforms.uTime.value = t;

  // Engine sound reacts to throttle + boost + hyper.
  engineAudio.update(dt, throttle, boosting, hyper);

  // --- Post FX -------------------------------------------------------------
  // Streaks: only a hint during boost — the real motion comes from dust.
  const boostVis = boosting ? Math.min(1, throttle * 0.55) : 0;
  const hyperVis = hyper ? 1.0 : 0;
  streaks.uniforms.uTime.value = t;
  streaks.uniforms.uIntensity.value = THREE.MathUtils.lerp(
    streaks.uniforms.uIntensity.value,
    Math.max(boostVis, hyperVis),
    Math.min(1, dt * 5),
  );

  gradePass.uniforms.uTime.value = t;
  gradePass.uniforms.uChroma.value =
    0.0012 + throttle * 0.0016 + boostVis * 0.005 + hyperVis * 0.014;
  gradePass.uniforms.uFade.value = 1.0;
  // Bloom stays low so only bright points (orb, suns, engines) glow.
  bloom.strength = 0.35 + throttle * 0.08 + boostVis * 0.18 + hyperVis * 0.75;

  // --- HUD -----------------------------------------------------------------
  // Normalize against the hyper ceiling so boost reads ~55% and hyper fills.
  const pct = Math.min(1, speed / controls.hyperMaxSpeed);
  speedFillEl.style.width = `${pct * 100}%`;
  speedValEl.textContent = `${Math.round(speed).toString().padStart(3, '0')}`;
  // Pulse the speed bar while charging toward the break.
  speedFillEl.style.filter =
    hyperCharge > 0 ? `drop-shadow(0 0 ${6 + hyperCharge * 14}px rgba(255,106,61,${0.3 + hyperCharge * 0.7}))` : '';

  composer.render();
  requestAnimationFrame(frame);
}

frame();

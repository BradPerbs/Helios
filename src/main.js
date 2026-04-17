import * as THREE from 'three';
import { createNebula }         from './nebula.js';
import { createPlanets }        from './planets.js';
import { createParticles }      from './particles.js';
import { createStreaks }        from './streaks.js';
import { createSuns, updateSuns } from './suns.js';
import { createShip }           from './ship.js';
import { createTrails }         from './trail.js';
import { ShipControls }         from './controls.js';
import { createPostFX }         from './postfx.js';
import { CosmicAudio }          from './audio.js';

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
renderer.setClearColor(0x010104, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 2000);
camera.position.set(0, 3, 14);

// --- Systems ---------------------------------------------------------------
const nebula    = createNebula();
const planets   = createPlanets();
const particles = createParticles();
// Drop the colored pixel-starfield — keep only the speed-dust layer.
particles.group.remove(particles.stars.points);
const suns      = createSuns();
const ship      = createShip(renderer);
const trails    = createTrails(ship, { length: 60 });

// Camera in scene graph so the streak overlay (child of camera) renders.
scene.add(camera);
const streaks = createStreaks(camera);

scene.add(nebula.mesh);
scene.add(planets.group);
scene.add(particles.group);
scene.add(suns.group);
scene.add(ship.group);
scene.add(trails.group);

ship.group.position.set(0, 0, 0);

const { composer, bloom, gradePass } = createPostFX(renderer, scene, camera);
const audio = new CosmicAudio({ src: './Helios.mp3', volume: 0.7 });
const controls = new ShipControls({
  ship,
  canvas,
  onBoostChange: (b) => { if (b) audio.duck(); },
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
const camOffset       = new THREE.Vector3(0, 1.8, 6.5);   // local (behind + above)
const camLookAhead    = new THREE.Vector3(0, 0.4, -8);    // local (in front)
const tmpCamPos       = new THREE.Vector3();
const tmpCamLook      = new THREE.Vector3();
const tmpMouseWorld   = new THREE.Vector3();
const ndc             = new THREE.Vector3();

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

  // --- Camera follow -------------------------------------------------------
  // Compute desired camera position in ship's local frame, then to world.
  tmpCamPos.copy(camOffset);
  ship.group.localToWorld(tmpCamPos);
  tmpCamLook.copy(camLookAhead);
  ship.group.localToWorld(tmpCamLook);

  // Light camera shake during boost.
  if (boosting) {
    tmpCamPos.x += (Math.random() - 0.5) * 0.06;
    tmpCamPos.y += (Math.random() - 0.5) * 0.06;
  }

  // Smooth follow.
  const followK = 1 - Math.exp(-dt * 6);
  camera.position.lerp(tmpCamPos, followK);
  // LookAt (computed directly each frame for stable orientation).
  camera.lookAt(tmpCamLook);

  // --- Trails --------------------------------------------------------------
  trails.update(dt, throttle);

  // --- Env uniforms --------------------------------------------------------
  // Nebula: reactive to ship speed (faster = brighter accents).
  nebula.uniforms.uTime.value = t;
  nebula.uniforms.uProgress.value = Math.min(1, speed / controls.boostMaxSpeed);
  nebula.uniforms.uIntensity.value = 0.3 + throttle * 0.7;
  // Use ship forward as the "mouse" vector to subtly warm the direction of travel.
  nebula.uniforms.uMouse.value.copy(controls.forward());

  // Planets — slow axial rotation.
  for (const p of planets.planets) {
    p.mesh.rotation.y += dt * p.rotationSpeed;
  }

  // Nebula follows the ship (infinite-feeling skybox).
  nebula.mesh.position.copy(ship.group.position);

  particles.dust.uniforms.uShipPos.value.copy(ship.group.position);
  particles.dust.uniforms.uShipVel.value.copy(controls.velocity);
  particles.dust.uniforms.uTime.value = t;

  // Suns — always visible now (revealed immediately in this mode).
  updateSuns(suns, camera, t, 1.0);

  // Ship visuals.
  ship.uniforms.uTime.value = t;
  ship.uniforms.uThrottle.value = throttle;
  ship.engineUniforms.uTime.value = t;

  // --- Post FX -------------------------------------------------------------
  // Streaks: only a hint during boost — the real motion comes from dust.
  const boostVis = boosting ? Math.min(1, throttle * 0.55) : 0;
  streaks.uniforms.uTime.value = t;
  streaks.uniforms.uIntensity.value = THREE.MathUtils.lerp(
    streaks.uniforms.uIntensity.value,
    boostVis,
    Math.min(1, dt * 5),
  );

  gradePass.uniforms.uTime.value = t;
  gradePass.uniforms.uChroma.value = 0.0012 + throttle * 0.0016 + boostVis * 0.005;
  gradePass.uniforms.uFade.value = 1.0;
  // Bloom stays low so only bright points (orb, suns, engines) glow.
  bloom.strength = 0.35 + throttle * 0.08 + boostVis * 0.18;

  // --- HUD -----------------------------------------------------------------
  const pct = Math.min(1, speed / controls.boostMaxSpeed);
  speedFillEl.style.width = `${pct * 100}%`;
  speedValEl.textContent = `${Math.round(speed).toString().padStart(3, '0')}`;

  composer.render();
  requestAnimationFrame(frame);
}

frame();

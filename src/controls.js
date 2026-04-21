import * as THREE from 'three';

// Flight controls for the ship:
//   W / S     — forward / reverse thrust
//   A / D     — roll left / right (bank)
//   Q / E     — yaw left / right  (sharper than mouse)
//   Shift     — boost
//   Space     — hard brake
//   Mouse     — pitch + yaw (pointer lock)
//
// The ship has inertia. Damping is tuned for a snappy arcade feel so the
// player doesn't drift forever when they let go of W.
export class ShipControls {
  constructor({ ship, canvas, onBoostChange, onHyperChange }) {
    this.ship   = ship;
    this.canvas = canvas;
    this.onBoostChange = onBoostChange || (() => {});
    this.onHyperChange = onHyperChange || (() => {});

    this.velocity   = new THREE.Vector3();
    this.throttle   = 0;            // smoothed 0..1 for visuals
    this.targetThrottle = 0;
    this.boosting   = false;
    this.braking    = false;

    this.maxSpeed       = 55;
    this.boostMaxSpeed  = 140;
    this.hyperMaxSpeed  = 260;
    this.thrustAccel    = 45;
    this.boostAccel     = 130;
    this.hyperAccel     = 260;
    this.reverseAccel   = 20;
    this.linearDamping  = 0.985;   // per 60hz tick
    this.angularDamping = 0.88;
    this.brakeDamping   = 0.92;

    // "Break the sound barrier" — charges while held at peak boost speed.
    this.hyperCharge   = 0;         // 0..1 build-up while eligible
    this.hyperActive   = false;
    this.hyperChargeTime = 1.5;     // seconds of peak-boost before break
    this.hyperDecayTime  = 0.45;    // seconds for charge to bleed off

    this.mouseSens = 0.0018;
    this.keyRollRate  = 2.2;   // rad/s
    this.keyYawRate   = 1.5;   // rad/s

    this._keys = new Set();
    this._mouseDX = 0;
    this._mouseDY = 0;
    this._locked  = false;
    this.aimEnabled = true;   // external code can pause mouse-aim input

    this._tmpQ = new THREE.Quaternion();
    this._forward = new THREE.Vector3();

    this._bind();
  }

  _bind() {
    const dn = (e) => {
      this._keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    const up = (e) => this._keys.delete(e.code);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup',   up);

    this._onClick = () => {
      // Request lock on first click after awaken.
      if (!this._locked && document.body.classList.contains('awake')) {
        this.canvas.requestPointerLock?.();
      }
    };
    this.canvas.addEventListener('click', this._onClick);

    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === this.canvas;
      document.body.classList.toggle('locked', this._locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._locked || !this.aimEnabled) return;
      this._mouseDX += e.movementX || 0;
      this._mouseDY += e.movementY || 0;
    });
  }

  requestLock() {
    this.canvas.requestPointerLock?.();
  }

  isLocked() { return this._locked; }

  update(dt) {
    const keys = this._keys;
    const ship = this.ship.group;

    // --- Rotation input --------------------------------------------------
    let mouseYaw   = -this._mouseDX * this.mouseSens;
    let mousePitch = -this._mouseDY * this.mouseSens;
    this._mouseDX = 0;
    this._mouseDY = 0;

    let keyYaw = 0;
    if (keys.has('KeyQ')) keyYaw += this.keyYawRate * dt;
    if (keys.has('KeyE')) keyYaw -= this.keyYawRate * dt;

    let keyRoll = 0;
    if (keys.has('KeyA')) keyRoll += this.keyRollRate * dt;
    if (keys.has('KeyD')) keyRoll -= this.keyRollRate * dt;

    // Apply in ship-local frame.
    const yaw   = mouseYaw + keyYaw;
    const pitch = mousePitch;
    const roll  = keyRoll;

    // Quaternion rotations in local axes, composed in YXZ order
    // (yaw → pitch → roll) for predictable flight feel.
    if (yaw !== 0) {
      this._tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      ship.quaternion.multiply(this._tmpQ);
    }
    if (pitch !== 0) {
      this._tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
      ship.quaternion.multiply(this._tmpQ);
    }
    if (roll !== 0) {
      this._tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
      ship.quaternion.multiply(this._tmpQ);
    }

    // --- Thrust input ----------------------------------------------------
    const wasBoosting = this.boosting;
    this.boosting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    this.braking  = keys.has('Space');

    if (this.boosting !== wasBoosting) this.onBoostChange(this.boosting);

    // Local forward in world space.
    this._forward.set(0, 0, -1).applyQuaternion(ship.quaternion);

    const accel = this.hyperActive
      ? this.hyperAccel
      : (this.boosting ? this.boostAccel : this.thrustAccel);
    if (keys.has('KeyW')) {
      this.velocity.addScaledVector(this._forward, accel * dt);
      this.targetThrottle = this.boosting ? 1.0 : 0.75;
    } else if (keys.has('KeyS')) {
      this.velocity.addScaledVector(this._forward, -this.reverseAccel * dt);
      this.targetThrottle = 0.2;
    } else {
      this.targetThrottle = 0.08;
    }

    if (this.braking) {
      const dampK = Math.pow(this.brakeDamping, dt * 60);
      this.velocity.multiplyScalar(dampK);
      this.targetThrottle = 0;
    }

    // Global damping (space is slightly 'sticky' here for game feel).
    const dampG = Math.pow(this.linearDamping, dt * 60);
    this.velocity.multiplyScalar(dampG);

    // Speed cap. In hyper mode the barrier is lifted.
    const vmax = this.hyperActive
      ? this.hyperMaxSpeed
      : (this.boosting ? this.boostMaxSpeed : this.maxSpeed);
    if (this.velocity.length() > vmax) this.velocity.setLength(vmax);

    // Position integration.
    ship.position.addScaledVector(this.velocity, dt);

    // --- Hyper / sound-barrier break ----------------------------------------
    // Charges while holding W+Shift at the top of the boost envelope. Once
    // fully charged it "breaks through" and stays active until the player
    // stops thrusting forward or releases Shift.
    const speedNow = this.velocity.length();
    const forwardThrust = this.boosting && keys.has('KeyW');
    const atPeakBoost = forwardThrust &&
      (speedNow > this.boostMaxSpeed * 0.97 || this.hyperActive);

    if (atPeakBoost) {
      this.hyperCharge = Math.min(1, this.hyperCharge + dt / this.hyperChargeTime);
    } else {
      this.hyperCharge = Math.max(0, this.hyperCharge - dt / this.hyperDecayTime);
    }

    const wasHyper = this.hyperActive;
    if (!this.hyperActive && this.hyperCharge >= 1 && forwardThrust) {
      this.hyperActive = true;
    } else if (this.hyperActive && !forwardThrust) {
      this.hyperActive = false;
      this.hyperCharge = 0;
    }
    if (this.hyperActive !== wasHyper) this.onHyperChange(this.hyperActive);

    // Smooth throttle toward target so visuals don't pop.
    this.throttle += (this.targetThrottle - this.throttle) * Math.min(1, dt * 6);
  }

  speed()    { return this.velocity.length(); }
  forward()  { return this._forward.clone(); }
}

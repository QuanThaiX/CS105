// ./class/PlayerControl.js
import * as THREE from 'three';
import { Game } from './Game.js';

class PlayerControl {
  tank;
  keys;
  keyDownHandler;
  keyUpHandler;
  debug = false;

  // --- NEW/MODIFIED Properties for ADS ---
  isAiming = false;
  raycaster;
  groundPlane;
  crosshairElement;

  // For smooth camera transitions
  transitionProgress = 0.0; // 0 = 3rd person, 1 = 1st person
  previousCameraPosition;
  previousCameraTarget;

  // Define the camera's position relative to the tank in ADS mode.
  // This is in the tank's LOCAL space.
  // x: 0 (center), y: 2.5 (up), z: 1.5 (forward from center)
  adsCameraOffset = new THREE.Vector3(0, 2.5, 1.5);

  constructor(tank) {
    this.keys = {};
    this.tank = tank;

    this.keyDownHandler = this.onKeyDown.bind(this);
    this.keyUpHandler = this.onKeyUp.bind(this);

    window.addEventListener("keydown", this.keyDownHandler, false);
    window.addEventListener("keyup", this.keyUpHandler, false);

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.crosshairElement = document.getElementById('crosshair');

    // Initialize vectors to store the 3rd person camera state
    this.previousCameraPosition = new THREE.Vector3();
    this.previousCameraTarget = new THREE.Vector3();

    console.log("PlayerControl initialized for tank", tank.id);
  }

  onKeyDown(event) {
    this.keys[event.code] = true;
  }

  onKeyUp(event) {
    this.keys[event.code] = false;
  }

  isKeyPressed(key) {
    return this.keys[key] || false;
  }

  // --- MODIFIED: The core update loop now handles camera transitions ---
  update() {
    const game = Game.instance;
    if (!this.tank || this.tank.disposed || !game || game.isCutscenePlaying || !this.tank.model) {
      return;
    }

    const controls = game.controls;

    // --- State Management for Aiming ---
    if (this.isKeyPressed("ShiftLeft") && !this.isAiming) {
      // --- ENTERING ADS ---
      this.isAiming = true;
      // Store the current 3rd person camera position and target
      this.previousCameraPosition.copy(game.camera.position);
      this.previousCameraTarget.copy(controls.target);
      controls.enabled = false; // Disable OrbitControls
      if (this.crosshairElement) this.crosshairElement.classList.remove('hidden');

    } else if (!this.isKeyPressed("ShiftLeft") && this.isAiming) {
      // --- EXITING ADS ---
      this.isAiming = false;
      if (this.crosshairElement) this.crosshairElement.classList.add('hidden');
    }


    // --- Camera Transition Logic ---
    // This runs every frame to smoothly move the camera
    const transitionSpeed = 0.08;
    if (this.isAiming) {
      // We are aiming, so move progress towards 1 (fully ADS)
      this.transitionProgress = Math.min(1.0, this.transitionProgress + transitionSpeed);
    } else {
      // We are not aiming, so move progress towards 0 (fully 3rd person)
      this.transitionProgress = Math.max(0.0, this.transitionProgress - transitionSpeed);
    }

    // Only re-enable controls when fully transitioned back to 3rd person
    if (!this.isAiming && this.transitionProgress === 0) {
        controls.enabled = true;
    }

    // --- Apply the camera position based on transition progress ---
    if (this.transitionProgress > 0) {
        // Calculate the target ADS camera position in WORLD space
        const adsTargetPosition = this.tank.model.localToWorld(this.adsCameraOffset.clone());

        // The point the camera should look at is the raycast intersection point.
        this.raycaster.setFromCamera({ x: 0, y: 0 }, game.camera);
        const lookAtPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, lookAtPoint);

        if (lookAtPoint) {
            // Smoothly interpolate the camera's position
            game.camera.position.lerpVectors(this.previousCameraPosition, adsTargetPosition, this.transitionProgress);
            // Smoothly interpolate the camera's look-at target
            controls.target.lerpVectors(this.previousCameraTarget, lookAtPoint, this.transitionProgress);

            // Always tell the tank to aim at the crosshair point
            this.tank.aimAt(lookAtPoint);
        }
    }


    // --- Movement & Shooting Logic ---
    // If not aiming, allow standard rotation. Otherwise, aiming controls rotation.
    if (!this.isAiming) {
      if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
        this.tank.rotateLeft();
      }
      if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
        this.tank.rotateRight();
      }
    }

    // Movement is always allowed
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) {
      this.tank.moveForward();
    }
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) {
      this.tank.moveBackward();
    }
    
    // Shooting is always allowed
    if (this.keys["Space"]) {
      const currentTime = Date.now();
      const timeSinceLastShot = currentTime - this.tank.lastShotTime;
      if (timeSinceLastShot >= this.tank.shootCooldown) {
        this.tank.shoot();
      }
    }
  }

  dispose() {
    console.log("Disposing PlayerControl");
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    this.keys = {};
    this.tank = null;

    if (this.crosshairElement) {
        this.crosshairElement.classList.add('hidden');
    }
  }
}

export { PlayerControl };
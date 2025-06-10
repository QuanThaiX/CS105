// ./class/PlayerControl.js
import { Game } from './Game.js';

class PlayerControl {
  tank;
  keys;
  keyDownHandler;
  keyUpHandler;
  debug = false;

  constructor(tank) {
    this.keys = {};
    this.tank = tank;

    this.keyDownHandler = this.onKeyDown.bind(this);
    this.keyUpHandler = this.onKeyUp.bind(this);

    window.addEventListener("keydown", this.keyDownHandler, false);
    window.addEventListener("keyup", this.keyUpHandler, false);
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

  update() {
    const game = Game.instance;
    if (!this.tank || this.tank.disposed || !game || game.isCutscenePlaying || !this.tank.model) {
      return;
    }

    // --- Movement & Shooting Logic ---
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
      this.tank.rotateLeft();
    }
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
      this.tank.rotateRight();
    }

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) {
      this.tank.moveForward();
    }
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) {
      this.tank.moveBackward();
    }
    
    if (this.keys["Space"]) {
      const currentTime = Date.now();
      const timeSinceLastShot = currentTime - this.tank.lastShotTime;
      if (timeSinceLastShot >= this.tank.shootCooldown) {
        this.tank.shoot();
      }
    }
  }

  dispose() {
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    this.keys = {};
    this.tank = null;
  }
}

export { PlayerControl }; 
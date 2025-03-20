class PlayerControl {
  tank;
  keys;
  constructor(tank) {
    this.keys = {};
    this.tank = tank;
    window.addEventListener("keydown", (event) => this.onKeyDown(event), false);
    window.addEventListener("keyup", (event) => this.onKeyUp(event), false);
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

  update(){
    const currentTime = Date.now();
    if (this.keys["KeyW"]) {
      this.tank.moveForward();
    }
    if (this.keys["KeyS"]) {
      this.tank.moveBackward();
    }
    if (this.keys["KeyA"]) {
      this.tank.rotateLeft();
    }
    if (this.keys["KeyD"]) {
      this.tank.rotateRight();
    }
    if (this.keys["Space"] && currentTime - this.tank.lastShotTime >= this.tank.shootCooldown) {
      this.tank.shoot();
    }
  }
}

export { PlayerControl };

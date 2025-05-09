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

  update(){
    if (!this.tank) {
      return;
    }
    
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
    if (this.keys["Space"]) {
      const timeSinceLastShot = currentTime - this.tank.lastShotTime;
      if (timeSinceLastShot >= this.tank.shootCooldown) {
        const result = this.tank.shoot();
      }
    }
  }
  
  // dispose() {
  //   console.log("Disposing PlayerControl");
  //   window.removeEventListener("keydown", this.keyDownHandler);
  //   window.removeEventListener("keyup", this.keyUpHandler);
  //   this.keys = {};
  //   this.tank = null;
  // }

  // setDebug(enableDebug) {
  //   this.debug = enableDebug;
  // }
}

export { PlayerControl };

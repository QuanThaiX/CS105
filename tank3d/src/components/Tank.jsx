import * as THREE from 'three';

class Tank {
  constructor(scene) {
    this.scene = scene;
    this.keyState = {};

    this.initTank();
    this.addEventListeners();
  }

  initTank() {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    this.tank = new THREE.Mesh(geometry, material);
    this.scene.add(this.tank);
  }

  addEventListeners() {
    document.addEventListener('keydown', (event) => this.handleKeyDown(event));
    document.addEventListener('keyup', (event) => this.handleKeyUp(event));
  }

  handleKeyDown(event) {
    this.keyState[event.code] = true;
  }

  handleKeyUp(event) {
    this.keyState[event.code] = false;
  }

  updatePosition() {
    if (this.keyState['KeyW']) this.tank.position.z -= 0.1;
    if (this.keyState['KeyS']) this.tank.position.z += 0.1;
    if (this.keyState['KeyA']) this.tank.position.x -= 0.1;
    if (this.keyState['KeyD']) this.tank.position.x += 0.1;
  }
}

export default Tank;


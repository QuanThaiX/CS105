import * as THREE from 'three';

class GameCamera {
  constructor(scene) {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.scene = scene;
    this.camera.position.set(0, 5, 10);
    this.scene.add(this.camera);
  }

  update(targetPosition) {
    const { x, y, z } = targetPosition;
    this.camera.position.set(x + 5, y + 5, z + 10);
    this.camera.lookAt(targetPosition);
  }
}

export default GameCamera;
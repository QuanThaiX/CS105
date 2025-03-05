import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CollisionManager } from "./CollisionManager";
import { Tank } from './Tank.js';
import { Game } from './Game.js';
import { GameObject } from "./GameObject.js";

class Bullet extends GameObject{
  static count = 0;
  prevPosition;
  velocity;
  constructor(type, position) {
    super("bullet" + Bullet.count, type, position, true);
    Bullet.count++;

    this.prevPosition = this.position.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.setModel(this.createMesh());
    CollisionManager.instance.add(this); 
  }

  setVelocity(velocityVector) {
    this.velocity.copy(velocityVector);
  }

  createMesh() {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.position);
    mesh.castShadow = true;
    return mesh;
  }

  update() {
    if (this.mesh) {
      this.model.position.add(this.velocity);
      this.position.copy(this.model.position);
    }
  }

  onCollision(otherObject) {
    if (otherObject instanceof Tank){
      console.log(this.faction);
      if (this.faction != otherObject.faction){
        this.scene.remove(this.mesh);
        CollisionManager.instance.remove(this);
      }
    }
  }
}

export { Bullet }

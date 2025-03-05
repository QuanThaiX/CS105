import * as THREE from "three";
import { GAMECONFIG } from '../config.js';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Bullet } from "./Bullet.js";
import { CollisionManager } from "./CollisionManager.js";
import { Game } from './Game.js'
import { GameObject } from './GameObject.js'
import { EventManager } from "./EventManager.js";

export const FACTION = Object.freeze({
  PLAYER: "player",
  ENEMY: "enemy",
});

class Tank extends GameObject{
  hp;
  moveSpeed;
  rotateSpeed;
  prevPosition;
  lastShotTime = 0;
  shootCooldown = 450;

  constructor(id, type, position, isCollision) {
    super(id, type, position, isCollision);
    this.setStat();
    this.prevPosition = this.position.clone();
    this.loadModel("./src/assets/tankv001.gltf").then((model) => {this.setModel(model)});

    EventManager.instance.subscribe("collision", this.handleCollision.bind(this));
  }

  loadModel(modelPath) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene;
          model.position.copy(this.position);
          model.scale.set(3.5, 3.5, 3.5);

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              if (child.material.map) {
                console.log("Texture loaded:", child.material.map);
              } else {
                console.warn("Texture missing in", child.name);
              }
            }
          });

          resolve(model);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }


  setStat(){
    this.moveSpeed = 0.1;
    this.rotateSpeed = 0.03;
    if (this.faction == FACTION.PLAYER){
      this.hp = GAMECONFIG.PLAYER.HP;
    } else if (this.faction == FACTION.ENEMY){
      this.hp = GAMECONFIG.ENEMY.HP;
    } else {
      this.hp = GAMECONFIG.DEFAULT.HP;
    }
  }

  moveForward(distance = this.moveSpeed) {
    if (this.model) {
      this.prevPosition.copy(this.position);
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(this.model.quaternion);
      this.model.position.add(forward.multiplyScalar(distance));
      this.position.copy(this.model.position);
    }
  }

  moveBackward(distance = this.moveSpeed) {
    if (this.model) {
      this.prevPosition.copy(this.position);
      const backward = new THREE.Vector3(0, 0, -1);
      backward.applyQuaternion(this.model.quaternion);
      this.model.position.add(backward.multiplyScalar(distance));
      this.position.copy(this.model.position);
    }
  }

  rotateLeft(angle = this.rotateSpeed) {
    if (this.model) {
      this.model.rotation.y += angle;
    }
  }

  rotateRight(angle = this.rotateSpeed) {
    if (this.model) {
      this.model.rotation.y -= angle;
    }
  }

  shoot() {
    if (this.model) {
      const bulletPosition = this.model.position.clone();
      bulletPosition.y += 1.2;
      const forward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.model.quaternion)
        .normalize();
      bulletPosition.add(forward.clone().multiplyScalar(4));

      const bullet = new Bullet("player", bulletPosition);
      bullet.setVelocity(forward.multiplyScalar(0.5));
      bullet.createMesh();

      Game.instance.projectiles.push(bullet);
      this.lastShotTime = Date.now();
      return bullet;
    }
    return null;
  }

  startAutoShoot(interval = 1000) {
    if (!this.shootInterval) {
      this.shootInterval = setInterval(() => {
        this.shoot();
      }, interval);
    }
  }

  stopAutoShoot() {
    if (this.shootInterval) {
      clearInterval(this.shootInterval);
      this.shootInterval = null;
    }
  }

  dispose(){
    this.stopAutoShoot()
    this.scene.remove(this.mesh);
    CollisionManager.instance.remove(this);
  }

  handleCollision({ objA, objB }) {
    if (objA === this || objB === this) {
      const otherObject = objA === this ? objB : objA;
      console.log("collision: " + this.constructor.name + "---" + otherObject.constructor.name);

      if (otherObject instanceof Tank) {
        if (this.prevPosition) {
          this.model.position.copy(this.prevPosition);
          this.position.copy(this.prevPosition);
        }
      }

      if (otherObject instanceof Bullet) {
        if (this.faction !== otherObject.faction) {
          this.hp -= 10;
          console.log(this.hp);
          if (this.hp <= 0) {
            this.dispose();
          }
        }
      }
    }
  }
}

export { Tank };

import * as THREE from "three";
import { FACTION, EVENT } from "../utils.js";
import { GAMECONFIG } from '../config.js';
import { GLTFLoader } from "../three/examples/jsm/loaders/GLTFLoader.js";
import { Bullet } from "./Bullet.js";
import { CollisionManager } from "./CollisionManager.js";
import { Game } from './Game.js'
import { HealthBar } from "./HealthBar.js";
import { GameObject } from './GameObject.js'
import { EventManager } from "./EventManager.js";
import { ProjectilesManager } from "./ProjectilesManager.js";
import { Bot } from "./Bot.js";

/**
 * Bổ sung hitbox tạo thời điểm tạo, và đc cập nhật khi object di chuyển
 * Bổ sung texture
 */

class Tank extends GameObject{
  hp;
  moveSpeed;
  rotateSpeed;
  prevPosition;
  lastShotTime = 0;
  shootCooldown = 450;
  HealthBar;

  constructor(id, faction, position, isCollision) {
    super(id, faction, position, isCollision);
    this.setStat();
    this.prevPosition = this.position.clone();
    this.loadModel("./assets/tankv001.gltf").then((model) => {this.setModel(model)});
    this.healthBar = new HealthBar(this, this.hp);

    EventManager.instance.subscribe(EVENT.COLLISION, this.handleCollision.bind(this));
    EventManager.instance.subscribe(EVENT.BULLET_HIT, this.handleBulletHit.bind(this));
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
    const currentTime = Date.now();
    if (currentTime - this.lastShotTime < this.shootCooldown) {
      return null;
    }

    if (this.model) {
      const bulletPosition = this.model.position.clone();
      bulletPosition.y += 1.2;
      const forward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.model.quaternion)
        .normalize();
      bulletPosition.add(forward.clone().multiplyScalar(4));

      this.createMuzzleFlash(bulletPosition.clone(), forward);

      const projectilesManager = new ProjectilesManager();
      const bullet = projectilesManager.createBullet(
        this.faction, 
        bulletPosition, 
        forward.clone(), 
        0.5
      );
      
      // Cập nhật thời gian bắn cuối cùng
      this.lastShotTime = currentTime;
      return bullet;
    }
    return null;
  }

  createMuzzleFlash(position, direction) {
    // Tạo ánh sáng khi bắn
    const light = new THREE.PointLight(0xffaa00, 40, 10);
    light.position.copy(position);
    Game.instance.scene.add(light);

    // Tạo hiệu ứng hạt khi bắn
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 20;
    const posArray = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      posArray[i3] = position.x + (Math.random() - 0.5) * 0.5;
      posArray[i3 + 1] = position.y + (Math.random() - 0.5) * 0.5;
      posArray[i3 + 2] = position.z + (Math.random() - 0.5) * 0.5;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.2,
      transparent: true,
      opacity: 0.8
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    Game.instance.scene.add(particles);
    
    setTimeout(() => {
      Game.instance.scene.remove(light);
      Game.instance.scene.remove(particles);
    }, 100);
  }

  playShootSound() {
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
    this.stopAutoShoot();
    super.dispose();
    if (this.faction === FACTION.PLAYER) {
      EventManager.instance.notify(EVENT.PLAYER_DESTROYED, {tank: this});
    } else if (this.faction === FACTION.ENEMY) {
      Bot.instance.removeTank(this);
    }

    if (this.healthBar) {
      this.healthBar.remove();
      this.healthBar = null;
    }

    EventManager.instance.notify(EVENT.TANK_DESTROYED, { tank: this });
    EventManager.instance.unsubscribe(EVENT.COLLISION, this.handleCollision.bind(this));
    EventManager.instance.unsubscribe(EVENT.BULLET_HIT, this.handleBulletHit.bind(this));
    CollisionManager.instance.remove(this);
  }

  handleBulletHit({ bullet, tank, damage }) {
    if (tank === this && this.faction !== bullet.faction) {
      this.hp -= damage;
      if (this.healthBar) {
        this.healthBar.updateHP(this.hp);
      }

      console.log(`${this.id} HP: ${this.hp}`);
      if (this.hp <= 0) {
        this.dispose();
      }
    }
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
          if (this.healthBar) {
            this.healthBar.updateHP(this.hp);
          }

          console.log(this.hp);
          if (this.hp <= 0) {
            this.dispose();
          }
        }
      }
    }
  }

  update() {
    if (this.healthBar) {
      this.healthBar.update();
    }
  }
}

export { Tank };

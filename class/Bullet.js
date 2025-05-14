import * as THREE from "three";
import { COLOR, EVENT, FACTION}  from "../utils.js";
import { GLTFLoader } from "../three/examples/jsm/loaders/GLTFLoader.js";
import { CollisionManager } from "./CollisionManager.js";
import { Tank } from './Tank.js';
import { Game } from './Game.js';
import { GameObject } from "./GameObject.js";
import { EventManager} from "./EventManager.js";
import { Rock } from "./Rock.js";

class Bullet extends GameObject{
  static count = 0;
  prevPosition;
  velocity;
  lifeTime = 5000;
  creationTime;
  hasCollided = false;
  damage = 100;
  boundHandleCollision;

  constructor(faction, position) {
    super("Bullet" + Bullet.count, faction, position, true);
    
    this.prevPosition = this.position.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.creationTime = Date.now();

    this.setModel(this.createMesh());

    Bullet.count++;
    CollisionManager.instance.add(this);
    this.boundHandleCollision = this.handleCollision.bind(this);
    EventManager.instance.subscribe(EVENT.COLLISION, this.boundHandleCollision);
  }

  setVelocity(velocityVector) {
    this.velocity.copy(velocityVector);
  }

  createMesh() {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    //const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const material = new THREE.MeshStandardMaterial({ 
      color: COLOR.red,
      emissive: COLOR.orange,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.position);
    mesh.castShadow = true;

    const light = new THREE.PointLight(COLOR.yellow, 1, 3);
    light.position.set(0, 0, 0);
    mesh.add(light);

    return mesh;
  }

  update() {
    if (this.model) {
      this.prevPosition.copy(this.position);
      this.model.position.add(this.velocity);
      this.position.copy(this.model.position);

      if (Date.now() - this.creationTime > this.lifeTime){
        EventManager.instance.notify(EVENT.BULLET_EXPIRED, {bullet: this});
      }
    }
  }

  handleCollision({ objA, objB }) {
    if (objA === this || objB === this) {
      const otherObject = objA === this ? objB : objA;
      
      if ((otherObject instanceof Tank && this.faction !== otherObject.faction) || otherObject instanceof Rock) {
        console.log(`Log_${EVENT.COLLISION}: ${this.id} -- ${otherObject.id}`);
        this.hasCollided = true;
        this.dispose();
        this.createImpactEffect();
      }
    }
  }

  createImpactEffect() {
    // Tạo hiệu ứng nổ khi đạn va chạm
    const explosionGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const explosionMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8
    });
    
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(this.position);
    Game.instance.scene.add(explosion);
    
    const light = new THREE.PointLight(0xffaa00, 5, 8);
    light.position.copy(this.position);
    Game.instance.scene.add(light);
    
    let scale = 1;
    const animate = () => {
      scale += 0.1;
      explosion.scale.set(scale, scale, scale);
      explosion.material.opacity -= 0.05;
      
      if (explosion.material.opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        Game.instance.scene.remove(explosion);
        Game.instance.scene.remove(light);
        explosion.geometry.dispose();
        explosion.material.dispose();
      }
    };
    
    animate();
  }

  dispose() {
    super.dispose();
    EventManager.instance.unsubscribe(EVENT.COLLISION, this.handleCollision.bind(this));
    CollisionManager.instance.remove(this);
    if (this.model && this.model.parent) {
      this.model.parent.remove(this.model);
    }
    if (this.model) {
      if (this.model.geometry) this.model.geometry.dispose();
      if (this.model.material) {
          if (Array.isArray(this.model.material)) {
              this.model.material.forEach(m => m.dispose());
          } else {
              this.model.material.dispose();
          }
      }
    }
  }
}

export { Bullet }

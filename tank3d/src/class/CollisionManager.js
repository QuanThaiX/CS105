import * as THREE from 'three';
import { GAMECONFIG } from '../config.js'
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';

/**
 * Thay vì tạo box3d mỗi lần render để check colision thì lấy hitbox từ model
 * Cần tối ưu thuật toán detect va chạm thành QuadTree hoặc Octree nếu có projectile 3D trajectory
 */

class CollisionManager {
  static instance;
  objects;
  boxHelpers;
  constructor() {
    if (CollisionManager.instance){
      return CollisionManager.instance;
    }
    CollisionManager.instance = this;
    this.objects = [];
    this.boxHelpers = new Map();
  }
  
  add(gameObject) {
    if (!this.objects.includes(gameObject) && gameObject.isCollision == true) {
      this.objects.push(gameObject);
    }
  }
  
  remove(gameObject) {
    const index = this.objects.indexOf(gameObject);
    if (index !== -1) {
      this.objects.splice(index, 1);
    }

    if (GAMECONFIG.DEBUG === true && this.boxHelpers.has(gameObject.id)) {
      const boxHelper = this.boxHelpers.get(gameObject.id);
      if (boxHelper) {
          Game.instance.scene.remove(boxHelper);
      }
      this.boxHelpers.delete(gameObject.id);
    }
  }

  drawBoxHelpers() {
    this.objects.forEach((obj) => {
        if (obj.model && !this.boxHelpers.has(obj.id)) {
            const boxHelper = new THREE.BoxHelper(obj.model, 0xffff00);
            Game.instance.scene.add(boxHelper);
            this.boxHelpers.set(obj.id, boxHelper);
        }
    });
    this.boxHelpers.forEach((boxHelper, objId) => {
        let obj = this.objects.find(o => o.id === objId);
        if (obj && obj.model) {
            boxHelper.update();
        }
    });
}
  
  update() {
    if (GAMECONFIG.DEBUG === true){
      this.drawBoxHelpers();
    }

    for (let i = 0; i < this.objects.length; i++) {
      const objA = this.objects[i];
      if (!objA.model) continue;
      const boxA = new THREE.Box3().setFromObject(objA.model);
      for (let j = i + 1; j < this.objects.length; j++) {
        const objB = this.objects[j];
        if (!objB.model) continue;
        const boxB = new THREE.Box3().setFromObject(objB.model);
        if (boxA.intersectsBox(boxB)) {

          EventManager.instance.notify(EVENT.COLLISION, {objA, objB})
        }
      }
    }
  }
}

export { CollisionManager };
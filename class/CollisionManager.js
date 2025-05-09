import * as THREE from 'three';
import { GAMECONFIG } from '../config.js'
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT, HITBOX_SCALE } from '../utils.js';
import { Tank } from './Tank.js';
import { Rock } from './Rock.js';
import { Tree } from './Tree.js';

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
      
      // Áp dụng tỷ lệ hitbox phù hợp dựa vào loại đối tượng
      let scaleA = 1.0;
      if (objA instanceof Tank) {
        scaleA = HITBOX_SCALE.TANK;
      } else if (objA instanceof Rock) {
        scaleA = HITBOX_SCALE.ROCK;
      } else if (objA instanceof Tree) {
        scaleA = HITBOX_SCALE.TREE;
      }
      
      const boxA = new THREE.Box3().setFromObject(objA.model);
      // Điều chỉnh kích thước box
      if (scaleA !== 1.0) {
        const center = new THREE.Vector3();
        boxA.getCenter(center);
        const size = new THREE.Vector3();
        boxA.getSize(size);
        
        const newSize = size.multiplyScalar(scaleA);
        boxA.setFromCenterAndSize(center, newSize);
      }
      
      for (let j = i + 1; j < this.objects.length; j++) {
        const objB = this.objects[j];
        if (!objB.model) continue;
        
        // Áp dụng tỷ lệ hitbox phù hợp dựa vào loại đối tượng
        let scaleB = 1.0;
        if (objB instanceof Tank) {
          scaleB = HITBOX_SCALE.TANK;
        } else if (objB instanceof Rock) {
          scaleB = HITBOX_SCALE.ROCK;
        } else if (objB instanceof Tree) {
          scaleB = HITBOX_SCALE.TREE;
        }
        
        const boxB = new THREE.Box3().setFromObject(objB.model);
        // Điều chỉnh kích thước box
        if (scaleB !== 1.0) {
          const center = new THREE.Vector3();
          boxB.getCenter(center);
          const size = new THREE.Vector3();
          boxB.getSize(size);
          
          const newSize = size.multiplyScalar(scaleB);
          boxB.setFromCenterAndSize(center, newSize);
        }
        
        if (boxA.intersectsBox(boxB)) {
          EventManager.instance.notify(EVENT.COLLISION, {objA, objB});
        }
      }
    }
  }
}

export { CollisionManager };
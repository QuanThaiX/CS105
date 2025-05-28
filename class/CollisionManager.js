import * as THREE from 'three';
import { GAMECONFIG } from '../config.js'
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT, HITBOX_SCALE } from '../utils.js';
import { Tank } from './Tank.js';
import { Rock } from './Rock.js';
import { Tree } from './Tree.js';
import { Barrel } from './Barrel.js';
import { Bullet } from './Bullet.js';

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

  /**
   * Check if object is static (non-movable) for optimization
   * @param {GameObject} obj - Object to check
   * @returns {boolean} True if object is static
   */
  isStaticObject(obj) {
    return obj instanceof Rock || 
           obj instanceof Tree || 
           (obj instanceof Barrel && obj.hasExploded);
  }

  /**
   * Check if object can move for game logic optimization
   * @param {GameObject} obj - Object to check
   * @returns {boolean} True if object can move
   */
  canMove(obj) {
    return obj instanceof Tank || 
           obj instanceof Bullet ||
           (obj instanceof Barrel && !obj.hasExploded);
  }

  /**
   * Get appropriate hitbox scale for object type
   * @param {GameObject} obj - Object to get scale for
   * @returns {Object} Scale object with x, y, z properties
   */
  getHitboxScale(obj) {
    if (obj instanceof Tank) {
      return HITBOX_SCALE.TANK;
    } else if (obj instanceof Rock) {
      return HITBOX_SCALE.ROCK;
    } else if (obj instanceof Tree) {
      return HITBOX_SCALE.TREE;
    } else if (obj instanceof Barrel) {
      return HITBOX_SCALE.BARREL;
    }
    return { x: 1.0, y: 1.0, z: 1.0 };
  }

  /**
   * Create scaled bounding box for object
   * @param {GameObject} obj - Object to create box for
   * @returns {THREE.Box3} Scaled bounding box
   */
  createScaledBoundingBox(obj) {
    if (!obj.model) return null;
    
    const scale = this.getHitboxScale(obj);
    const box = new THREE.Box3().setFromObject(obj.model);
    
    // Apply scaling if needed
    if (scale.x !== 1.0 || scale.y !== 1.0 || scale.z !== 1.0) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      const newSize = new THREE.Vector3(
        size.x * scale.x,
        size.y * scale.y,
        size.z * scale.z
      );
      box.setFromCenterAndSize(center, newSize);
    }
    
    return box;
  }

  /**
   * Handle specific collision types with custom logic
   * @param {GameObject} objA - First object
   * @param {GameObject} objB - Second object
   */
  handleSpecialCollisions(objA, objB) {
    // Handle bullet-barrel collisions
    if ((objA instanceof Bullet && objB instanceof Barrel) ||
        (objA instanceof Barrel && objB instanceof Bullet)) {
      
      const bullet = objA instanceof Bullet ? objA : objB;
      const barrel = objA instanceof Barrel ? objA : objB;
      
      if (!barrel.hasExploded && bullet.faction !== 'neutral') {
        barrel.onBulletHit(bullet);
        
        // Notify bullet-barrel collision
        EventManager.instance.notify(EVENT.COLLISION_TANK_BULLET, {
          tank: barrel,
          bullet: bullet,
          damage: bullet.damage || 25,
          newHP: barrel.hp
        });
        
        return true; // Collision handled specifically
      }
    }
    
    return false; // Use default collision handling
  }

  /**
   * Check collision between all objects (for Generator placement)
   * @param {Object} options - { includeStatic: boolean, includeDisposed: boolean }
   * @returns {Array} Array of collision pairs
   */
  checkAllCollisions(options = {}) {
    const { includeStatic = true, includeDisposed = false } = options;
    const collisions = [];
    
    const objectsToCheck = this.objects.filter(obj => {
      if (!obj.model) return false;
      if (!includeDisposed && obj.disposed) return false;
      if (!includeStatic && this.isStaticObject(obj)) return false;
      return true;
    });
    
    for (let i = 0; i < objectsToCheck.length; i++) {
      const objA = objectsToCheck[i];
      const boxA = this.createScaledBoundingBox(objA);
      if (!boxA) continue;
      
      for (let j = i + 1; j < objectsToCheck.length; j++) {
        const objB = objectsToCheck[j];
        const boxB = this.createScaledBoundingBox(objB);
        if (!boxB) continue;
        
        if (boxA.intersectsBox(boxB)) {
          collisions.push({ objA, objB });
        }
      }
    }
    
    return collisions;
  }

  /**
   * Check if position is valid for object placement (Generator use)
   * @param {THREE.Vector3} position - Position to check
   * @param {Object} objectSize - { width, height, depth }
   * @param {Array} excludeObjects - Objects to ignore in check
   * @returns {boolean} True if position is valid
   */
  isPositionValid(position, objectSize, excludeObjects = []) {
    const testBox = new THREE.Box3().setFromCenterAndSize(
      position,
      new THREE.Vector3(objectSize.width, objectSize.height, objectSize.depth)
    );
    
    for (const obj of this.objects) {
      if (excludeObjects.includes(obj) || !obj.model || obj.disposed) continue;
      
      const objBox = this.createScaledBoundingBox(obj);
      if (objBox && testBox.intersectsBox(objBox)) {
        return false;
      }
    }
    
    return true;
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
  
  /**
   * Optimized update for game logic (skips static objects in first loop)
   */
  update() {
    if (GAMECONFIG.DEBUG === true){
      this.drawBoxHelpers();
    }

    // Optimized collision detection for game logic
    // First loop: only check movable objects against each other and static objects
    for (let i = 0; i < this.objects.length; i++) {
      const objA = this.objects[i];
      if (!objA.model || objA.disposed) continue;
      
      // Skip static objects in first loop for optimization
      if (this.isStaticObject(objA)) continue;
      
      const boxA = this.createScaledBoundingBox(objA);
      if (!boxA) continue;
      
      for (let j = 0; j < this.objects.length; j++) {
        if (i === j) continue; // Skip self
        
        const objB = this.objects[j];
        if (!objB.model || objB.disposed) continue;
        
        const boxB = this.createScaledBoundingBox(objB);
        if (!boxB) continue;
        
        if (boxA.intersectsBox(boxB)) {
          // Handle special collisions first
          const specialHandled = this.handleSpecialCollisions(objA, objB);
          
          if (!specialHandled) {
            // Default collision notification
            EventManager.instance.notify(EVENT.COLLISION, {objA, objB});
          }
        }
      }
    }
  }

  /**
   * Force full collision check (for Generator or debugging)
   * @param {boolean} isForGenerate - Whether this is for generation purposes
   */
  updateAll(isForGenerate = false) {
    if (GAMECONFIG.DEBUG === true && !isForGenerate){
      this.drawBoxHelpers();
    }

    const collisions = this.checkAllCollisions({ 
      includeStatic: true, 
      includeDisposed: false 
    });
    
    collisions.forEach(({ objA, objB }) => {
      if (isForGenerate) {
        // For generation, just return collision data without events
        return { objA, objB };
      } else {
        // For game logic, fire events
        const specialHandled = this.handleSpecialCollisions(objA, objB);
        
        if (!specialHandled) {
          EventManager.instance.notify(EVENT.COLLISION, {objA, objB});
        }
      }
    });
    
    return isForGenerate ? collisions : null;
  }

  /**
   * Get all objects within radius of position
   * @param {THREE.Vector3} position - Center position
   * @param {number} radius - Search radius
   * @param {Array} excludeTypes - Object types to exclude
   * @returns {Array} Objects within radius
   */
  getObjectsInRadius(position, radius, excludeTypes = []) {
    return this.objects.filter(obj => {
      if (!obj.model || obj.disposed) return false;
      if (excludeTypes.some(type => obj instanceof type)) return false;
      
      const distance = position.distanceTo(obj.position);
      return distance <= radius;
    });
  }

  /**
   * Dispose collision manager
   */
  dispose() {
    this.objects = [];
    
    // Clean up box helpers
    if (GAMECONFIG.DEBUG === true) {
      this.boxHelpers.forEach((boxHelper) => {
        if (boxHelper && Game.instance?.scene) {
          Game.instance.scene.remove(boxHelper);
        }
      });
    }
    this.boxHelpers.clear();
    
    CollisionManager.instance = null;
  }
}

export { CollisionManager };
// ./class/CollisionManager.js
import * as THREE from 'three';
import { GAMECONFIG } from '../config.js';
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
  _reusableBox3 = new THREE.Box3();
  dynamicObjects;
  staticObjects;
  objectsMap; 
  worker; 
  bboxCache;
  hitboxScaleMap;
  boxHelpers;

  staticObjectsSent = false;
  
  constructor() {
    if (CollisionManager.instance) {
      return CollisionManager.instance;
    }
    CollisionManager.instance = this;
    
    this.dynamicObjects = [];
    this.staticObjects = [];
    this.objectsMap = new Map();
    this.bboxCache = new WeakMap();
    this.boxHelpers = new Map();
    
    // Create and initialize the worker
    if (typeof Worker !== 'undefined') {
        this.worker = new Worker('./class/CollisionWorker.js', { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (error) => console.error("Collision Worker Error:", error);
        
        const worldSize = GAMECONFIG.WORLD_BOUNDARY || 500;
        const worldBounds = new THREE.Box3(
            new THREE.Vector3(-worldSize, -worldSize, -worldSize),
            new THREE.Vector3(worldSize, worldSize, worldSize)
        );

        // Send initialization data to the worker
        this.worker.postMessage({
            type: 'init',
            payload: {
                worldBounds: {
                    min: { x: worldBounds.min.x, y: worldBounds.min.y, z: worldBounds.min.z },
                    max: { x: worldBounds.max.x, y: worldBounds.max.y, z: worldBounds.max.z }
                }
            }
        });
    } else {
        console.error("❌ Web Workers not supported. Collision detection will not run.");
    }

    this.hitboxScaleMap = new Map([
        [Tank, HITBOX_SCALE.TANK],
        [Rock, HITBOX_SCALE.ROCK],
        [Tree, HITBOX_SCALE.TREE],
        [Barrel, HITBOX_SCALE.BARREL],
    ]);
  }
  
  add(gameObject) {
    if (!gameObject.isCollision || !gameObject.id || this.objectsMap.has(gameObject.id)) return;

    if (this.isStaticObject(gameObject)) {
      if (!this.staticObjects.includes(gameObject)) this.staticObjects.push(gameObject);
    } else {
      if (!this.dynamicObjects.includes(gameObject)) this.dynamicObjects.push(gameObject);
    }
    this.objectsMap.set(gameObject.id, gameObject);
  }
  
  remove(gameObject) {
    if (!gameObject || !gameObject.id) return;
    
    let index = this.dynamicObjects.indexOf(gameObject);
    if (index !== -1) this.dynamicObjects.splice(index, 1);
    
    index = this.staticObjects.indexOf(gameObject);
    if (index !== -1) this.staticObjects.splice(index, 1);

    this.objectsMap.delete(gameObject.id);

    if (GAMECONFIG.DEBUG && this.boxHelpers.has(gameObject.id)) {
      const boxHelper = this.boxHelpers.get(gameObject.id);
      Game.instance.scene.remove(boxHelper);
      this.boxHelpers.delete(gameObject.id);
    }
  }

  isStaticObject(obj) {
    return obj instanceof Rock || 
           obj instanceof Tree || 
           (obj instanceof Barrel && obj.hasExploded);
  }

  getHitboxScale(obj) {
    return this.hitboxScaleMap.get(obj.constructor) || { x: 1.0, y: 1.0, z: 1.0 };
  }

  createScaledBoundingBox(obj) {
    if (!obj.model) return null;
    
    const box = new THREE.Box3().setFromObject(obj.model);
    const scale = this.getHitboxScale(obj);
    
    if (scale.x !== 1.0 || scale.y !== 1.0 || scale.z !== 1.0) {
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      
      const newSize = new THREE.Vector3(size.x * scale.x, size.y * scale.y, size.z * scale.z);
      box.setFromCenterAndSize(center, newSize);
    }
    
    return box;
  }

    handleCollisionPair(objA, objB) {
        let bullet = null;
        let target = null;

        if (objA instanceof Bullet) {
            bullet = objA; target = objB;
        } else if (objB instanceof Bullet) {
            bullet = objB; target = objA;
        }

        if (bullet) {
            if (bullet.hasCollided || bullet.shooter === target) return;

            let wasHit = false;
            if (target instanceof Tank && bullet.faction !== target.faction) {
                target.takeDamage(bullet.damage, bullet.shooter); // Use bullet.shooter here
                wasHit = true;
            }
            else if (target instanceof Rock || target instanceof Tree) {
                wasHit = true;
            }
            else if (target instanceof Barrel && !target.hasExploded) {
                if (bullet.faction !== 'neutral') {
                    target.onBulletHit(bullet);
                }
                wasHit = true;
            }

            // --- THE FIX ---
            // If a valid hit occurred, call onHit() and notify the system.
            if (wasHit) {
                bullet.onHit(target);
                EventManager.instance.notify(EVENT.BULLET_HIT, {
                    bullet: bullet,
                    target: target,
                    hitPoint: bullet.position.clone() // Provide the impact point
                });
            }
            // --- END OF FIX ---
            return;
        }

        // This is only called for non-bullet collisions now.
        EventManager.instance.notify(EVENT.COLLISION, { objA, objB });
    }


    update() {
      if (!this.worker) return;

      const dynamicPayload = [];
      for (const obj of this.dynamicObjects) {
          if (obj.model && !obj.disposed) {
              this._reusableBox3.setFromObject(obj.model);
              const scale = this.getHitboxScale(obj);
              if (scale.x !== 1.0 || scale.y !== 1.0 || scale.z !== 1.0) {
                  const center = new THREE.Vector3();
                  const size = new THREE.Vector3();
                  this._reusableBox3.getCenter(center);
                  this._reusableBox3.getSize(size);
                  const newSize = new THREE.Vector3(size.x * scale.x, size.y * scale.y, size.z * scale.z);
                  this._reusableBox3.setFromCenterAndSize(center, newSize);
              }

              if (this._reusableBox3 && !this._reusableBox3.isEmpty()) {
                  dynamicPayload.push({
                      id: obj.id,
                      bbox: {
                          min: { x: this._reusableBox3.min.x, y: this._reusableBox3.min.y, z: this._reusableBox3.min.z },
                          max: { x: this._reusableBox3.max.x, y: this._reusableBox3.max.y, z: this._reusableBox3.max.z }
                      },
                      // --- THAY ĐỔI Ở ĐÂY ---
                      // Gửi thêm thông tin để worker biết đây là thùng phuy
                      isBarrel: obj instanceof Barrel 
                  });
              }
          }
      }

        if (!this.staticObjectsSent) {
            // First frame: send everything
            const staticPayload = [];
            for (const obj of this.staticObjects) {
                if (obj.model && !obj.disposed) {
                    const bbox = this.createScaledBoundingBox(obj);
                    if (bbox) {
                        staticPayload.push({
                            id: obj.id,
                            bbox: {
                                min: { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
                                max: { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z }
                            }
                        });
                    }
                }
            }
            this.worker.postMessage({
                type: 'full_update',
                payload: {
                    dynamicObjects: dynamicPayload,
                    staticObjects: staticPayload
                }
            });
            this.staticObjectsSent = true;
        } else {
            // Subsequent frames: send only dynamic objects
            this.worker.postMessage({
                type: 'dynamic_update',
                payload: {
                    dynamicObjects: dynamicPayload
                }
            });
        }
    }

  handleWorkerMessage(e) {
      const { type, payload } = e.data;
      if (type === 'collisions') {
          for (const pair of payload.pairs) {
              const objA = this.objectsMap.get(pair.idA);
              const objB = this.objectsMap.get(pair.idB);

              if (objA && objB && !objA.disposed && !objB.disposed) {
                  this.handleCollisionPair(objA, objB);
              }
          }
      } 
      else if (type === 'explosion_results') {
          const barrel = this.objectsMap.get(payload.sourceId);
          const explosionSource = payload.explosionSourceId ? this.objectsMap.get(payload.explosionSourceId) : null;
          
          if (barrel && barrel.applyWorkerExplosionResults) {
              barrel.applyWorkerExplosionResults(payload.affectedObjects, explosionSource);
          }
      }
  }
  createScaledBoundingBox(obj, targetBox = new THREE.Box3()) {
    if (!obj.model) return null;
    
    targetBox.setFromObject(obj.model);
    const scale = this.getHitboxScale(obj);
    
    if (scale.x !== 1.0 || scale.y !== 1.0 || scale.z !== 1.0) {
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      targetBox.getCenter(center);
      targetBox.getSize(size);
      
      const newSize = new THREE.Vector3(size.x * scale.x, size.y * scale.y, size.z * scale.z);
      targetBox.setFromCenterAndSize(center, newSize);
    }
    
    return targetBox;
  }
  isPositionValid(position, objectSize, excludeObjects = []) {
    const testBox = new THREE.Box3().setFromCenterAndSize(
      position,
      new THREE.Vector3(objectSize.width, objectSize.height, objectSize.depth)
    );
    
    const allObjects = [...this.dynamicObjects, ...this.staticObjects];
    for (const obj of allObjects) {
      if (excludeObjects.includes(obj) || !obj.model || obj.disposed) continue;
      
      const objBox = this.createScaledBoundingBox(obj);
      if (objBox && testBox.intersectsBox(objBox)) {
        return false;
      }
    }
    return true;
  }

  dispose() {
    this.dynamicObjects = [];
    this.staticObjects = [];
    this.objectsMap.clear();
    this.bboxCache = new WeakMap();

    this.boxHelpers.forEach((boxHelper) => {
        if (boxHelper && Game.instance?.scene) {
          Game.instance.scene.remove(boxHelper);
        }
    });
    this.boxHelpers.clear();
    
    if (this.worker) {
        this.worker.terminate();
        this.worker = null;
    }
    
    CollisionManager.instance = null;
  }
    notifyObjectStateChange(gameObject) {
        if (!this.worker) return;

        this.remove(gameObject); // Remove from its current list (likely dynamic)
        this.add(gameObject);    // Re-add it, it will now be classified as static

        // Send a specific command to the worker to update its internal lists
        const bbox = this.createScaledBoundingBox(gameObject);
        if (bbox) {
            this.worker.postMessage({
                type: 'object_became_static',
                payload: {
                    id: gameObject.id,
                    bbox: {
                         min: { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
                         max: { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z }
                    }
                }
            });
        }
    }
}
export { CollisionManager };
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
// Import the new Octree class
import { Octree } from './Octree.js';

class CollisionManager {
  static instance;

  // Lists to manage different types of objects
  dynamicObjects;
  staticObjects;

  // The Octree for high-performance spatial partitioning
  octree;

  // Caching and helpers
  bboxCache;
  hitboxScaleMap;
  boxHelpers;
  
  constructor() {
    if (CollisionManager.instance) {
      return CollisionManager.instance;
    }
    CollisionManager.instance = this;
    
    this.dynamicObjects = [];
    this.staticObjects = [];
    this.bboxCache = new WeakMap();
    this.boxHelpers = new Map();
    
    const worldSize = GAMECONFIG.WORLD_BOUNDARY || 500;
    const worldBounds = new THREE.Box3(
        new THREE.Vector3(-worldSize, -worldSize, -worldSize),
        new THREE.Vector3(worldSize, worldSize, worldSize)
    );
    // Initialize the Octree with world bounds, max objects per node, and max depth.
    this.octree = new Octree(worldBounds, 8, 8);

    // Use a Map for efficient hitbox scale lookups.
    this.hitboxScaleMap = new Map([
        [Tank, HITBOX_SCALE.TANK],
        [Rock, HITBOX_SCALE.ROCK],
        [Tree, HITBOX_SCALE.TREE],
        [Barrel, HITBOX_SCALE.BARREL],
    ]);
  }
  
  /**
   * Adds a game object to the appropriate collision list.
   */
  add(gameObject) {
    if (!gameObject.isCollision) return;

    if (this.isStaticObject(gameObject)) {
      if (!this.staticObjects.includes(gameObject)) {
        this.staticObjects.push(gameObject);
      }
    } else {
      if (!this.dynamicObjects.includes(gameObject)) {
        this.dynamicObjects.push(gameObject);
      }
    }
  }
  
  /**
   * Removes a game object from the collision lists and cleans up its debug helper.
   */
  remove(gameObject) {
    let index = this.dynamicObjects.indexOf(gameObject);
    if (index !== -1) {
      this.dynamicObjects.splice(index, 1);
    } else {
      index = this.staticObjects.indexOf(gameObject);
      if (index !== -1) {
        this.staticObjects.splice(index, 1);
      }
    }

    if (GAMECONFIG.DEBUG && this.boxHelpers.has(gameObject.id)) {
      const boxHelper = this.boxHelpers.get(gameObject.id);
      Game.instance.scene.remove(boxHelper);
      this.boxHelpers.delete(gameObject.id);
    }
  }

  /**
   * Checks if an object is static (non-movable).
   */
  isStaticObject(obj) {
    return obj instanceof Rock || 
           obj instanceof Tree || 
           (obj instanceof Barrel && obj.hasExploded);
  }

  /**
   * Gets the appropriate hitbox scale for an object type using the map.
   */
  getHitboxScale(obj) {
    return this.hitboxScaleMap.get(obj.constructor) || { x: 1.0, y: 1.0, z: 1.0 };
  }

  /**
   * Creates a scaled bounding box for an object.
   */
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

  /**
   * Handles the collision logic for a pair of objects.
   */
  handleCollisionPair(objA, objB) {
    // Handle specific bullet-barrel collisions
    if ((objA instanceof Bullet && objB instanceof Barrel && !objB.hasExploded) ||
        (objA instanceof Barrel && !objA.hasExploded && objB instanceof Bullet)) {
      
      const bullet = objA instanceof Bullet ? objA : objB;
      const barrel = objA instanceof Barrel ? objA : objB;
      
      if (bullet.faction !== 'neutral') {
        barrel.onBulletHit(bullet);
        EventManager.instance.notify(EVENT.COLLISION_TANK_BULLET, {
          tank: barrel,
          bullet: bullet,
          damage: bullet.damage || 25,
          newHP: barrel.hp
        });
      }
    } else {
      // Notify default collision for all other pairs
      EventManager.instance.notify(EVENT.COLLISION, { objA, objB });
    }
  }

  /**
   * The main update loop, using the Octree for highly optimized collision detection.
   */
  update() {
    // 1. Clear the Octree for the new frame.
    this.octree.clear();
    
    // 2. Populate the Octree with all objects (static and dynamic).
    // Also, cache their bounding boxes for this frame.
    const allObjects = [...this.dynamicObjects, ...this.staticObjects];
    for (const obj of allObjects) {
      if (obj.model && !obj.disposed) {
        const bbox = this.createScaledBoundingBox(obj);
        if (bbox) {
          this.bboxCache.set(obj, bbox);
          this.octree.insert(obj, bbox);
        }
      }
    }

    // 3. Perform collision checks.
    const processedPairs = new Set(); // Prevents checking A-B and then B-A.

    // Iterate through DYNAMIC objects only. Static objects don't initiate collisions.
    for (const objA of this.dynamicObjects) {
      if (objA.disposed) continue;

      const boxA = this.bboxCache.get(objA);
      if (!boxA) continue;

      // Retrieve only potential colliders from the Octree. This is the key optimization!
      const potentialColliders = this.octree.retrieve(objA, boxA);

      for (const objB of potentialColliders) {
        // Skip self-collision and checks with disposed objects.
        if (objA === objB || objB.disposed) continue;

        // Prevent duplicate pair checks (e.g., Tank1-Tank2 and later Tank2-Tank1).
        const pairKey = objA.id < objB.id ? `${objA.id}-${objB.id}` : `${objB.id}-${objA.id}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const boxB = this.bboxCache.get(objB);
        if (!boxB) continue;

        // Final, precise intersection test
        if (boxA.intersectsBox(boxB)) {
          this.handleCollisionPair(objA, objB);
        }
      }
    }
  }

  /**
   * Checks if a potential position is valid (not colliding with anything).
   * Used primarily for procedural generation where performance is less critical.
   */
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

  /**
   * Dispose collision manager and clean up resources.
   */
  dispose() {
    this.dynamicObjects = [];
    this.staticObjects = [];
    
    // Clear the octree and all caches
    this.octree.clear();
    this.bboxCache = new WeakMap();

    // Clean up debug box helpers
    this.boxHelpers.forEach((boxHelper) => {
        if (boxHelper && Game.instance?.scene) {
          Game.instance.scene.remove(boxHelper);
        }
    });
    this.boxHelpers.clear();
    
    CollisionManager.instance = null;
  }
}

export { CollisionManager };
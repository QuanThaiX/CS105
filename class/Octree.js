// src/core/Octree.js
import * as THREE from 'three';


export class Octree {
  constructor(bounds, maxObjects = 8, maxLevels = 8, level = 0) {
    this.bounds = bounds;         
    this.maxObjects = maxObjects; 
    this.maxLevels = maxLevels;   
    this.level = level;           

    this.objects = [];            
    this.nodes = [];             
  }

  /**
   * Subdivides the current node into 8 smaller octants.
   */
  subdivide() {
    const { min, max } = this.bounds;
    const halfSize = new THREE.Vector3().subVectors(max, min).multiplyScalar(0.5);
    const center = new THREE.Vector3().addVectors(min, halfSize);

    const childrenBounds = [
      // Bottom half (y from min.y to center.y)
      new THREE.Box3(new THREE.Vector3(center.x, min.y, center.z), new THREE.Vector3(max.x, center.y, max.z)),
      new THREE.Box3(new THREE.Vector3(min.x, min.y, center.z), new THREE.Vector3(center.x, center.y, max.z)),
      new THREE.Box3(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(center.x, center.y, center.z)),
      new THREE.Box3(new THREE.Vector3(center.x, min.y, min.z), new THREE.Vector3(max.x, center.y, center.z)),
      // Top half (y from center.y to max.y)
      new THREE.Box3(new THREE.Vector3(center.x, center.y, center.z), new THREE.Vector3(max.x, max.y, max.z)),
      new THREE.Box3(new THREE.Vector3(min.x, center.y, center.z), new THREE.Vector3(center.x, max.y, max.z)),
      new THREE.Box3(new THREE.Vector3(min.x, center.y, min.z), new THREE.Vector3(center.x, max.y, center.z)),
      new THREE.Box3(new THREE.Vector3(center.x, center.y, min.z), new THREE.Vector3(max.x, max.y, max.z)),
    ];
    
    for (let i = 0; i < 8; i++) {
      this.nodes[i] = new Octree(childrenBounds[i], this.maxObjects, this.maxLevels, this.level + 1);
    }
  }

  /**
   * Determines which child octant an object's bounding box belongs to.
   * @param {THREE.Box3} bbox - The bounding box of the object.
   * @returns {number} The index of the child node (0-7), or -1 if it spans multiple children.
   */
  getIndex(bbox) {
    let index = -1;
    const center = new THREE.Vector3();
    this.bounds.getCenter(center);

    const fitsInTop = bbox.min.y >= center.y;
    const fitsInBottom = bbox.max.y < center.y;
    const fitsInFront = bbox.min.z >= center.z;
    const fitsInBack = bbox.max.z < center.z;
    const fitsInRight = bbox.min.x >= center.x;
    const fitsInLeft = bbox.max.x < center.x;
    
    if (fitsInTop) {
      if (fitsInFront) {
        if (fitsInRight) index = 4;
        else if (fitsInLeft) index = 5;
      } else if (fitsInBack) {
        if (fitsInRight) index = 7;
        else if (fitsInLeft) index = 6;
      }
    } else if (fitsInBottom) {
      if (fitsInFront) {
        if (fitsInRight) index = 0;
        else if (fitsInLeft) index = 1;
      } else if (fitsInBack) {
        if (fitsInRight) index = 3;
        else if (fitsInLeft) index = 2;
      }
    }

    // If the object doesn't fit neatly into one octant (it spans a boundary),
    // it will be stored in the parent node (index remains -1).
    return index;
  }

  /**
   * Inserts an object into the Octree.
   * @param {GameObject} obj - The game object to insert.
   * @param {THREE.Box3} bbox - The pre-calculated bounding box for the object.
   */
  insert(obj, bbox) {
    // If we have child nodes, try to push the object down into one of them
    if (this.nodes.length > 0) {
      const index = this.getIndex(bbox);
      if (index !== -1) {
        this.nodes[index].insert(obj, bbox);
        return;
      }
    }
    
    // Otherwise, store the object in this node
    this.objects.push(obj);

    // If we've exceeded the max objects and haven't reached the max depth, subdivide
    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (this.nodes.length === 0) {
        this.subdivide();
      }
      
      // Move any objects that can fit into a child node
      let i = 0;
      while (i < this.objects.length) {
        const objToMove = this.objects[i];
        const bboxToMove = new THREE.Box3().setFromObject(objToMove.model); // Recalc needed here
        const index = this.getIndex(bboxToMove);
        if (index !== -1) {
          this.nodes[index].insert(objToMove, bboxToMove);
          this.objects.splice(i, 1); // Remove from this node
        } else {
          i++; // Keep in this node
        }
      }
    }
  }

  /**
   * Retrieves all objects that could potentially collide with the given object.
   * @param {GameObject} obj - The object to check against.
   * @param {THREE.Box3} bbox - The bounding box of the object.
   * @returns {Array<GameObject>} A list of potential colliders.
   */
  retrieve(obj, bbox) {
    let returnObjects = [...this.objects];
    
    // If the object has a chance of being in a child node, check there too
    const index = this.getIndex(bbox);
    if (index !== -1 && this.nodes.length > 0) {
      returnObjects.push(...this.nodes[index].retrieve(obj, bbox));
    } else if (index === -1 && this.nodes.length > 0) {
      // If the object spans multiple children, we need to check all of them
      for (let i = 0; i < this.nodes.length; i++) {
        returnObjects.push(...this.nodes[i].retrieve(obj, bbox));
      }
    }
    
    return returnObjects;
  }

  /**
   * Clears the Octree for the next frame.
   */
  clear() {
    this.objects = [];
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].clear();
    }
    this.nodes = []; // Discard the child nodes
  }
}
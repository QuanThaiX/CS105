// ./class/CollisionWorker.js

// --- START: SELF-CONTAINED HELPER CLASSES (No external dependencies) ---

/**
 * A lightweight, dependency-free 3D vector class for use within the worker.
 */
class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }
    addVectors(a, b) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        return this;
    }
    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }
    distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

/**
 * A lightweight, dependency-free 3D bounding box for use within the worker.
 */
class Box3 {
    constructor(min = new Vec3(Infinity, Infinity, Infinity), max = new Vec3(-Infinity, -Infinity, -Infinity)) {
        this.min = min;
        this.max = max;
    }

    setFromCenterAndSize(center, size) {
        const halfSize = new Vec3(size.x / 2, size.y / 2, size.z / 2);
        this.min.copy(center).addVectors(center, halfSize.multiplyScalar(-1));
        this.max.copy(center).addVectors(center, halfSize);
        return this;
    }

    // Simplified getCenter for worker
    getCenter(target) {
        return target.addVectors(this.min, this.max).multiplyScalar(0.5);
    }

    intersectsBox(box) {
        return !(box.max.x < this.min.x || box.min.x > this.max.x ||
            box.max.y < this.min.y || box.min.y > this.max.y ||
            box.max.z < this.min.z || box.min.z > this.max.z);
    }
}

/**
 * A lightweight, dependency-free Octree implementation for fast spatial lookups.
 */
class Octree {
    constructor(bounds, maxObjects = 8, maxLevels = 8, level = 0) {
        this.bounds = bounds;
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;
        this.objects = [];
        this.nodes = [];
    }

    subdivide() {
        const { min, max } = this.bounds;
        const halfSize = new Vec3().addVectors(max, min).multiplyScalar(0.5);
        const center = new Vec3().addVectors(min, halfSize);

        const childrenBounds = [
            // Top half
            new Box3(new Vec3(center.x, center.y, center.z), new Vec3(max.x, max.y, max.z)),
            new Box3(new Vec3(min.x, center.y, center.z), new Vec3(center.x, max.y, max.z)),
            new Box3(new Vec3(min.x, center.y, min.z), new Vec3(center.x, max.y, center.z)),
            new Box3(new Vec3(center.x, center.y, min.z), new Vec3(max.x, max.y, max.z)),
            // Bottom half
            new Box3(new Vec3(center.x, min.y, center.z), new Vec3(max.x, center.y, max.z)),
            new Box3(new Vec3(min.x, min.y, center.z), new Vec3(center.x, center.y, max.z)),
            new Box3(new Vec3(min.x, min.y, min.z), new Vec3(center.x, center.y, center.z)),
            new Box3(new Vec3(center.x, min.y, min.z), new Vec3(max.x, center.y, center.z))
        ];

        for (let i = 0; i < 8; i++) {
            this.nodes[i] = new Octree(childrenBounds[i], this.maxObjects, this.maxLevels, this.level + 1);
        }
    }

    getIndex(bbox) {
        let index = -1;
        const center = this.bounds.getCenter(new Vec3());

        const fitsInTop = bbox.min.y >= center.y;
        const fitsInBottom = bbox.max.y <= center.y;

        if (fitsInTop) {
            index = 0; 
        } else if (fitsInBottom) {
            index = 4;
        } else {
            return -1; 
        }

        const fitsInFront = bbox.min.z >= center.z;
        const fitsInBack = bbox.max.z <= center.z;

        if (fitsInFront) {
        } else if (fitsInBack) {
            index += 2;
        } else {
            return -1; 
        }

        const fitsInRight = bbox.min.x >= center.x;
        const fitsInLeft = bbox.max.x <= center.x;

        if (fitsInRight) {
             // Nằm ở bên phải, không cộng thêm
        } else if (fitsInLeft) {
            index += 1; // Nằm ở bên trái, cộng 1
        } else {
            return -1; // Nằm ở cả trái và phải
        }

        return index;
    }
    insert(obj) {
        if (this.nodes.length > 0) {
            const index = this.getIndex(obj.bbox);
            if (index !== -1) {
                this.nodes[index].insert(obj);
                return;
            }
        }

        this.objects.push(obj);

        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (this.nodes.length === 0) {
                this.subdivide();
            }

            let i = 0;
            while (i < this.objects.length) {
                const currentObj = this.objects[i];
                const index = this.getIndex(currentObj.bbox);
                if (index !== -1) {
                    this.nodes[index].insert(currentObj);
                    this.objects.splice(i, 1);
                } else {
                    i++;
                }
            }
        }
    }

    retrieve(obj) {
        let returnObjects = [...this.objects];

        if (this.nodes.length > 0) {
            const index = this.getIndex(obj.bbox);
            if (index !== -1) {
                returnObjects.push(...this.nodes[index].retrieve(obj));
            } else {
                // If the object spans multiple nodes, check all of them
                for (let i = 0; i < this.nodes.length; i++) {
                    if (obj.bbox.intersectsBox(this.nodes[i].bounds)) {
                        returnObjects.push(...this.nodes[i].retrieve(obj));
                    }
                }
            }
        }

        return returnObjects;
    }

    clear() {
        this.objects = [];
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].clear();
        }
        this.nodes = [];
    }
}

// --- END: SELF-CONTAINED HELPER CLASSES ---


// --- Worker State ---
let worldOctree;
let staticObjects = new Map();
let dynamicObjects = new Map();
/**
 * Converts a plain bbox object from the main thread into a Box3 instance for calculations.
 * @param {object} bboxPayload - The {min: {x,y,z}, max: {x,y,z}} object.
 * @returns {Box3} An instance of our worker's Box3 class.
 */
function createBox3FromPayload(bboxPayload) {
    return new Box3(
        new Vec3(bboxPayload.min.x, bboxPayload.min.y, bboxPayload.min.z),
        new Vec3(bboxPayload.max.x, bboxPayload.max.y, bboxPayload.max.z)
    );
}

/**
 * Rebuilds the Octree from scratch using all known static and dynamic objects.
 */
function rebuildOctree() {
    worldOctree.clear();
    for (const obj of staticObjects.values()) {
        worldOctree.insert(obj);
    }
    for (const obj of dynamicObjects.values()) {
        worldOctree.insert(obj);
    }
}
function processExplosion(payload, octree) {
    if (!octree) {
        console.error("Collision Worker: Octree is not available to process explosion.");
        return;
    }

    const { sourceId, explosionSourceId, position, radius, damage, force, chainReaction } = payload;
    
    const explosionCenter = new Vec3(position.x, position.y, position.z);
    const searchBox = new Box3(
        new Vec3(position.x - radius, position.y - radius, position.z - radius),
        new Vec3(position.x + radius, position.y + radius, position.z + radius)
    );
    
    const potentialVictims = octree.retrieve({ bbox: searchBox });
    const affectedObjects = [];
    
    for (const victim of potentialVictims) {
        if (victim.id === sourceId) continue;
        
        const victimPosition = victim.bbox.getCenter(new Vec3());
        const distance = explosionCenter.distanceTo(victimPosition);
        
        if (distance <= radius) {
            const damageMultiplier = Math.max(0, 1 - (distance / radius));
            const actualDamage = Math.floor(damage * damageMultiplier);
            const actualForce = force * damageMultiplier;
            
            const isVictimABarrel = victim.isBarrel || false;
            
            if (actualDamage > 0) {
                 affectedObjects.push({
                    objectId: victim.id,
                    distance: distance,
                    damage: actualDamage,
                    force: actualForce,
                    isBarrel: chainReaction && isVictimABarrel, 
                });
            }
        }
    }
    
    self.postMessage({
        type: 'explosion_results',
        payload: {
            sourceId: sourceId,
            explosionSourceId: explosionSourceId,
            affectedObjects: affectedObjects,
        }
    });
}
/**
 * The core collision detection logic using the Octree.
 */
function checkCollisions() {
    const collisionPairs = [];
    // A Set is used to prevent checking the same pair twice (e.g., A-B and B-A).
    const checkedPairs = new Set();

    // Iterate through only the dynamic objects, as static-static collisions are not needed.
    for (const objA of dynamicObjects.values()) {
        // Retrieve only the objects that are spatially close to objA. THIS IS THE OPTIMIZATION.
        const potentialColliders = worldOctree.retrieve(objA);

        for (const objB of potentialColliders) {
            // Don't check an object against itself.
            if (objA.id === objB.id) continue;

            // Create a unique key for the pair to avoid duplicates.
            const pairKey = objA.id < objB.id ? `${objA.id}-${objB.id}` : `${objB.id}-${objA.id}`;
            if (checkedPairs.has(pairKey)) continue;

            // Perform the final, precise bounding box check.
            if (objA.bbox.intersectsBox(objB.bbox)) {
                collisionPairs.push({ idA: objA.id, idB: objB.id });
            }

            checkedPairs.add(pairKey);
        }
    }

    // If any collisions were found, send them back to the main thread.
    if (collisionPairs.length > 0) {
        self.postMessage({ type: 'collisions', payload: { pairs: collisionPairs } });
    }
}


self.onmessage = (e) => {
    const { type, payload } = e.data;
    switch (type) {
        case 'init':
            const worldBounds = createBox3FromPayload(payload.worldBounds);
            worldOctree = new Octree(worldBounds, 8, 4);
            // isInitialized = true; 
            break;

        case 'full_update':
            staticObjects.clear();
            dynamicObjects.clear();
            
            payload.staticObjects.forEach(obj => {
                obj.bbox = createBox3FromPayload(obj.bbox);
                staticObjects.set(obj.id, obj);
            });
            payload.dynamicObjects.forEach(obj => {
                obj.bbox = createBox3FromPayload(obj.bbox);
                // Gán thuộc tính isBarrel cho đối tượng trong worker
                obj.isBarrel = payload.dynamicObjects.find(d => d.id === obj.id)?.isBarrel || false;
                dynamicObjects.set(obj.id, obj);
            });
            
            rebuildOctree();
            checkCollisions();
            break;

        case 'dynamic_update':
            worldOctree.clear();
            
            dynamicObjects.clear();
            payload.dynamicObjects.forEach(obj => {
                obj.bbox = createBox3FromPayload(obj.bbox);
                // Gán thuộc tính isBarrel cho đối tượng trong worker
                obj.isBarrel = payload.dynamicObjects.find(d => d.id === obj.id)?.isBarrel || false;
                dynamicObjects.set(obj.id, obj);
});

            rebuildOctree();
            checkCollisions();
            break;
            
        case 'object_became_static':
            if(dynamicObjects.has(payload.id)) {
                dynamicObjects.delete(payload.id);
                const staticObj = {
                    id: payload.id,
                    bbox: createBox3FromPayload(payload.bbox),
                    isBarrel: true // Thùng phuy đã nổ chắc chắn là thùng phuy
                };
                staticObjects.set(payload.id, staticObj);
            }
            break;
            
        case 'process_explosion':
            processExplosion(payload, worldOctree);
            break;
    }
};
// ./class/CollisionWorker.js
class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
    }
    addVectors(a, b) {
        this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z;
        return this;
    }
    subVectors(a, b) {
        this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z;
        return this;
    }
    multiplyScalar(s) {
        this.x *= s; this.y *= s; this.z *= s;
        return this;
    }
}

class Box3 {
    constructor(min = new Vec3(Infinity, Infinity, Infinity), max = new Vec3(-Infinity, -Infinity, -Infinity)) {
        this.min = min;
        this.max = max;
    }
    getCenter(target) {
        return target.addVectors(this.min, this.max).multiplyScalar(0.5);
    }
    intersectsBox(box) {
        return !(box.max.x < this.min.x || box.min.x > this.max.x ||
                 box.max.y < this.min.y || box.min.y > this.max.y ||
                 box.max.z < this.min.z || box.min.z > this.max.z);
    }
}

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
        const halfSize = new Vec3().subVectors(max, min).multiplyScalar(0.5);
        const center = new Vec3().addVectors(min, halfSize);

        const childrenBounds = [
            new Box3(new Vec3(center.x, min.y, center.z), new Vec3(max.x, center.y, max.z)),
            new Box3(new Vec3(min.x, min.y, center.z), new Vec3(center.x, center.y, max.z)),
            new Box3(new Vec3(min.x, min.y, min.z), new Vec3(center.x, center.y, center.z)),
            new Box3(new Vec3(center.x, min.y, min.z), new Vec3(max.x, center.y, center.z)),
            new Box3(new Vec3(center.x, center.y, center.z), new Vec3(max.x, max.y, max.z)),
            new Box3(new Vec3(min.x, center.y, center.z), new Vec3(center.x, max.y, max.z)),
            new Box3(new Vec3(min.x, center.y, min.z), new Vec3(center.x, max.y, center.z)),
            new Box3(new Vec3(center.x, center.y, min.z), new Vec3(max.x, max.y, max.z)),
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
        const fitsInFront = bbox.min.z >= center.z;
        const fitsInBack = bbox.max.z <= center.z;
        const fitsInRight = bbox.min.x >= center.x;
        const fitsInLeft = bbox.max.x <= center.x;

        if (fitsInBottom) {
            if (fitsInFront) {
                if (fitsInRight) index = 0; else if (fitsInLeft) index = 1;
            } else if (fitsInBack) {
                if (fitsInLeft) index = 2; else if (fitsInRight) index = 3;
            }
        } else if (fitsInTop) {
            if (fitsInFront) {
                if (fitsInRight) index = 4; else if (fitsInLeft) index = 5;
            } else if (fitsInBack) {
                if (fitsInLeft) index = 6; else if (fitsInRight) index = 7;
            }
        }
        return index;
    }

    insert(obj, bbox) {
        if (this.nodes.length > 0) {
            const index = this.getIndex(bbox);
            if (index !== -1) {
                this.nodes[index].insert(obj, bbox);
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
                const currentBBox = new Box3(new Vec3(currentObj.bbox.min.x, currentObj.bbox.min.y, currentObj.bbox.min.z), new Vec3(currentObj.bbox.max.x, currentObj.bbox.max.y, currentObj.bbox.max.z));
                const index = this.getIndex(currentBBox);
                if (index !== -1) {
                    this.nodes[index].insert(currentObj, currentBBox);
                    this.objects.splice(i, 1);
                } else {
                    i++;
                }
            }
        }
    }

    retrieve(obj, bbox) {
        let returnObjects = [...this.objects];
        const index = this.getIndex(bbox);

        if (index !== -1 && this.nodes.length > 0) {
            returnObjects.push(...this.nodes[index].retrieve(obj, bbox));
        } else if (index === -1 && this.nodes.length > 0) { // Spans multiple children
            for (let i = 0; i < this.nodes.length; i++) {
                returnObjects.push(...this.nodes[i].retrieve(obj, bbox));
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

let octree;
let worldBounds;
// NEW: Persistent object lists
let staticObjects = new Map();
let dynamicObjects = new Map();


// --- Worker Main Logic ---
self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            const boundsData = payload.worldBounds;
            worldBounds = new Box3(new Vec3(boundsData.min.x, boundsData.min.y, boundsData.min.z), new Vec3(boundsData.max.x, boundsData.max.y, boundsData.max.z));
            octree = new Octree(worldBounds, 8, 8);
            staticObjects.clear();
            dynamicObjects.clear();
            break;

        case 'full_update':
            // Received on the first frame
            staticObjects.clear();
            dynamicObjects.clear();
            payload.staticObjects.forEach(obj => staticObjects.set(obj.id, obj));
            payload.dynamicObjects.forEach(obj => dynamicObjects.set(obj.id, obj));
            runCollisionCheck();
            break;
            
        case 'dynamic_update':
            // Received on subsequent frames
            dynamicObjects.clear();
            payload.dynamicObjects.forEach(obj => dynamicObjects.set(obj.id, obj));
            runCollisionCheck();
            break;

        case 'object_became_static':
            // Handle a barrel exploding
            dynamicObjects.delete(payload.id);
            staticObjects.set(payload.id, payload);
            // No need to run collision check here, it will happen on next update
            break;
    }
};

function runCollisionCheck() {
    if (!octree) return;

    // 1. Rebuild Octree efficiently
    octree.clear();
    for (const objData of staticObjects.values()) {
        const bbox = new Box3(new Vec3(objData.bbox.min.x, objData.bbox.min.y, objData.bbox.min.z), new Vec3(objData.bbox.max.x, objData.bbox.max.y, objData.bbox.max.z));
        octree.insert(objData, bbox);
    }
    for (const objData of dynamicObjects.values()) {
        const bbox = new Box3(new Vec3(objData.bbox.min.x, objData.bbox.min.y, objData.bbox.min.z), new Vec3(objData.bbox.max.x, objData.bbox.max.y, objData.bbox.max.z));
        octree.insert(objData, bbox);
    }

    // 2. Perform collision checks (only need to check dynamic objects against the whole tree)
    const collisionPairs = [];
    const processedPairs = new Set();
    
    for (const objA of dynamicObjects.values()) {
        const boxA = new Box3(new Vec3(objA.bbox.min.x, objA.bbox.min.y, objA.bbox.min.z), new Vec3(objA.bbox.max.x, objA.bbox.max.y, objA.bbox.max.z));
        const potentialColliders = octree.retrieve(objA, boxA);

        for (const objB of potentialColliders) {
            if (objA.id === objB.id) continue;

            const pairKey = objA.id < objB.id ? `${objA.id}-${objB.id}` : `${objB.id}-${objA.id}`;
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);
            
            // Note: objB from retrieve doesn't have its box pre-calculated, so we do it here.
            const boxB = new Box3(new Vec3(objB.bbox.min.x, objB.bbox.min.y, objB.bbox.min.z), new Vec3(objB.bbox.max.x, objB.bbox.max.y, objB.bbox.max.z));
            
            if (boxA.intersectsBox(boxB)) {
                collisionPairs.push({ idA: objA.id, idB: objB.id });
            }
        }
    }

    if (collisionPairs.length > 0) {
        self.postMessage({ type: 'collisions', payload: { pairs: collisionPairs } });
    }
}
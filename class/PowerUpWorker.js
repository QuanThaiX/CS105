
class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
}

class Box3 {
    constructor(min = new Vec3(Infinity, Infinity, Infinity), max = new Vec3(-Infinity, -Infinity, -Infinity)) { this.min = min; this.max = max; }
    getCenter(target) { return target.addVectors(this.min, this.max).multiplyScalar(0.5); }
    intersectsBox(box) { return !(box.max.x < this.min.x || box.min.x > this.max.x || box.max.y < this.min.y || box.min.y > this.max.y || box.max.z < this.min.z || box.min.z > this.max.z); }
}

class Octree {
    constructor(bounds, maxObjects = 4, maxLevels = 4, level = 0) {
        this.bounds = bounds; this.maxObjects = maxObjects; this.maxLevels = maxLevels; this.level = level; this.objects = []; this.nodes = [];
    }
    subdivide() {
        const { min, max } = this.bounds; const halfSize = new Vec3().addVectors(max, min).multiplyScalar(0.5); const center = new Vec3().addVectors(min, halfSize);
        const childrenBounds = [new Box3(new Vec3(center.x, center.y, center.z), new Vec3(max.x, max.y, max.z)), new Box3(new Vec3(min.x, center.y, center.z), new Vec3(center.x, max.y, max.z)), new Box3(new Vec3(min.x, center.y, min.z), new Vec3(center.x, max.y, center.z)), new Box3(new Vec3(center.x, center.y, min.z), new Vec3(max.x, max.y, max.z)), new Box3(new Vec3(center.x, min.y, center.z), new Vec3(max.x, center.y, max.z)), new Box3(new Vec3(min.x, min.y, center.z), new Vec3(center.x, center.y, max.z)), new Box3(new Vec3(min.x, min.y, min.z), new Vec3(center.x, center.y, center.z)), new Box3(new Vec3(center.x, min.y, min.z), new Vec3(max.x, center.y, max.z))];
        for (let i = 0; i < 8; i++) { this.nodes[i] = new Octree(childrenBounds[i], this.maxObjects, this.maxLevels, this.level + 1); }
    }
    getIndex(bbox) {
        let index = -1; const center = this.bounds.getCenter(new Vec3()); const fitsInTop = bbox.min.y > center.y; const fitsInBottom = bbox.max.y < center.y;
        if (fitsInTop) index = 0; else if (fitsInBottom) index = 4; else return -1;
        const fitsInFront = bbox.min.z > center.z; const fitsInBack = bbox.max.z < center.z; if (!fitsInFront && !fitsInBack) return -1; if (fitsInFront) index += 0; if (fitsInBack) index += 2;
        const fitsInRight = bbox.min.x > center.x; const fitsInLeft = bbox.max.x < center.x; if (!fitsInLeft && !fitsInRight) return -1; if (fitsInRight && index < 2) index += 0; if (fitsInLeft && index < 2) index += 1; if (fitsInRight && index > 1) index += 0; if (fitsInLeft && index > 1) index += 1;
        return index;
    }
    insert(obj, bbox) {
        if (this.nodes.length > 0) { const index = this.getIndex(bbox); if (index !== -1) { this.nodes[index].insert(obj, bbox); return; } }
        this.objects.push({ obj, bbox });
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) { if (this.nodes.length === 0) { this.subdivide(); } let i = 0; while (i < this.objects.length) { const currentItem = this.objects[i]; const index = this.getIndex(currentItem.bbox); if (index !== -1) { this.nodes[index].insert(currentItem.obj, currentItem.bbox); this.objects.splice(i, 1); } else { i++; } } }
    }
    retrieve(bbox) {
        let returnObjects = [...this.objects.map(item => item.obj)];
        if (this.nodes.length > 0) { const index = this.getIndex(bbox); if (index !== -1) { returnObjects.push(...this.nodes[index].retrieve(bbox)); } else { for (let i = 0; i < this.nodes.length; i++) { if (bbox.intersectsBox(this.nodes[i].bounds)) { returnObjects.push(...this.nodes[i].retrieve(bbox)); } } } }
        return returnObjects;
    }
    clear() { this.objects = []; for (let i = 0; i < this.nodes.length; i++) { this.nodes[i].clear(); } }
}


let config = {};
let gameState = { playerPos: { x: 0, y: 0, z: 0 } };
let spawnTimer = null;
let activePowerUpCount = 0;
let spawnedCount = 0;

let environmentOctree;



function getRandomElement(arr) { if (!arr || arr.length === 0) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function getRandomInRange(min, max) { return Math.random() * (max - min) + min; }
function distanceSq(p1, p2) { const dx = p1.x - p2.x; const dz = p1.z - p2.z; return dx * dx + dz * dz; }


/**
 * The core logic for finding a safe place to spawn.
 * This runs entirely within the worker.
 * @returns {object|null} A {x, y, z} position or null if no safe spot is found.
 */
function findSafeSpawnPosition() {




    if (!gameState.obstacles || gameState.obstacles.length === 0) {
        console.log('🛠️ PowerUp Worker: Waiting for obstacle data from main thread...');
        return null;
    }


    const { worldBoundary, minPlayerDist, minObstacleDist, maxAttempts } = config.spawnRules;
    const boundaryHalf = worldBoundary / 2;
    const minPlayerDistSq = minPlayerDist * minPlayerDist;
    const minObstacleDistSq = minObstacleDist * minObstacleDist;

    for (let i = 0; i < maxAttempts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = getRandomInRange(minPlayerDist, boundaryHalf * 0.9);
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const candidatePos = { x, y: 1.5, z };

        if (distanceSq(candidatePos, gameState.playerPos) < minPlayerDistSq) {
            continue;
        }

        let isSafe = true;
        for (const obstacle of gameState.obstacles) {
            if (distanceSq(candidatePos, obstacle.position) < minObstacleDistSq) {
                isSafe = false;
                break;
            }
        }

        if (isSafe) {
            return candidatePos;
        }
    }
    console.warn('🛠️ PowerUp Worker: Could not find a safe spawn position after max attempts.');
    return null;
}


/**
 * The main message handler for the worker.
 */
self.onmessage = (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            config = payload;
            spawnedCount = 0;

            const worldBounds = new Box3(
                new Vec3(-config.spawnRules.worldBoundary / 2, -10, -config.spawnRules.worldBoundary / 2),
                new Vec3(config.spawnRules.worldBoundary / 2, 10, config.spawnRules.worldBoundary / 2)
            );
            environmentOctree = new Octree(worldBounds);
            console.log('🛠️ PowerUp Worker: Initialized with config', config);
            startSpawning();
            break;

        case 'updateGameState':
            gameState = payload;

            environmentOctree.clear();
            if (payload.obstacles) {
                payload.obstacles.forEach(obs => {
                    const size = 5;
                    const obsBox = new Box3(
                        new Vec3(obs.position.x - size, obs.position.y - size, obs.position.z - size),
                        new Vec3(obs.position.x + size, obs.position.y + size, obs.position.z + size)
                    );
                    environmentOctree.insert(obs, obsBox);
                });
            }
            break;

        case 'updatePowerUpCount':
            activePowerUpCount = payload.count;
            break;

        case 'stop':
            if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
            break;
    }
};

/**
 * Starts the interval timer to check if a new power-up should be spawned.
 */
function startSpawning() {
    if (spawnTimer) clearInterval(spawnTimer);

    spawnTimer = setInterval(() => {
        if (spawnedCount >= config.totalSpawnLimit || activePowerUpCount >= config.maxPowerUps) {
            return;
        }

        const position = findSafeSpawnPosition();

        if (position) {
            const randomType = getRandomElement(config.powerUpTypes);
            if (randomType) {
                self.postMessage({
                    type: 'spawnPowerUpAtPosition',
                    payload: { typeName: randomType.name, position: position }
                });
                spawnedCount++;
            }
        }
    }, config.spawnInterval);
}
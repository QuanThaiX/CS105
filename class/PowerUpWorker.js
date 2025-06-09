// ./class/PowerUpWorker.js

let config = {};
let gameState = {
    playerPos: { x: 0, y: 0, z: 0 },
    obstacles: []
};
let spawnTimer = null;
let activePowerUpCount = 0;
let spawnedCount = 0;

// --- Self-Contained Helper Functions ---
function getRandomElement(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function distanceSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return dx * dx + dz * dz;
}

/**
 * The core logic for finding a safe place to spawn.
 * This runs entirely within the worker.
 * @returns {object|null} A {x, y, z} position or null if no safe spot is found.
 */
function findSafeSpawnPosition() {
    const { worldBoundary, minPlayerDist, minObstacleDist, maxAttempts } = config.spawnRules;
    const boundaryHalf = worldBoundary / 2;
    const minPlayerDistSq = minPlayerDist * minPlayerDist;
    const minObstacleDistSq = minObstacleDist * minObstacleDist;

    for (let i = 0; i < maxAttempts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = getRandomInRange(minPlayerDist, boundaryHalf * 0.9);
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const candidatePos = { x, y: 1.5, z }; // Assume y=1.5 for powerups

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
            console.log('🛠️ PowerUp Worker: Initialized with config', config);
            startSpawning();
            break;

        case 'updateGameState':
            // Receive lightweight game state from main thread
            gameState = payload;
            break;

        case 'updatePowerUpCount':
            activePowerUpCount = payload.count;
            break;

        case 'stop':
            if (spawnTimer) {
                clearInterval(spawnTimer);
                spawnTimer = null;
            }
            break;
    }
};

/**
 * Starts the interval timer to check if a new power-up should be spawned.
 */
function startSpawning() {
    if (spawnTimer) clearInterval(spawnTimer);

    spawnTimer = setInterval(() => {
        if (spawnedCount >= config.totalSpawnLimit) {
            clearInterval(spawnTimer);
            spawnTimer = null;
            console.log(`🛠️ PowerUp Worker: Total spawn limit of ${config.totalSpawnLimit} reached. Halting spawns.`);
            return;
        }

        if (activePowerUpCount < config.maxPowerUps) {
            const position = findSafeSpawnPosition();

            if (position) {
                const randomType = getRandomElement(config.powerUpTypes);
                
                self.postMessage({
                    type: 'spawnPowerUpAtPosition',
                    payload: {
                        typeName: randomType.name,
                        position: position
                    }
                });
                
                spawnedCount++;
            }
        }
    }, config.spawnInterval);
}
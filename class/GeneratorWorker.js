

/**
 * This worker handles the computationally intensive task of generating
 * object positions, scales, and types for the game world. It receives a configuration
 * and returns an array of plain JavaScript objects (definitions), which the main thread
 * then uses to create the actual 3D objects. This keeps the main UI thread from freezing
 * during level loading.
 */


function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomElement(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}


function generateScatteredObjects(count, types, scaleMin, scaleMax, maxSpawnRadius, minSpawnRadius = 0, playerSafeRadius = 35) {
    const objects = [];
    if (!types || types.length === 0) {
        console.warn("Worker: No types provided for scattered objects.");
        return objects;
    }
    const maxAttempts = count * 20;
    let attempts = 0;
    while (objects.length < count && attempts < maxAttempts) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const effectiveMinRadius = Math.max(minSpawnRadius, playerSafeRadius);
        const radius = getRandomInRange(effectiveMinRadius, maxSpawnRadius);
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        if (distanceFromCenter >= playerSafeRadius) {
            objects.push({
                position: { x, y: 0, z },
                scale: getRandomInRange(scaleMin, scaleMax),
                rotation: Math.random() * Math.PI * 2,
                type: getRandomElement(types),
            });
        }
    }
    if (objects.length < count) {
        console.warn(`Worker: Generated ${objects.length}/${count} scattered objects.`);
    }
    return objects;
}

function generateEnemyDefinitions(count, types, pointValueFn, hpFn, maxSpawnRadius, minSpawnRadius = 0) {
    const definitions = [];
    if (!types || types.length === 0) {
        console.warn("Worker: No enemy types provided.");
        return definitions;
    }
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = getRandomInRange(minSpawnRadius, maxSpawnRadius);
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const selectedType = getRandomElement(types);

        definitions.push({
            id: `enemy-${i + 1}`,
            position: { x, y: 1, z },
            type: selectedType,
        });
    }
    return definitions;
}



self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === 'generateLevel') {
        console.log("🛠️ Generator Worker: Received level generation request.", payload);
        const config = payload;

        const worldBoundaryHalf = config.worldBoundary / 2;
        const playerSafeRadius = 35;

        const maxEnemySpawnRadius = worldBoundaryHalf * config.enemyConfig.MAX_SPAWN_RADIUS_FACTOR;
        const minEnemySpawnRadius = Math.max(config.enemyConfig.MIN_SPAWN_RADIUS, playerSafeRadius);
        const enemyDefinitions = generateEnemyDefinitions(
            config.enemyConfig.NUM_ENEMIES,
            config.enemyConfig.ENEMY_TYPES,
            null,
            null,
            maxEnemySpawnRadius,
            minEnemySpawnRadius
        );

        const sceneryConfig = config.sceneryConfig;
        const maxScenerySpawnRadius = worldBoundaryHalf * sceneryConfig.MAX_SPAWN_RADIUS_FACTOR;

        const rockDefinitions = generateScatteredObjects(
            sceneryConfig.NUM_ROCKS, sceneryConfig.ROCK_TYPES, sceneryConfig.ROCK_SCALE_MIN,
            sceneryConfig.ROCK_SCALE_MAX, maxScenerySpawnRadius, sceneryConfig.MIN_SPAWN_RADIUS, playerSafeRadius
        );

        const treeDefinitions = generateScatteredObjects(
            sceneryConfig.NUM_TREES, sceneryConfig.TREE_TYPES, sceneryConfig.TREE_SCALE_MIN,
            sceneryConfig.TREE_SCALE_MAX, maxScenerySpawnRadius, sceneryConfig.MIN_SPAWN_RADIUS, playerSafeRadius
        );

        const barrelDefinitions = generateScatteredObjects(
            sceneryConfig.NUM_BARRELS, sceneryConfig.BARREL_TYPES, sceneryConfig.BARREL_SCALE_MIN,
            sceneryConfig.BARREL_SCALE_MAX, maxScenerySpawnRadius, sceneryConfig.MIN_SPAWN_RADIUS, playerSafeRadius + 10
        );

        console.log("✅ Generator Worker: Generation complete. Sending definitions back to main thread.");

        self.postMessage({
            type: 'generationComplete',
            payload: {
                enemyDefinitions,
                rockDefinitions,
                treeDefinitions,
                barrelDefinitions
            }
        });
    }
};
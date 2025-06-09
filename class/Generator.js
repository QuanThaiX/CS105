import * as THREE from 'three';
import { FACTION, TANKTYPE } from '../utils.js';
import { Tank } from './Tank.js';
import { Rock } from './Rock.js';
import { Tree } from './Tree.js';
import { Barrel } from './Barrel.js';
import { CollisionManager } from './CollisionManager.js';

/**
 * Advanced Generator class handles all procedural generation
 * - Object creation with async support
 * - Optimized algorithms for placement
 * - Batch processing for performance
 * - Memory-efficient generation patterns
 */
class Generator {
    static instance;

    constructor() {
        if (Generator.instance) {
            return Generator.instance;
        }
        Generator.instance = this;
        
        // Performance optimization
        this.batchSize = 50;
        this.processingDelay = 0; // ms delay between batches
    }

    /**
     * Get random number in range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number between min and max
     */
    getRandomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Get random element from array
     * @param {Array} arr - Array to pick from
     * @returns {*} Random element from array
     */
    getRandomElement(arr) {
        if (!arr || arr.length === 0) return undefined;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Generate scattered objects (rocks, trees, barrels) in circular pattern
     * @param {number} count - Number of objects to generate
     * @param {Array} types - Array of object types
     * @param {number} scaleMin - Minimum scale
     * @param {number} scaleMax - Maximum scale
     * @param {number} maxSpawnRadius - Maximum spawn radius
     * @param {number} minSpawnRadius - Minimum spawn radius
     * @param {number} playerSafeRadius - Safe radius around player spawn (0,0,0)
     * @returns {Array} Array of object definitions
     */
    generateScatteredObjects(count, types, scaleMin, scaleMax, maxSpawnRadius, minSpawnRadius = 0, playerSafeRadius = 35) {
        const objects = [];
        if (!types || types.length === 0) {
            console.warn("generateScatteredObjects: No types provided, cannot generate objects.");
            return objects;
        }

        const maxAttempts = count * 20; // Increase attempts to find valid positions
        let attempts = 0;

        while (objects.length < count && attempts < maxAttempts) {
            attempts++;
            
            const angle = Math.random() * Math.PI * 2;
            const effectiveMinRadius = Math.max(minSpawnRadius, playerSafeRadius);
            const radius = this.getRandomInRange(effectiveMinRadius, maxSpawnRadius);

            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);

            const distanceFromPlayer = Math.sqrt(x * x + z * z);
            if (distanceFromPlayer >= (playerSafeRadius + 5)) {
                objects.push({
                    position: { x, y: 0, z },
                    scale: this.getRandomInRange(scaleMin, scaleMax),
                    rotation: Math.random() * Math.PI * 2,
                    type: this.getRandomElement(types),
                });
            }
        }

        if (objects.length < count) {
            console.warn(`Generated ${objects.length}/${count} objects. Some positions were too close to player spawn.`);
        }

        return objects;
    }

    /**
     * Generate collision-aware placement for better object distribution
     * @param {number} count - Number of objects to generate
     * @param {Array} types - Array of object types
     * @param {number} scaleMin - Minimum scale
     * @param {number} scaleMax - Maximum scale
     * @param {Object} bounds - { minX, maxX, minZ, maxZ }
     * @param {number} minDistance - Minimum distance between objects
     * @returns {Array} Array of object definitions with validated positions
     */
    generateCollisionAwareObjects(count, types, scaleMin, scaleMax, bounds, minDistance = 5) {
        const objects = [];
        const maxAttempts = count * 10; // Limit attempts to prevent infinite loops
        let attempts = 0;
        
        while (objects.length < count && attempts < maxAttempts) {
            attempts++;
            
            const x = this.getRandomInRange(bounds.minX, bounds.maxX);
            const z = this.getRandomInRange(bounds.minZ, bounds.maxZ);
            const position = new THREE.Vector3(x, 0, z);
            const scale = this.getRandomInRange(scaleMin, scaleMax);
            
            // Check if position is valid (no overlaps)
            let validPosition = true;
            
            // Check against existing objects in this generation
            for (const existingObj of objects) {
                const distance = position.distanceTo(new THREE.Vector3(
                    existingObj.position.x, 
                    existingObj.position.y, 
                    existingObj.position.z
                ));
                
                if (distance < minDistance * Math.max(scale, existingObj.scale)) {
                    validPosition = false;
                    break;
                }
            }
            
            // Check against existing objects in CollisionManager if available
            if (validPosition && typeof CollisionManager !== 'undefined' && CollisionManager.instance) {
                const objectSize = {
                    width: scale * 2,
                    height: scale * 2,
                    depth: scale * 2
                };
                
                validPosition = CollisionManager.instance.isPositionValid(position, objectSize);
            }
            
            if (validPosition) {
                objects.push({
                    position: { x, y: 0, z },
                    scale: scale,
                    rotation: Math.random() * Math.PI * 2,
                    type: this.getRandomElement(types),
                });
            }
        }
        
        if (objects.length < count) {
            console.warn(`Could only generate ${objects.length}/${count} objects without overlaps`);
        }
        
        return objects;
    }

    /**
     * Enhanced random objects generation with collision avoidance
     * @param {number} count - Number of objects to generate
     * @param {Array} types - Array of object types
     * @param {number} scaleMin - Minimum scale
     * @param {number} scaleMax - Maximum scale
     * @param {Object} bounds - { minX, maxX, minZ, maxZ }
     * @param {Object} options - { avoidCollisions: boolean, minDistance: number }
     * @returns {Array} Array of object definitions
     */
    generateRandomObjects(count, types, scaleMin, scaleMax, bounds, options = {}) {
        const { avoidCollisions = false, minDistance = 5 } = options;
        
        if (avoidCollisions) {
            return this.generateCollisionAwareObjects(count, types, scaleMin, scaleMax, bounds, minDistance);
        } else {
            // Use original method for backward compatibility
            const objects = [];
            const { minX, maxX, minZ, maxZ } = bounds;

            for (let i = 0; i < count; i++) {
                const x = this.getRandomInRange(minX, maxX);
                const z = this.getRandomInRange(minZ, maxZ);
                
                objects.push({
                    position: { x, y: 0, z },
                    scale: this.getRandomInRange(scaleMin, scaleMax),
                    rotation: Math.random() * Math.PI * 2,
                    type: this.getRandomElement(types),
                });
            }
            
            return objects;
        }
    }

    /**
     * Generate enemy tank definitions with random placement
     * @param {number} count - Number of enemies to generate
     * @param {Array} types - Array of tank types
     * @param {number|Function} pointValue - Point value or function to calculate points
     * @param {number|Function} hp - HP value or function to calculate HP
     * @param {number} maxSpawnRadius - Maximum spawn radius
     * @param {number} minSpawnRadius - Minimum spawn radius
     * @returns {Array} Array of enemy definitions
     */
    generateEnemyDefinitions(count, types, pointValue, hp, maxSpawnRadius, minSpawnRadius = 0) {
        const definitions = [];
        if (!types || types.length === 0) {
            console.warn("generateEnemyDefinitions: No enemy types provided, cannot generate enemies.");
            return definitions;
        }

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const effectiveMinRadius = Math.min(minSpawnRadius, maxSpawnRadius);
            const radius = this.getRandomInRange(effectiveMinRadius, maxSpawnRadius);

            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);
            const selectedType = this.getRandomElement(types);

            definitions.push({
                id: `enemy-${i + 1}`, // Unique ID for each enemy
                position: { x, y: 1, z }, // y=1 for ground level
                pointValue: typeof pointValue === 'function' ? pointValue(selectedType) : pointValue,
                type: selectedType,
                hp: typeof hp === 'function' ? hp(selectedType) : hp,
            });
        }
        return definitions;
    }

    // =================== OBJECT CREATION METHODS (moved from static classes) ===================

    /**
     * Create Tank objects from enemy definitions (async batch processing)
     * @param {Array} enemyDefinitions - Array of enemy definitions
     * @param {Bot} bot - Bot instance to add tanks to
     * @param {CollisionManager} collisionManager - Collision manager to register tanks
     * @returns {Promise<Array>} Array of created Tank objects
     */
    async createEnemyTanks(enemyDefinitions, bot, collisionManager) {
        const tanks = [];
        
        // Process in batches for performance
        for (let i = 0; i < enemyDefinitions.length; i += this.batchSize) {
            const batch = enemyDefinitions.slice(i, i + this.batchSize);
            
            const batchTanks = batch.map(def => {
                const enemyTank = new Tank(def.id, FACTION.ENEMY, def.position, true, def.type);
                enemyTank.setTankHP(def.hp);
                enemyTank.pointValue = def.pointValue;
                enemyTank.defense = enemyTank.defense * 0.7;
                
                if (bot) bot.addTank(enemyTank);
                if (collisionManager) collisionManager.add(enemyTank);
                
                return enemyTank;
            });
            
            tanks.push(...batchTanks);
            
            // Yield control to prevent blocking
            if (this.processingDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.processingDelay));
            }
        }
        
        return tanks;
    }

    /**
     * Create Rock objects from definitions (consolidated from Rock.createRocksFromList)
     * @param {Array} rockDefinitions - Array of rock definitions
     * @param {CollisionManager} collisionManager - Collision manager to register rocks
     * @returns {Promise<Array>} Array of created Rock objects
     */
    async createRocks(rockDefinitions, collisionManager) {
        const rocks = [];
        
        for (let i = 0; i < rockDefinitions.length; i += this.batchSize) {
            const batch = rockDefinitions.slice(i, i + this.batchSize);
            
            const batchRocks = batch.map((rockData, batchIndex) => {
                const { position, scale = 1, rotation = 0, type = 'rock09' } = rockData;
                const globalIndex = i + batchIndex;
                
                if (position) {
                    const rockPosition = new THREE.Vector3(position.x, position.y || 0, position.z);
                    const rock = new Rock(`rock_${globalIndex}`, rockPosition, scale, rotation, type);
                    if (collisionManager) collisionManager.add(rock);
                    return rock;
                }
                return null;
            }).filter(Boolean);
            
            rocks.push(...batchRocks);
            
            if (this.processingDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.processingDelay));
            }
        }
        
        return rocks;
    }

    /**
     * Create random rocks with optimized generation
     * @param {number} count - Number of rocks to create
     * @param {Object} bounds - { minX, maxX, minZ, maxZ }
     * @param {Object} scaleRange - { min, max }
     * @param {Array} types - Rock types to choose from
     * @returns {Promise<Array>} Array of created Rock objects
     */
    async createRandomRocks(count, bounds, scaleRange = { min: 0.5, max: 2.0 }, types = ['rock09', 'rock13']) {
        const rockDefinitions = this.generateRandomObjects(
            count, 
            types, 
            scaleRange.min, 
            scaleRange.max, 
            bounds
        );
        
        return this.createRocks(rockDefinitions);
    }

    /**
     * Create Tree objects from definitions (consolidated from Tree.createTreesFromList)
     * @param {Array} treeDefinitions - Array of tree definitions
     * @param {CollisionManager} collisionManager - Collision manager to register trees
     * @returns {Promise<Array>} Array of created Tree objects
     */
    async createTrees(treeDefinitions, collisionManager) {
        const trees = [];
        
        for (let i = 0; i < treeDefinitions.length; i += this.batchSize) {
            const batch = treeDefinitions.slice(i, i + this.batchSize);
            
            const batchTrees = batch.map((treeData, batchIndex) => {
                const { position, scale = 1, rotation = 0, type = 'tree01' } = treeData;
                const globalIndex = i + batchIndex;
                
                if (position) {
                    const treePosition = new THREE.Vector3(position.x, position.y || 0, position.z);
                    const tree = new Tree(`tree_${globalIndex}`, treePosition, scale, rotation, type);
                    if (collisionManager) collisionManager.add(tree);
                    return tree;
                }
                return null;
            }).filter(Boolean);
            
            trees.push(...batchTrees);
            
            if (this.processingDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.processingDelay));
            }
        }
        
        return trees;
    }

    /**
     * Create Barrel objects from definitions (consolidated from Barrel.createBarrelsFromList)
     * @param {Array} barrelDefinitions - Array of barrel definitions
     * @param {CollisionManager} collisionManager - Collision manager to register barrels
     * @returns {Promise<Array>} Array of created Barrel objects
     */
    async createBarrels(barrelDefinitions, collisionManager) {
        const barrels = [];
        
        for (let i = 0; i < barrelDefinitions.length; i += this.batchSize) {
            const batch = barrelDefinitions.slice(i, i + this.batchSize);
            
            const batchBarrels = batch.map((barrelData, batchIndex) => {
                const { position, scale = 1, rotation = 0, type = 'barrel' } = barrelData;
                const globalIndex = i + batchIndex;
                
                if (position) {
                    const barrelPosition = new THREE.Vector3(position.x, position.y || 0, position.z);
                    const barrel = new Barrel(`barrel_${globalIndex}`, barrelPosition, scale, rotation, type);
                    if (collisionManager) collisionManager.add(barrel);
                    return barrel;
                }
                return null;
            }).filter(Boolean);
            
            barrels.push(...batchBarrels);
            
            if (this.processingDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.processingDelay));
            }
        }
        
        return barrels;
    }

    /**
     * Create random barrels with collision awareness and explosion considerations
     * @param {number} count - Number of barrels to create
     * @param {Object} bounds - { minX, maxX, minZ, maxZ }
     * @param {Object} scaleRange - { min, max }
     * @param {Object} options - { avoidCollisions: boolean, minDistance: number, safeFromPlayer: number }
     * @returns {Promise<Array>} Array of created Barrel objects
     */
    async createRandomBarrels(count, bounds, scaleRange = { min: 0.8, max: 1.5 }, options = {}) {
        const { 
            avoidCollisions = true, 
            minDistance = 8, // Larger distance for barrels due to explosion radius
            safeFromPlayer = 15 // Keep barrels away from player spawn
        } = options;
        
        // Modify bounds to keep barrels away from player spawn (0,0,0)
        const safeBounds = {
            minX: bounds.minX < -safeFromPlayer ? bounds.minX : -bounds.maxX,
            maxX: bounds.maxX > safeFromPlayer ? bounds.maxX : -bounds.minX,
            minZ: bounds.minZ < -safeFromPlayer ? bounds.minZ : -bounds.maxZ,
            maxZ: bounds.maxZ > safeFromPlayer ? bounds.maxZ : -bounds.minZ
        };
        
        const barrelDefinitions = this.generateRandomObjects(
            count, 
            ['barrel'], 
            scaleRange.min, 
            scaleRange.max, 
            safeBounds,
            { avoidCollisions, minDistance }
        );
        
        return this.createBarrels(barrelDefinitions);
    }

    /**
     * Generate complete level with all objects (async version)
     * @param {Object} config - Level configuration
     * @returns {Promise<Object>} Object containing all generated entities
     */
    async generateLevel(config) {
        const {
            worldBoundary,
            sceneryConfig,
            enemyConfig
        } = config;

        const worldBoundaryHalf = worldBoundary / 2;
        const playerSafeRadius = 35; // Safe zone around player spawn

        // Generate enemy definitions
        const maxEnemySpawnRadius = worldBoundaryHalf * enemyConfig.MAX_SPAWN_RADIUS_FACTOR;
        const minEnemySpawnRadius = Math.max(enemyConfig.MIN_SPAWN_RADIUS, playerSafeRadius); // Keep enemies away from player

        const enemyDefinitions = this.generateEnemyDefinitions(
            enemyConfig.NUM_ENEMIES,
            enemyConfig.ENEMY_TYPES,
            enemyConfig.ENEMY_POINT_VALUE,
            enemyConfig.ENEMY_HP,
            maxEnemySpawnRadius,
            minEnemySpawnRadius
        );

        // Generate scenery definitions with player safe zone
        const maxScenerySpawnRadius = worldBoundaryHalf * sceneryConfig.MAX_SPAWN_RADIUS_FACTOR;
        const minScenerySpawnRadius = Math.max(sceneryConfig.MIN_SPAWN_RADIUS, playerSafeRadius);

        const rockDefinitions = this.generateScatteredObjects(
            sceneryConfig.NUM_ROCKS,
            sceneryConfig.ROCK_TYPES,
            sceneryConfig.ROCK_SCALE_MIN,
            sceneryConfig.ROCK_SCALE_MAX,
            maxScenerySpawnRadius,
            minScenerySpawnRadius,
            playerSafeRadius
        );

        const treeDefinitions = this.generateScatteredObjects(
            sceneryConfig.NUM_TREES,
            sceneryConfig.TREE_TYPES,
            sceneryConfig.TREE_SCALE_MIN,
            sceneryConfig.TREE_SCALE_MAX,
            maxScenerySpawnRadius,
            minScenerySpawnRadius,
            playerSafeRadius
        );

        const barrelDefinitions = this.generateScatteredObjects(
            sceneryConfig.NUM_BARRELS || 0,
            sceneryConfig.BARREL_TYPES || ['barrel'],
            sceneryConfig.BARREL_SCALE_MIN || 0.8,
            sceneryConfig.BARREL_SCALE_MAX || 1.5,
            maxScenerySpawnRadius,
            minScenerySpawnRadius,
            playerSafeRadius + 10 // Extra safe distance for explosive barrels
        );

        console.log(`🎯 Generated level with player safe zone of ${playerSafeRadius} units`);
        console.log(`📊 Objects: ${enemyDefinitions.length} enemies, ${rockDefinitions.length} rocks, ${treeDefinitions.length} trees, ${barrelDefinitions.length} barrels`);

        return {
            enemyDefinitions,
            rockDefinitions,
            treeDefinitions,
            barrelDefinitions
        };
    }

    /**
     * Async level creation with progress callback
     * @param {Object} config - Level configuration
     * @param {Function} progressCallback - Progress callback (optional)
     * @returns {Promise<Object>} Created level objects
     */
    async createLevelAsync(config, progressCallback = null) {
        const levelData = await this.generateLevel(config);
        const totalSteps = 4;
        let currentStep = 0;

        const updateProgress = (step, description) => {
            if (progressCallback) {
                progressCallback({
                    step: step,
                    total: totalSteps,
                    progress: (step / totalSteps) * 100,
                    description: description
                });
            }
        };

        updateProgress(++currentStep, 'Creating enemy tanks...');
        const enemies = await this.createEnemyTanks(levelData.enemyDefinitions);

        updateProgress(++currentStep, 'Creating rocks...');
        const rocks = await this.createRocks(levelData.rockDefinitions);

        updateProgress(++currentStep, 'Creating trees...');
        const trees = await this.createTrees(levelData.treeDefinitions);

        updateProgress(++currentStep, 'Creating barrels...');
        const barrels = await this.createBarrels(levelData.barrelDefinitions);

        return {
            enemies,
            rocks,
            trees,
            barrels,
            definitions: levelData
        };
    }

    /**
     * Set processing options for batch operations
     * @param {Object} options - { batchSize: number, processingDelay: number }
     */
    setProcessingOptions(options) {
        if (options.batchSize !== undefined) {
            this.batchSize = Math.max(1, options.batchSize);
        }
        if (options.processingDelay !== undefined) {
            this.processingDelay = Math.max(0, options.processingDelay);
        }
    }

    /**
     * Cleanup generator resources
     */
    dispose() {
        Generator.instance = null;
    }
}

export { Generator }; 

import * as THREE from 'three';
import { FACTION, TANKTYPE } from '../utils.js';
import { Tank } from './Tank.js';
import { Rock } from './Rock.js';
import { Tree } from './Tree.js';
import { Barrel } from './Barrel.js';
import { CollisionManager } from './CollisionManager.js';
import { GAMECONFIG } from '../config.js';

/**
 * Advanced Generator class now acts as a manager for a Web Worker.
 * It offloads the heavy computation of object placement to a separate thread,
 * then uses the resulting data to instantiate the actual 3D objects on the main thread.
 */
class Generator {
    static instance;
    worker;
    _levelGenerationResolve = null;
    _levelGenerationReject = null;

    constructor() {
        if (Generator.instance) {
            return Generator.instance;
        }
        Generator.instance = this;

        if (typeof (Worker) === "undefined") {
            console.error("❌ This browser does not support Web Workers. Level generation will be synchronous and may freeze the UI.");
            return;
        }

        this.worker = new Worker('./class/GeneratorWorker.js', { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (error) => {
            console.error("🛠️ Generator Worker Error:", error);
            if (this._levelGenerationReject) {
                this._levelGenerationReject(error);
                this._levelGenerationReject = null;
                this._levelGenerationResolve = null;
            }
        };


        this.batchSize = 50;
        this.processingDelay = 0;
    }

    handleWorkerMessage(e) {
        const { type, payload } = e.data;
        if (type === 'generationComplete') {
            if (this._levelGenerationResolve) {
                this._levelGenerationResolve(payload);
                this._levelGenerationResolve = null;
                this._levelGenerationReject = null;
            }
        }
    }

    /**
     * Generate complete level definitions by offloading the task to a Web Worker.
     * @param {Object} config - Level configuration.
     * @returns {Promise<Object>} A promise that resolves with the object definitions.
     */
    async generateLevel(config) {
        if (!this.worker) {
            return Promise.reject(new Error("Web Worker is not supported or initialized."));
        }




        const workerConfig = {
            worldBoundary: config.worldBoundary,
            enemyConfig: {
                NUM_ENEMIES: config.enemyConfig.NUM_ENEMIES,
                ENEMY_TYPES: config.enemyConfig.ENEMY_TYPES,
                MAX_SPAWN_RADIUS_FACTOR: config.enemyConfig.MAX_SPAWN_RADIUS_FACTOR,
                MIN_SPAWN_RADIUS: config.enemyConfig.MIN_SPAWN_RADIUS,
            },
            sceneryConfig: config.sceneryConfig,
        };


        return new Promise((resolve, reject) => {
            this._levelGenerationResolve = resolve;
            this._levelGenerationReject = reject;

            this.worker.postMessage({ type: 'generateLevel', payload: workerConfig });
        });
    }


    getRandomInRange(min, max) { return Math.random() * (max - min) + min; }
    getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }



    /**
     * Create Tank objects from enemy definitions (async batch processing)
     * @param {Array} enemyDefinitions - Array of enemy definitions
     * @param {Bot} bot - Bot instance to add tanks to
     * @param {CollisionManager} collisionManager - Collision manager to register tanks
     * @returns {Promise<Array>} Array of created Tank objects
     */
    async createEnemyTanks(enemyDefinitions, bot, collisionManager) {
        const tanks = [];

        for (let i = 0; i < enemyDefinitions.length; i += this.batchSize) {
            const batch = enemyDefinitions.slice(i, i + this.batchSize);

            const batchTanks = batch.map(def => {
                const enemyTank = new Tank(def.id, FACTION.ENEMY, def.position, true, def.type);


                const pointValue = typeof GAMECONFIG.ENEMY_CONFIG.ENEMY_POINT_VALUE === 'function'
                    ? GAMECONFIG.ENEMY_CONFIG.ENEMY_POINT_VALUE(def.type)
                    : GAMECONFIG.ENEMY_CONFIG.ENEMY_POINT_VALUE;

                const hp = typeof GAMECONFIG.ENEMY_CONFIG.ENEMY_HP === 'function'
                    ? GAMECONFIG.ENEMY_CONFIG.ENEMY_HP(def.type)
                    : GAMECONFIG.ENEMY_CONFIG.ENEMY_HP;


                enemyTank.setTankHP(hp);
                enemyTank.pointValue = pointValue;


                enemyTank.defense *= 0.8;
                enemyTank.damage *= 0.8;
                enemyTank.shootCooldown *= 1.2;
                enemyTank.moveSpeed *= 0.9;
                enemyTank.rotateSpeed *= 0.9;

                if (bot) bot.addTank(enemyTank);
                if (collisionManager) collisionManager.add(enemyTank);

                return enemyTank;
            });

            tanks.push(...batchTanks);

            if (this.processingDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.processingDelay));
            }
        }

        return tanks;
    }

    /**
     * Create Rock objects from definitions
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
     * Create Tree objects from definitions
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
     * Create Barrel objects from definitions
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
     * Cleanup generator resources
     */
    dispose() {
        if (this.worker) {
            this.worker.terminate();
        }
        Generator.instance = null;
    }
}

export { Generator };
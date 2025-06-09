// ./class/PowerUpManager.js
import { Game } from './Game.js';
import { PowerUp } from './PowerUp.js';
import { POWERUP_TYPE, EVENT } from '../utils.js';
import { EventManager } from './EventManager.js';
import { GAMECONFIG } from '../config.js';

export class PowerUpManager {
    constructor() {
        this.game = Game.instance;
        this.powerUpPool = [];
        this.worker = null;
        
        // For throttling state updates to the worker
        this.lastStateUpdateTime = 0;
        this.stateUpdateInterval = 500; // ms

        this.initializePool();
        this.initializeWorker();
    }
    
    initializePool() {
        console.log("🔥 Initializing Power-Up Object Pool...");
        const maxPoolSize = 5; 
        const powerUpTypes = Object.values(POWERUP_TYPE);

        for (const type of powerUpTypes) {
            for (let i = 0; i < maxPoolSize; i++) {
                const powerUp = new PowerUp(`powerup-${type.name}-${i}`, type);
                this.powerUpPool.push(powerUp);
                this.game.updatableObjects.push(powerUp);
            }
        }
        console.log(`✅ Power-Up Pool created with ${this.powerUpPool.length} objects.`);
    }

    initializeWorker() {
        if (typeof Worker === 'undefined') {
            console.error("Web Workers not supported. Power-up system will not run.");
            return;
        }

        this.worker = new Worker('./class/PowerUpWorker.js', { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (e) => console.error("PowerUp Worker Error:", e);

        const powerUpConfig = GAMECONFIG.POWERUP_CONFIG;
        const worldBoundary = GAMECONFIG.WORLD_BOUNDARY;

        this.worker.postMessage({
            type: 'init',
            payload: {
                spawnInterval: powerUpConfig.SPAWN_INTERVAL,
                maxPowerUps: powerUpConfig.MAX_ACTIVE,
                totalSpawnLimit: powerUpConfig.TOTAL_SPAWN_LIMIT,
                powerUpTypes: this.getSerializablePowerUpTypes(),
                // NEW: Send spawn rules to the worker
                spawnRules: {
                    worldBoundary: worldBoundary,
                    minPlayerDist: 30,
                    minObstacleDist: 5,
                    maxAttempts: 20
                }
            }
        });
    }

    handleWorkerMessage(e) {
        const { type, payload } = e.data;
        // The worker now sends a specific command with the final position
        if (type === 'spawnPowerUpAtPosition') {
            this.activatePowerUp(payload.typeName, payload.position);
        }
    }

    /**
     * Called from the main game loop to periodically send state to the worker.
     */
    update() {
        if (!this.worker || !this.game.isRunning) return;

        const now = performance.now();
        if (now - this.lastStateUpdateTime > this.stateUpdateInterval) {
            this.lastStateUpdateTime = now;

            // Serialize only what the worker needs: positions.
            const gsm = this.game.getGameStateManager();
            if (!gsm || !gsm.getPlayerTank()) return;
            
            const serializableObstacles = gsm.getAllObstacles().map(obs => ({
                id: obs.id,
                position: { x: obs.position.x, y: obs.position.y, z: obs.position.z }
            }));

            const serializableEnemies = gsm.getEnemyTanks().map(tank => ({
                id: tank.id,
                position: { x: tank.position.x, y: tank.position.y, z: tank.position.z }
            }));

            this.worker.postMessage({
                type: 'updateGameState',
                payload: {
                    playerPos: gsm.getPlayerTank().position,
                    obstacles: [...serializableObstacles, ...serializableEnemies]
                }
            });
        }
    }
    
    /**
     * Activates a power-up from the pool at a specific position.
     * This is called in response to a worker command.
     */
    activatePowerUp(typeName, position) {
        const powerUp = this.powerUpPool.find(p => !p.isActive && p.powerUpType.name === typeName);

        if (powerUp) {
            powerUp.activate(position);
            this.updateWorkerCount(); // Tell worker the count has changed
            EventManager.instance.notify(EVENT.POWERUP_SPAWNED, { powerUp });
        } else {
            console.warn(`No inactive power-ups of type ${typeName} available in the pool.`);
        }
    }
    
    onPowerUpCollected() {
        // When a power-up is collected on the main thread, we just need to notify
        // the worker that a slot has been freed up.
        this.updateWorkerCount();
    }
    
    updateWorkerCount() {
        if (!this.worker) return;
        
        const activeCount = this.powerUpPool.filter(p => p.isActive).length;
        this.worker.postMessage({
            type: 'updatePowerUpCount',
            payload: {
                count: activeCount
            }
        });
    }

    getSerializablePowerUpTypes() {
        return Object.values(POWERUP_TYPE).map(p => ({ name: p.name }));
    }

    clear() {
        if (this.worker) {
            this.worker.postMessage({ type: 'stop' });
            this.worker.terminate();
            this.worker = null;
        }
        this.powerUpPool.forEach(p => p.dispose());
        this.powerUpPool = [];
    }
}
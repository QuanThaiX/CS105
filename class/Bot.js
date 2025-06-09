// ./class/Bot.js
import * as THREE from 'three';
import { Game } from './Game.js';
import { GAMECONFIG } from '../config.js';
import { Tank } from './Tank.js';

class Bot {
    static instance;
    tanks = [];
    worker;
    
    constructor() {
        if (Bot.instance) {
            return Bot.instance;
        }
        Bot.instance = this;

        if (typeof(Worker) === "undefined") {
            console.error("❌ This browser does not support Web Workers. Bot AI will not function.");
            return;
        }

        console.log("🚀 Initializing Bot AI with Web Worker support.");
        
        this.worker = new Worker('./class/BotWorker.js', { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (error) => {
            console.error("🤖 Bot Worker Error:", error.message, error);
        };
        
        this.worker.postMessage({
            type: 'init',
            payload: {
                config: { WORLD_BOUNDARY: GAMECONFIG.WORLD_BOUNDARY }
            }
        });
    }

    addTank(tank) {
        if (!this.worker) return;

        // The initial bot configuration is still defined here
        tank.bot = {
            currentState: 'patrol',
            stateStartTime: Date.now(),
            stateTimer: 0,
            minStateTime: 1000,
            playerTank: null, // This will be provided by gameState now
            detectionRange: 2000,
            attackRange: 150,
            optimalAttackRange: 20,
            minDistanceToObstacles: 5,
            minDistanceToTanks: 5,
            moveSpeed: tank.moveSpeed || 0.1,
            rotateSpeed: tank.rotateSpeed || 0.03,
            patrolTarget: null,
            patrolRadius: 100,
            lastPatrolGeneration: 0,
            patrolInterval: 3000,
            lastShotTime: 0,
            shootCooldown: tank.shootCooldown || 2000,
            lastBehaviorUpdate: Date.now(),
            behaviorUpdateInterval: 300,
            debugInfo: {
                currentAction: 'Initializing',
                distanceToPlayer: 0,
                nearestObstacleDistance: 0,
                isAvoidingObstacle: false,
                isShooting: false
            }
        };

        this.tanks.push(tank);
        
        this.worker.postMessage({
            type: 'add',
            payload: { id: tank.id, botConfig: tank.bot }
        });
    }

    removeTank(tank) {
        if (!this.worker) return;

        const index = this.tanks.findIndex(t => t.id === tank.id);
        if (index !== -1) {
            this.tanks.splice(index, 1);
            this.worker.postMessage({ type: 'remove', payload: { id: tank.id } });
        }
    }

    update() {
        if (!this.worker || this.tanks.length === 0) return;
        const gameState = this.serializeGameState();
        if (gameState) {
            this.worker.postMessage({ type: 'update', payload: gameState });
        }
    }

    handleWorkerMessage(e) {
        const { type, payload } = e.data;
        if (type === 'commands') {
            this.applyCommands(payload);
        }
    }

    applyCommands(commands) {
        for (const command of commands) {
            const tank = this.tanks.find(t => t.id === command.tankId);
            if (tank && !tank.disposed) {
                switch (command.action) {
                    case 'moveForward':
                        tank.moveForward(command.value);
                        break;
                    case 'moveBackward':
                        tank.moveBackward(command.value);
                        break;
                    case 'rotateLeft':
                        tank.rotateLeft(command.value);
                        break;
                    case 'rotateRight':
                        tank.rotateRight(command.value);
                        break;
                    case 'startAutoShoot':
                        tank.startAutoShoot(command.value);
                        break;
                    case 'stopAutoShoot':
                        tank.stopAutoShoot();
                        break;
                    case 'updateDebugInfo':
                        tank.bot.debugInfo = command.value;
                        break;
                }
            }
        }
    }
    
     serializeGameState() {
        const game = Game.instance;
        if (!game || !game.playerTank || !game.playerTank.model) return null;
        
        const gsm = game.getGameStateManager();
        if (!gsm) return null;
        
        const playerTank = gsm.getPlayerTank();
        const serializedPlayer = playerTank ? {
            id: playerTank.id,
            position: { x: playerTank.position.x, y: playerTank.position.y, z: playerTank.position.z },
            hp: playerTank.hp
        } : null;
        
        const allTanks = gsm.getAllTanks();
        const serializedTanks = allTanks
            .filter(tank => tank.model)
            .map(tank => ({
                id: tank.id,
                position: { x: tank.position.x, y: tank.position.y, z: tank.position.z },
                quaternion: { x: tank.model.quaternion.x, y: tank.model.quaternion.y, z: tank.model.quaternion.z, w: tank.model.quaternion.w },
                rotationY: tank.model.rotation.y
            }));
        
        const allObstacles = gsm.getAllObstacles();
        const serializedObstacles = allObstacles.map(obs => ({
            id: obs.id,
            position: { x: obs.position.x, y: obs.position.y, z: obs.position.z },
            // Add a type property so the worker knows what it is
            type: obs.constructor.name 
        }));
        
        // --- NEW: Serialize barrels for tactical AI ---
        const allBarrels = game.barrels || [];
        const serializedBarrels = allBarrels
            .filter(barrel => barrel && !barrel.hasExploded)
            .map(barrel => ({
                id: barrel.id,
                position: { x: barrel.position.x, y: barrel.position.y, z: barrel.position.z },
                hp: barrel.hp
            }));

        return {
            playerTank: serializedPlayer,
            tanks: serializedTanks,
            obstacles: serializedObstacles,
            barrels: serializedBarrels, // <-- ADDED
        };
    }

    clear() {
        this.tanks.forEach(tank => {
            if (tank) {
                tank.stopAutoShoot();
            }
        });
        this.tanks = [];
        if (this.worker) {
            this.worker.postMessage({ type: 'clear' });
        }
    }

    dispose() {
        this.clear();
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        Bot.instance = null;
    }
}

export { Bot };
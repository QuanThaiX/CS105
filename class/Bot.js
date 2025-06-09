import * as THREE from 'three';
import { FACTION, EVENT } from "../utils.js";
import { Game } from './Game.js';
import { GAMECONFIG } from '../config.js';
import { Tank } from './Tank.js'; 

/**
 * Simplified Bot AI với FSM và intelligent distance management
 * Features:
 * - Simple Finite State Machine (3 states)
 * - Distance-based movement và combat
 * - Continuous player attacking
 * - Smart obstacle avoidance
 */

const BotState = Object.freeze({
    PATROL: 'patrol',               // Tuần tra random
    HUNT: 'hunt',                   // Tìm kiếm và di chuyển về phía player
    ATTACK: 'attack'                // Tấn công player liên tục
});

class Bot {
    static instance;
    tanks = [];

    constructor() {
        if (Bot.instance) {
            return Bot.instance;
        }
        Bot.instance = this;
    }

    addTank(tank) {
        tank.bot = {
            // =================== FSM STATES ===================
            currentState: BotState.PATROL,
            stateStartTime: Date.now(),
            stateTimer: 0,
            minStateTime: 1000,           // Minimum time in state (ms)
            
            // =================== TARGETS & DETECTION ===================
            playerTank: Game.instance.playerTank,
            detectionRange: 2000,          // Detection range
            attackRange: 150,             // Attack range 
            optimalAttackRange: 20,       // Optimal attack distance
            minDistanceToObstacles: 5,   // Minimum distance to obstacles
            minDistanceToTanks: 5,       // Minimum distance to other tanks
            
            // =================== MOVEMENT ===================
            moveSpeed: tank.moveSpeed || 0.1,
            rotateSpeed: tank.rotateSpeed || 0.03,
            
            // =================== PATROL SYSTEM ===================
            patrolTarget: null,           // Current patrol target
            patrolRadius: 100,            // Patrol radius
            lastPatrolGeneration: 0,
            patrolInterval: 3000,         // Generate new patrol point every 3s
            
            // =================== COMBAT ===================
            lastShotTime: 0,
            shootCooldown: tank.shootCooldown || 2000,
            
            // =================== BEHAVIOR UPDATE ===================
            lastBehaviorUpdate: Date.now(),
            behaviorUpdateInterval: 300,   // Update behavior every 300ms
            
            // =================== DEBUG INFO ===================
            debugInfo: {
                currentAction: 'Initializing',
                distanceToPlayer: 0,
                nearestObstacleDistance: 0,
                isAvoidingObstacle: false,
                isShooting: false
            }
        };

        this.tanks.push(tank);
    }

    removeTank(tank) {
        const index = this.tanks.findIndex(t => t === tank);
        if (index !== -1) {
            this.tanks.splice(index, 1);
        }
    }

    update() {
        for (const tank of this.tanks) {
            if (tank && !tank.disposed) {
                this.updateTankBehavior(tank);
            }
        }
    }

    updateTankBehavior(tank) {
        const bot = tank.bot;
        const currentTime = Date.now();
        
        // Update timers
        bot.stateTimer = currentTime - bot.stateStartTime;
        
        // Update behavior periodically
        if (currentTime - bot.lastBehaviorUpdate >= bot.behaviorUpdateInterval) {
            bot.lastBehaviorUpdate = currentTime;
            this.evaluateStateTransition(tank);
        }
        
        // Always execute current state
        this.executeCurrentState(tank);
    }

    /**
     * Evaluate state transitions
     * @param {Tank} tank - Tank to evaluate
     */
    evaluateStateTransition(tank) {
        const bot = tank.bot;
        
        // Don't change state too quickly
        if (bot.stateTimer < bot.minStateTime) {
            return;
        }
        
        // Player check
        if (!bot.playerTank || bot.playerTank.hp <= 0) {
            this.transitionTo(tank, BotState.PATROL);
            return;
        }

        const distanceToPlayer = tank.position.distanceTo(bot.playerTank.position);
        bot.debugInfo.distanceToPlayer = distanceToPlayer;
        
        // State transitions based on distance
        if (distanceToPlayer <= bot.attackRange) {
            // In attack range - always attack
            if (bot.currentState !== BotState.ATTACK) {
                this.transitionTo(tank, BotState.ATTACK);
            }
        } else if (distanceToPlayer <= bot.detectionRange) {
            // In detection range - hunt player
            if (bot.currentState !== BotState.HUNT) {
                this.transitionTo(tank, BotState.HUNT);
            }
        } else {
            // Out of range - patrol
            if (bot.currentState !== BotState.PATROL) {
                this.transitionTo(tank, BotState.PATROL);
            }
        }
    }

    /**
     * Transition to new state
     * @param {Tank} tank - Tank to transition
     * @param {string} newState - New state to transition to
     */
    transitionTo(tank, newState) {
        const bot = tank.bot;
        
        if (newState === bot.currentState) return;
        
        bot.currentState = newState;
        bot.stateStartTime = Date.now();
        bot.stateTimer = 0;

        // State entry actions
        switch (newState) {
            case BotState.ATTACK:
                tank.startAutoShoot(Math.max(5000, bot.shootCooldown * 1.5));
                bot.debugInfo.isShooting = true;
                break;
                
            case BotState.HUNT:
            case BotState.PATROL:
                tank.stopAutoShoot();
                bot.debugInfo.isShooting = false;
                break;
        }
    }

    /**
     * Execute current state behavior
     * @param {Tank} tank - Tank to execute behavior for
     */
    executeCurrentState(tank) {
        const bot = tank.bot;
        
        switch (bot.currentState) {
            case BotState.PATROL:
                this.executePatrolState(tank);
                break;
            case BotState.HUNT:
                this.executeHuntState(tank);
                break;
            case BotState.ATTACK:
                this.executeAttackState(tank);
                break;
        }
    }

    /**
     * Execute PATROL state - random movement
     * @param {Tank} tank - Tank to control
     */
    executePatrolState(tank) {
        const bot = tank.bot;
        const currentTime = Date.now();
        
        // Generate new patrol target if needed
        if (!bot.patrolTarget || currentTime - bot.lastPatrolGeneration > bot.patrolInterval) {
            this.generatePatrolTarget(tank);
            bot.lastPatrolGeneration = currentTime;
        }
        
        // Move toward patrol target with obstacle avoidance
        if (bot.patrolTarget) {
            const distance = tank.position.distanceTo(bot.patrolTarget);
            
            // Reached patrol target - generate new one
            if (distance < 10) {
                this.generatePatrolTarget(tank);
                return;
            }
            
            // Move with obstacle avoidance
            this.moveWithObstacleAvoidance(tank, bot.patrolTarget, 0.5);
        }
        
        bot.debugInfo.currentAction = 'Patrolling';
    }

    /**
     * Execute HUNT state - move toward player
     * @param {Tank} tank - Tank to control
     */
    executeHuntState(tank) {
        const bot = tank.bot;
        
        if (!bot.playerTank) return;
        
        // Move toward player with obstacle avoidance
        this.moveWithObstacleAvoidance(tank, bot.playerTank.position, 0.8);
        
        bot.debugInfo.currentAction = 'Hunting player';
    }

    /**
     * Execute ATTACK state - attack player while maintaining optimal distance
     * @param {Tank} tank - Tank to control
     */
    executeAttackState(tank) {
        const bot = tank.bot;
        
        if (!bot.playerTank) return;
        
        const distanceToPlayer = tank.position.distanceTo(bot.playerTank.position);
        
        // Always face player for accurate shooting
        this.faceTarget(tank, bot.playerTank.position, true);
        
        // Distance management
        if (distanceToPlayer > bot.optimalAttackRange * 1.3) {
            this.moveWithObstacleAvoidance(tank, bot.playerTank.position, 0.6);
            bot.debugInfo.currentAction = 'Attacking - moving closer';
        } else if (distanceToPlayer < bot.optimalAttackRange * 0.7) {
            this.moveWithObstacleAvoidance(tank, bot.playerTank.position, 0.4);
            bot.debugInfo.currentAction = 'Attacking - backing away';
        } else {
            bot.debugInfo.currentAction = 'Attacking - in optimal range';
        }
    }

    /**
     * Generate random patrol target
     * @param {Tank} tank - Tank to generate patrol target for
     */
    generatePatrolTarget(tank) {
        const bot = tank.bot;
        const angle = Math.random() * Math.PI * 2;
        const distance = bot.patrolRadius * (0.5 + Math.random() * 0.5);
        
        const x = tank.position.x + Math.cos(angle) * distance;
        const z = tank.position.z + Math.sin(angle) * distance;
        
        // Check world boundaries
        const halfBoundary = (GAMECONFIG?.WORLD_BOUNDARY || 1500) / 2;
        const clampedX = Math.max(-halfBoundary + 50, Math.min(halfBoundary - 50, x));
        const clampedZ = Math.max(-halfBoundary + 50, Math.min(halfBoundary - 50, z));
        
        bot.patrolTarget = new THREE.Vector3(clampedX, 1, clampedZ);
    }
    /**
     * Move toward target with intelligent obstacle avoidance.
     * This version adds a "panic" mode for when obstacles are too close.
     * @param {Tank} tank - Tank to move
     * @param {THREE.Vector3} targetPosition - Target to move toward
     * @param {number} speedMultiplier - Speed multiplier
     */
    moveWithObstacleAvoidance(tank, targetPosition, speedMultiplier = 1) {
        const bot = tank.bot;
        
        const { avoidanceVector, nearestObstacleDistance } = this.calculateObstacleAvoidance(tank);
        
        const panicDistance = 4.0;
        if (nearestObstacleDistance < panicDistance) {
            bot.debugInfo.isAvoidingObstacle = true;
            bot.debugInfo.currentAction = "Evasive Maneuver!";

            tank.moveBackward(bot.moveSpeed * 2);

            const directionToAvoidance = new THREE.Vector3().subVectors(avoidanceVector, tank.position).normalize();
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(tank.model.quaternion);
            
            const cross = new THREE.Vector3().crossVectors(forward, directionToAvoidance);
            
            if (cross.y > 0) {
                tank.rotateLeft(bot.rotateSpeed * 1.5);
            } else {
                tank.rotateRight(bot.rotateSpeed * 1.5);
            }
            return;
        }

        if (avoidanceVector.length() > 0.1) {
            bot.debugInfo.isAvoidingObstacle = true;
            bot.debugInfo.currentAction = "Steering...";
            
            const directionToTarget = new THREE.Vector3().subVectors(targetPosition, tank.position).normalize();
            const steeredDirection = new THREE.Vector3()
                .addVectors(directionToTarget, avoidanceVector.normalize())
                .normalize();

            const avoidanceTarget = tank.position.clone().add(steeredDirection.multiplyScalar(20));
            this.moveTowardTarget(tank, avoidanceTarget, speedMultiplier * 0.8);
        } else {
            bot.debugInfo.isAvoidingObstacle = false;
            bot.debugInfo.currentAction = "Moving to target";
            this.moveTowardTarget(tank, targetPosition, speedMultiplier);
        }
    }

    /**
     * Calculate obstacle avoidance vector.
     * @param {Tank} tank - Tank to calculate avoidance for
     * @returns {object} { avoidanceVector, nearestObstacleDistance }
     */
    calculateObstacleAvoidance(tank) {
        const bot = tank.bot;
        const game = Game.instance;
        const avoidanceVector = new THREE.Vector3();
        
        if (!game) return { avoidanceVector, nearestObstacleDistance: Infinity };
        
        let nearestObstacleDistance = Infinity;
        
        const obstacles = [
            ...(game.rocks || []),
            ...(game.trees || []),
            ...(game.barrels?.filter(b => !b.hasExploded) || []),
            game.playerTank, 
            ...(game.enemies?.filter(t => t !== tank) || [])
        ].filter(obj => obj && !obj.disposed && obj.position);
        
        for (const obstacle of obstacles) {
            const distance = tank.position.distanceTo(obstacle.position);
            
            if (distance < nearestObstacleDistance) {
                nearestObstacleDistance = distance;
            }
            
            // Adjust min distance for different object types
            let minDistance = bot.minDistanceToObstacles;
            if (obstacle instanceof Tank) {
                minDistance = bot.minDistanceToTanks;
            }
            
            if (distance < minDistance) {
                const avoidDirection = new THREE.Vector3()
                    .subVectors(tank.position, obstacle.position)
                    .normalize();
                
                const avoidanceStrength = (minDistance - distance) / minDistance;
                avoidDirection.multiplyScalar(avoidanceStrength);
                
                avoidanceVector.add(avoidDirection);
            }
        }
        
        bot.debugInfo.nearestObstacleDistance = nearestObstacleDistance;
        
        return { avoidanceVector, nearestObstacleDistance };
    }

    /**
     * Move tank toward target using Tank's built-in movement functions
     * @param {Tank} tank - Tank to move
     * @param {THREE.Vector3} targetPosition - Target to move toward
     * @param {number} speedMultiplier - Speed multiplier
     */
    moveTowardTarget(tank, targetPosition, speedMultiplier = 1) {
        // Face target first
        this.faceTarget(tank, targetPosition);
        
        // Check if tank is facing the target
        const direction = new THREE.Vector3()
            .subVectors(targetPosition, tank.position)
            .normalize();
        
        const forward = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(tank.model.quaternion)
            .normalize();
        
        const dot = forward.dot(direction);
        
        // Move based on facing direction
        if (dot > 0.3) {
            // Facing towards target - move forward
            tank.moveForward(tank.bot.moveSpeed * speedMultiplier);
        } else if (dot < -0.3) {
            // Facing away from target - move backward  
            tank.moveBackward(tank.bot.moveSpeed * speedMultiplier);
        }
        // If not aligned enough, just rotate until aligned
    }

    /**
     * Face tank toward target position
     * @param {Tank} tank - Tank to rotate
     * @param {THREE.Vector3} targetPosition - Position to face
     * @param {boolean} preciseMode - Whether to use precise mode
     */
    faceTarget(tank, targetPosition, preciseMode = false) {
        const direction = new THREE.Vector3()
            .subVectors(targetPosition, tank.position)
            .normalize();
        
        const targetAngle = Math.atan2(direction.x, direction.z);
        const currentAngle = tank.model.rotation.y;
        
        // Calculate shortest rotation direction
        let angleDifference = targetAngle - currentAngle;
        
        // Normalize angle difference to [-π, π]
        while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
        while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
        
        // Use different tolerances based on mode
        const rotationTolerance = preciseMode ? 0.05 : 0.15;
        const rotationSpeed = preciseMode ? tank.bot.rotateSpeed : tank.bot.rotateSpeed * 1.5;
        
        if (Math.abs(angleDifference) > rotationTolerance) {
            if (angleDifference > 0) {
                tank.rotateLeft(Math.min(Math.abs(angleDifference), rotationSpeed));
            } else {
                tank.rotateRight(Math.min(Math.abs(angleDifference), rotationSpeed));
            }
        }
    }

    /**
     * Clear all tanks and cleanup
     */
    clear() {
        this.tanks.forEach(tank => {
            if (tank) {
                tank.stopAutoShoot();
            }
        });
        this.tanks = [];
    }

    /**
     * Dispose bot and cleanup resources
     */
    dispose() {
        this.clear();
        Bot.instance = null;
    }
}

export { Bot }; 
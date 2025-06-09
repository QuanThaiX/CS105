// ./class/GameStateManager.js
import * as THREE from 'three';
import { FACTION } from '../utils.js';

/**
 * GameStateManager provides API access to game state information
 * Used by Bot AI to get information about all game objects
 * Positions, health, bullets, obstacles etc.
 */
class GameStateManager {
    static instance;

    constructor(game) {
        if (GameStateManager.instance) {
            return GameStateManager.instance;
        }
        GameStateManager.instance = this;
        this.game = game;
    }
    
    /**
     * Creates a serializable, lightweight version of the game state for Web Workers.
     * @returns {object} A plain object with game state data.
     */
    getSerializableState() {
        const serializeObject = (obj) => {
            if (!obj || obj.disposed || !obj.position) return null;
            return {
                id: obj.id,
                faction: obj.faction,
                hp: obj.hp,
                position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                // Tank-specific data
                rotation: obj.model ? { y: obj.model.rotation.y } : { y: 0 },
            };
        };

        const playerTank = this.getPlayerTank();
        
        return {
            playerTank: playerTank ? serializeObject(playerTank) : null,
            tanks: this.getEnemyTanks().map(serializeObject).filter(Boolean),
            obstacles: this.getAllObstacles().map(serializeObject).filter(Boolean),
            // We can add projectiles or other data here if needed by the worker
        };
    }

    /**
     * Get all tank objects in game
     * @returns {Array} Array of Tank objects
     */
    getAllTanks() {
        const tanks = [];
        
        // Add player tank
        if (this.game.playerTank && !this.game.playerTank.disposed) {
            tanks.push(this.game.playerTank);
        }
        
        // Add enemy tanks
        if (this.game.enemies) {
            this.game.enemies.forEach(tank => {
                if (tank && !tank.disposed) {
                    tanks.push(tank);
                }
            });
        }
        
        return tanks;
    }

    /**
     * Get all enemy tanks
     * @returns {Array} Array of enemy Tank objects
     */
    getEnemyTanks() {
        return this.getAllTanks().filter(tank => tank.faction === FACTION.ENEMY);
    }

    /**
     * Get player tank
     * @returns {Tank|null} Player tank object or null
     */
    getPlayerTank() {
        return this.game.playerTank && !this.game.playerTank.disposed ? this.game.playerTank : null;
    }

    /**
     * Get all active projectiles/bullets
     * @returns {Array} Array of Bullet objects
     */
    getAllProjectiles() {
        if (this.game.projectilesManager) {
            return this.game.projectilesManager.getProjectiles() || [];
        }
        return [];
    }

    /**
     * Get projectiles by faction
     * @param {string} faction - Faction to filter by
     * @returns {Array} Array of Bullet objects from specified faction
     */
    getProjectilesByFaction(faction) {
        return this.getAllProjectiles().filter(bullet => bullet.faction === faction);
    }

    /**
     * Get all static obstacles (rocks, trees, barrels)
     * @returns {Array} Array of obstacle objects
     */
    getAllObstacles() {
        const obstacles = [];
        
        // Add rocks
        if (this.game.rocks) {
            this.game.rocks.forEach(rock => {
                if (rock && !rock.disposed) obstacles.push(rock);
            });
        }
        
        // Add trees
        if (this.game.trees) {
            this.game.trees.forEach(tree => {
                if (tree && !tree.disposed) obstacles.push(tree);
            });
        }
        
        // Add barrels
        if (this.game.barrels) {
            this.game.barrels.forEach(barrel => {
                if (barrel && !barrel.disposed) obstacles.push(barrel);
            });
        }
        
        return obstacles;
    }

    /**
     * Get all objects with collision detection
     * @returns {Array} Array of all collidable objects
     */
    getAllCollidableObjects() {
        return [
            ...this.getAllTanks(),
            ...this.getAllObstacles(),
            ...this.getAllProjectiles()
        ];
    }

    /**
     * Get distance between two positions
     * @param {THREE.Vector3} pos1 - First position
     * @param {THREE.Vector3} pos2 - Second position
     * @returns {number} Distance between positions
     */
    getDistance(pos1, pos2) {
        return pos1.distanceTo(pos2);
    }

    /**
     * Get direction vector from pos1 to pos2
     * @param {THREE.Vector3} pos1 - Starting position
     * @param {THREE.Vector3} pos2 - Target position
     * @returns {THREE.Vector3} Normalized direction vector
     */
    getDirection(pos1, pos2) {
        return new THREE.Vector3().subVectors(pos2, pos1).normalize();
    }

    /**
     * Check if there's line of sight between two positions
     * @param {THREE.Vector3} startPos - Starting position
     * @param {THREE.Vector3} endPos - Target position
     * @param {Array} ignoreObjects - Objects to ignore in raycast
     * @returns {boolean} True if line of sight is clear
     */
    hasLineOfSight(startPos, endPos, ignoreObjects = []) {
        const direction = this.getDirection(startPos, endPos);
        const distance = this.getDistance(startPos, endPos);
        
        const raycaster = new THREE.Raycaster(startPos, direction);
        const obstacles = this.getAllObstacles().filter(obj => !ignoreObjects.includes(obj));
        
        // Get intersections with obstacles
        const intersections = [];
        obstacles.forEach(obstacle => {
            if (obstacle.model) {
                const intersection = raycaster.intersectObject(obstacle.model, true);
                if (intersection.length > 0) {
                    intersections.push(...intersection);
                }
            }
        });
        
        // Check if any intersection is closer than target
        return !intersections.some(intersection => intersection.distance < distance);
    }

    /**
     * Find nearest object to position from array
     * @param {THREE.Vector3} position - Reference position
     * @param {Array} objects - Array of objects to search
     * @returns {Object|null} Nearest object with distance property
     */
    findNearestObject(position, objects) {
        if (!objects || objects.length === 0) return null;
        
        let nearest = null;
        let minDistance = Infinity;
        
        objects.forEach(obj => {
            if (obj && obj.position) {
                const distance = this.getDistance(position, obj.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = obj;
                }
            }
        });
        
        return nearest ? { object: nearest, distance: minDistance } : null;
    }

    /**
     * Find objects within radius of position
     * @param {THREE.Vector3} position - Center position
     * @param {number} radius - Search radius
     * @param {Array} objects - Array of objects to search
     * @returns {Array} Objects within radius with distance
     */
    findObjectsInRadius(position, radius, objects) {
        if (!objects || objects.length === 0) return [];
        
        const result = [];
        objects.forEach(obj => {
            if (obj && obj.position) {
                const distance = this.getDistance(position, obj.position);
                if (distance <= radius) {
                    result.push({ object: obj, distance });
                }
            }
        });
        
        return result.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Get game boundaries
     * @returns {Object} Game world boundaries
     */
    getWorldBoundaries() {
        const boundary = this.game.gameConfig?.WORLD_BOUNDARY || 500;
        return {
            minX: -boundary / 2,
            maxX: boundary / 2,
            minZ: -boundary / 2,
            maxZ: boundary / 2,
            size: boundary
        };
    }

    /**
     * Check if position is within world boundaries
     * @param {THREE.Vector3} position - Position to check
     * @returns {boolean} True if position is within boundaries
     */
    isPositionInBounds(position) {
        const bounds = this.getWorldBoundaries();
        return position.x >= bounds.minX && position.x <= bounds.maxX &&
               position.z >= bounds.minZ && position.z <= bounds.maxZ;
    }

    /**
     * Get safe movement positions around a position
     * @param {THREE.Vector3} position - Center position
     * @param {number} radius - Search radius
     * @param {number} samples - Number of sample points
     * @returns {Array} Array of safe positions
     */
    getSafePositions(position, radius = 10, samples = 8) {
        const safePositions = [];
        const angleStep = (Math.PI * 2) / samples;
        
        for (let i = 0; i < samples; i++) {
            const angle = i * angleStep;
            const testPos = new THREE.Vector3(
                position.x + Math.cos(angle) * radius,
                position.y,
                position.z + Math.sin(angle) * radius
            );
            
            // Check if position is in bounds and not colliding
            if (this.isPositionInBounds(testPos)) {
                const obstacles = this.findObjectsInRadius(testPos, 5, this.getAllObstacles());
                if (obstacles.length === 0) {
                    safePositions.push(testPos);
                }
            }
        }
        
        return safePositions;
    }

    /**
     * Get predicted position of moving object
     * @param {Object} object - Object with position and velocity
     * @param {number} timeAhead - Time to predict ahead (seconds)
     * @returns {THREE.Vector3} Predicted position
     */
    getPredictedPosition(object, timeAhead) {
        if (!object.position) return null;
        
        const predicted = object.position.clone();
        
        // If object has velocity or is moving, predict future position
        if (object.velocity) {
            predicted.add(object.velocity.clone().multiplyScalar(timeAhead));
        } else if (object.isMoving && object.moveSpeed) {
            // Estimate based on current rotation and movement
            const forward = new THREE.Vector3(0, 0, 1);
            if (object.model) {
                forward.applyQuaternion(object.model.quaternion);
            }
            predicted.add(forward.multiplyScalar(object.moveSpeed * timeAhead * 60)); // 60 FPS assumption
        }
        
        return predicted;
    }

    /**
     * Get tactical information for a position
     * @param {THREE.Vector3} position - Position to analyze
     * @returns {Object} Tactical information object
     */
    getTacticalInfo(position) {
        const nearbyEnemies = this.findObjectsInRadius(position, 50, this.getEnemyTanks());
        const nearbyAllies = this.findObjectsInRadius(position, 30, [this.getPlayerTank()].filter(Boolean));
        const nearbyObstacles = this.findObjectsInRadius(position, 20, this.getAllObstacles());
        const nearbyBullets = this.findObjectsInRadius(position, 15, this.getAllProjectiles());
        
        return {
            position,
            nearbyEnemies,
            nearbyAllies,
            nearbyObstacles,
            nearbyBullets,
            threatLevel: this.calculateThreatLevel(nearbyEnemies, nearbyBullets),
            coverAvailable: nearbyObstacles.length > 0,
            safePositions: this.getSafePositions(position)
        };
    }

    /**
     * Calculate threat level for a position
     * @param {Array} nearbyEnemies - Nearby enemy tanks
     * @param {Array} nearbyBullets - Nearby bullets
     * @returns {number} Threat level (0-10)
     */
    calculateThreatLevel(nearbyEnemies, nearbyBullets) {
        let threat = 0;
        
        // Add threat from nearby enemies
        nearbyEnemies.forEach(enemy => {
            const distance = enemy.distance;
            const enemyThreat = Math.max(0, 10 - (distance / 5)); // Closer = more dangerous
            threat += enemyThreat;
        });
        
        // Add threat from nearby bullets
        nearbyBullets.forEach(bullet => {
            const distance = bullet.distance;
            const bulletThreat = Math.max(0, 5 - (distance / 3));
            threat += bulletThreat;
        });
        
        return Math.min(10, threat); // Cap at 10
    }

    /**
     * Dispose manager
     */
    dispose() {
        this.game = null;
        GameStateManager.instance = null;
    }
}

export { GameStateManager };
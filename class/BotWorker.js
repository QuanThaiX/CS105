// ./class/BotWorker.js

class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    copy({ x, y, z }) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vec3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    normalize() { const len = this.length(); return len > 0 ? this.multiplyScalar(1 / len) : this; }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    distanceTo(v) { const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
    applyQuaternion({ x, y, z, w }) { const ix = w * this.x + y * this.z - z * this.y, iy = w * this.y + z * this.x - x * this.z, iz = w * this.z + x * this.y - y * this.x, iw = -x * this.x - y * this.y - z * this.z; this.x = ix * w + iw * -x + iy * -z - iz * -y; this.y = iy * w + iw * -y + iz * -x - ix * -z; this.z = iz * w + iw * -z + ix * -y - iy * -x; return this; }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    crossVectors(a, b) { const ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z; this.x = ay * bz - az * by; this.y = az * bx - ax * bz; this.z = ax * by - ay * bx; return this; }
    addVectors( a, b ) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
}

class Box3 {
    constructor(min = new Vec3(Infinity, Infinity, Infinity), max = new Vec3(-Infinity, -Infinity, -Infinity)) { this.min = min; this.max = max; }
    setFromCenterAndSize(center, size) { const halfSize = new Vec3(size.x / 2, size.y / 2, size.z / 2); this.min.copy(center).add(halfSize.multiplyScalar(-1)); this.max.copy(center).add(halfSize); return this; }
    getCenter(target) { return target.addVectors(this.min, this.max).multiplyScalar(0.5); }
    intersectsBox(box) { return !(box.max.x < this.min.x || box.min.x > this.max.x || box.max.y < this.min.y || box.min.y > this.max.y || box.max.z < this.min.z || box.min.z > this.max.z); }
}

class Octree {
    constructor(bounds, maxObjects = 8, maxLevels = 8, level = 0) { this.bounds = bounds; this.maxObjects = maxObjects; this.maxLevels = maxLevels; this.level = level; this.objects = []; this.nodes = []; }
    subdivide() {
        const { min, max } = this.bounds;
        const halfSize = new Vec3().subVectors(max, min).multiplyScalar(0.5);
        const center = new Vec3().addVectors(min, halfSize);
        const childrenBounds = [
            new Box3(new Vec3(center.x, min.y, center.z), new Vec3(max.x, center.y, max.z)), new Box3(new Vec3(min.x, min.y, center.z), new Vec3(center.x, center.y, max.z)), new Box3(new Vec3(min.x, min.y, min.z), new Vec3(center.x, center.y, center.z)), new Box3(new Vec3(center.x, min.y, min.z), new Vec3(max.x, center.y, center.z)),
            new Box3(new Vec3(center.x, center.y, center.z), new Vec3(max.x, max.y, max.z)), new Box3(new Vec3(min.x, center.y, center.z), new Vec3(center.x, max.y, max.z)), new Box3(new Vec3(min.x, center.y, min.z), new Vec3(center.x, max.y, center.z)), new Box3(new Vec3(center.x, center.y, min.z), new Vec3(max.x, max.y, max.z)),
        ];
        for (let i = 0; i < 8; i++) { this.nodes[i] = new Octree(childrenBounds[i], this.maxObjects, this.maxLevels, this.level + 1); }
    }
    getIndex(bbox) {
        let index = -1;
        const center = this.bounds.getCenter(new Vec3());
        const fitsInTop = bbox.min.y >= center.y; const fitsInBottom = bbox.max.y <= center.y; const fitsInFront = bbox.min.z >= center.z; const fitsInBack = bbox.max.z <= center.z; const fitsInRight = bbox.min.x >= center.x; const fitsInLeft = bbox.max.x <= center.x;
        if (fitsInBottom) { if (fitsInFront) { if (fitsInRight) index = 0; else if (fitsInLeft) index = 1; } else if (fitsInBack) { if (fitsInLeft) index = 2; else if (fitsInRight) index = 3; } } else if (fitsInTop) { if (fitsInFront) { if (fitsInRight) index = 4; else if (fitsInLeft) index = 5; } else if (fitsInBack) { if (fitsInLeft) index = 6; else if (fitsInRight) index = 7; } }
        return index;
    }
    insert(obj, bbox) {
        if (this.nodes.length > 0) { const index = this.getIndex(bbox); if (index !== -1) { this.nodes[index].insert(obj, bbox); return; } }
        this.objects.push(obj);
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (this.nodes.length === 0) { this.subdivide(); }
            let i = 0;
            while (i < this.objects.length) {
                const currentObj = this.objects[i];
                const currentBBox = new Box3(new Vec3(currentObj.position.x - 2, currentObj.position.y - 2, currentObj.position.z - 2), new Vec3(currentObj.position.x + 2, currentObj.position.y + 2, currentObj.position.z + 2)); // Simplified BBox for worker
                const index = this.getIndex(currentBBox);
                if (index !== -1) { this.nodes[index].insert(currentObj, currentBBox); this.objects.splice(i, 1); } else { i++; }
            }
        }
    }
    retrieve(obj, bbox) {
        let returnObjects = [...this.objects];
        const index = this.getIndex(bbox);
        if (index !== -1 && this.nodes.length > 0) { returnObjects.push(...this.nodes[index].retrieve(obj, bbox)); } else if (index === -1 && this.nodes.length > 0) { for (let i = 0; i < this.nodes.length; i++) { returnObjects.push(...this.nodes[i].retrieve(obj, bbox)); } }
        return returnObjects;
    }
    clear() { this.objects = []; for (let i = 0; i < this.nodes.length; i++) { this.nodes[i].clear(); } this.nodes = []; }
}
// --- End of Self-Contained Classes ---


const BotState = Object.freeze({
    PATROL: 'patrol',
    HUNT: 'hunt',
    ATTACK: 'attack'
});

let bots = new Map();
let gameState = {};
let config = {};
let worldOctree; // The new Octree for the BotWorker

// Main entry point for the worker
self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            config = payload.config;
            const halfBoundary = (config.WORLD_BOUNDARY || 500);
            const worldBounds = new Box3(new Vec3(-halfBoundary, -50, -halfBoundary), new Vec3(halfBoundary, 50, halfBoundary));
            worldOctree = new Octree(worldBounds, 8, 4);
            break;
        case 'add':
            bots.set(payload.id, payload.botConfig);
            break;
        case 'remove':
            bots.delete(payload.id);
            break;
        case 'update':
            gameState = payload;
            rebuildWorldOctree();
            const commands = updateAllBots();
            self.postMessage({ type: 'commands', payload: commands });
            break;
        case 'clear':
            bots.clear();
            if (worldOctree) worldOctree.clear();
            break;
    }
};

function rebuildWorldOctree() {
    if (!worldOctree || !gameState) return;
    worldOctree.clear();

    const allObjects = [
        ...(gameState.tanks || []),
        ...(gameState.obstacles || []),
        ...(gameState.barrels || [])
    ];

    for (const obj of allObjects) {
        // Create a minimal bounding box for insertion
        const size = (obj.type === 'Tank') ? 8 : 4;
        const center = new Vec3().copy(obj.position);
        const bbox = new Box3().setFromCenterAndSize(center, new Vec3(size, size, size));
        worldOctree.insert(obj, bbox);
    }
}

function updateAllBots() {
    const commands = [];
    if (!gameState.tanks) return commands;

    const botTanks = gameState.tanks.filter(t => bots.has(t.id));

    for (const tankState of botTanks) {
        const botConfig = bots.get(tankState.id);
        if (botConfig) {
            updateTankBehavior(tankState, botConfig, commands);
        }
    }
    return commands;
}

function updateTankBehavior(tankState, botConfig, commands) {
    const currentTime = Date.now();
    botConfig.stateTimer = currentTime - botConfig.stateStartTime;
    
    if (currentTime - botConfig.lastBehaviorUpdate >= botConfig.behaviorUpdateInterval) {
        botConfig.lastBehaviorUpdate = currentTime;
        evaluateStateTransition(tankState, botConfig, commands);
    }
    
    executeCurrentState(tankState, botConfig, commands);
    commands.push({ tankId: tankState.id, action: 'updateDebugInfo', value: botConfig.debugInfo });
}

function evaluateStateTransition(tankState, botConfig, commands) {
    if (botConfig.stateTimer < botConfig.minStateTime) return;
    
    if (!gameState.playerTank || gameState.playerTank.hp <= 0) {
        transitionTo(tankState, botConfig, BotState.PATROL, commands);
        return;
    }

    const tankPosition = new Vec3().copy(tankState.position);
    const playerPosition = new Vec3().copy(gameState.playerTank.position);
    const distanceToPlayer = tankPosition.distanceTo(playerPosition);
    botConfig.debugInfo.distanceToPlayer = distanceToPlayer;
    
    if (distanceToPlayer <= botConfig.attackRange) {
        if (botConfig.currentState !== BotState.ATTACK) transitionTo(tankState, botConfig, BotState.ATTACK, commands);
    } else if (distanceToPlayer <= botConfig.detectionRange) {
        if (botConfig.currentState !== BotState.HUNT) transitionTo(tankState, botConfig, BotState.HUNT, commands);
    } else {
        if (botConfig.currentState !== BotState.PATROL) transitionTo(tankState, botConfig, BotState.PATROL, commands);
    }
}

function transitionTo(tankState, botConfig, newState, commands) {
    if (newState === botConfig.currentState) return;
    
    botConfig.currentState = newState;
    botConfig.stateStartTime = Date.now();
    botConfig.stateTimer = 0;

    switch (newState) {
        case BotState.ATTACK:
            commands.push({ tankId: tankState.id, action: 'startAutoShoot', value: Math.max(5000, botConfig.shootCooldown * 1.5) });
            botConfig.debugInfo.isShooting = true;
            break;
        case BotState.HUNT:
        case BotState.PATROL:
            commands.push({ tankId: tankState.id, action: 'stopAutoShoot' });
            botConfig.debugInfo.isShooting = false;
            break;
    }
}

function executeCurrentState(tankState, botConfig, commands) {
    switch (botConfig.currentState) {
        case BotState.PATROL: executePatrolState(tankState, botConfig, commands); break;
        case BotState.HUNT: executeHuntState(tankState, botConfig, commands); break;
        case BotState.ATTACK: executeAttackState(tankState, botConfig, commands); break;
    }
}

function executePatrolState(tankState, botConfig, commands) {
    const currentTime = Date.now();
    if (!botConfig.patrolTarget || currentTime - botConfig.lastPatrolGeneration > botConfig.patrolInterval) {
        generatePatrolTarget(tankState, botConfig);
        botConfig.lastPatrolGeneration = currentTime;
    }
    if (botConfig.patrolTarget) {
        const tankPosition = new Vec3().copy(tankState.position);
        const targetPosition = new Vec3().copy(botConfig.patrolTarget);
        if (tankPosition.distanceTo(targetPosition) < 10) {
            generatePatrolTarget(tankState, botConfig);
            return;
        }
        moveWithObstacleAvoidance(tankState, botConfig, targetPosition, commands, 0.5);
    }
    botConfig.debugInfo.currentAction = 'Patrolling';
}

function executeHuntState(tankState, botConfig, commands) {
    if (!gameState.playerTank) return;
    const targetPosition = new Vec3().copy(gameState.playerTank.position);
    moveWithObstacleAvoidance(tankState, botConfig, targetPosition, commands, 0.8);
    botConfig.debugInfo.currentAction = 'Hunting player';
}

function executeAttackState(tankState, botConfig, commands) {
    if (!gameState.playerTank) return;
    
    const tankPosition = new Vec3().copy(tankState.position);
    const playerPosition = new Vec3().copy(gameState.playerTank.position);

    const tacticalTarget = findTacticalTarget(tankPosition, playerPosition, botConfig);
    const finalTargetPosition = tacticalTarget ? new Vec3().copy(tacticalTarget.position) : playerPosition;

    if (tacticalTarget) {
        botConfig.debugInfo.currentAction = `Attacking tactical target! (Barrel)`;
    }
    
    faceTarget(tankState, botConfig, finalTargetPosition, commands, true);
    
    const distanceToTarget = tankPosition.distanceTo(finalTargetPosition);
    if (distanceToTarget > botConfig.optimalAttackRange * 1.3) {
        moveWithObstacleAvoidance(tankState, botConfig, finalTargetPosition, commands, 0.6);
        if (!tacticalTarget) botConfig.debugInfo.currentAction = 'Attacking - moving closer';
    } else if (distanceToTarget < botConfig.optimalAttackRange * 0.7) {
        moveWithObstacleAvoidance(tankState, botConfig, finalTargetPosition, commands, 0.4, true);
        if (!tacticalTarget) botConfig.debugInfo.currentAction = 'Attacking - backing away';
    } else {
        if (!tacticalTarget) botConfig.debugInfo.currentAction = 'Attacking - in optimal range';
    }
}

function findTacticalTarget(tankPos, playerPos, botConfig) {
    if (!gameState.barrels || gameState.barrels.length === 0) return null;
    for (const barrel of gameState.barrels) {
        const barrelPos = new Vec3().copy(barrel.position);
        if (tankPos.distanceTo(barrelPos) > botConfig.attackRange) continue;
        if (playerPos.distanceTo(barrelPos) < 15) {
            return barrel;
        }
    }
    return null;
}

function generatePatrolTarget(tankState, botConfig) {
    const angle = Math.random() * Math.PI * 2;
    const distance = botConfig.patrolRadius * (0.5 + Math.random() * 0.5);
    const x = tankState.position.x + Math.cos(angle) * distance;
    const z = tankState.position.z + Math.sin(angle) * distance;
    const halfBoundary = (config?.WORLD_BOUNDARY || 500) / 2;
    const clampedX = Math.max(-halfBoundary + 50, Math.min(halfBoundary - 50, x));
    const clampedZ = Math.max(-halfBoundary + 50, Math.min(halfBoundary - 50, z));
    botConfig.patrolTarget = { x: clampedX, y: 1, z: clampedZ };
}

function moveWithObstacleAvoidance(tankState, botConfig, targetPosition, commands, speedMultiplier = 1, isBackingAway = false) {
    const { avoidanceVector, nearestObstacleDistance } = calculateObstacleAvoidance(tankState, botConfig);
    const tankPosition = new Vec3().copy(tankState.position);

    const panicDistance = 4.0;
    if (nearestObstacleDistance < panicDistance) {
        botConfig.debugInfo.isAvoidingObstacle = true;
        botConfig.debugInfo.currentAction = "Evasive Maneuver!";
        commands.push({ tankId: tankState.id, action: 'moveBackward', value: botConfig.moveSpeed * 2 });
        const directionToAvoidance = new Vec3().subVectors(avoidanceVector, tankPosition).normalize();
        const forward = new Vec3(0, 0, 1).applyQuaternion(tankState.quaternion);
        const cross = new Vec3().crossVectors(forward, directionToAvoidance);
        commands.push({ tankId: tankState.id, action: cross.y > 0 ? 'rotateLeft' : 'rotateRight', value: botConfig.rotateSpeed * 1.5 });
        return;
    }

    if (avoidanceVector.lengthSq() > 0.01) {
        botConfig.debugInfo.isAvoidingObstacle = true;
        botConfig.debugInfo.currentAction = "Steering...";
        const directionToTarget = new Vec3().subVectors(targetPosition, tankPosition).normalize();
        const steeredDirection = new Vec3().addVectors(directionToTarget, avoidanceVector.normalize()).normalize();
        const avoidanceTarget = tankPosition.clone().add(steeredDirection.multiplyScalar(20));
        moveTowardTarget(tankState, botConfig, avoidanceTarget, commands, speedMultiplier * 0.8, isBackingAway);
    } else {
        botConfig.debugInfo.isAvoidingObstacle = false;
        botConfig.debugInfo.currentAction = isBackingAway ? "Backing away" : "Moving to target";
        moveTowardTarget(tankState, botConfig, targetPosition, commands, speedMultiplier, isBackingAway);
    }
}

function calculateObstacleAvoidance(tankState, botConfig) {
    const avoidanceVector = new Vec3();
    const tankPosition = new Vec3().copy(tankState.position);
    if (!worldOctree) return { avoidanceVector, nearestObstacleDistance: Infinity };
    
    let nearestObstacleDistance = Infinity;
    
    const searchRadius = botConfig.minDistanceToObstacles + 5;
    const searchBox = new Box3().setFromCenterAndSize(tankPosition, new Vec3(searchRadius * 2, 20, searchRadius * 2));
    const potentialObstacles = worldOctree.retrieve(tankState, searchBox);

    for (const obstacleState of potentialObstacles) {
        if (obstacleState.id === tankState.id) continue;

        const obstaclePosition = new Vec3().copy(obstacleState.position);
        const distance = tankPosition.distanceTo(obstaclePosition);
        if (distance < nearestObstacleDistance) nearestObstacleDistance = distance;
        
        let minDistance = botConfig.minDistanceToObstacles;
        if (obstacleState.type === 'Tank' || (gameState.playerTank && obstacleState.id === gameState.playerTank.id)) {
            minDistance = botConfig.minDistanceToTanks;
        }
        
        if (distance < minDistance) {
            const avoidDirection = new Vec3().subVectors(tankPosition, obstaclePosition).normalize();
            const avoidanceStrength = (minDistance - distance) / minDistance;
            avoidanceVector.add(avoidDirection.multiplyScalar(avoidanceStrength * 2.0));
        }
    }
    botConfig.debugInfo.nearestObstacleDistance = nearestObstacleDistance;
    return { avoidanceVector, nearestObstacleDistance };
}

function moveTowardTarget(tankState, botConfig, targetPosition, commands, speedMultiplier = 1, isBackingAway = false) {
    faceTarget(tankState, botConfig, targetPosition, commands);
    const tankPosition = new Vec3().copy(tankState.position);
    const direction = new Vec3().subVectors(targetPosition, tankPosition).normalize();
    const forward = new Vec3(0, 0, 1).applyQuaternion(tankState.quaternion).normalize();
    const dot = forward.dot(direction);
    
    if (isBackingAway) {
        commands.push({ tankId: tankState.id, action: 'moveBackward', value: botConfig.moveSpeed * speedMultiplier });
    } else {
        if (dot > 0.3) commands.push({ tankId: tankState.id, action: 'moveForward', value: botConfig.moveSpeed * speedMultiplier });
        else if (dot < -0.3) commands.push({ tankId: tankState.id, action: 'moveBackward', value: botConfig.moveSpeed * speedMultiplier });
    }
}

function faceTarget(tankState, botConfig, targetPosition, commands, preciseMode = false) {
    const tankPosition = new Vec3().copy(tankState.position);
    const direction = new Vec3().subVectors(targetPosition, tankPosition).normalize();
    const targetAngle = Math.atan2(direction.x, direction.z);
    let angleDifference = targetAngle - tankState.rotationY;
    
    while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
    while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
    
    const rotationTolerance = preciseMode ? 0.05 : 0.15;
    const rotationSpeed = preciseMode ? botConfig.rotateSpeed : botConfig.rotateSpeed * 1.5;
    
    if (Math.abs(angleDifference) > rotationTolerance) {
        const rotationAmount = Math.min(Math.abs(angleDifference), rotationSpeed);
        commands.push({ tankId: tankState.id, action: angleDifference > 0 ? 'rotateLeft' : 'rotateRight', value: rotationAmount });
    }
}
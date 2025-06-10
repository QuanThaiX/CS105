// ./class/MinimapWorker.js

// A simple Vec2 for 2D calculations
class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}

// Worker state
let canvasWidth = 200;
let mapSize = 500;

// Main message handler
self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            // Initialize worker with canvas and world dimensions
            canvasWidth = payload.canvasWidth;
            mapSize = payload.mapSize;
            break;
        case 'update':
            // Process the game state and send back drawing commands
            if (payload) {
                const drawCommands = processGameState(payload);
                self.postMessage({ type: 'draw', payload: drawCommands });
            }
            break;
    }
};

/**
 * Transforms a world point (x, z) into a final canvas coordinate,
 * by replicating the main thread's canvas transforms mathematically.
 * @param {number} worldX - The world X coordinate of the object.
 * @param {number} worldZ - The world Z coordinate of the object.
 * @param {object} player - The player state { position: {x, z}, rotationY }.
 * @returns {Vec2} The final 2D coordinate for drawing on the canvas.
 */
function transformWorldPointToMap(worldX, worldZ, player) {
    const scaleFactor = canvasWidth / mapSize;
    const mapCenterX = canvasWidth / 2;
    const mapCenterY = canvasWidth / 2;

    // 1. Get object position relative to player in world scale
    const relativeX = worldX - player.position.x;
    const relativeZ = worldZ - player.position.z;

    // 2. Convert to map scale
    const mapRelativeX = relativeX * scaleFactor;
    const mapRelativeZ = relativeZ * scaleFactor;

    // 3. Apply the equivalent of `ctx.scale(-1, -1)`
    const scaledX = -mapRelativeX;
    const scaledZ = -mapRelativeZ;

    // 4. Apply the equivalent of `ctx.rotate(player.rotationY)`
    const playerRotation = player.rotationY;
    const cosR = Math.cos(playerRotation);
    const sinR = Math.sin(playerRotation);
    const rotatedX = scaledX * cosR - scaledZ * sinR;
    const rotatedZ = scaledX * sinR + scaledZ * cosR;

    // 5. Apply the equivalent of `ctx.translate(mapCenterX, mapCenterY)`
    const finalX = rotatedX + mapCenterX;
    const finalY = rotatedZ + mapCenterY;

    return new Vec2(finalX, finalY);
}


/**
 * Processes the full game state to generate an array of drawing commands.
 * @param {object} gameState - The current state of the game.
 * @returns {Array<object>} An array of command objects for the main thread to draw.
 */
function processGameState(gameState) {
    const { player, enemies, barrels, powerups, staticObstacles } = gameState;
    if (!player) return [];

    const commands = [];

    // --- Process static obstacles ---
    staticObstacles.forEach(obs => {
        const pos = transformWorldPointToMap(obs.x, obs.z, player);
        const size = (obs.size / mapSize) * canvasWidth;
        commands.push({
            type: 'rect',
            x: pos.x - size / 2,
            y: pos.y - size / 2,
            width: size,
            height: size,
            entityType: 'obstacle'
        });
    });

    // --- Process dynamic entities ---
    enemies.forEach(e => {
        const pos = transformWorldPointToMap(e.position.x, e.position.z, player);
        // The rotation of the icon on the map is relative to the player's rotation
        const finalRotation = e.rotationY - player.rotationY;
        commands.push({
            type: 'triangle',
            x: pos.x,
            y: pos.y,
            rotation: finalRotation,
            entityType: 'enemy'
        });
    });

    barrels.forEach(b => {
        const pos = transformWorldPointToMap(b.position.x, b.position.z, player);
        commands.push({ type: 'dot', x: pos.x, y: pos.y, size: 2, entityType: 'barrel' });
    });

    powerups.forEach(p => {
        const pos = transformWorldPointToMap(p.position.x, p.position.z, player);
        commands.push({ type: 'dot', x: pos.x, y: pos.y, size: 4, entityType: 'powerup' });
    });

    return commands;
}
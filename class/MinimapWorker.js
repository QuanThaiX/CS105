


class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}


let canvasWidth = 200;
let mapSize = 500;


self.onmessage = function (e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':

            canvasWidth = payload.canvasWidth;
            mapSize = payload.mapSize;
            break;
        case 'update':

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

    const relativeX = worldX - player.position.x;
    const relativeZ = worldZ - player.position.z;

    const mapRelativeX = relativeX * scaleFactor;
    const mapRelativeZ = relativeZ * scaleFactor;

    const scaledX = -mapRelativeX;
    const scaledZ = -mapRelativeZ;

    const playerRotation = player.rotationY;
    const cosR = Math.cos(playerRotation);
    const sinR = Math.sin(playerRotation);
    const rotatedX = scaledX * cosR - scaledZ * sinR;
    const rotatedZ = scaledX * sinR + scaledZ * cosR;

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


    enemies.forEach(e => {
        const pos = transformWorldPointToMap(e.position.x, e.position.z, player);

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
// ./class/MinimapWorker.js

// --- Worker Globals ---
let ctx = null;
let config = {};
let colors = {};
let gameState = {
    player: null,
    enemies: [],
    barrels: [],
    powerUps: []
};
let isPaused = false;
let drawInterval = null;

// --- Drawing Functions (copied from original Minimap.js) ---

function worldToMapScale(val) {
    return val / config.mapSize * config.canvasSize;
}

function drawGrid() {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const step = worldToMapScale(50);
    const numLines = (config.mapSize / 50) * 2;
    const totalSize = numLines * step;
    ctx.beginPath();
    for (let i = -numLines / 2; i <= numLines / 2; i++) {
        ctx.moveTo(i * step, -totalSize / 2);
        ctx.lineTo(i * step, totalSize / 2);
        ctx.moveTo(-totalSize / 2, i * step);
        ctx.lineTo(totalSize / 2, i * step);
    }
    ctx.stroke();
}

function drawDot(worldX, worldZ, color, size = 3) {
    const mapX = worldToMapScale(worldX);
    const mapY = worldToMapScale(worldZ);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mapX, mapY, size, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlayerIcon(mapX, mapY, color, size) {
    ctx.save();
    ctx.translate(mapX, mapY);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.2);
    ctx.lineTo(size, size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawTriangle(worldX, worldZ, rotationY, color, size = 5) {
    const mapX = worldToMapScale(worldX);
    const mapY = worldToMapScale(worldZ);
    ctx.save();
    ctx.translate(mapX, mapY);
    ctx.rotate(rotationY);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawStaticObstacles() {
    if (!gameState.staticObstacles) return;
    ctx.fillStyle = colors.obstacle;
    gameState.staticObstacles.forEach(obs => {
        const mapX = worldToMapScale(obs.x);
        const mapY = worldToMapScale(obs.z);
        const mapSize = worldToMapScale(obs.size);
        ctx.fillRect(mapX - mapSize / 2, mapY - mapSize / 2, mapSize, mapSize);
    });
}


// --- Main Drawing Loop for the Worker ---

function draw() {
    if (isPaused || !ctx || !gameState.player) {
        return;
    }

    const canvasWidth = config.canvasSize;
    const canvasHeight = config.canvasSize;
    const mapCenterX = canvasWidth / 2;
    const mapCenterY = canvasHeight / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.beginPath();
    ctx.arc(mapCenterX, mapCenterY, mapCenterX, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    
    ctx.translate(mapCenterX, mapCenterY);
    ctx.scale(-1, -1);
    ctx.rotate(gameState.player.rotationY);
    
    ctx.translate(-worldToMapScale(gameState.player.position.x), -worldToMapScale(gameState.player.position.z));

    drawGrid();
    drawStaticObstacles();
    
    gameState.enemies.forEach(e => drawTriangle(e.position.x, e.position.z, e.rotationY, colors.enemy));
    gameState.barrels.forEach(b => drawDot(b.position.x, b.position.z, colors.barrel, 2));
    gameState.powerUps.forEach(p => drawDot(p.position.x, p.position.z, colors.powerup, 4));

    ctx.restore();

    ctx.fillStyle = colors.viewCone;
    ctx.beginPath();
    ctx.moveTo(mapCenterX, mapCenterY);
    ctx.arc(mapCenterX, mapCenterY, mapCenterX * 1.5, -config.viewConeAngle / 2 - Math.PI/2, config.viewConeAngle / 2 - Math.PI/2);
    ctx.closePath();
    ctx.fill();
    
    drawPlayerIcon(mapCenterX, mapCenterY, colors.player, 6);
    
    ctx.restore();

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(mapCenterX, mapCenterY, mapCenterX - 2, 0, Math.PI * 2);
    ctx.stroke();
}


// --- Worker Message Handler ---

self.onmessage = (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            // One-time setup
            config = payload.config;
            colors = payload.colors;
            const canvas = payload.canvas; // This is the OffscreenCanvas
            ctx = canvas.getContext('2d');
            config.canvasSize = canvas.width; // Store canvas size in config
            
            // Start the drawing loop inside the worker
            if (drawInterval) clearInterval(drawInterval);
            drawInterval = setInterval(draw, 33); // Draw at ~30 FPS
            break;

        case 'updateState':
            // Receive fresh game state from main thread
            gameState = payload;
            break;

        case 'setPaused':
            // Pause/resume the drawing loop
            isPaused = payload.isPaused;
            break;
    }
};
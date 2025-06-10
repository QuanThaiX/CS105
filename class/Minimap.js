// ./class/Minimap.js
import { Game } from './Game.js';
import { FACTION, toRad } from '../utils.js';
import { gameSettings } from '../config.js'; // <-- IMPORT gameSettings

class Minimap {
    constructor() {
        this.game = Game.instance;
        this.canvas = document.getElementById('minimap-canvas');
        if (!this.canvas) {
            console.error("Minimap canvas not found!");
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.mapSize = this.game.gameConfig.WORLD_BOUNDARY;
        this.viewConeAngle = toRad(75);

        this.colors = {
            background: 'rgba(20, 30, 45, 0.6)',
            grid: 'rgba(100, 150, 200, 0.1)',
            border: '#155e31',
            player: '#66ff66',
            viewCone: 'rgba(102, 255, 102, 0.2)',
            enemy: '#F44336',
            barrel: '#FF9800',
            powerup: '#2196F3',
            obstacle: 'rgba(150, 150, 150, 0.4)'
        };

        this.staticObstacles = [];
        this.staticGeometryProcessed = false;
    }

    processStaticGeometry() {
        if (this.staticGeometryProcessed) return;
        const gsm = this.game.getGameStateManager();
        if (!gsm) return;
        const obstacles = gsm.getAllObstacles();
        obstacles.forEach(obs => {
            if (obs.constructor.name === 'Rock' || obs.constructor.name === 'Tree') {
                this.staticObstacles.push({
                    x: obs.position.x,
                    z: obs.position.z,
                    size: (obs.scale || 1) * 1.5
                });
            }
        });
        this.staticGeometryProcessed = true;
        console.log(`Minimap: Processed ${this.staticObstacles.length} static obstacles.`);
    }

    worldToMapScale(val) {
        return val / this.mapSize * this.canvas.width;
    }

    update() {
        if (!this.ctx || !this.game.isRunning) return;
        
        if (!this.staticGeometryProcessed) this.processStaticGeometry();

        const player = this.game.playerTank;
        if (!player || !player.model) return;

        const gsm = this.game.getGameStateManager();
        if (!gsm) return;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const mapCenterX = canvasWidth / 2;
        const mapCenterY = canvasHeight / 2;

        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(mapCenterX, mapCenterY, mapCenterX, 0, Math.PI * 2);
        this.ctx.clip();
        
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        this.ctx.save();
        
        this.ctx.translate(mapCenterX, mapCenterY);
        this.ctx.scale(-1, -1);
        this.ctx.rotate(player.model.rotation.y);
        
        this.ctx.translate(-this.worldToMapScale(player.position.x), -this.worldToMapScale(player.position.z));

        this.drawGrid();

        this.ctx.fillStyle = this.colors.obstacle;
        this.staticObstacles.forEach(obs => {
            const mapX = this.worldToMapScale(obs.x);
            const mapY = this.worldToMapScale(obs.z);
            const mapSize = this.worldToMapScale(obs.size);
            this.ctx.fillRect(mapX - mapSize / 2, mapY - mapSize / 2, mapSize, mapSize);
        });
        
        gsm.getEnemyTanks().forEach(e => this.drawTriangle(e.position.x, e.position.z, e.model.rotation.y, this.colors.enemy));
        this.game.barrels.forEach(b => !b.hasExploded && this.drawDot(b.position.x, b.position.z, this.colors.barrel, 2));
        this.game.powerUpManager.powerUpPool.forEach(p => p.isActive && this.drawDot(p.position.x, p.position.z, this.colors.powerup, 4));

        // Restore from the world transformation (removes the scale, rotate, and translate)
        this.ctx.restore();

        // --- 4. Draw UI elements that are fixed relative to the player (on top) ---
        // These are drawn on the original, non-transformed canvas where Y+ is "down".
        this.ctx.fillStyle = this.colors.viewCone;
        this.ctx.beginPath();
        this.ctx.moveTo(mapCenterX, mapCenterY);
        this.ctx.arc(mapCenterX, mapCenterY, mapCenterX * 1.5, -this.viewConeAngle / 2 - Math.PI/2, this.viewConeAngle / 2 - Math.PI/2);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.drawPlayerIcon(mapCenterX, mapCenterY, this.colors.player, 6);
        
        // Restore from the circular clipping mask
        this.ctx.restore();

        // --- 5. Draw the border on top of everything ---
        this.ctx.strokeStyle = this.colors.border;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(mapCenterX, mapCenterY, mapCenterX - 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawGrid() {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;
        const step = this.worldToMapScale(50);
        const numLines = (this.mapSize / 50) * 2;
        const totalSize = numLines * step;
        this.ctx.beginPath();
        for (let i = -numLines/2; i <= numLines/2; i++) {
            this.ctx.moveTo(i * step, -totalSize/2);
            this.ctx.lineTo(i * step, totalSize/2);
            this.ctx.moveTo(-totalSize/2, i * step);
            this.ctx.lineTo(totalSize/2, i * step);
        }
        this.ctx.stroke();
    }

    drawDot(worldX, worldZ, color, size = 3) {
        const mapX = this.worldToMapScale(worldX);
        const mapY = this.worldToMapScale(worldZ); // No change needed here, the main transform handles it
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(mapX, mapY, size, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawPlayerIcon(mapX, mapY, color, size) {
        this.ctx.save();
        this.ctx.translate(mapX, mapY);
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size * 1.2); // Draw pointing "up" in the Y-down system
        this.ctx.lineTo(size, size);
        this.ctx.lineTo(-size, size);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    drawTriangle(worldX, worldZ, rotationY, color, size = 5) {
        const mapX = this.worldToMapScale(worldX);
        const mapY = this.worldToMapScale(worldZ); // No change needed here
        this.ctx.save();
        this.ctx.translate(mapX, mapY);
        this.ctx.rotate(rotationY);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(size, size);
        this.ctx.lineTo(-size, size);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    dispose() {
        this.ctx = null;
        this.canvas = null;
    }
}

export { Minimap };
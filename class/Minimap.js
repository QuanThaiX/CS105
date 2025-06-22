
import { Game } from './Game.js';
import { FACTION, toRad } from '../utils.js';
import { gameSettings } from '../config.js';

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

        this.worker = null;
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker('./class/MinimapWorker.js', { type: 'module' });
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = (e) => console.error("Minimap Worker Error:", e);

            
            this.worker.postMessage({
                type: 'init',
                payload: {
                    canvasWidth: this.canvas.width,
                    mapSize: this.mapSize,
                }
            });
            console.log("🗺️ Minimap Worker initialized.");
        } else {
            console.warn("Minimap: Web Workers not supported. Calculations will run on the main thread (not implemented).");
        }

        
        this.toggleVisibility(gameSettings.showMinimap);
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
        console.log(`Minimap: Processed ${this.staticObstacles.length} static obstacles for worker.`);
    }

    update() {
        if (!this.ctx || !this.game.isRunning || !this.worker) return;

        if (!this.staticGeometryProcessed) {
            this.processStaticGeometry();
        }

        const player = this.game.playerTank;
        if (!player || !player.model) return;

        const gsm = this.game.getGameStateManager();
        if (!gsm) return;

        const gameState = {
            player: {
                position: { x: player.position.x, z: player.position.z },
                rotationY: player.model.rotation.y,
            },
            enemies: gsm.getEnemyTanks().map(e => ({
                position: { x: e.position.x, z: e.position.z },
                rotationY: e.model.rotation.y
            })),
            barrels: this.game.barrels
                .filter(b => !b.hasExploded)
                .map(b => ({ position: { x: b.position.x, z: b.position.z } })),
            powerups: this.game.powerUpManager.powerUpPool
                .filter(p => p.isActive)
                .map(p => ({ position: { x: p.position.x, z: p.position.z } })),
            staticObstacles: this.staticObstacles,
        };

        this.worker.postMessage({ type: 'update', payload: gameState });
    }

    handleWorkerMessage(e) {
        const { type, payload } = e.data;
        if (type === 'draw') {
            this.drawMapFromCommands(payload); 
        }
    }

    drawMapFromCommands(commands) {
        if (!this.ctx) return;

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

        commands.forEach(cmd => {
            const color = this.colors[cmd.entityType];
            if (!color) return;

            switch (cmd.type) {
                case 'rect':
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
                    break;
                case 'dot':
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(cmd.x, cmd.y, cmd.size, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                case 'triangle':
                    this.drawTriangleOnCanvas(cmd.x, cmd.y, cmd.rotation, color, 5);
                    break;
            }
        });

        this.ctx.fillStyle = this.colors.viewCone;
        this.ctx.beginPath();
        this.ctx.moveTo(mapCenterX, mapCenterY);
        this.ctx.arc(mapCenterX, mapCenterY, mapCenterX * 1.5, -this.viewConeAngle / 2 - Math.PI / 2, this.viewConeAngle / 2 - Math.PI / 2);
        this.ctx.closePath();
        this.ctx.fill();

        this.drawPlayerIcon(mapCenterX, mapCenterY, this.colors.player, 6);

        this.ctx.restore();
        this.ctx.strokeStyle = this.colors.border;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(mapCenterX, mapCenterY, mapCenterX - 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawPlayerIcon(mapX, mapY, color, size) {
        this.ctx.save();
        this.ctx.translate(mapX, mapY);
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size * 1.2);
        this.ctx.lineTo(size, size);
        this.ctx.lineTo(-size, size);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawTriangleOnCanvas(canvasX, canvasY, rotation, color, size = 5) {
        this.ctx.save();
        this.ctx.translate(canvasX, canvasY);
        this.ctx.rotate(rotation);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(size, size);
        this.ctx.lineTo(-size, size);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    toggleVisibility(show) {
        if (this.canvas) {
            this.canvas.style.display = show ? 'block' : 'none';
        }
    }

    dispose() {
        if (this.worker) {
            this.worker.terminate();
        }
        this.worker = null;
        this.ctx = null;
        this.canvas = null;
    }
}

export { Minimap };
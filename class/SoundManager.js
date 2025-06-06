import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';
import { FACTION } from '../utils.js';
import { GAMECONFIG } from '../config.js';
import { Game } from './Game.js';

class SoundManager {
    static instance;
    sounds;
    moveTimeout;

    constructor() {
        if (SoundManager.instance) {
            return SoundManager.instance;
        }
        SoundManager.instance = this;
        this.sounds = {};
        this.initSounds();
        this.setupEventListeners();
    }

    initSounds() {
        this.sounds = {
            tankMoving: new Audio('./assets/sound/tank-moving.mp3'),
            tankShot: new Audio('./assets/sound/tank-shots.mp3'),
            barrelExplosion: new Audio('./assets/sound/barrel-explosion.mp3'),
            tankDestruction: new Audio('./assets/sound/tank-far-explosion.mp3')
        };

        // Configure sound properties
        this.sounds.tankMoving.loop = true;
        this.sounds.tankMoving.volume = 0.05;
        this.sounds.tankShot.volume = 1.0;
        this.sounds.barrelExplosion.volume = 1;
        this.sounds.tankDestruction.volume = 0.2;

        // Preload all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.preload = 'auto';
        });
    }

    setupEventListeners() {
        EventManager.instance.subscribe(EVENT.PLAYER_MOVE, (data) => {
            this.handleTankMoving(data);
        });

        EventManager.instance.subscribe(EVENT.OBJECT_SHOOT, (data) => {
            if (data.tank && data.tank.faction === FACTION.PLAYER) {
                this.handleTankShot();
            }
        });

        // Simplified event listeners for explosions
        EventManager.instance.subscribe(EVENT.BARREL_EXPLODED, (data) => {
            this.handleBarrelExplosion(data);
        });

        EventManager.instance.subscribe(EVENT.TANK_DESTROYED, (data) => {
            this.handleTankDestruction(data);
        });
    }

    /**
     * Handle barrel explosion audio with simple distance-based volume
     * @param {Object} data - Barrel explosion data
     */
    handleBarrelExplosion(data) {
        const { barrel, explosion } = data;
        
        if (barrel && explosion && this.sounds.barrelExplosion) {
            const audio = this.sounds.barrelExplosion.cloneNode();
            
            // Simple distance-based volume adjustment
            if (explosion.position) {
                const adjustedVolume = this.calculateDistanceVolume(explosion.position, 0.8, 100);
                audio.volume = adjustedVolume;
            } else {
                audio.volume = 0.8;
            }
            
            audio.play().catch(error => {
                console.error('Error playing barrel explosion sound:', error);
            });
        }
    }

    /**
     * Handle tank destruction audio with simple distance-based volume
     * @param {Object} data - Tank destruction data
     */
    handleTankDestruction(data) {
        const { tank, position } = data;
        
        if (tank && position && this.sounds.tankDestruction) {
            const audio = this.sounds.tankDestruction.cloneNode();
            
            // Simple distance-based volume adjustment
            if (position) {
                const adjustedVolume = this.calculateDistanceVolume(position, 0.1, 150);
                audio.volume = adjustedVolume;
            } else {
                audio.volume = 0.1;
            }
            console.log(audio.volume)
            audio.play().catch(error => {
                console.error('Error playing tank destruction sound:', error);
            });
        }
    }

    /**
     * Calculate volume based on distance from player (simplified)
     * @param {THREE.Vector3} soundPosition - Position of sound source
     * @param {number} baseVolume - Base volume level
     * @param {number} maxDistance - Maximum hearing distance
     * @returns {number} Adjusted volume level
     */
    calculateDistanceVolume(soundPosition, baseVolume, maxDistance) {
        if (!Game.instance?.playerTank?.position || !soundPosition) {
            return baseVolume;
        }

        const distance = Game.instance.playerTank.position.distanceTo(soundPosition);
        
        if (distance >= maxDistance) {
            return 0;
        }

        // Linear falloff
        const volumeMultiplier = Math.max(0, 1 - (distance / maxDistance));
        return baseVolume * volumeMultiplier;
    }

    handleTankMoving(data) {
        const { isMoving } = data;
        if (isMoving) {
            if (this.sounds.tankMoving.paused) {
                this.sounds.tankMoving.play();
            }
            if (this.moveTimeout) {
                clearTimeout(this.moveTimeout);
            }
        } else {
            this.moveTimeout = setTimeout(() => {
                this.sounds.tankMoving.pause();
                this.sounds.tankMoving.currentTime = 0;
            }, 200);
        }
    }

    handleTankShot() {
        this.sounds.tankShot.currentTime = 0;
        this.sounds.tankShot.play();
    }

    stopAllSounds() {
        Object.values(this.sounds).forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
        if (this.moveTimeout) {
            clearTimeout(this.moveTimeout);
        }
    }

    /**
     * Dispose SoundManager
     */
    dispose() {
        this.stopAllSounds();
        SoundManager.instance = null;
    }
}

export { SoundManager }; 
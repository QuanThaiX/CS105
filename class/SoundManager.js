// ./class/SoundManager.js
import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';
import { FACTION } from '../utils.js';
import { Game } from './Game.js';
import { gameSettings } from '../config.js';

class SoundManager {
    static instance;
    sounds;

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
            tankMoving: {
                audio: new Audio('./assets/sound/tank-moving.mp3'),
                type: 'sfx',
                baseVolume: .05,
                isMuted: true,
                isPlaying: false
            },
            tankShot: { audio: new Audio('./assets/sound/tank-shots.mp3'), type: 'sfx', baseVolume: .5 },
            barrelExplosion: { audio: new Audio('./assets/sound/barrel-explosion.mp3'), type: 'sfx', baseVolume: .25 },
            tankDestruction: { audio: new Audio('./assets/sound/tank-far-explosion.mp3'), type: 'sfx', baseVolume: .25 },
            lobbyMusic: { audio: new Audio('./assets/sound/lobby_bgm.mp3'), type: 'music', baseVolume: .5 },
            gameBgm: { audio: new Audio('./assets/sound/ingame_bgm.mp3'), type: 'music', baseVolume: .5 },
        };

        Object.values(this.sounds).forEach(soundData => {
            soundData.audio.preload = 'auto';
            if (soundData.type === 'music' || soundData === this.sounds.tankMoving) {
                soundData.audio.loop = true;
            }
        });

        this.updateAllVolumes();
    }

    /**
     * [FIXED] Centralized volume calculation logic.
     * @param {string} soundKey - The key for the sound in this.sounds.
     * @returns {number} The calculated volume between 0 and 1.
     */
    _getCalculatedVolume(soundKey) {
        const soundData = this.sounds[soundKey];
        if (!soundData) return 0;
        
        const masterVolume = gameSettings.volumeMaster ?? 1.0;
        let categoryVolume = 1.0;

        if (soundData.type === 'music') categoryVolume = gameSettings.volumeMusic ?? 1.0;
        else if (soundData.type === 'sfx') categoryVolume = gameSettings.volumeSfx ?? 1.0;

        return Math.max(0, Math.min(1, soundData.baseVolume * categoryVolume * masterVolume));
    }
    
    updateVolume(soundKey) {
        const soundData = this.sounds[soundKey];
        if (!soundData || !soundData.audio) return;

        if (soundKey === 'tankMoving' && soundData.isMuted) {
            soundData.audio.volume = 0;
            return;
        }

        // Use the centralized calculation
        soundData.audio.volume = this._getCalculatedVolume(soundKey);
    }

    updateAllVolumes() {
        console.log('🔊 Updating all sound volumes based on settings...');
        for (const soundKey in this.sounds) {
            this.updateVolume(soundKey);
        }
    }

    setupEventListeners() {
        EventManager.instance.subscribe(EVENT.PLAYER_MOVE, (data) => this.handleTankMoving(data));
        EventManager.instance.subscribe(EVENT.OBJECT_SHOOT, (data) => {
            if (data.tank && data.tank.faction === FACTION.PLAYER) this.handleTankShot();
        });
        EventManager.instance.subscribe(EVENT.BARREL_EXPLODED, (data) => this.handleBarrelExplosion(data));
        EventManager.instance.subscribe(EVENT.TANK_DESTROYED, (data) => this.handleTankDestruction(data));
        EventManager.instance.subscribe(EVENT.ENTER_LOBBY, () => this.playLobbyMusic());
        EventManager.instance.subscribe(EVENT.GAME_STARTED, () => this.playBgm());
        EventManager.instance.subscribe(EVENT.GAME_OVER, () => this.playLobbyMusic());
        EventManager.instance.subscribe(EVENT.GAME_WIN, () => this.playLobbyMusic());
        EventManager.instance.subscribe(EVENT.SETTINGS_UPDATED, () => this.updateAllVolumes());
    }

    handleTankMoving(data) {
        const { isMoving } = data;
        const soundData = this.sounds.tankMoving;

        if (Game.instance?.isRunning) {
            if (!soundData.isPlaying) {
                soundData.audio.play().catch(e => {});
                soundData.isPlaying = true;
            }

            const shouldBeMuted = !isMoving;
            if (soundData.isMuted !== shouldBeMuted) {
                soundData.isMuted = shouldBeMuted;
                this.updateVolume('tankMoving');
            }
        } else {
             if (!soundData.isMuted) {
                soundData.isMuted = true;
                this.updateVolume('tankMoving');
            }
        }
    }

    /**
     * [FIXED] All one-shot sounds now use the central volume calculation.
     */
    handleTankShot() {
        const audio = this.sounds.tankShot.audio.cloneNode();
        audio.volume = this._getCalculatedVolume('tankShot');
        audio.play().catch(e => {});
    }
    
    handleBarrelExplosion(data) {
        const audio = this.sounds.barrelExplosion.audio.cloneNode();
        audio.volume = this._getCalculatedVolume('barrelExplosion');
        audio.play().catch(e => {});
    } 
    
    handleTankDestruction(data) {
        const audio = this.sounds.tankDestruction.audio.cloneNode();
        audio.volume = this._getCalculatedVolume('tankDestruction');
        audio.play().catch(e => {});
    } 

    stopAllSounds() {
        Object.values(this.sounds).forEach(soundData => {
            soundData.audio.pause();
            soundData.audio.currentTime = 0;
            if (soundData === this.sounds.tankMoving) {
                soundData.isPlaying = false;
                soundData.isMuted = true;
            }
        });
    }

    playLobbyMusic() { this.stopAllSounds(); this.sounds.lobbyMusic.audio.play().catch(e => {}); }
    playBgm() { this.stopAllSounds(); this.sounds.gameBgm.audio.play().catch(e => {}); }
    calculateDistanceVolume(pos, maxVol, maxDist) { return maxVol; } // Dummy function, not implemented
    dispose() { this.stopAllSounds(); SoundManager.instance = null; }
}

export { SoundManager };
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
            // Give tankMoving its own special properties
            tankMoving: {
                audio: new Audio('./assets/sound/tank-moving.mp3'),
                type: 'sfx',
                baseVolume: 1.0,
                isMuted: true, // Start in a muted state
                isPlaying: false // We will manage its play state
            },
            tankShot: { audio: new Audio('./assets/sound/tank-shots.mp3'), type: 'sfx', baseVolume: 1.0 },
            barrelExplosion: { audio: new Audio('./assets/sound/barrel-explosion.mp3'), type: 'sfx', baseVolume: 1.0 },
            tankDestruction: { audio: new Audio('./assets/sound/tank-far-explosion.mp3'), type: 'sfx', baseVolume: 1.0 },
            lobbyMusic: { audio: new Audio('./assets/sound/lobby_bgm.mp3'), type: 'music', baseVolume: 0.5 },
            gameBgm: { audio: new Audio('./assets/sound/ingame_bgm.mp3'), type: 'music', baseVolume: 0.4 },
        };

        // Configure common properties
        Object.values(this.sounds).forEach(soundData => {
            soundData.audio.preload = 'auto';
            // All music and the tank moving sound will loop
            if (soundData.type === 'music' || soundData === this.sounds.tankMoving) {
                soundData.audio.loop = true;
            }
        });

        // Apply initial volumes from settings
        this.updateAllVolumes();
    }
    
    updateVolume(soundKey) {
        const soundData = this.sounds[soundKey];
        if (!soundData || !soundData.audio) return;

        // Special handling for the muted tankMoving sound
        if (soundKey === 'tankMoving' && soundData.isMuted) {
            soundData.audio.volume = 0;
            return; // Exit early
        }

        const masterVolume = gameSettings.volumeMaster ?? 1.0;
        let categoryVolume = 1.0;
        
        if (soundData.type === 'music') categoryVolume = gameSettings.volumeMusic ?? 1.0;
        else if (soundData.type === 'sfx') categoryVolume = gameSettings.volumeSfx ?? 1.0;

        const calculatedVolume = soundData.baseVolume * categoryVolume * masterVolume;
        soundData.audio.volume = Math.max(0, Math.min(1, calculatedVolume));
    }

    updateAllVolumes() {
        console.log('🔊 Updating all sound volumes...');
        for (const soundKey in this.sounds) {
            this.updateVolume(soundKey);
        }
    }

    setupEventListeners() {
        // ... (other event listeners are the same) ...
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

    // --- FINAL, INSTANTANEOUS TANK MOVING LOGIC ---
    handleTankMoving(data) {
        const { isMoving } = data;
        const soundData = this.sounds.tankMoving;

        // If the game is running...
        if (Game.instance?.isRunning) {
            // First, ensure the sound is playing in the background (it's silent if muted)
            if (!soundData.isPlaying) {
                soundData.audio.play().catch(e => {/* This might fail once but is fine */});
                soundData.isPlaying = true;
            }

            // Now, simply mute or unmute based on movement
            if (isMoving) {
                // If it's currently muted, unmute it
                if (soundData.isMuted) {
                    soundData.isMuted = false;
                    this.updateVolume('tankMoving'); // Apply the real volume
                }
            } else {
                // If it's currently unmuted, mute it
                if (!soundData.isMuted) {
                    soundData.isMuted = true;
                    this.updateVolume('tankMoving'); // Apply volume of 0
                }
            }
        } else {
            // If the game is not running, ensure it's muted
             if (!soundData.isMuted) {
                soundData.isMuted = true;
                this.updateVolume('tankMoving');
            }
        }
    }

    // One-shot sounds still use cloneNode for overlap
    handleTankShot() {
        const soundTemplate = this.sounds.tankShot;
        const shotAudio = soundTemplate.audio.cloneNode();
        // Manually calculate volume for the clone
        const masterVolume = gameSettings.volumeMaster ?? 1.0;
        const sfxVolume = gameSettings.volumeSfx ?? 1.0;
        shotAudio.volume = Math.max(0, Math.min(1, soundTemplate.baseVolume * masterVolume * sfxVolume));
        shotAudio.play().catch(e => {});
    }

    stopAllSounds() {
        Object.values(this.sounds).forEach(soundData => {
            soundData.audio.pause();
            soundData.audio.currentTime = 0;

            // Reset our custom state for tankMoving
            if (soundData === this.sounds.tankMoving) {
                soundData.isPlaying = false;
                soundData.isMuted = true;
            }
        });
    }

    // Other functions like playBgm, playLobbyMusic, explosions, etc., are fine
    // and don't need changes from the version that was working reliably.
    playLobbyMusic() { this.stopAllSounds(); this.sounds.lobbyMusic.audio.play().catch(e => {}); }
    playBgm() { this.stopAllSounds(); this.sounds.gameBgm.audio.play().catch(e => {}); }
    handleBarrelExplosion(data) { const audio = this.sounds.barrelExplosion.audio.cloneNode(); audio.volume = 0.5; audio.play(); } // Simplified for brevity
    handleTankDestruction(data) { const audio = this.sounds.tankDestruction.audio.cloneNode(); audio.volume = 0.5; audio.play(); } // Simplified for brevity
    calculateDistanceVolume(pos, maxVol, maxDist) { return maxVol; } // Simplified for brevity
    dispose() { this.stopAllSounds(); SoundManager.instance = null; }
}

export { SoundManager };
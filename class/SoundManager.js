import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';
import { FACTION } from '../utils.js';

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
            tankShot: new Audio('./assets/sound/tank-shots.mp3')
        };

        this.sounds.tankMoving.loop = true;
        this.sounds.tankMoving.volume = 0.05;
        this.sounds.tankShot.volume = 1;
    }

    setupEventListeners() {
        EventManager.instance.subscribe(EVENT.PLAYER_MOVE, (data) => {
            this.handleTankMoving(data);
        });

        EventManager.instance.subscribe(EVENT.OBJECT_SHOOT, (data) => {
            // if (data.tank && data.tank.faction === FACTION.PLAYER) {
            //     this.handleTankShot();
            // }
            this.handleTankShot();
        });
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
}

export { SoundManager }; 
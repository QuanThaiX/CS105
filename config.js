// ./config.js
import { TANKTYPE } from './utils.js';
import * as THREE from 'three';

export const QUALITY = Object.freeze({
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
});

const QUALITY_SETTINGS_PROFILES = {
    [QUALITY.LOW]: {
        antialias: false,
        pixelRatio: 1,
        shadowMapSize: 1024,
        shadowType: THREE.PCFShadowMap,
        shadowRadius: 1,
        toneMapping: THREE.NoToneMapping,
        exposure: 1.0,
        extraLights: false,
        useSky: false,
        useFog: false,
    },
    [QUALITY.MEDIUM]: {
        antialias: true,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        shadowMapSize: 2048,
        shadowType: THREE.PCFSoftShadowMap,
        shadowRadius: 3,
        toneMapping: THREE.ACESFilmicToneMapping,
        exposure: 1.2,
        extraLights: true,
        useSky: true,
        useFog: true,
    },
    [QUALITY.HIGH]: {
        antialias: true,
        pixelRatio: window.devicePixelRatio,
        shadowMapSize: 4096,
        shadowType: THREE.PCFSoftShadowMap,
        shadowRadius: 5,
        toneMapping: THREE.ACESFilmicToneMapping,
        exposure: 1.2,
        extraLights: true,
        useSky: true,
        useFog: true,
    }
};

export const gameSettings = {
    quality: QUALITY.MEDIUM,
    fog: true,
    dayNightCycle: 'day',
    // NEW SETTINGS with default values
    cameraShake: true,
    showMinimap: true,
    volumeMaster: 0.8,
    volumeMusic: 0.8,
    volumeSfx: 0.5,
};

export function loadSettings() {
    const savedSettings = localStorage.getItem('tankGameSettings');
    if (savedSettings) {
        const parsed = JSON.parse(savedSettings);

        if (parsed.quality && Object.values(QUALITY).includes(parsed.quality)) {
            gameSettings.quality = parsed.quality;
        }

        if (['day', 'night', 'dynamic'].includes(parsed.dayNightCycle)) {
            gameSettings.dayNightCycle = parsed.dayNightCycle;
        }

        gameSettings.fog = parsed.fog ?? QUALITY_SETTINGS_PROFILES[gameSettings.quality].useFog;
        
        // NEW: Load camera shake and minimap settings, defaulting to true if not found
        gameSettings.cameraShake = parsed.cameraShake ?? true;
        gameSettings.showMinimap = parsed.showMinimap ?? true;
        
        gameSettings.volumeMaster = parsed.volumeMaster ?? 0.8;
        gameSettings.volumeMusic = parsed.volumeMusic ?? 0.8;
        gameSettings.volumeSfx = parsed.volumeSfx ?? 0.5;

        console.log('⚙️ Settings loaded:', gameSettings);
    } else {
        const qualityProfile = QUALITY_SETTINGS_PROFILES[gameSettings.quality];
        gameSettings.fog = qualityProfile.useFog;
        console.log('⚙️ No saved settings found, using defaults for MEDIUM quality.');
    }
}

export function saveSettings() {
    localStorage.setItem('tankGameSettings', JSON.stringify(gameSettings));
}

export const GAMECONFIG = Object.freeze({
    DEBUG: false,
    WORLD_BOUNDARY: 400,
    QUALITY_PROFILES: QUALITY_SETTINGS_PROFILES,
    SCENERY: {
        NUM_ROCKS: 60,
        ROCK_TYPES: ['rock09', 'rock13'],
        ROCK_SCALE_MIN: 3.0,
        ROCK_SCALE_MAX: 12,
        NUM_TREES: 60,
        TREE_TYPES: ['tree01'],
        TREE_SCALE_MIN: 0.9,
        TREE_SCALE_MAX: 2.9,
        NUM_BARRELS: 20,
        BARREL_TYPES: ['barrel'],
        BARREL_SCALE_MIN: 3.5,
        BARREL_SCALE_MAX: 4.5,
        BARREL_EXPLOSION: {
            DAMAGE: 150,
            RADIUS: 10,
            PUSH_FORCE: 500,
            SOUND_VOLUME: 0.8,
            PARTICLE_COUNT: 50,
            CHAIN_REACTION: true
        },
        MIN_SPAWN_RADIUS: 90,
        MAX_SPAWN_RADIUS_FACTOR: 1.,
    },
    ENEMY_CONFIG: {
        NUM_ENEMIES:4,
        ENEMY_TYPES: [TANKTYPE.V001, TANKTYPE.V002, TANKTYPE.V003,
             TANKTYPE.V004, TANKTYPE.V005, TANKTYPE.V006, TANKTYPE.V007, TANKTYPE.V008],
        ENEMY_POINT_VALUE: (type) => {
            switch(type.name) {
                case TANKTYPE.V001.name: return 100;
                case TANKTYPE.V002.name: return 150;
                case TANKTYPE.V003.name: return 120;
                case TANKTYPE.V004.name: return 180;
                case TANKTYPE.V005.name: return 200;
                case TANKTYPE.V006.name: return 250;
                case TANKTYPE.V007.name: return 200;
                case TANKTYPE.V008.name: return 260;
                default: return 50;
            }
        },
        ENEMY_HP: (type) => {
            switch(type.name) {
                case TANKTYPE.V001.name: return 100;
                case TANKTYPE.V002.name: return 200;
                case TANKTYPE.V003.name: return 170;
                case TANKTYPE.V004.name: return 190;
                case TANKTYPE.V005.name: return 180;
                case TANKTYPE.V006.name: return 350;
                case TANKTYPE.V007.name: return 230;
                case TANKTYPE.V008.name: return 230;
                case TANKTYPE.V009.name: return 360;
                default: return 150;
            }
        },
        MIN_SPAWN_RADIUS: 40,
        MAX_SPAWN_RADIUS_FACTOR: 0.85,
        RESPAWN: {
            ENABLED: true,
            MIN_DELAY: 2000,
            MAX_DELAY: 5000,
            MIN_DISTANCE_FROM_PLAYER: 50,
            MIN_DISTANCE_FROM_OBSTACLES: 15,
            MAX_SPAWN_ATTEMPTS: 50,
            TANK_SIZE: 8,
            MAX_ENEMIES_ALIVE: 6,
            PROGRESSIVE_DIFFICULTY: true,
            DIFFICULTY_SCALING: {
                SCORE_THRESHOLD: 500,
                HP_MULTIPLIER: 1.2,
                POINT_MULTIPLIER: 1.5
            }
        }
    },
    POWERUP_CONFIG: {
        MAX_ACTIVE: 3,
        SPAWN_INTERVAL: 15000,
        TOTAL_SPAWN_LIMIT: 10,
    },
    AUDIO: {
        BARREL_EXPLOSION: {
            PATH: './assets/audio/barrel-explosion.wav',
            VOLUME: 0.6,
            DISTANCE_FALLOFF: true,
            MAX_DISTANCE: 100
        },
        TANK_DESTRUCTION: {
            PATH: './assets/audio/tank-far-explosion.wav',
            VOLUME: 0.3,
            DISTANCE_FALLOFF: true,
            MAX_DISTANCE: 150
        }
    }
});
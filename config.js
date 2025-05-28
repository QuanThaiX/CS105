import { TANKTYPE } from './utils.js';

export const GAMECONFIG = Object.freeze({
    DEBUG: false,
    WORLD_BOUNDARY: 500,
    SCENERY: {
        NUM_ROCKS: 120,
        ROCK_TYPES: ['rock09', 'rock13'],
        ROCK_SCALE_MIN: 3.0,
        ROCK_SCALE_MAX: 20,
        NUM_TREES: 130,
        TREE_TYPES: ['tree01'],
        TREE_SCALE_MIN: 0.9,
        TREE_SCALE_MAX: 2.9,
        // =================== BARREL CONFIGURATION ===================
        NUM_BARRELS: 40,
        BARREL_TYPES: ['barrel'],
        BARREL_SCALE_MIN: 3.5,
        BARREL_SCALE_MAX: 4.5,
        BARREL_EXPLOSION: {
            DAMAGE: 50,             
            RADIUS: 0.5,               
            PUSH_FORCE: 500,          
            SOUND_VOLUME: 0.8,       
            PARTICLE_COUNT: 50,      
            CHAIN_REACTION: true      
        },
        MIN_SPAWN_RADIUS: 50, // Scenery can spawn closer to the center
        MAX_SPAWN_RADIUS_FACTOR: 0.95, // Scenery will spawn up to this factor of (WORLD_BOUNDARY / 2)
    },
    ENEMY_CONFIG: {
        NUM_ENEMIES: 8,
        ENEMY_TYPES: [TANKTYPE.V001, TANKTYPE.V003],
        ENEMY_POINT_VALUE: (type) => {
            switch(type) {
                case TANKTYPE.V001: return 100;
                case TANKTYPE.V002: return 150;
                default: return 50;
            }
        },
        ENEMY_HP: (type) => {
            switch(type) {
                case TANKTYPE.V001: return 100;
                case TANKTYPE.V002: return 120;
                default: return 80;
            }
        },
        MIN_SPAWN_RADIUS: 40, 
        MAX_SPAWN_RADIUS_FACTOR: 0.85,
    },
    // =================== AUDIO CONFIGURATION ===================
    AUDIO: {
        BARREL_EXPLOSION: {
            PATH: './assets/audio/barrel-explosion.wav',
            VOLUME: 0.8,
            DISTANCE_FALLOFF: true,
            MAX_DISTANCE: 100
        },
        TANK_DESTRUCTION: {
            PATH: './assets/audio/tank-far-explosion.wav',
            VOLUME: 0.7,
            DISTANCE_FALLOFF: true,
            MAX_DISTANCE: 150
        }
    }
});
import { TANKTYPE } from './utils.js';

export const GAMECONFIG = Object.freeze({
    DEBUG: true,
    WORLD_BOUNDARY: 500,
    SCENERY: {
        NUM_ROCKS: 20,
        ROCK_TYPES: ['rock09', 'rock13'],
        ROCK_SCALE_MIN: 3.0,
        ROCK_SCALE_MAX: 8.0,
        NUM_TREES: 30,
        TREE_TYPES: ['tree01'],
        TREE_SCALE_MIN: 0.9,
        TREE_SCALE_MAX: 1.6,
        MIN_SPAWN_RADIUS: 10, // Scenery can spawn closer to the center
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
    }
});
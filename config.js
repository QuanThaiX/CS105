import { TANKTYPE } from './utils.js';

export const GAMECONFIG = Object.freeze({
    DEBUG: false,
    WORLD_BOUNDARY: 500,
    
    SCENERY: {
        NUM_ROCKS: 60,
        ROCK_TYPES: ['rock09', 'rock13'],
        ROCK_SCALE_MIN: 3.0,
        ROCK_SCALE_MAX: 14,
        NUM_TREES: 40,
        TREE_TYPES: ['tree01'],
        TREE_SCALE_MIN: 0.9,
        TREE_SCALE_MAX: 2.9,
        // =================== BARREL CONFIGURATION ===================
        NUM_BARRELS: 20,
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
        MIN_SPAWN_RADIUS: 100, // Scenery can spawn closer to the center
        MAX_SPAWN_RADIUS_FACTOR: 0.95, // Scenery will spawn up to this factor of (WORLD_BOUNDARY / 2)
    },
    ENEMY_CONFIG: {
        NUM_ENEMIES: 8,
        ENEMY_TYPES: [TANKTYPE.V001, TANKTYPE.V003],
        ENEMY_POINT_VALUE: (type) => {
            switch(type) {
                case TANKTYPE.V001: return 100;
                case TANKTYPE.V002: return 150;
                case TANKTYPE.V003: return 120;
                case TANKTYPE.V004: return 180;
                case TANKTYPE.V005: return 200;
                case TANKTYPE.V006: return 250;
                default: return 50;
            }
        },
        ENEMY_HP: (type) => {
            switch(type) {
                case TANKTYPE.V001: return 100;
                case TANKTYPE.V002: return 120;
                case TANKTYPE.V003: return 110;
                case TANKTYPE.V004: return 140;
                case TANKTYPE.V005: return 160;
                case TANKTYPE.V006: return 180;
                default: return 80;
            }
        },
        MIN_SPAWN_RADIUS: 40, 
        MAX_SPAWN_RADIUS_FACTOR: 0.85,
        
        // =================== RESPAWN CONFIGURATION ===================
        RESPAWN: {
            ENABLED: true,                    // Bật/tắt respawn system
            MIN_DELAY: 2000,                  // Thời gian tối thiểu trước khi spawn (ms)
            MAX_DELAY: 5000,                  // Thời gian tối đa trước khi spawn (ms)
            MIN_DISTANCE_FROM_PLAYER: 50,    // Khoảng cách tối thiểu từ player
            MIN_DISTANCE_FROM_OBSTACLES: 15, // Khoảng cách tối thiểu từ obstacles
            MAX_SPAWN_ATTEMPTS: 50,           // Số lần thử tìm vị trí spawn tối đa
            TANK_SIZE: 8,                     // Kích thước tank để tính collision
            MAX_ENEMIES_ALIVE: 6,             // Số lượng tank địch tối đa cùng lúc
            PROGRESSIVE_DIFFICULTY: true,     // Tăng độ khó theo thời gian
            DIFFICULTY_SCALING: {
                SCORE_THRESHOLD: 500,         // Điểm để tăng độ khó
                HP_MULTIPLIER: 1.2,           // Nhân HP khi tăng độ khó
                POINT_MULTIPLIER: 1.5         // Nhân điểm khi tăng độ khó
            }
        }
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
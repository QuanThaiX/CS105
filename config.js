export const GAMECONFIG = Object.freeze({
    DEBUG: false,
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
        MIN_SPAWN_RADIUS: 5, 
        MAX_SPAWN_RADIUS_FACTOR: 0.9, // Scenery will spawn up to this factor of (WORLD_BOUNDARY / 2)
                                      // e.g., 0.9 * (500/2) = 0.9 * 250 = 225 units from center
    }
});

import * as THREE from 'three';

function toRad(deg){
    return THREE.MathUtils.degToRad(deg);
}

const FACTION = Object.freeze({
    PLAYER: "player",
    ENEMY: "enemy",
    NEUTRAL: "neutral",
  });

const EVENT = Object.freeze({
    COLLISION: "collision",
    
    OBJECT_MOVED: "object_moved",
    OBJECT_LOADED: "object_loaded", 
    OBJECT_DAMAGED: "object_damaged",   
    OBJECT_DESTROYED: "object_destroyed", 
    OBJECT_SHOOT: "object_shoot",        
    
    BULLET_EXPIRED: "bullet_expired",
    
    PLAYER_MOVE: "player_move",
    PLAYER_DIE: "player_die",
    PLAYER_RESTART: "player_restart",
    
    GAME_STARTED: "game_started",
    GAME_PAUSED: "game_paused",
    GAME_RESUMED: "game_resumed",
    GAME_OVER: "game_over",
    GAME_WIN: "game_win",
    
    LEVEL_LOADED: "level_loaded",
    LEVEL_COMPLETED: "level_completed",
    
    ITEM_SPAWNED: "item_spawned",
    ITEM_COLLECTED: "item_collected"
})

const COLOR = Object.freeze({
    white: 0xffffff,
    black: 0x000000,
    red: 0xff0000,
    green: 0x00ff00,
    blue: 0x0000ff,
    yellow: 0xffff00,
    cyan: 0x00ffff,
    magenta: 0xff00ff,
    orange: 0xffa500,
    purple: 0x800080,
    pink: 0xffc0cb,
    brown: 0x8b4513,
    gold: 0xffd700,
    silver: 0xc0c0c0,
    gray: 0x808080,
    lightGray: 0xd3d3d3,
    darkGray: 0x505050,
    navy: 0x000080,
    olive: 0x808000,
    lime: 0x32cd32,
    teal: 0x008080,
    maroon: 0x800000,
    forestGreen: 0x228b22,
    skyBlue: 0x87ceeb,
    deepSkyBlue: 0x00bfff,
    coral: 0xff7f50,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    pastelBlue: 0xaec6cf,
    pastelGreen: 0x77dd77,
    pastelPink: 0xffd1dc,
    pastelPurple: 0xb39eb5,
    pastelYellow: 0xfdfd96,
    darkRed: 0x8b0000,
    darkGreen: 0x006400,
    darkBlue: 0x00008b,
    darkCyan: 0x008b8b,
    darkMagenta: 0x8b008b,
    darkOrange: 0xff8c00,
    darkPurple: 0x4b0082,
});

export {toRad, FACTION, EVENT, COLOR};

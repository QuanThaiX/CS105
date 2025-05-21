import * as THREE from 'three';
import { GLTFLoader } from "./three/examples/jsm/loaders/GLTFLoader.js";

function toRad(deg) {
    return THREE.MathUtils.degToRad(deg);
}

const HITBOX_SCALE = {
    TANK: { x: 0.7, y: 1.0, z: 0.7 },
    ROCK: { x: 0.6, y: 1.0, z: 0.6 },
    TREE: { x: 0.1, y: 1.0, z: 0.1 },
    BARREL: { x: 1.0, y: 1.0, z: 1.0 },
};

function loadTankModel(tankType, position = new THREE.Vector3(0, 0, 0)) {
    let modelPath = tankType.assetPathGLTF;
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;

                if (tankType == TANKTYPE.V001) {
                    model.position.set(position.x, position.y, position.z);
                    model.scale.set(3.5, 3.5, 3.5);
                } else if (tankType == TANKTYPE.V003) {
                    model.position.set(position.x, position.y - 1, position.z);
                    model.scale.set(3.0, 3.0, 3.0);
                } else if (tankType == TANKTYPE.V002) {
                    model.position.set(position.x, position.y - 1, position.z);
                    model.scale.set(2.0, 2.0, 2.0);
                } else if (tankType == TANKTYPE.V004) {
                    model.position.set(position.x, position.y - 1, position.z);
                    model.scale.set(2.4, 2.4, 2.4);
                } else if (tankType == TANKTYPE.V005) {
                    model.position.set(position.x, position.y - 1, position.z);
                    model.scale.set(1.4, 1.4, 1.4);
                } else if (tankType == TANKTYPE.V006) {
                    model.position.set(position.x, position.y - 1, position.z);
                    model.scale.set(1.2, 1.2, 1.2);
                } else {
                    model.position.copy(position);
                    model.scale.set(3.5, 3.5, 3.5);
                }

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if (child.material.map) {
                            console.log("Texture loaded:", child.material.map);
                        } else {
                            console.warn("Texture missing in", child.name);
                        }
                    }
                });

                resolve(model);
            },
            undefined,
            (error) => reject(error)
        );
    });
}

const FACTION = Object.freeze({
    PLAYER: "player",
    ENEMY: "enemy",
    NEUTRAL: "neutral",
});

const TANK_STATS = Object.freeze({
    V001: {
        hp: 1000,
        maxHp: 500,
        moveSpeed: 0.1,
        rotateSpeed: 0.03,
        shootCooldown: 1500,
        damage: 100,
        defense: 70,
    },
    V002: {
        hp: 800,
        maxHp: 800,
        moveSpeed: 0.07,
        rotateSpeed: 0.02,
        shootCooldown: 2200,
        damage: 150,
        defense: 90,
    },
    V003: {
        hp: 600,
        maxHp: 600,
        moveSpeed: 0.08,
        rotateSpeed: 0.025,
        shootCooldown: 2500,
        damage: 120,
        defense: 85,
    },
    V004: {
        hp: 700,
        maxHp: 700,
        moveSpeed: 0.12,
        rotateSpeed: 0.035,
        shootCooldown: 1800,
        damage: 90,
        defense: 60,
    },
    V005: {
        hp: 500,
        maxHp: 500,
        moveSpeed: 0.14,
        rotateSpeed: 0.04,
        shootCooldown: 1500,
        damage: 80,
        defense: 50,
    },
    V006: {
        hp: 1200,
        maxHp: 1200,
        moveSpeed: 0.06,
        rotateSpeed: 0.015,
        shootCooldown: 3000,
        damage: 200,
        defense: 100,
    }
});

const TANKTYPE = Object.freeze({
    V001: {
        name: "V001",
        assetPathGLTF: "./assets/tankv001/tankv001.gltf",
        assetPathFBX: "./assets/tankv001/cartoon_tank.fbx",
    },
    V002: {
        name: "V002",
        assetPathGLTF: "./assets/tankv002/tankv002.gltf",
    },
    V003: {
        name: "V003",
        assetPathGLTF: "./assets/tankv003/tankv003.gltf",
    },
    V004: {
        name: "V004",
        assetPathGLTF: "./assets/tankv004/tankv004.gltf",
    },
    V005: {
        name: "V005",
        assetPathGLTF: "./assets/tankv005/tankv005.gltf",
    },
    V006: {
        name: "V006",
        assetPathGLTF: "./assets/tankv006/tankv006.gltf",
    }
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
    ITEM_COLLECTED: "item_collected",
    
    TANK_DESTROYED: "tank_destroyed",
    
    SCORE_CHANGED: "score_changed"
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

export { toRad, loadTankModel, FACTION, EVENT, COLOR, TANKTYPE, TANK_STATS, HITBOX_SCALE };

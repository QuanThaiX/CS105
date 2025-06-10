import * as THREE from 'three';
import { GLTFLoader } from "./three/examples/jsm/loaders/GLTFLoader.js";
import { ModelLoader } from './loader.js';

function toRad(deg) {
    return THREE.MathUtils.degToRad(deg);
}
export const POWERUP_TYPE = Object.freeze({
    SHIELD: { name: 'Shield', duration: 10000, color: 0x00BFFF },
    RAPID_FIRE: { name: 'Rapid Fire', duration: 8000, color: 0xFFFF00 },
    DAMAGE_BOOST: { name: 'Damage Boost', duration: 10000, color: 0xFF4500 },
    HEALTH_PACK: { name: 'Health Pack', duration: 0, color: 0x00FF7F, value: 150 },
});
const HITBOX_SCALE = {
    TANK: { x: 0.7, y: 1.0, z: 0.7 },
    ROCK: { x: 0.6, y: 1.0, z: 0.6 },
    TREE: { x: 0.1, y: 1.0, z: 0.1 },
    BARREL: { x: 0.8, y: 1.0, z: 0.8 },
};

/**
 * Load tank model from cache (if preloaded) or load directly
 * @param {Object} tankType - TANKTYPE object
 * @param {THREE.Vector3} position - Tank position
 * @returns {Promise<THREE.Group>} - Promise resolve with tank model
 */
function loadTankModel(tankType, position = new THREE.Vector3(0, 0, 0)) {
    return new Promise((resolve, reject) => {
        const modelLoader = new ModelLoader();
        
        // If preloaded, get from cache
        if (modelLoader.isPreloaded) {
            const model = modelLoader.getTankModel(tankType, position);
            if (model instanceof Promise) {
                // Xử lý trường hợp getTankModel trả về Promise (cho custom JS tank)
                model.then(resolvedModel => {
                    if (resolvedModel) {
                        resolve(resolvedModel);
                    } else {
                        reject(new Error(`Failed to load JS tank model: ${tankType.name}`));
                    }
                }).catch(reject);
                return;
            } else if (model) {
                resolve(model);
                return;
            }
        }
        
        // Fallback: Load directly if not preloaded (for backward compatibility)
        console.warn(`⚠️ Tank model ${tankType.name} not preloaded, loading directly...`);
        
        // Xử lý custom tank từ JavaScript
        if (tankType.useCustomRenderer && tankType.assetPathJS) {
            import(tankType.assetPathJS)
                .then(module => {
                    const model = module.createTank();
                    
                    if (tankType == TANKTYPE.V007) {
                        model.position.copy(position);
                        // Giảm scale của V007 xuống còn 1.2 (từ 1.5)
                        model.scale.set(1.2, 1.2, 1.2);
                        // Điều chỉnh vị trí y để phù hợp với các tank khác và tăng thêm 0.3
                        model.position.y = position.y - 1 + 0.3;
                    }
                    
                    resolve(model);
                })
                .catch(error => {
                    console.error(`Failed to load JS tank model ${tankType.name}:`, error);
                    reject(error);
                });
            return;
        }
        
        // Load GLTF model
        let modelPath = tankType.assetPathGLTF;
        if (!modelPath) {
            reject(new Error(`No model path defined for tank type: ${tankType.name}`));
            return;
        }
        
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

                        // Cải thiện material properties cho hiệu ứng metal
                        if (child.material) {
                            // Nếu là MeshStandardMaterial hoặc có thể chuyển đổi
                            if (child.material.isMeshStandardMaterial) {
                                // Giữ nguyên texture hiện có nhưng cải thiện material properties
                                child.material.metalness = 0.3; // Tăng metalness cho hiệu ứng kim loại
                                child.material.roughness = 0.2; // Giảm roughness để tăng phản chiếu
                                child.material.envMapIntensity = 1.0; // Tăng cường environment mapping nếu có
                            } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                // Chuyển đổi sang MeshStandardMaterial để có hiệu ứng tốt hơn
                                const newMaterial = new THREE.MeshStandardMaterial({
                                    map: child.material.map,
                                    color: child.material.color,
                                    metalness: 0.3,
                                    roughness: 0.2,
                                    envMapIntensity: 1.0
                                });
                                child.material = newMaterial;
                            }
                        }

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
        hp: 500,
        maxHp: 500,
        moveSpeed: 0.11,
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
        damage: 110,
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
        moveSpeed: 0.07,
        rotateSpeed: 0.035,
        shootCooldown: 1800,
        damage: 90,
        defense: 60,
    },
    V005: {
        hp: 650,
        maxHp: 650,
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
        damage: 120,
        defense: 100,
    },
    V007: {
        hp: 850,
        maxHp: 850,
        moveSpeed: 0.09,
        rotateSpeed: 0.03,
        shootCooldown: 1800,
        damage: 130,
        defense: 75,
    },
    V008: {
        hp: 1200,
        maxHp: 1200,
        moveSpeed: 0.06,
        rotateSpeed: 0.04,
        shootCooldown: 4500,
        damage: 140,
        defense: 90,
    },
    V009: {
        hp: 500,
        maxHp: 500,
        moveSpeed: 0.15,
        rotateSpeed: 0.035,
        shootCooldown: 1600,
        damage: 55,
        defense: 80,
    },
    V010: {
        hp: 850,
        maxHp: 850,
        moveSpeed: 0.12,
        rotateSpeed: 0.035,
        shootCooldown: 2100,
        damage: 90,
        defense: 74,
    },
    V011: {
        hp: 600,
        maxHp: 600,
        moveSpeed: 0.18,
        rotateSpeed: 0.035,
        shootCooldown: 800,
        damage: 80,
        defense: 50,
    },
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
    },
    V007: {
        name: "V007",
        assetPathJS: "./custom_tanks/tankv007.js",
        useCustomRenderer: true
    },
    V008: {
        name: "V008",
        assetPathJS: "./custom_tanks/tankv008.js",
        useCustomRenderer: true
    },
    V009: {
        name: "V009",
        assetPathJS: "./custom_tanks/tankv009.js",
        useCustomRenderer: true
    },
    V010: {
        name: "V010",
        assetPathJS: "./custom_tanks/tankv010.js",
        useCustomRenderer: true
    },
    V011: {
        name: "V011",
        assetPathJS: "./custom_tanks/tankv011.js",
        useCustomRenderer: true
    },    
});

const EVENT = Object.freeze({
    // =================== CORE GAME EVENTS ===================
    /**
     * GAME_STARTED - Fired when game starts
     * @param {Object} data - { playerTank: Tank, score: number, highScore: number }
     */
    GAME_STARTED: "game_started",
    
    /**
     * GAME_PAUSED - Fired when game is paused
     * @param {Object} data - { score: number, highScore: number, timestamp: number }
     */
    GAME_PAUSED: "game_paused",
    
    /**
     * GAME_RESUMED - Fired when game is resumed
     * @param {Object} data - { score: number, highScore: number, pauseDuration: number }
     */
    GAME_RESUMED: "game_resumed",
    
    /**
     * GAME_OVER - Fired when game ends (player dies)
     * @param {Object} data - { reason: string, score: number, highScore: number, finalStats: Object }
     */
    GAME_OVER: "game_over",
    
    /**
     * GAME_WIN - Fired when player wins (all enemies destroyed)
     * @param {Object} data - { reason: string, score: number, highScore: number, timeToComplete: number }
     */
    GAME_WIN: "game_win",

    // =================== LEVEL & WORLD EVENTS ===================
    /**
     * LEVEL_LOADED - Fired when level is fully loaded
     * @param {Object} data - { playerTank: Tank, enemies: Tank[], rocks: Rock[], trees: Tree[], barrels: Barrel[] }
     */
    LEVEL_LOADED: "level_loaded",
    
    /**
     * LEVEL_COMPLETED - Fired when level objectives are completed
     * @param {Object} data - { levelId: string, score: number, timeToComplete: number, enemiesDestroyed: number }
     */
    LEVEL_COMPLETED: "level_completed",

    // =================== OBJECT LIFECYCLE EVENTS ===================
    /**
     * OBJECT_MOVED - Fired when any game object moves
     * @param {Object} data - { object: GameObject, previousPosition: Vector3, newPosition: Vector3, velocity: Vector3 }
     */
    OBJECT_MOVED: "object_moved",
    
    /**
     * OBJECT_LOADED - Fired when object model is loaded
     * @param {Object} data - { object: GameObject, modelType: string, loadTime: number }
     */
    OBJECT_LOADED: "object_loaded",
    
    /**
     * OBJECT_DAMAGED - Fired when object takes damage
     * @param {Object} data - { object: GameObject, damage: number, remainingHP: number, damageSource: GameObject }
     */
    OBJECT_DAMAGED: "object_damaged",
    
    /**
     * OBJECT_DESTROYED - Fired when object is destroyed
     * @param {Object} data - { object: GameObject, destroyer: GameObject, position: Vector3, pointValue: number }
     */
    OBJECT_DESTROYED: "object_destroyed",
    
    /**
     * OBJECT_SHOOT - Fired when object shoots projectile
     * @param {Object} data - { shooter: GameObject, projectile: Bullet, direction: Vector3, damage: number }
     */
    OBJECT_SHOOT: "object_shoot",
    /**
     * OBJECT_SHOOT - Fired when object healed
     * @param {Object} data - { shooter: GameObject, projectile: Bullet, direction: Vector3, damage: number }
     */
    OBJECT_HEALED: 'objectHealed', 

    // =================== COLLISION EVENTS ===================
    /**
     * COLLISION - Fired when objects collide
     * @param {Object} data - { objectA: GameObject, objectB: GameObject, collisionPoint: Vector3, force: number }
     */
    COLLISION: "collision",
    
    /**
     * COLLISION_TANK_BULLET - Fired when tank is hit by bullet
     * @param {Object} data - { tank: Tank, bullet: Bullet, damage: number, newHP: number }
     */
    COLLISION_TANK_BULLET: "collision_tank_bullet",
    
    /**
     * COLLISION_TANK_TANK - Fired when tanks collide
     * @param {Object} data - { tankA: Tank, tankB: Tank, collisionForce: number }
     */
    COLLISION_TANK_TANK: "collision_tank_tank",

    // =================== PLAYER EVENTS ===================
    /**
     * PLAYER_MOVE - Fired when player moves
     * @param {Object} data - { player: Tank, direction: Vector3, speed: number, position: Vector3 }
     */
    PLAYER_MOVE: "player_move",
    
    /**
     * PLAYER_DIE - Fired when player dies
     * @param {Object} data - { player: Tank, killer: GameObject, deathCause: string, finalScore: number }
     */
    PLAYER_DIE: "player_die",
    
    /**
     * PLAYER_RESTART - Fired when player restarts
     * @param {Object} data - { previousScore: number, selectedTank: TANKTYPE }
     */
    PLAYER_RESTART: "player_restart",
    
    /**
     * PLAYER_SHOOT - Fired when player shoots
     * @param {Object} data - { player: Tank, bullet: Bullet, direction: Vector3, cooldownRemaining: number }
     */
    PLAYER_SHOOT: "player_shoot",

    // =================== PROJECTILE EVENTS ===================
    /**
     * BULLET_CREATED - Fired when bullet is created
     * @param {Object} data - { bullet: Bullet, shooter: GameObject, targetDirection: Vector3 }
     */
    BULLET_CREATED: "bullet_created",
    
    /**
     * BULLET_EXPIRED - Fired when bullet expires/timeout
     * @param {Object} data - { bullet: Bullet, reason: string, position: Vector3 }
     */
    BULLET_EXPIRED: "bullet_expired",
    
    /**
     * BULLET_HIT - Fired when bullet hits target
     * @param {Object} data - { bullet: Bullet, target: GameObject, damage: number, hitPoint: Vector3 }
     */
    BULLET_HIT: "bullet_hit",

    // =================== TANK SPECIFIC EVENTS ===================
    /**
     * TANK_DESTROYED - Fired when tank is destroyed
     * @param {Object} data - { tank: Tank, pointValue: number, destroyer: GameObject, explosionPosition: Vector3 }
     */
    TANK_DESTROYED: "tank_destroyed",
    
    /**
     * TANK_HP_CHANGED - Fired when tank HP changes
     * @param {Object} data - { tank: Tank, previousHP: number, newHP: number, maxHP: number, cause: string }
     */
    TANK_HP_CHANGED: "tank_hp_changed",
    
    /**
     * TANK_SPAWNED - Fired when tank spawns
     * @param {Object} data - { tank: Tank, position: Vector3, tankType: TANKTYPE }
     */
    TANK_SPAWNED: "tank_spawned",

    // =================== SCORING EVENTS ===================
    /**
     * SCORE_CHANGED - Fired when score changes
     * @param {Object} data - { score: number, highScore: number, pointsAdded: number, reason: string }
     */
    SCORE_CHANGED: "score_changed",
    
    /**
     * HIGH_SCORE_ACHIEVED - Fired when new high score is achieved
     * @param {Object} data - { newHighScore: number, previousHighScore: number, achievement: string }
     */
    HIGH_SCORE_ACHIEVED: "high_score_achieved",

    // =================== ITEM & PICKUP EVENTS ===================
    /**
     * ITEM_SPAWNED - Fired when item spawns
     * @param {Object} data - { item: GameObject, itemType: string, position: Vector3, value: number }
     */
    ITEM_SPAWNED: "item_spawned",
    
    /**
     * ITEM_COLLECTED - Fired when item is collected
     * @param {Object} data - { item: GameObject, collector: Tank, effect: string, value: number }
     */
    ITEM_COLLECTED: "item_collected",

    // =================== AUDIO EVENTS (CRITICAL FOR HEALING EFFECT) ===================
    /**
     * AUDIO_PLAY - Fired when audio should play
     * @param {Object} data - { soundId: string, soundPath: string, volume: number, position?: Vector3, loop: boolean }
     */
    AUDIO_PLAY: "audio_play",
    
    /**
     * AUDIO_STOP - Fired when audio should stop
     * @param {Object} data - { soundId: string, fadeOut: boolean }
     */
    AUDIO_STOP: "audio_stop",

    // =================== UI EVENTS (CRITICAL FOR HEALING EFFECT) ===================
    /**
     * UI_UPDATE_HUD - Fired when HUD needs update
     * @param {Object} data - { playerHP: number, score: number, highScore: number, ammo: number }
     */
    UI_UPDATE_HUD: "ui_update_hud",
    
    /**
     * UI_SHOW_MESSAGE - Fired when UI message should show
     * @param {Object} data - { message: string, type: string, duration: number, position?: string }
     */
    UI_SHOW_MESSAGE: "ui_show_message",

    // =================== EXPLOSION EVENTS ===================
    /**
     * BARREL_EXPLODED - Fired when barrel explodes
     * @param {Object} data - { barrel: Barrel, explosion: Object, damageDealt: Array, chainReaction: boolean }
     */
    BARREL_EXPLODED: "barrel_exploded",
    
    /**
     * EXPLOSION_DAMAGE - Fired when explosion deals damage
     * @param {Object} data - { source: GameObject, target: GameObject, damage: number, distance: number, explosionType: string }
     */
    EXPLOSION_DAMAGE: "explosion_damage",

    // =================== SYSTEM EVENTS ===================
    /**
     * SYSTEM_ERROR - Fired when system error occurs
     * @param {Object} data - { error: Error, context: string, severity: string, timestamp: number }
     */
    SYSTEM_ERROR: "system_error",
    
    /**
     * SYSTEM_PERFORMANCE - Fired for performance monitoring
     * @param {Object} data - { fps: number, memory: number, loadTime: number, eventType: string }
     */
    SYSTEM_PERFORMANCE: "system_performance",
    
    /**
     * SYSTEM_RESOURCE_LOADED - Fired when resources are loaded
     * @param {Object} data - { resourceType: string, resourceId: string, loadTime: number, success: boolean }
     */
    SYSTEM_RESOURCE_LOADED: "system_resource_loaded",
    
    // =================== LOBBY & SETTINGS EVENTS ===================
    /**
     * ENTER_LOBBY - Fired when enter the lobby
     */
    ENTER_LOBBY: "enter_lobby",
    
    /**
     * SETTINGS_UPDATED - Fired when game settings are changed
     */
    SETTINGS_UPDATED: 'settings:updated', 
    POWERUP_COLLECTED: 'powerup_collected',
    POWERUP_EXPIRED: 'powerup_expired',
    POWERUP_SPAWNED: 'powerup_spawned',
});

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
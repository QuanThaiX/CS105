import * as THREE from 'three';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { GameObject } from './GameObject.js';
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT, HITBOX_SCALE } from '../utils.js';
import { ModelLoader } from '../loader.js';
import { GAMECONFIG } from '../config.js';

class Barrel extends GameObject {
    constructor(id, position, scale = 1, rotation = 0, barrelType = 'barrel') {
        super(id, 'neutral', position, true);
        this.scale = scale;
        this.barrelType = barrelType;
        this.rotation = rotation; // Rotation around Y axis (radians)
        this.hitBoxScale = HITBOX_SCALE.BARREL;
        
        // Explosion properties
        this.canExplode = true;
        this.hasExploded = false;
        this.explosionRadius = GAMECONFIG.SCENERY.BARREL_EXPLOSION.RADIUS * this.scale;
        this.explosionDamage = GAMECONFIG.SCENERY.BARREL_EXPLOSION.DAMAGE;
        this.explosionForce = GAMECONFIG.SCENERY.BARREL_EXPLOSION.PUSH_FORCE;
        
        // Health system for barrels
        this.maxHP = 50;
        this.hp = this.maxHP;
        
        this.loadModel();
    }

    loadModel() {
        // Try to get from ModelLoader cache first
        const modelLoader = new ModelLoader();
        
        if (modelLoader.isPreloaded) {
            try {
                const model = modelLoader.getBarrelModel(
                    this.barrelType, 
                    this.position, 
                    this.scale, 
                    this.rotation
                );
                
                if (model) {
                    // Setup shadows for model from cache
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    this.setModel(model);
                    
                    // Show box helper if debug mode
                    if (Game.instance.debug) {
                        this.createBoxHelper();
                    }
                    return;
                }
            } catch (error) {
                console.error('Error getting barrel model from cache:', error);
            }
        }

        // Fallback: Load directly if not preloaded
        console.warn(`⚠️ Barrel model ${this.barrelType} not preloaded, loading directly...`);
        this.loadModelDirect();
    }

    loadModelDirect() {
        // Determine model path based on barrel type
        let modelPath;
        
        switch (this.barrelType) {
            case 'barrel':
                modelPath = './assets/barrel/barrel.gltf';
                break;
            default:
                modelPath = './assets/barrel/barrel.gltf';
                break;
        }

        // Use GLTFLoader to load model
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                
                // Set position, scale and rotation
                model.position.copy(this.position);
                model.scale.set(this.scale, this.scale, this.scale);
                model.rotation.y = this.rotation;
                
                // Setup shadows
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.setModel(model);
                
                // Show box helper if debug mode
                if (Game.instance.debug) {
                    this.createBoxHelper();
                }
            },
            undefined,
            (error) => {
                console.error('Could not load barrel model:', error);
                
                // Create fallback model if loading fails
                this.createFallbackModel();
            }
        );
    }

    createBoxHelper() {
        if (this.model && Game.instance.debug) {
            // Create box helper
            const boxHelper = new THREE.BoxHelper(this.model, 0xff8800);
            Game.instance.scene.add(boxHelper);
            
            // Save reference for later removal
            this.boxHelper = boxHelper;
        }
    }

    updateBoxHelper() {
        if (this.boxHelper && this.model) {
            this.boxHelper.update();
        }
    }

    createFallbackModel() {
        // Create simple fallback model if loading fails
        const geometry = new THREE.CylinderGeometry(0.5 * this.scale, 0.6 * this.scale, 1.2 * this.scale, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x8b4513,
            roughness: 0.8,
            metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.position);
        mesh.rotation.y = this.rotation;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const model = new THREE.Group();
        model.add(mesh);
        this.setModel(model);
        
        // Show box helper if debug mode
        if (Game.instance.debug) {
            this.createBoxHelper();
        }
    }

    // Called when Barrel is destroyed
    destroy() {
        super.destroy();
    }

    // Called when Barrel is removed from scene
    dispose() {
        if (this.boxHelper) {
            Game.instance.scene.remove(this.boxHelper);
            this.boxHelper = null;
        }
        super.dispose();
    }
    
    update() {
        if (this.boxHelper) {
            this.updateBoxHelper();
        }
    }

    /**
     * Handle bullet collision with barrel
     * @param {Bullet} bullet - The bullet that hit this barrel
     */
    onBulletHit(bullet) {
        if (this.hasExploded) return;
        
        const damage = bullet.damage || 25;
        this.takeDamage(damage, bullet.shooter);
        
        // Notify collision event
        EventManager.instance.notify(EVENT.COLLISION_TANK_BULLET, {
            tank: this,
            bullet: bullet,
            damage: damage,
            newHP: this.hp
        });
        
        // Trigger explosion if health depleted
        if (this.hp <= 0) {
            this.explode(bullet.shooter);
        }
    }

    /**
     * Take damage and handle destruction
     * @param {number} damage - Amount of damage to take
     * @param {GameObject} damageSource - Source of the damage
     */
    takeDamage(damage, damageSource = null) {
        if (this.hasExploded) return;
        
        const previousHP = this.hp;
        this.hp = Math.max(0, this.hp - damage);
        
        // Notify damage event
        EventManager.instance.notify(EVENT.OBJECT_DAMAGED, {
            object: this,
            damage: damage,
            remainingHP: this.hp,
            damageSource: damageSource
        });
        
        if (this.hp <= 0 && !this.hasExploded) {
            this.explode(damageSource);
        }
    }

    /**
     * Trigger barrel explosion with area damage
     * @param {GameObject} explosionSource - What caused the explosion
     */
    explode(explosionSource = null) {
        if (this.hasExploded || !this.canExplode) return;
        
        this.hasExploded = true;
        console.log(`💥 Barrel ${this.id} exploded! Radius: ${this.explosionRadius}`);
        
        // Play explosion sound
        this.playExplosionSound();
        
        // Calculate explosion effects
        const explosionData = this.calculateExplosionEffects();
        
        // Apply damage to objects in explosion radius
        const damageDealt = this.applyExplosionDamage(explosionSource);
        
        // Create explosion visual effects
        this.createExplosionEffects();
        
        // Notify explosion event
        EventManager.instance.notify(EVENT.BARREL_EXPLODED, {
            barrel: this,
            explosion: {
                position: this.position.clone(),
                radius: this.explosionRadius,
                damage: this.explosionDamage,
                force: this.explosionForce
            },
            damageDealt: damageDealt,
            chainReaction: GAMECONFIG.SCENERY.BARREL_EXPLOSION.CHAIN_REACTION,
            explosionSource: explosionSource
        });
        
        // Mark for disposal
        this.destroy();
    }

    /**
     * Calculate explosion effects and affected objects
     * @returns {Object} Explosion calculation results
     */
    calculateExplosionEffects() {
        const affectedObjects = [];
        const game = Game.instance;
        
        if (!game) return { affectedObjects };
        
        // Check all game objects for explosion effects
        const allObjects = [
            ...(game.enemies || []),
            ...(game.barrels || []),
            game.playerTank
        ].filter(obj => obj && !obj.disposed && obj !== this);
        
        allObjects.forEach(obj => {
            const distance = this.position.distanceTo(obj.position);
            if (distance <= this.explosionRadius) {
                const damageMultiplier = Math.max(0, 1 - (distance / this.explosionRadius));
                const actualDamage = Math.floor(this.explosionDamage * damageMultiplier);
                
                affectedObjects.push({
                    object: obj,
                    distance: distance,
                    damage: actualDamage,
                    damageMultiplier: damageMultiplier
                });
            }
        });
        
        return { affectedObjects };
    }

    /**
     * Apply explosion damage to all objects in radius
     * @param {GameObject} explosionSource - Original cause of explosion
     * @returns {Array} List of damage dealt
     */
    applyExplosionDamage(explosionSource) {
        const { affectedObjects } = this.calculateExplosionEffects();
        const damageDealt = [];
        
        affectedObjects.forEach(({ object, distance, damage, damageMultiplier }) => {
            if (damage > 0) {
                // Apply damage based on object type
                if (object.takeDamage && typeof object.takeDamage === 'function') {
                    object.takeDamage(damage, this);
                } else if (object.hp !== undefined) {
                    object.hp = Math.max(0, object.hp - damage);
                }
                
                // Notify explosion damage event
                EventManager.instance.notify(EVENT.EXPLOSION_DAMAGE, {
                    source: this,
                    target: object,
                    damage: damage,
                    distance: distance,
                    explosionType: 'barrel',
                    damageMultiplier: damageMultiplier
                });
                
                damageDealt.push({
                    target: object,
                    damage: damage,
                    distance: distance
                });
                
                // Chain reaction for other barrels
                if (object instanceof Barrel && 
                    GAMECONFIG.SCENERY.BARREL_EXPLOSION.CHAIN_REACTION && 
                    !object.hasExploded) {
                    // Delay chain explosion slightly for visual effect
                    setTimeout(() => {
                        if (!object.hasExploded) {
                            object.explode(this);
                        }
                    }, 100 + Math.random() * 200);
                }
            }
        });
        
        return damageDealt;
    }

    /**
     * Play barrel explosion sound effect
     */
    playExplosionSound() {
        try {
            const audioConfig = GAMECONFIG.AUDIO.BARREL_EXPLOSION;
            
            EventManager.instance.notify(EVENT.AUDIO_PLAY, {
                soundId: 'barrel_explosion',
                volume: audioConfig.VOLUME,
                position: this.position.clone(),
                loop: false,
                soundPath: audioConfig.PATH,
                distanceFalloff: audioConfig.DISTANCE_FALLOFF,
                maxDistance: audioConfig.MAX_DISTANCE
            });
        } catch (error) {
            console.error('Error playing barrel explosion sound:', error);
        }
    }

    /**
     * Create visual explosion effects
     */
    createExplosionEffects() {
        // TODO: Integrate with EffectManager for particle effects
        // For now, create simple visual indicators
        
        if (Game.instance && Game.instance.scene) {
            // Create temporary explosion sphere for visual feedback
            const explosionGeometry = new THREE.SphereGeometry(this.explosionRadius, 16, 16);
            const explosionMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6600,
                transparent: true,
                opacity: 0.3
            });
            const explosionSphere = new THREE.Mesh(explosionGeometry, explosionMaterial);
            explosionSphere.position.copy(this.position);
            
            Game.instance.scene.add(explosionSphere);
            
            // Animate and remove explosion sphere
            const animateExplosion = () => {
                explosionSphere.scale.multiplyScalar(1.1);
                explosionMaterial.opacity *= 0.9;
                
                if (explosionMaterial.opacity > 0.01) {
                    requestAnimationFrame(animateExplosion);
                } else {
                    Game.instance.scene.remove(explosionSphere);
                    explosionGeometry.dispose();
                    explosionMaterial.dispose();
                }
            };
            
            animateExplosion();
        }
    }

    /**
     * Check if position is within explosion radius
     * @param {THREE.Vector3} position - Position to check
     * @returns {boolean} True if within explosion radius
     */
    isInExplosionRadius(position) {
        return this.position.distanceTo(position) <= this.explosionRadius;
    }

    /**
     * Get explosion info for AI/game logic
     * @returns {Object} Explosion information
     */
    getExplosionInfo() {
        return {
            canExplode: this.canExplode,
            hasExploded: this.hasExploded,
            explosionRadius: this.explosionRadius,
            explosionDamage: this.explosionDamage,
            position: this.position.clone(),
            hp: this.hp,
            maxHP: this.maxHP
        };
    }
}

export { Barrel }; 
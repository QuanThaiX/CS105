// ./class/Barrel.js
import * as THREE from 'three';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { GameObject } from './GameObject.js';
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT, HITBOX_SCALE } from '../utils.js';
import { ModelLoader } from '../loader.js';
import { GAMECONFIG } from '../config.js';
import { CollisionManager } from './CollisionManager.js';
class Barrel extends GameObject {
    constructor(id, position, scale = 1, rotation = 0, barrelType = 'barrel') {
        super(id, 'neutral', position, true);
        this.scale = scale;
        this.barrelType = barrelType;
        this.rotation = rotation; 
        this.hitBoxScale = HITBOX_SCALE.BARREL;
        
        // Explosion properties
        this.canExplode = true;
        this.hasExploded = false;
        this.explosionRadius = GAMECONFIG.SCENERY.BARREL_EXPLOSION.RADIUS * this.scale;
        this.explosionDamage = GAMECONFIG.SCENERY.BARREL_EXPLOSION.DAMAGE;
        this.explosionForce = GAMECONFIG.SCENERY.BARREL_EXPLOSION.PUSH_FORCE;
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
                            
                            // Cải thiện material cho thùng để tạo shadow và hiệu ứng metal nhẹ
                            if (child.material) {
                                if (child.material.isMeshStandardMaterial) {
                                    child.material.roughness = 0.6; // Thùng có bề mặt hơi nhám
                                    child.material.metalness = 0.3; // Thùng có một chút kim loại
                                } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                    // Chuyển đổi sang MeshStandardMaterial để có shadow tốt hơn
                                    const newMaterial = new THREE.MeshStandardMaterial({
                                        map: child.material.map,
                                        color: child.material.color,
                                        roughness: 0.6,
                                        metalness: 0.3
                                    });
                                    child.material = newMaterial;
                                }
                            }
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
                        
                        // Cải thiện material cho thùng để tạo shadow và hiệu ứng metal nhẹ
                        if (child.material) {
                            if (child.material.isMeshStandardMaterial) {
                                child.material.roughness = 0.6; // Thùng có bề mặt hơi nhám
                                child.material.metalness = 0.3; // Thùng có một chút kim loại
                            } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                // Chuyển đổi sang MeshStandardMaterial để có shadow tốt hơn
                                const newMaterial = new THREE.MeshStandardMaterial({
                                    map: child.material.map,
                                    color: child.material.color,
                                    roughness: 0.6,
                                    metalness: 0.3
                                });
                                child.material = newMaterial;
                            }
                        }
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
        CollisionManager.instance.notifyObjectStateChange(this);
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
                if (object.takeDamage && typeof object.takeDamage === 'function') {
                    object.takeDamage(damage, this);
                } else if (object.hp !== undefined) {
                    object.hp = Math.max(0, object.hp - damage);
                }
                
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
                
                if (object instanceof Barrel && 
                    GAMECONFIG.SCENERY.BARREL_EXPLOSION.CHAIN_REACTION && 
                    !object.hasExploded) {
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
// In Barrel.js

    createExplosionEffects() {
        const scene = Game.instance.scene;
        if (!scene) return;

        const explosionPosition = this.position.clone();
        const clock = new THREE.Clock();

        const flashLight = new THREE.PointLight(0xffa500, 250, 100, 2); 
        flashLight.position.copy(explosionPosition);
        scene.add(flashLight);


        const particleCount = 1000;
        const particlesGeometry = new THREE.BufferGeometry();
        const posArray = new Float32Array(particleCount * 3);
        const velocities = [];
        const particleColors = new Float32Array(particleCount * 3);

        const coreColor = new THREE.Color(0xff4500); // Fiery orange-red
        const sparkColor = new THREE.Color(0xffff00); // Bright yellow

        for (let i = 0; i < particleCount; i++) {
            // All particles start at the center
            posArray[i * 3 + 0] = 0;
            posArray[i * 3 + 1] = 0;
            posArray[i * 3 + 2] = 0;

            // Give each particle a random outward velocity.
            // Using a sphere distribution for a nice round explosion.
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.sin(phi) * Math.sin(theta);
            const z = Math.cos(phi);

            const velocity = new THREE.Vector3(x, y, z);
            velocity.multiplyScalar(Math.random() * 15 + 5); // Random speed between 5 and 20
            velocities.push(velocity);

            const color = Math.random() > 0.7 ? sparkColor : coreColor;
            particleColors[i * 3 + 0] = color.r;
            particleColors[i * 3 + 1] = color.g;
            particleColors[i * 3 + 2] = color.b;
        }
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.9,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            sizeAttenuation: true,
            opacity: 0.9
        });

        const sparks = new THREE.Points(particlesGeometry, particleMaterial);
        sparks.position.copy(explosionPosition);
        scene.add(sparks);



        const shockwaveGeometry = new THREE.RingGeometry(1, 1.2, 64);
        const shockwaveMaterial = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
        shockwave.position.copy(explosionPosition).add(new THREE.Vector3(0, 0.1, 0));
        shockwave.rotation.x = -Math.PI / 2;
        scene.add(shockwave);


        let duration = 1.2;
        let elapsed = 0;

        const animateExplosion = () => {
            const dt = clock.getDelta();
            elapsed += dt;

            if (elapsed > duration) {
                scene.remove(sparks);
                scene.remove(flashLight);
                scene.remove(shockwave);
                sparks.geometry.dispose();
                sparks.material.dispose();
                shockwave.geometry.dispose();
                shockwave.material.dispose();
                flashLight.dispose();
                return;
            }

            const progress = elapsed / duration;
            const easeOutQuad = (t) => t * (2 - t); 
            const easedProgress = easeOutQuad(progress);

            flashLight.intensity = 500 * (1 - easedProgress);

            particleMaterial.opacity = 1.0 - progress;
            const positions = sparks.geometry.attributes.position.array;
            for (let i = 0; i < particleCount; i++) {
                velocities[i].y -= 9.8 * dt * 0.5;

                positions[i * 3 + 0] += velocities[i].x * dt;
                positions[i * 3 + 1] += velocities[i].y * dt;
                positions[i * 3 + 2] += velocities[i].z * dt;
            }
            sparks.geometry.attributes.position.needsUpdate = true;
            
            const shockwaveRadius = this.explosionRadius * easedProgress;
            shockwave.scale.set(shockwaveRadius, shockwaveRadius, 1);
            shockwave.material.opacity = 0.8 * (1 - progress);

            requestAnimationFrame(animateExplosion);
        };

        animateExplosion();
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
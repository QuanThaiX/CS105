import * as THREE from 'three';
import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';
import { Game } from './Game.js';

class Effect {
    static instance;

    constructor() {
        if (Effect.instance) {
            return Effect.instance;
        }
        Effect.instance = this;
        
        this.registerEventListeners();
    }
    
    registerEventListeners() {
        EventManager.instance.subscribe(EVENT.TANK_DESTROYED, this.handleTankDestroyed.bind(this));
        EventManager.instance.subscribe(EVENT.OBJECT_SHOOT, this.handleObjectShoot.bind(this));
    }
    
    handleTankDestroyed(data) {
        const { tank } = data;
        this.createExplosion(tank.position, 10, { particleCount: 10000 });
    }
    
    handleObjectShoot(data) {
        const { position, direction } = data;
        if (position && direction) {
            this.createMuzzleFlash(position, direction);
        }
    }
    
    createExplosion(position, size = 1, options = {}) {
        return new Explosion(Game.instance.scene, position, size, options);
    }
    
    createMuzzleFlash(position, direction, options = {}) {
        return new MuzzleFlash(Game.instance.scene, position, direction, options);
    }
}

const EXPLOSION_DEFAULTS = {
    particleCount: 500,   // Number of particles
    maxLife: 1.5,         // Maximum particle lifetime (seconds)
    baseSpeed: 15,        // Base particle speed
    gravity: -9.8,        // Gravity (negative pulls down)
    particleBaseSize: 0.5,// Base particle size on screen
    colors: [             // Array of possible particle colors
        new THREE.Color(0xffa000), // Orange
        new THREE.Color(0xff4000), // Red-Orange
        new THREE.Color(0xffc040), // Yellow-Orange
        new THREE.Color(0x444444), // Dark Gray (smoke)
        new THREE.Color(0x888888), // Gray (smoke)
    ],
    texture: createParticleTexture() // Particle texture (soft circle)
};

function createParticleTexture(size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
        console.error("Could not get 2D context for particle texture");
        return new THREE.Texture(); // Return empty texture on error
    }
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return new THREE.CanvasTexture(canvas);
}

class EffectInstance {
    constructor(scene) {
        this.scene = scene;
        this.alive = true;
    }

    update() {
    }

    dispose() {
        this.alive = false;
    }
}

class Explosion extends EffectInstance {
    constructor(scene, originPosition, size = 1, options = {}) {
        super(scene);
        this.origin = originPosition.clone(); // Explosion start position
        this.size = size;                     // Scale factor (affects radius/speed)
        this.options = { ...EXPLOSION_DEFAULTS, ...options }; // Merge default and custom options

        this.particlesData = [];
        this.geometry = null; // Will be created in _createParticles
        this.material = null; // Will be created in _createParticles
        this.points = null;   // Will be created in _createParticles
        this.clock = new THREE.Clock();
        this._animationFrameId = null; // To store the requestAnimationFrame ID

        // --- Setup ---
        this._createParticles();    // Create geometry, material, points object
        this._initializeParticles(); // Set initial particle properties (position, velocity, color, life)

        // Add the particle system to the scene immediately
        this.scene.add(this.points);

        // Bind the _animate function to ensure 'this' context is correct
        this._animate = this._animate.bind(this);

        // Start the animation loop
        this._animate();
    }

    _createParticles() {
        const particleCount = this.options.particleCount;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const alphas = new Float32Array(particleCount); // For controlling fade-out

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1)); // Add alpha attribute

        this.material = new THREE.PointsMaterial({
            size: this.options.particleBaseSize,
            map: this.options.texture,
            vertexColors: true,     // Use colors from 'color' attribute
            transparent: true,      // Allow transparency
            depthWrite: false,      // Disable writing to depth buffer for better blending
            blending: THREE.AdditiveBlending, // Bright effect when particles overlap
            sizeAttenuation: true   // Particle size changes with distance
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.position.copy(this.origin); // Set the initial position of the Points object
    }

    _initializeParticles() {
        const positionAttribute = this.geometry.attributes.position;
        const colorAttribute = this.geometry.attributes.color;
        const alphaAttribute = this.geometry.attributes.alpha;

        for (let i = 0; i < this.options.particleCount; i++) {
            // Initial position (relative to the Points object's origin)
            positionAttribute.setXYZ(i, 0, 0, 0);

            // Random velocity
            const direction = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random(), // Slightly biased upwards
                Math.random() - 0.5
            ).normalize();

            // Speed influenced by base speed, size, and randomness
            const speed = this.options.baseSpeed * this.size * (0.5 + Math.random() * 0.7);
            const velocity = direction.multiplyScalar(speed);

            // Random color from the options
            const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];
            colorAttribute.setXYZ(i, color.r, color.g, color.b);

            // Initial alpha
            alphaAttribute.setX(i, 1.0); // Start fully opaque

            // Store data for updates
            const initialLife = this.options.maxLife * (0.7 + Math.random() * 0.3); // Random lifespan
            this.particlesData.push({
                velocity: velocity,
                initialLife: initialLife,
                life: initialLife // Current life starts at full
            });
        }

        // Mark attributes as needing update
        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        alphaAttribute.needsUpdate = true;
    }

    // --- Animation Loop Function ---
    _animate() {
        // Stop the loop if the explosion is no longer alive
        if (!this.alive) {
            return;
        }

        // Request the next frame *before* doing the work for this frame
        // This keeps the loop going even if update() takes time
        this._animationFrameId = requestAnimationFrame(this._animate);

        // Update the particle states
        this.update();
    }

    // --- Update Logic (called each frame by _animate) ---
    update() {
        const deltaTime = this.clock.getDelta();
        // Ensure deltaTime is not excessively large (e.g., after tab switching)
        const dt = Math.min(deltaTime, 0.1); // Cap delta time to avoid large jumps

        const positionAttribute = this.geometry.attributes.position;
        const alphaAttribute = this.geometry.attributes.alpha;

        let liveParticles = 0;

        for (let i = 0; i < this.options.particleCount; i++) {
            const data = this.particlesData[i];

            // Only process particles that are still "alive" (life > 0)
            if (data.life > 0) {
                data.life -= dt; // Decrease life by time elapsed

                if (data.life <= 0) {
                    // Particle died this frame
                    alphaAttribute.setX(i, 0); // Make it fully transparent
                    // Optional: Could also move its position far away (positionAttribute.setXYZ(i, Infinity, Infinity, Infinity))
                    // but setting alpha to 0 is usually sufficient and cheaper.
                } else {
                    // Particle is still alive
                    liveParticles++;

                    // Update position based on velocity
                    const currentPos = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
                    currentPos.addScaledVector(data.velocity, dt);
                    positionAttribute.setXYZ(i, currentPos.x, currentPos.y, currentPos.z);

                    // Apply simple gravity
                    data.velocity.y += this.options.gravity * dt;

                    // Update Alpha for fade-out effect
                    // Using lifeRatio squared makes it fade faster towards the end
                    const lifeRatio = Math.max(0, data.life / data.initialLife);
                    alphaAttribute.setX(i, lifeRatio * lifeRatio);
                }
            }
        }

        // Mark attributes as needing GPU update
        positionAttribute.needsUpdate = true;
        alphaAttribute.needsUpdate = true;

        // If no particles are left alive and we haven't disposed yet, trigger cleanup
        if (liveParticles === 0 && this.alive) {
            this.dispose();
        }
    }

    // --- Cleanup ---
    dispose() {
        // Prevent dispose from running multiple times
        if (!this.alive) return;
        super.dispose(); // Call parent dispose method

        console.log("Disposing explosion");

        // Stop the animation loop
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }

        // Remove from scene
        if (this.points && this.scene) {
            this.scene.remove(this.points);
        }

        // Dispose Three.js resources
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }
        if (this.material) {
            // Dispose texture ONLY if it was created by this instance
            // or if you know it's safe to do so. The default one is shared.
            // If using custom textures per explosion, uncomment the map.dispose() line.
            // if (this.material.map && this.material.map !== EXPLOSION_DEFAULTS.texture) {
            //     this.material.map.dispose();
            // }
            this.material.dispose();
            this.material = null;
        }

        // Clear internal data
        this.particlesData = [];
        this.points = null;
        this.scene = null; // Release scene reference if no longer needed
        this.clock = null; // Release clock reference
        
        // Notify that explosion was disposed
        EventManager.instance.notify(EVENT.EFFECT_DISPOSED, {
            type: 'explosion'
        });
    }
}

// --- MuzzleFlash Effect Class ---
class MuzzleFlash extends EffectInstance {
    constructor(scene, position, direction, options = {}) {
        super(scene);
        this.position = position.clone();
        this.direction = direction.clone();
        
        // Default options
        this.options = {
            color: options.color || 0xffaa00,
            intensity: options.intensity || 40,
            distance: options.distance || 10,
            duration: options.duration || 100, // milliseconds
            particleCount: options.particleCount || 20,
            particleSize: options.particleSize || 0.2,
            ...options
        };
        
        this._createEffect();
        
        setTimeout(() => {
            this.dispose();
        }, this.options.duration);
    }
    
    _createEffect() {
        this.light = new THREE.PointLight(
            this.options.color, 
            this.options.intensity, 
            this.options.distance
        );
        this.light.position.copy(this.position);
        this.scene.add(this.light);
        
        // Create particles
        const particleGeometry = new THREE.BufferGeometry();
        const posArray = new Float32Array(this.options.particleCount * 3);
        
        for (let i = 0; i < this.options.particleCount; i++) {
            const i3 = i * 3;
            posArray[i3] = this.position.x + (Math.random() - 0.5) * 0.5;
            posArray[i3 + 1] = this.position.y + (Math.random() - 0.5) * 0.5;
            posArray[i3 + 2] = this.position.z + (Math.random() - 0.5) * 0.5;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: this.options.color,
            size: this.options.particleSize,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(this.particles);
    }
    
    dispose() {
        if (!this.alive) return;
        super.dispose();
        
        if (this.light && this.scene) {
            this.scene.remove(this.light);
            this.light = null;
        }
        
        if (this.particles && this.scene) {
            this.scene.remove(this.particles);
            if (this.particles.geometry) this.particles.geometry.dispose();
            if (this.particles.material) this.particles.material.dispose();
            this.particles = null;
        }
    }
}

export { Effect, Explosion, MuzzleFlash };
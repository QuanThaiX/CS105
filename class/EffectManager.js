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
        this.createExplosion(tank.position, 0.7, { particleCount: 800 });
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
    // General
    particleCount: 500,   
    maxLife: 1.5,         // Maximum particle lifetime (seconds)
    baseSpeed: 15,        // Base particle speed
    gravity: -9.8,        // Gravity (negative pulls down)
    particleBaseSize: 0.5,// Base particle size
    colors: [             // Array of possible particle colors
        new THREE.Color(0xffa000), // Orange
        new THREE.Color(0xff4000), // Red-Orange
        new THREE.Color(0xffc040), // Yellow-Orange
    ],
    // Light
    addLight: true,       // Whether to add a light flash
    lightColor: 0xffa000, // Bright orange-yellow
    lightIntensity: 2000,  // Very bright initially
    lightDistance: 50,    // How far the light reaches
    texture: createParticleTexture()
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
        this.origin = originPosition.clone();
        this.size = size;
        this.options = { ...EXPLOSION_DEFAULTS, ...options };

        this.light = null;
        this.particlesData = [];
        this.geometry = null;
        this.material = null;
        this.points = null;
        
        this.clock = new THREE.Clock();
        this._animationFrameId = null;

        // --- Setup ---
        if (this.options.addLight) {
            this._createLight();
        }
        this._createParticles();
        this._initializeParticles();

        // Add created objects to the scene
        if (this.light) this.scene.add(this.light);
        if (this.points) this.scene.add(this.points);

        this._animate = this._animate.bind(this);
        this._animate();
    }

    _createLight() {
        this.light = new THREE.PointLight(
            this.options.lightColor,
            this.options.lightIntensity * this.size,
            this.options.lightDistance * this.size
        );
        this.light.position.copy(this.origin);
    }

    _createParticles() {
        const particleCount = this.options.particleCount;
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(particleCount), 1));

        this.material = new THREE.PointsMaterial({
            size: this.options.particleBaseSize * this.size,
            map: this.options.texture,
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending, // Glowing effect
            sizeAttenuation: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.position.copy(this.origin);
    }

    _initializeParticles() {
        const positionAttribute = this.geometry.attributes.position;
        const colorAttribute = this.geometry.attributes.color;
        const alphaAttribute = this.geometry.attributes.alpha;

        for (let i = 0; i < this.options.particleCount; i++) {
            positionAttribute.setXYZ(i, 0, 0, 0);

            const direction = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random(), // Slightly biased upwards
                Math.random() - 0.5
            ).normalize();

            const speed = this.options.baseSpeed * this.size * (0.5 + Math.random() * 0.7);
            const velocity = direction.multiplyScalar(speed);

            const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
            alphaAttribute.setX(i, 1.0);

            const initialLife = this.options.maxLife * (0.7 + Math.random() * 0.3);
            this.particlesData.push({
                velocity: velocity,
                initialLife: initialLife,
                life: initialLife
            });
        }
    }
    
    _animate() {
        if (!this.alive) return;
        this._animationFrameId = requestAnimationFrame(this._animate);
        this.update();
    }

    update() {
        const deltaTime = this.clock.getDelta();
        const dt = Math.min(deltaTime, 0.1);
        const elapsedTime = this.clock.getElapsedTime();

        // --- Update Light ---
        if (this.light && this.light.visible) {
            const lifeRatio = Math.min(elapsedTime / (this.options.maxLife * 0.25), 1.0);
            const decay = Math.pow(1.0 - lifeRatio, 2.0);
            this.light.intensity = this.options.lightIntensity * this.size * decay;
            if (this.light.intensity <= 0) {
                this.light.visible = false;
            }
        }
        
        // --- Update Particles ---
        const positionAttribute = this.geometry.attributes.position;
        const alphaAttribute = this.geometry.attributes.alpha;
        let liveParticles = 0;

        for (let i = 0; i < this.options.particleCount; i++) {
            const data = this.particlesData[i];
            if (data.life > 0) {
                data.life -= dt;
                if (data.life <= 0) {
                    alphaAttribute.setX(i, 0);
                } else {
                    liveParticles++;
                    const currentPos = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
                    currentPos.addScaledVector(data.velocity, dt);
                    positionAttribute.setXYZ(i, currentPos.x, currentPos.y, currentPos.z);
                    data.velocity.y += this.options.gravity * dt;
                    const lifeRatio = Math.max(0, data.life / data.initialLife);
                    alphaAttribute.setX(i, lifeRatio * lifeRatio);
                }
            }
        }
        positionAttribute.needsUpdate = true;
        alphaAttribute.needsUpdate = true;

        if (liveParticles === 0 && this.alive) {
            this.dispose();
        }
    }

    dispose() {
        if (!this.alive) return;
        super.dispose();

        console.log("Disposing explosion");

        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }

        if (this.light && this.scene) {
            this.scene.remove(this.light);
        }
        this.light = null;

        if (this.points && this.scene) {
            this.scene.remove(this.points);
        }
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();

        this.particlesData = [];
        this.geometry = null;
        this.material = null;
        this.points = null;
        this.scene = null;
        this.clock = null;

        EventManager.instance.notify(EVENT.EFFECT_DISPOSED, {
            type: 'explosion'
        });
    }
}


// --- MuzzleFlash Effect Class (Unchanged) ---
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
            particleCount: options.particleCount || 9,
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
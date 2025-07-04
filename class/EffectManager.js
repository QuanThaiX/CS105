
import * as THREE from 'three';
import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';
import { Game } from './Game.js';
import { gameSettings } from '../config.js';

class CameraShaker {
    constructor(camera) {
        this.camera = camera;
        this.shakeInfo = {
            active: false,
            intensity: 0,
            duration: 0,
            startTime: 0,
        };
        this.shakeOffset = new THREE.Vector3();
    }

    shake(intensity, duration) {
        if (!gameSettings.cameraShake) return;

        if (this.shakeInfo.active && this.shakeInfo.intensity > intensity) {
            return;
        }
        this.shakeInfo.active = true;
        this.shakeInfo.intensity = intensity;
        this.shakeInfo.duration = duration;
        this.shakeInfo.startTime = performance.now();
    }

    update() {
        if (!this.shakeInfo.active || !this.camera) {
            if (this.shakeOffset.lengthSq() > 0 && this.camera) {
                this.camera.position.sub(this.shakeOffset);
                this.shakeOffset.set(0, 0, 0);
            }
            return;
        }

        const now = performance.now();
        const elapsed = (now - this.shakeInfo.startTime) / 1000;

        if (elapsed >= this.shakeInfo.duration) {
            this.shakeInfo.active = false;
            if (this.camera) {
                this.camera.position.sub(this.shakeOffset);
            }
            this.shakeOffset.set(0, 0, 0);
            return;
        }

        const progress = elapsed / this.shakeInfo.duration;
        const currentIntensity = this.shakeInfo.intensity * (1 - progress);

        this.camera.position.sub(this.shakeOffset);

        const x = (Math.random() - 0.5) * 2 * currentIntensity;
        const y = (Math.random() - 0.5) * 2 * currentIntensity;
        const z = (Math.random() - 0.5) * 2 * currentIntensity;
        this.shakeOffset.set(x, y, z);

        this.camera.position.add(this.shakeOffset);
    }
}


class Effect {
    static instance;
    cameraShaker;

    constructor() {
        if (Effect.instance) {
            return Effect.instance;
        }
        Effect.instance = this;

        this.boundHandleTankDestroyed = this.handleTankDestroyed.bind(this);
        this.boundHandleObjectShoot = this.handleObjectShoot.bind(this);
        this.boundHandleBarrelExploded = this.handleBarrelExploded.bind(this);

        this.registerEventListeners();
    }

    initCameraShaker(camera) {
        this.cameraShaker = new CameraShaker(camera);
    }

    update() {
        if (this.cameraShaker) {
            this.cameraShaker.update();
        }
    }

    registerEventListeners() {
        EventManager.instance.subscribe(EVENT.TANK_DESTROYED, this.boundHandleTankDestroyed);
        EventManager.instance.subscribe(EVENT.OBJECT_SHOOT, this.boundHandleObjectShoot);
        EventManager.instance.subscribe(EVENT.BARREL_EXPLODED, this.boundHandleBarrelExploded);
    }

    handleBarrelExploded(data) {
        const { barrel } = data;
        const player = Game.instance.playerTank;
        if (!player || !this.cameraShaker) return;

        const distance = player.position.distanceTo(barrel.position);
        const maxShakeDistance = 50;
        if (distance < maxShakeDistance) {
            const intensity = 0.5 * (1 - (distance / maxShakeDistance));
            this.cameraShaker.shake(intensity, 0.6);
        }
    }

    handleTankDestroyed(data) {
        const { tank } = data;
        this.createExplosion(tank.position, 0.7, { particleCount: 800 });

        const player = Game.instance.playerTank;
        if (!player || !this.cameraShaker) return;

        const distance = player.position.distanceTo(tank.position);
        const maxShakeDistance = 60;
        if (distance < maxShakeDistance) {
            const intensity = 0.6 * (1 - (distance / maxShakeDistance));
            this.cameraShaker.shake(intensity, 0.7);
        }
    }

    handleObjectShoot(data) {
        const { tank, position, direction } = data;
        if (position && direction) {
            this.createMuzzleFlash(position, direction);
        }

        if (tank && tank.faction === 'player' && this.cameraShaker) {
            this.cameraShaker.shake(0.08, 0.2);
        }
    }

    createExplosion(position, size = 1, options = {}) {
        return new Explosion(Game.instance.scene, position, size, options);
    }

    createMuzzleFlash(position, direction, options = {}) {
        return new MuzzleFlash(Game.instance.scene, position, direction, options);
    }

    dispose() {
        if (EventManager.instance) {
            EventManager.instance.unsubscribe(EVENT.TANK_DESTROYED, this.boundHandleTankDestroyed);
            EventManager.instance.unsubscribe(EVENT.OBJECT_SHOOT, this.boundHandleObjectShoot);
            EventManager.instance.unsubscribe(EVENT.BARREL_EXPLODED, this.boundHandleBarrelExploded);
        }
        this.cameraShaker = null;
        Effect.instance = null;
    }
}

const EXPLOSION_DEFAULTS = {

    particleCount: 500,
    maxLife: 1.5,
    baseSpeed: 15,
    gravity: -9.8,
    particleBaseSize: 0.5,
    colors: [
        new THREE.Color(0xffa000),
        new THREE.Color(0xff4000),
        new THREE.Color(0xffc040),
    ],

    addLight: true,
    lightColor: 0xffa000,
    lightIntensity: 2000,
    lightDistance: 50,
    texture: createParticleTexture(),
    addShockwave: true,
    shockwaveColor: 0xffffff,
    shockwaveDuration: 0.8,
    shockwaveInitialRadius: 0.2,
    shockwaveMaxRadius: 15,
    shockwaveThickness: 1.5,
};

function createParticleTexture(size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
        console.error("Could not get 2D context for particle texture");
        return new THREE.Texture();
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
        this.shockwave = null;

        this.clock = new THREE.Clock();
        this._animationFrameId = null;

        if (this.options.addLight) {
            this._createLight();
        }
        if (this.options.addShockwave) {
            this._createShockwave();
        }
        this._createParticles();
        this._initializeParticles();

        if (this.light) this.scene.add(this.light);
        if (this.shockwave) this.scene.add(this.shockwave);
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

    _createShockwave() {
        const geometry = new THREE.RingGeometry(
            this.options.shockwaveInitialRadius,
            this.options.shockwaveInitialRadius - this.options.shockwaveThickness * this.size,
            64
        );

        const material = new THREE.MeshBasicMaterial({
            color: this.options.shockwaveColor,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });

        this.shockwave = new THREE.Mesh(geometry, material);
        this.shockwave.position.copy(this.origin).add(new THREE.Vector3(0, 0.1, 0));
        this.shockwave.rotation.x = -Math.PI / 2;
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
            blending: THREE.AdditiveBlending,
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
                Math.random(),
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


        if (this.light && this.light.visible) {
            const lifeRatio = Math.min(elapsedTime / (this.options.maxLife * 0.25), 1.0);
            const decay = Math.pow(1.0 - lifeRatio, 2.0);
            this.light.intensity = this.options.lightIntensity * this.size * decay + 1000;
            if (this.light.intensity <= 0) {
                this.light.visible = false;
            }
        }

        if (this.shockwave && this.shockwave.visible) {
            const shockwaveLife = Math.min(elapsedTime / this.options.shockwaveDuration, 1.0);

            const currentRadius = THREE.MathUtils.lerp(
                this.options.shockwaveInitialRadius,
                this.options.shockwaveMaxRadius * this.size,
                shockwaveLife
            );
            this.shockwave.scale.set(currentRadius, currentRadius, currentRadius);


            this.shockwave.material.opacity = Math.pow(1.0 - shockwaveLife, 2.0);

            if (shockwaveLife >= 1.0) {
                this.shockwave.visible = false;
            }
        }

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

        if (liveParticles === 0 && this.alive && (!this.shockwave || !this.shockwave.visible)) {
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

        if (this.light && this.scene) this.scene.remove(this.light);
        this.light = null;

        if (this.shockwave) {
            if (this.scene) this.scene.remove(this.shockwave);
            this.shockwave.geometry.dispose();
            this.shockwave.material.dispose();
            this.shockwave = null;
        }

        if (this.points && this.scene) this.scene.remove(this.points);
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


class MuzzleFlash extends EffectInstance {
    constructor(scene, position, direction, options = {}) {
        super(scene);
        this.position = position.clone();
        this.direction = direction.clone();


        this.options = {
            color: options.color || 0xffaa00,
            intensity: options.intensity || 40,
            distance: options.distance || 10,
            duration: options.duration || 100,
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
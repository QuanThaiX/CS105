// ./class/Bullet.js
import * as THREE from "three";
import { COLOR, EVENT } from "../utils.js";
import { CollisionManager } from "./CollisionManager.js";
import { Tank } from './Tank.js';
import { Game } from './Game.js';
import { GameObject } from "./GameObject.js";
import { EventManager} from "./EventManager.js";
import { Rock } from "./Rock.js";
import { Tree } from "./Tree.js";
import { Barrel } from "./Barrel.js"; // Added Barrel import

class Bullet extends GameObject{
  static count = 0;
  hasCollided = false;
  damage = 100;
  shooter = null; // Reference to the entity that fired the bullet
  color;
  velocity; // Keep velocity for lookAt calculation

  trail;
  trailPoints = [];
  trailLength = 20;

  constructor(faction, position, color) {
    const id = "Bullet" + (Bullet.count++);
    super(id, faction, position, true);

    this.color = color || COLOR.orange;
    this.velocity = new THREE.Vector3(); // Initialized but set by Manager

    this.setModel(this.createTracerHead());
    this.createTrail();

    CollisionManager.instance.add(this);
  }

  onHit(otherObject) {
    if (this.hasCollided) return;
    this.hasCollided = true;
    this.createImpactEffect();
    // Do not call dispose here. The manager will do it.
  }

  // createTracerHead() and createTrail() remain the same
  createTracerHead() {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 2,
      metalness: 0.5,
      roughness: 0.5
    });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.position);
    mesh.castShadow = true;

    const light = new THREE.PointLight(this.color, 20, 20);
    light.position.set(0, 0, 0);
    mesh.add(light);

    return mesh;
  }

  createTrail() {
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
    });
    this.trail = new THREE.Line(trailGeometry, trailMaterial);
    Game.instance.scene.add(this.trail);
  }

  // updateTrail() remains the same
  updateTrail() {
    this.trailPoints.push(this.position.clone());
    while (this.trailPoints.length > this.trailLength) {
      this.trailPoints.shift();
    }

    const positions = [];
    const colors = [];
    const trailColor = new THREE.Color(this.color);

    for (let i = 0; i < this.trailPoints.length; i++) {
      const p = this.trailPoints[i];
      positions.push(p.x, p.y, p.z);
      const alpha = i / this.trailPoints.length;
      colors.push(trailColor.r, trailColor.g, trailColor.b, alpha);
    }

    this.trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.trail.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }

  /**
   * The update method is now empty, as all logic is handled by the worker
   * and applied by the ProjectilesManager.
   */
  update() {
    // No-op
  }

  // Collision logic remains on the main thread
  handleCollision({ objA, objB }) {
    if (this.hasCollided) return;

    if (objA === this || objB === this) {
      const otherObject = objA === this ? objB : objA;
      // Do not collide with the entity that shot the bullet
      if (otherObject === this.shooter) return;

      if (
        (otherObject instanceof Tank && this.faction !== otherObject.faction) ||
        otherObject instanceof Rock ||
        otherObject instanceof Tree ||
        (otherObject instanceof Barrel && !otherObject.hasExploded)
      ) {
        this.onHit(otherObject);
      }
    }
  }

  // createImpactEffect() remains the same
  createImpactEffect() {
    const scene = Game.instance.scene;
    const impactPosition = this.position;
    const flashLight = new THREE.PointLight(0xffffff, 20, 15, 2);
    flashLight.position.copy(impactPosition);
    scene.add(flashLight);
    const particleCount = 60;
    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const velocities = [];
    for (let i = 0; i < particleCount; i++) {
        posArray[i * 3 + 0] = 0;
        posArray[i * 3 + 1] = 0;
        posArray[i * 3 + 2] = 0;
        const velocity = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
        velocity.normalize().multiplyScalar(Math.random() * 0.3 + 0.1);
        velocities.push(velocity);
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMaterial = new THREE.PointsMaterial({
        color: this.color,
        size: 0.15,
        blending: THREE.AdditiveBlending,
        transparent: true,
        sizeAttenuation: true,
    });
    const sparks = new THREE.Points(particlesGeometry, particleMaterial);
    sparks.position.copy(impactPosition);
    scene.add(sparks);
    let duration = 0.7;
    let elapsed = 0;
    const clock = new THREE.Clock();
    const animate = () => {
        const dt = clock.getDelta();
        elapsed += dt;
        if (elapsed > duration) {
            scene.remove(sparks);
            scene.remove(flashLight);
            sparks.geometry.dispose();
            sparks.material.dispose();
            return;
        }
        const progress = elapsed / duration;
        flashLight.intensity = 20 * (1 - progress);
        particleMaterial.opacity = 1 - progress;
        const positions = sparks.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 0] += velocities[i].x * dt * 10;
            positions[i * 3 + 1] += velocities[i].y * dt * 10;
            positions[i * 3 + 2] += velocities[i].z * dt * 10;
        }
        sparks.geometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animate);
    };
    animate();
  }

  dispose() {
    // Unsubscribe and remove from CollisionManager
    CollisionManager.instance.remove(this);

    // Clean up Three.js resources
    if (this.trail) {
      if (this.trail.parent) this.trail.parent.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail.material.dispose();
      this.trail = null;
    }

    // Call super.dispose() which handles the main model
    super.dispose();
  }
}

export { Bullet };
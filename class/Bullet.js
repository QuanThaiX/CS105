import * as THREE from "three";
import { COLOR, EVENT, FACTION}  from "../utils.js";
import { GLTFLoader } from "../three/examples/jsm/loaders/GLTFLoader.js";
import { CollisionManager } from "./CollisionManager.js";
import { Tank } from './Tank.js';
import { Game } from './Game.js';
import { GameObject } from "./GameObject.js";
import { EventManager} from "./EventManager.js";
import { Rock } from "./Rock.js";
import { Tree } from "./Tree.js";

class Bullet extends GameObject{
  static count = 0;
  prevPosition;
  velocity;
  lifeTime = 5000;
  creationTime;
  hasCollided = false;
  damage = 100;
  boundHandleCollision;

  trail;
  trailPoints = [];
  trailLength = 20; 


  constructor(faction, position) {
    super("Bullet" + Bullet.count, faction, position, true);
    
    this.prevPosition = this.position.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.creationTime = Date.now();


    this.setModel(this.createTracerHead());
    this.createTrail();

    Bullet.count++;
    CollisionManager.instance.add(this);
    // this.boundHandleCollision = this.handleCollision.bind(this);
    // EventManager.instance.subscribe(EVENT.COLLISION, this.boundHandleCollision);
  }

  setVelocity(velocityVector) {
    this.velocity.copy(velocityVector);
  }
  onHit(otherObject) {
    if (this.hasCollided) return;

    this.hasCollided = true;
    this.createImpactEffect();
    this.dispose();
  }
  createTracerHead() {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshStandardMaterial({ 
      color: COLOR.yellow,
      emissive: COLOR.orange,
      emissiveIntensity: 2, 
      metalness: 0.5,
      roughness: 0.5
    });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.position);
    mesh.castShadow = true;


    const light = new THREE.PointLight(COLOR.orange, 5, 5);
    light.position.set(0, 0, 0);
    mesh.add(light);

    return mesh;
  }
  

  createTrail() {
    const trailGeometry = new THREE.BufferGeometry();
    // Use vertex colors to make the trail fade out
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
  

  updateTrail() {
    // Add the bullet's current position to the trail history
    this.trailPoints.push(this.position.clone());
    
    // Limit the number of points in the trail
    while (this.trailPoints.length > this.trailLength) {
      this.trailPoints.shift();
    }

    const positions = [];
    const colors = [];
    const trailColor = new THREE.Color(COLOR.orange);

    for (let i = 0; i < this.trailPoints.length; i++) {
      const p = this.trailPoints[i];
      positions.push(p.x, p.y, p.z);
      
      // Fade the color and alpha along the length of the trail
      const alpha = i / this.trailPoints.length;
      colors.push(trailColor.r, trailColor.g, trailColor.b, alpha);
    }

    this.trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.trail.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }

  update() {
    if (this.hasCollided) {
      return;
    }

    if (this.model) {
      this.prevPosition.copy(this.position);
      this.model.position.add(this.velocity);
      this.position.copy(this.model.position);
      
      this.model.lookAt(this.position.clone().add(this.velocity));

      if (Date.now() - this.creationTime > this.lifeTime){
        EventManager.instance.notify(EVENT.BULLET_EXPIRED, {bullet: this});
      }
    }
    this.updateTrail();

  }

  handleCollision({ objA, objB }) {
    if (this.hasCollided) return; 

    if (objA === this || objB === this) {
      const otherObject = objA === this ? objB : objA;
      
      if ((otherObject instanceof Tank && this.faction !== otherObject.faction) || otherObject instanceof Rock || otherObject instanceof Tree) {
        this.hasCollided = true;
        

        this.createImpactEffect();
        this.dispose();
      }
    }
  }

  // --- VISUAL ENHANCEMENT: Replaced the simple sphere with a particle explosion ---
  createImpactEffect() {
    const scene = Game.instance.scene;
    const impactPosition = this.position;
    
    // 1. Create a bright flash of light
    const flashLight = new THREE.PointLight(0xffffff, 20, 15, 2);
    flashLight.position.copy(impactPosition);
    scene.add(flashLight);
    
    // 2. Create sparks using a particle system
    const particleCount = 60;
    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      // Start all particles at the impact point
      posArray[i * 3 + 0] = 0;
      posArray[i * 3 + 1] = 0;
      posArray[i * 3 + 2] = 0;
      
      // Give each particle a random outward velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      velocity.normalize().multiplyScalar(Math.random() * 0.3 + 0.1);
      velocities.push(velocity);
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.15,
      blending: THREE.AdditiveBlending,
      transparent: true,
      sizeAttenuation: true,
    });
    
    const sparks = new THREE.Points(particlesGeometry, particleMaterial);
    sparks.position.copy(impactPosition);
    scene.add(sparks);
    
    // 3. Animate the effect over a short duration
    let duration = 0.7; // seconds
    let elapsed = 0;
    const clock = new THREE.Clock();
    
    const animate = () => {
      const dt = clock.getDelta();
      elapsed += dt;

      if (elapsed > duration) {
        // Cleanup
        scene.remove(sparks);
        scene.remove(flashLight);
        sparks.geometry.dispose();
        sparks.material.dispose();
        return;
      }

      // Animate fade out and movement
      const progress = elapsed / duration;
      flashLight.intensity = 20 * (1 - progress);
      particleMaterial.opacity = 1 - progress;

      // Update particle positions
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
    super.dispose();
    EventManager.instance.unsubscribe(EVENT.COLLISION, this.boundHandleCollision);
    CollisionManager.instance.remove(this);
    if (this.trail) {
      if (this.trail.parent) this.trail.parent.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail.material.dispose();
      this.trail = null;
    }

    if (this.model && this.model.parent) {
      this.model.parent.remove(this.model);
    }
  }
}

export { Bullet }
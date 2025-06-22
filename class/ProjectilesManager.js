
import * as THREE from 'three';
import { Bullet } from './Bullet.js';
import { CollisionManager } from './CollisionManager.js';
import { EventManager } from './EventManager.js';
import { Game } from './Game.js';
import { toRad, FACTION, EVENT, TANKTYPE, COLOR } from "../utils.js";
import { GAMECONFIG } from '../config.js';
class ProjectilesManager {
  static instance;
  projectilesMap = new Map();
  worker = null;

  constructor() {
    if (ProjectilesManager.instance) {
      return ProjectilesManager.instance;
    }
    ProjectilesManager.instance = this;

    if (typeof Worker !== 'undefined') {
      this.worker = new Worker('./class/ProjectilesWorker.js', { type: 'module' });
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = (e) => console.error("Projectile Worker Error:", e);
      this.worker.postMessage({
        type: 'init',
        payload: {
          lifeTime: 5000,
          worldBoundary: GAMECONFIG.WORLD_BOUNDARY,
        }
      });
      console.log('🔫 Projectile Worker initialized.');
    } else {
      console.warn("Projectiles: Web Workers not supported. Game will run without projectile simulation.");
    }

    EventManager.instance.subscribe(EVENT.OBJECT_SHOOT, this.handleObjectShoot.bind(this));
    EventManager.instance.subscribe(EVENT.BULLET_HIT, this.handleBulletHit.bind(this));
  }

  handleWorkerMessage(e) {
    const { type, payload } = e.data;
    if (type === 'updates') {
      this.applyWorkerUpdates(payload);
    }
  }

  applyWorkerUpdates({ updates, removals }) {
    removals.forEach(id => {
      const bullet = this.projectilesMap.get(id);
      if (bullet) {
        this.removeBullet(bullet);
      }
    });

    updates.forEach(update => {
      const bullet = this.projectilesMap.get(update.id);
      if (bullet) {
        bullet.position.copy(update.newPosition);
        if (bullet.model) {
          bullet.model.position.copy(update.newPosition);
          bullet.model.lookAt(bullet.position.clone().add(bullet.velocity));
        }
        bullet.updateTrail();
      }
    });
  }

  handleObjectShoot({ tank, position, direction, speed, color }) {
    if (!tank) return;
    if (tank.tankType.name === TANKTYPE.V008.name) {
      console.log('V008 is firing a double shot!');
      const spreadAngle = toRad(2);
      const qLeft = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        spreadAngle
      );
      const qRight = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -spreadAngle
      );
      const directionLeft = direction.clone().applyQuaternion(qLeft);
      const directionRight = direction.clone().applyQuaternion(qRight);
      this.createBullet(tank, position, directionLeft, speed, color);
      this.createBullet(tank, position, directionRight, speed, color);
      return;
    } else if (tank.tankType.name === TANKTYPE.V009.name) {
      console.log('V009 is firing two consecutive shot!')
      this.createBullet(tank, position, direction, speed, color);
      const burstDelay = 200;
      setTimeout(() => {
        if (tank.disposed) {
          return;
        }

        const currentPosition = new THREE.Vector3();
        const currentDirection = new THREE.Vector3(0, 0, 1);

        tank.model.getWorldPosition(currentPosition);
        currentPosition.y += 1.7;

        tank.model.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Vector3(0, 0, 1));
        currentDirection.applyQuaternion(tank.model.quaternion);
        currentPosition.add(currentDirection.clone().multiplyScalar(4.0));
        this.createBullet(tank, currentPosition, currentDirection, speed, color);

      }, burstDelay);

    }
    this.createBullet(tank, position, direction, speed, color);
  }

  handleBulletHit({ bullet }) {
    if (bullet) {
      this.removeBullet(bullet);
    }
  }

  createBullet(tank, position, direction, speed = 0.8, color) {

    const bullet = new Bullet(tank.faction, position, color);
    bullet.shooter = tank;
    bullet.damage = tank.damage;




    const finalVelocity = direction.clone().multiplyScalar(speed);


    bullet.velocity.copy(finalVelocity);


    this.projectilesMap.set(bullet.id, bullet);


    if (this.worker) {
      this.worker.postMessage({
        type: 'add',
        payload: {
          id: bullet.id,
          position: { x: position.x, y: position.y, z: position.z },
          velocity: { x: finalVelocity.x, y: finalVelocity.y, z: finalVelocity.z },
        }
      });
    }

    return bullet;
  }

  removeBullet(bullet) {
    if (!bullet || !this.projectilesMap.has(bullet.id)) return;
    if (this.worker) {
      this.worker.postMessage({ type: 'remove', payload: { id: bullet.id } });
    }
    this.projectilesMap.delete(bullet.id);
    bullet.dispose();
  }

  update() { }

  clear() {
    if (this.worker) {
      this.worker.postMessage({ type: 'clear' });
    }
    this.projectilesMap.forEach(projectile => projectile.dispose());
    this.projectilesMap.clear();
    Bullet.count = 0;
  }
}

export { ProjectilesManager };
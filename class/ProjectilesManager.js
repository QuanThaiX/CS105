import * as THREE from 'three';
import { Bullet } from './Bullet.js';
import { CollisionManager } from './CollisionManager.js';
import { EventManager } from './EventManager.js';
import { Game } from './Game.js';
import { loadTankModel, FACTION, EVENT, TANKTYPE, COLOR, TANK_STATS } from "../utils.js";

class ProjectilesManager {
  static instance;
  projectiles = [];
  maxProjectiles = 100;
  
  constructor() {
    if (ProjectilesManager.instance) {
      return ProjectilesManager.instance;
    }
    ProjectilesManager.instance = this;

    EventManager.instance.subscribe(EVENT.OBJECT_SHOOT, this.handleObjectShoot.bind(this));
    EventManager.instance.subscribe(EVENT.BULLET_EXPIRED, this.handleBulletExpired.bind(this));
    EventManager.instance.subscribe(EVENT.COLLISION, this.handleCollision.bind(this));
  }

  handleObjectShoot({ tank, position, direction, speed, color}) {
    if (!tank) {
      return;
    }
    this.createBullet(tank.faction, position, direction, speed, color);
    if(tank.tankType === TANKTYPE.V009) {
        this.createBullet(tank.faction, position, direction, speed, color);
  }
}
  
  handleBulletExpired({ bullet }) {
    this.removeBullet(bullet);
  }
  
  handleCollision({ objA, objB }) {
    if (objA instanceof Bullet || objB instanceof Bullet) {
      const bullet = objA instanceof Bullet ? objA : objB;
      
      if (bullet.hasCollided) {
        this.removeBullet(bullet);
      }
    }
  }
  
  addProjectile(bullet) {
    this.projectiles.push(bullet);
    
    if (this.projectiles.length > this.maxProjectiles) {
      const oldestBullet = this.projectiles.shift();
      oldestBullet.dispose();
    }
    
    return bullet;
  }
  
  createBullet(faction, position, direction, speed = 0.5, color) {
    const bullet = new Bullet(faction, position, color);
    bullet.setVelocity(direction.multiplyScalar(speed));
    return this.addProjectile(bullet);
  }

  removeBullet(bullet) {
    const index = this.projectiles.findIndex(p => p === bullet);
    if (index !== -1) {
      this.projectiles.splice(index, 1);
      bullet.dispose();
    }
  }
  
  update() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.update();
      
      let tankPosition = null;
      if (Game.instance.playerTank.model){
        tankPosition = Game.instance.playerTank.model.position;
      } else {
        return;
      }
      //const tankPosition = Game.instance.playerTank.model.position;
      if (projectile.position.distanceTo(tankPosition) > 100 || projectile.hasCollided) {
        if (projectile.model && Game.instance.scene) {
          Game.instance.scene.remove(projectile.model);
        }
        CollisionManager.instance.remove(projectile);
        this.projectiles.splice(i, 1);
      }
    }
  }
  
  // clear() {
  //   this.projectiles.forEach(projectile => {
  //     if (projectile.model && Game.instance.scene) {
  //       Game.instance.scene.remove(projectile.model);
  //     }
  //     CollisionManager.instance.remove(projectile);
  //   });
  //   this.projectiles = [];
  // }
  clear() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.dispose();
    }
    this.projectiles = [];
    Bullet.count = 0; 
  }
}

export { ProjectilesManager };

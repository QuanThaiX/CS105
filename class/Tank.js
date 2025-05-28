import * as THREE from "three";
import { loadTankModel, FACTION, EVENT, TANKTYPE, TANK_STATS } from "../utils.js";
import { GAMECONFIG } from '../config.js';
import { Bullet } from "./Bullet.js";
import { CollisionManager } from "./CollisionManager.js";
import { Game } from './Game.js'
import { HealthBar } from "./HealthBar.js";
import { GameObject } from './GameObject.js'
import { EventManager } from "./EventManager.js";
import { ProjectilesManager } from "./ProjectilesManager.js";
import { Bot } from "./Bot.js";
import { Rock } from "./Rock.js";
import { Tree } from "./Tree.js";
import { ModelLoader } from '../loader.js';
import { Barrel } from './Barrel.js';

class Tank extends GameObject{
  tankType;               // TANKTYPE.
  hp;
  maxHp;
  moveSpeed;
  rotateSpeed;
  shootCooldown = 2500;   // ms
  damage;
  defense;
  isMoving = false;
  lastMoveTime = 0;
  moveSoundDuration = 100; // 0.1s

  lastShotTime = 0;       // ms
  prevPosition;
  prevRotation;

  HealthBar;

  constructor(id, faction, position, isCollision, tankType = TANKTYPE.V001) {
    super(id, faction, position, isCollision);
    this.tankType = tankType;
    this.setTankStats(this.tankType);
    // console.log("Tank stats: ", this.tankType, this.hp, this.maxHp, this.moveSpeed, this.rotateSpeed, this.shootCooldown, this.damage, this.defense);
    
    // Sử dụng ModelLoader cache hoặc fallback to loadTankModel
    this.loadTankModelFromCache();

    this.prevPosition = this.position.clone();
    this.prevRotation = 0;
    this.healthBar = new HealthBar(this, this.hp);

    EventManager.instance.subscribe(EVENT.COLLISION, this.handleCollision.bind(this));
    EventManager.instance.subscribe(EVENT.OBJECT_DAMAGED, this.handleDamage.bind(this));
  }

  /**
   * Load tank model từ cache hoặc fallback to direct loading
   */
  loadTankModelFromCache() {
    const modelLoader = new ModelLoader();
    
    if (modelLoader.isPreloaded) {
      try {
        const model = modelLoader.getTankModel(this.tankType, this.position);
        if (model) {
          this.setModel(model);
          return;
        }
      } catch (error) {
        console.error('Error getting tank model from cache:', error);
      }
    }
    
    // Fallback: sử dụng loadTankModel function cũ
    console.warn(`⚠️ Tank model ${this.tankType.name} chưa được preload, đang load trực tiếp...`);
    loadTankModel(this.tankType, this.position).then((model) => {
      this.setModel(model);
    }).catch((error) => {
      console.error('Failed to load tank model:', error);
    });
  }

  setTankStats(tankType, stats = null){
    const tankStats = stats || TANK_STATS[tankType.name];

    this.hp = tankStats.hp;
    this.maxHp = tankStats.maxHp;
    this.moveSpeed = tankStats.moveSpeed;
    this.rotateSpeed = tankStats.rotateSpeed;
    this.shootCooldown = tankStats.shootCooldown;
    this.damage = tankStats.damage;
    this.defense = tankStats.defense;
  }

  setTankHP(hp){
    this.hp = hp;
    this.maxHp = hp;
    this.healthBar = new HealthBar(this, this.hp);

  }

// MOVE --------------------------------------------------------------------------------------------------------------------------------

  moveForward(distance = this.moveSpeed) {
    if (this.model) {
      this.isMoving = true;
      this.lastMoveTime = Date.now();
      if (this.faction === FACTION.PLAYER) {
        EventManager.instance.notify(EVENT.PLAYER_MOVE, { isMoving: true });
      }
      this.prevPosition.copy(this.position);
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(this.model.quaternion);
      this.model.position.add(forward.multiplyScalar(distance));
      this.position.copy(this.model.position);
    }
  }

  moveBackward(distance = this.moveSpeed) {
    if (this.model) {
      this.isMoving = true;
      this.lastMoveTime = Date.now();
      if (this.faction === FACTION.PLAYER) {
        EventManager.instance.notify(EVENT.PLAYER_MOVE, { isMoving: true });
      }
      this.prevPosition.copy(this.position);
      const backward = new THREE.Vector3(0, 0, -1);
      backward.applyQuaternion(this.model.quaternion);
      this.model.position.add(backward.multiplyScalar(distance));
      this.position.copy(this.model.position);
    }
  }

  rotateLeft(angle = this.rotateSpeed) {
    if (this.model) {
      this.isMoving = true;
      this.lastMoveTime = Date.now();
      if (this.faction === FACTION.PLAYER) {
        EventManager.instance.notify(EVENT.PLAYER_MOVE, { isMoving: true });
      }
      this.prevRotation = this.model.rotation.y;
      this.model.rotation.y += angle;
    }
  }

  rotateRight(angle = this.rotateSpeed) {
    if (this.model) {
      this.isMoving = true;
      this.lastMoveTime = Date.now();
      if (this.faction === FACTION.PLAYER) {
        EventManager.instance.notify(EVENT.PLAYER_MOVE, { isMoving: true });
      }
      this.prevRotation = this.model.rotation.y;
      this.model.rotation.y -= angle;
    }
  }

  shoot() {
    const currentTime = Date.now();
    if (currentTime - this.lastShotTime < this.shootCooldown) {
      return null;
    }

    if (this.model) {
      const bulletPosition = this.model.position.clone();
      bulletPosition.y += 1.2;
      const forward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.model.quaternion)
        .normalize();
      bulletPosition.add(forward.clone().multiplyScalar(4));
      
      this.lastShotTime = currentTime;
      EventManager.instance.notify(EVENT.OBJECT_SHOOT, {
        tank: this,
        position: bulletPosition,
        direction: forward.clone(),
        speed: 0.5
      });
      
      return true;
    }
    return null;
  }

  playShootSound() {
  }

  startAutoShoot(interval = 1000) {
    if (!this.shootInterval) {
      this.shootInterval = setInterval(() => {
        this.shoot();
      }, interval);
    }
  }

  stopAutoShoot() {
    if (this.shootInterval) {
      clearInterval(this.shootInterval);
      this.shootInterval = null;
    }
  }

  dispose(){
    this.stopAutoShoot();
    
    // Play tank destruction sound if tank died from damage
    if (this.hp <= 0) {
      this.playDestructionSound();
    }
    
    super.dispose();
    if (this.faction === FACTION.ENEMY) {
      Bot.instance.removeTank(this);
    }
    
    if (this.healthBar) {
      this.healthBar.remove();
      this.healthBar = null;
    }

    // Enhanced tank destroyed event
    EventManager.instance.notify(EVENT.TANK_DESTROYED, { 
      tank: this,
      position: this.position.clone(),
      pointValue: this.faction === FACTION.ENEMY ? this.pointValue || 100 : 0,
      killer: this.lastDamageSource || null,
      explosionPosition: this.position.clone(),
      tankType: this.tankType,
      faction: this.faction
    });
    
    EventManager.instance.unsubscribe(EVENT.COLLISION, this.handleCollision.bind(this));
    EventManager.instance.unsubscribe(EVENT.OBJECT_DAMAGED, this.handleDamage.bind(this));
    CollisionManager.instance.remove(this);
  }

  /**
   * Play tank destruction sound effect
   */
  playDestructionSound() {
    try {
      const audioConfig = GAMECONFIG.AUDIO.TANK_DESTRUCTION;
      
      EventManager.instance.notify(EVENT.AUDIO_PLAY, {
        soundId: 'tank_destruction',
        volume: audioConfig.VOLUME,
        position: this.position.clone(),
        loop: false,
        soundPath: audioConfig.PATH,
        distanceFalloff: audioConfig.DISTANCE_FALLOFF,
        maxDistance: audioConfig.MAX_DISTANCE
      });
    } catch (error) {
      console.error('Error playing tank destruction sound:', error);
    }
  }

  takeDamage(atk, objSource){
    if (this.hp !== undefined || this.hp !== null){
      let damage = atk - this.defense > 0 ? atk - this.defense : 1;
      this.hp -= damage;
      
      // Store damage source for destruction sound
      this.lastDamageSource = objSource;
      
      EventManager.instance.notify(EVENT.OBJECT_DAMAGED, {
        object: this,
        damage: damage,
        objSource: objSource,
        remainingHp: this.hp
      });

      if (this.hp <= 0){
        this.destroy();
        if (this.faction == FACTION.PLAYER){
          EventManager.instance.notify(EVENT.PLAYER_DIE, {
            tank: this,
            position: this.position.clone(),
            killer: objSource,
            deathCause: 'damage',
            finalScore: Game.instance ? Game.instance.score : 0
          });
        }
      }

      return true;
    }
    return false;
  }

  handleDamage({ object, damage, objSource, remainingHp }) {
    if (object === this) {
      if (this.healthBar) {
        this.healthBar.updateHP(remainingHp);
      }
      console.log(`${this.id} HP: ${remainingHp}`);
    }
  }

  handleCollision({ objA, objB }) {
    if (objA === this || objB === this) {
      const otherObject = objA === this ? objB : objA;
      //console.log("collision: " + this.constructor.name + "---" + otherObject.constructor.name);

      if (otherObject instanceof Tank || otherObject instanceof Rock || otherObject instanceof Tree) {
        if (this.prevPosition) {
          this.model.position.copy(this.prevPosition);
          this.position.copy(this.prevPosition);
          
          if (this.model.rotation.y !== this.prevRotation) {
            this.model.rotation.y = this.prevRotation;
          }
        }
      }

      if (otherObject instanceof Bullet && this.faction !== otherObject.faction) {
        this.takeDamage(otherObject.damage, otherObject);
      }
    }
  }

  update() {
    if (this.healthBar) {
      this.healthBar.update();
    }

    const currentTime = Date.now();
    if (this.isMoving && currentTime - this.lastMoveTime > this.moveSoundDuration) {
      this.isMoving = false;
      if (this.faction === FACTION.PLAYER) {
        EventManager.instance.notify(EVENT.PLAYER_MOVE, { isMoving: false });
      }
    }
  }
}

export { Tank };

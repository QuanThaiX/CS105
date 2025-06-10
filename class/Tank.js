// ./class/Tank.js
import * as THREE from "three";
import { loadTankModel, POWERUP_TYPE, FACTION, EVENT, TANKTYPE, COLOR, TANK_STATS } from "../utils.js";
import { GAMECONFIG } from '../config.js';
import { Bullet } from "./Bullet.js";
import { CollisionManager } from "./CollisionManager.js";
import { Game } from './Game.js'
import { HealthBar } from "./HealthBar.js";
import { ReloadBar } from "./ReloadBar.js";
import { GameObject } from './GameObject.js'
import { EventManager } from "./EventManager.js";
import { ProjectilesManager } from "./ProjectilesManager.js";
import { Bot } from "./Bot.js";
import { Rock } from "./Rock.js";
import { Tree } from "./Tree.js";
import { ModelLoader } from '../loader.js';
import { Barrel } from './Barrel.js';
import { PowerUp } from './PowerUp.js';
class Tank extends GameObject {
  tankType;
  hp;
  maxHp;
  moveSpeed;
  rotateSpeed;
  shootCooldown = 2500;
  damage;
  defense;
  isMoving = false;
  lastMoveTime = 0;
  moveSoundDuration = 100;

  lastShotTime = 0;
  prevPosition;
  prevRotation;

  HealthBar;
  reloadBar;
  enemyIndicator;
  indicatorLight;
  // activePowerUps;
  originalStats;
  _forward = new THREE.Vector3(0, 0, 1);
  _backward = new THREE.Vector3(0, 0, -1);
  _bulletPosition = new THREE.Vector3();
  _bulletDirection = new THREE.Vector3(0, 0, 1);
  _hoverTime = 0;
  isHoverTank = false;
  initialY = 0;
  knockbackVelocity = new THREE.Vector3();
  knockbackDamping = 0.92;
  constructor(id, faction, position, isCollision, tankType = TANKTYPE.V001) {
    super(id, faction, position, isCollision);
    this.tankType = tankType;
    this.setTankStats(this.tankType);

    this.isHoverTank = (this.tankType === TANKTYPE.V010);
    if (this.isHoverTank) {
      this.initialY = 1.0;
      this.position.y = this.initialY;
    }

    this.healthBar = new HealthBar(this, this.hp);
    if (this.tankType.name === TANKTYPE.V002.name) {
      this.healthBar.yOffset = 3.5;
    } else if (this.tankType.name === TANKTYPE.V003.name) {
      this.healthBar.yOffset = -1;
    } else if (this.tankType.name === TANKTYPE.V004.name) {
      this.healthBar.yOffset = 3.5;
    } else if (this.tankType.name === TANKTYPE.V005.name) {
      this.healthBar.yOffset = 3.5;
    } else if (this.tankType.name === TANKTYPE.V006.name) {
      this.healthBar.yOffset = 3.5;
    } else if (this.tankType.name === TANKTYPE.V007.name) {
      this.healthBar.yOffset = 3.5;
    }
    this.loadTankModelFromCache();

    this.prevPosition = this.position.clone();
    this.prevRotation = 0;
    // this.activePowerUps = new Map();
    this.originalStats = {
      shootCooldown: this.shootCooldown,
      damage: this.damage
    };

    if (this.faction === FACTION.PLAYER) {
      this.reloadBar = new ReloadBar(this);
    }

    EventManager.instance.subscribe(EVENT.COLLISION, this.handleCollision.bind(this));
    EventManager.instance.subscribe(EVENT.OBJECT_DAMAGED, this.handleDamage.bind(this));
    EventManager.instance.subscribe(EVENT.OBJECT_HEALED, this.handleHeal.bind(this));
  }

  setModel(model) {
    super.setModel(model);
    if (this.isHoverTank && this.model) {
      this.model.position.y = this.initialY;
    }

    if (this.healthBar) {
      this.healthBar.setReady();
    }

    if (this.faction === FACTION.ENEMY) {
      this.createEnemyIndicator();
    }
    if (this.faction === FACTION.PLAYER && this.tankType !== TANKTYPE.V010 &&
      this.tankType !== TANKTYPE.V011 && this.tankType !== TANKTYPE.V009) {
      this.createPlayerIndicator();
    }
  }
  createPlayerIndicator() {
    if (!this.model) return;

    this.indicatorLight = new THREE.PointLight(0xffffff, 10, 8);
    this.indicatorLight.position.set(0, 1.5, 0);

    this.model.add(this.indicatorLight);
  }
  createEnemyIndicator() {
    if (!this.model) return;

    const arrowGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 }); // Bright red
    this.enemyIndicator = new THREE.Mesh(arrowGeometry, arrowMaterial);

    this.enemyIndicator.position.set(0, 3.5, 0);
    this.enemyIndicator.rotation.x = Math.PI;

    this.indicatorLight = new THREE.PointLight(0xff0000, 10, 8);
    this.indicatorLight.position.set(0, 1.5, 0);

    this.model.add(this.enemyIndicator);
    this.model.add(this.indicatorLight);
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

  setTankStats(tankType, stats = null) {
    const tankStats = stats || TANK_STATS[tankType.name];

    this.hp = tankStats.hp;
    this.maxHp = tankStats.maxHp;
    this.moveSpeed = tankStats.moveSpeed;
    this.rotateSpeed = tankStats.rotateSpeed;
    this.shootCooldown = tankStats.shootCooldown;
    this.damage = tankStats.damage;
    this.defense = tankStats.defense;
  }

  setTankHP(hp) {
    this.hp = hp;
    this.maxHp = hp;

    if (this.healthBar) {
      this.healthBar.maxHp = this.maxHp;
      this.healthBar.updateHP(this.hp);
    } else {
      this.healthBar = new HealthBar(this, this.hp);
    }
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

      // BEFORE: const forward = new THREE.Vector3(0, 0, 1);
      // AFTER: Reuse the helper vector
      this._forward.set(0, 0, 1);
      this._forward.applyQuaternion(this.model.quaternion);
      this.model.position.add(this._forward.multiplyScalar(distance));
      
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
      
      // BEFORE: const backward = new THREE.Vector3(0, 0, -1);
      // AFTER: Reuse the helper vector
      this._backward.set(0, 0, -1);
      this._backward.applyQuaternion(this.model.quaternion);
      this.model.position.add(this._backward.multiplyScalar(distance));

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
      // Lấy vị trí gốc của đạn từ vị trí tank
this._bulletPosition.copy(this.model.position);
      // Thiết lập offset cho vị trí đạn dựa vào loại tank
      let bulletOffsetY = 1.2; // Offset Y mặc định
      let bulletOffsetZ = 4;   // Offset Z mặc định (phía trước tank)

      // Thiết lập offset riêng cho từng loại tank
      if (this.tankType.name === TANKTYPE.V001) {
        bulletOffsetY = 1.2;
        bulletOffsetZ = 4;
      } else if (this.tankType.name === TANKTYPE.V002.name) {
        bulletOffsetY = 2.1;
        bulletOffsetZ = 4.2;
      } else if (this.tankType.name === TANKTYPE.V003.name) {
        bulletOffsetY = 2.3;
        bulletOffsetZ = 4.1;
      } else if (this.tankType.name === TANKTYPE.V004.name) {
        bulletOffsetY = 2.1;
        bulletOffsetZ = 3.5;
      } else if (this.tankType.name === TANKTYPE.V005.name) {
        bulletOffsetY = 2.4;
        bulletOffsetZ = 3.2;
      } else if (this.tankType.name === TANKTYPE.V006.name) {
        bulletOffsetY = 2.4;
        bulletOffsetZ = 4.5;
      } else if (this.tankType.name === TANKTYPE.V007.name) {
        bulletOffsetY = 2.2;
        bulletOffsetZ = 5.0;
      } else if (this.tankType.name === TANKTYPE.V008.name) {
        bulletOffsetY = 1.9;
        bulletOffsetZ = 3.5;
      } else if (this.tankType.name === TANKTYPE.V009.name) {
        bulletOffsetY = 1.7;
        bulletOffsetZ = 4.0;
      } else if (this.tankType.name === TANKTYPE.V010.name) {
        bulletOffsetY = 1.0;
        bulletOffsetZ = 4.5;
      } else if (this.tankType.name === TANKTYPE.V011.name) {
        bulletOffsetY = 1.5;
        bulletOffsetZ = 4.2;
      }
      this._bulletPosition.y += bulletOffsetY;

      // Tính toán hướng và áp dụng offset Z
      this._bulletDirection.set(0, 0, 1).applyQuaternion(this.model.quaternion).normalize();
    this._bulletPosition.add(this._bulletDirection.clone().multiplyScalar(bulletOffsetZ));
    
    this.lastShotTime = currentTime;
      if (this.reloadBar) {
        this.reloadBar.startReload();
      }
      if (this.tankType === TANKTYPE.V009) {
        EventManager.instance.notify(EVENT.OBJECT_SHOOT, {
          tank: this,
          position: this._bulletPosition, 
          direction: this._bulletDirection, 
          speed: 0.8,
          color: COLOR.cyan
        });
      } else if (this.tankType === TANKTYPE.V010) {
        EventManager.instance.notify(EVENT.OBJECT_SHOOT, {
          tank: this,
          position: this._bulletPosition,
          direction: this._bulletDirection,
          speed: 0.8,
          color: COLOR.cyan
        });
      } else if (this.tankType === TANKTYPE.V011) {
        EventManager.instance.notify(EVENT.OBJECT_SHOOT, {
          tank: this,
          position: this._bulletPosition,
          direction: this._bulletDirection,
          speed: 0.8,
          color: COLOR.purple
        });
      }
      else {
        EventManager.instance.notify(EVENT.OBJECT_SHOOT, {
          tank: this,
          position: this._bulletPosition,
          direction: this._bulletDirection,
          speed: 0.8,
          color: COLOR.orange
        });
      }

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

  /**
   * Handles the gameplay logic for when a tank is destroyed.
   * This includes playing sounds and notifying the game.
   * It then calls the base class destroy, which triggers cleanup via dispose().
   */
  destroy() {
    if (this.disposed) return;

    // --- Gameplay Death Effects ---
    this.playDestructionSound();

    EventManager.instance.notify(EVENT.TANK_DESTROYED, {
      tank: this,
      position: this.position.clone(),
      pointValue: this.faction === FACTION.ENEMY ? this.pointValue || 100 : 0,
      killer: this.lastDamageSource || null,
      explosionPosition: this.position.clone(),
      tankType: this.tankType,
      faction: this.faction
    });

    // Call GameObject.destroy() which in turn calls this.dispose() for cleanup
    super.destroy();
  }

  /**
   * Handles the cleanup of all resources associated with the tank.
   * This method is safe to call multiple times and during game reset.
   * It does NOT handle gameplay logic like sounds or scoring.
   */
  dispose() {
    if (this.disposed) return;

    // --- Resource Cleanup Logic ---
    this.stopAutoShoot();

    if (this.model) {
      if (this.enemyIndicator) {
        this.model.remove(this.enemyIndicator);
        this.enemyIndicator.geometry.dispose();
        this.enemyIndicator.material.dispose();
        this.enemyIndicator = null;
      }
      if (this.indicatorLight) {
        this.model.remove(this.indicatorLight);
        this.indicatorLight.dispose();
        this.indicatorLight = null;
      }
    }

    if (this.faction === FACTION.ENEMY && Bot.instance) {
      Bot.instance.removeTank(this);
    }

    if (this.healthBar) {
      this.healthBar.remove();
      this.healthBar = null;
    }
    if (this.reloadBar) {
      this.reloadBar.remove();
      this.reloadBar = null;
    }

    if (EventManager.instance) {
      EventManager.instance.unsubscribe(EVENT.COLLISION, this.handleCollision.bind(this));
      EventManager.instance.unsubscribe(EVENT.OBJECT_DAMAGED, this.handleDamage.bind(this));
      EventManager.instance.unsubscribe(EVENT.OBJECT_HEALED, this.handleHeal.bind(this));
    }

    if (CollisionManager.instance) {
      CollisionManager.instance.remove(this);
    }

    // Call parent dispose to finalize cleanup (remove model from scene, set disposed flag)
    super.dispose();
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
  /**
   * Heals the tank by a given amount, up to its max HP.
   * @param {number} amount The amount of HP to restore.
   * @returns {number} The actual amount of HP that was restored.
   */
  heal(amount) {
    if (this.hp <= 0 || amount <= 0) {
      return 0;
    }

    const oldHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const actualHealAmount = this.hp - oldHp;

    if (actualHealAmount > 0) {
      EventManager.instance.notify(EVENT.OBJECT_HEALED, {
        object: this,
        amount: actualHealAmount,
        newHp: this.hp
      });
    }

    return actualHealAmount;
  }
  takeDamage(atk, objSource) {
    if (this.hp === undefined || this.hp === null || this.hp <= 0) {
      return false;
    }

    let damage = atk - (this.defense * 1.5) / 10 > 0 ? atk - (this.defense * 1.5) / 10 : 25;
    this.hp -= damage;

    this.lastDamageSource = objSource;

    EventManager.instance.notify(EVENT.OBJECT_DAMAGED, {
      object: this,
      damage: damage,
      objSource: objSource,
      remainingHp: this.hp
    });

    if (this.hp <= 0) {
      this.destroy();
      if (this.faction == FACTION.PLAYER) {
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

  handleHeal({ object, newHp }) {
    if (object === this && this.healthBar) {
      this.healthBar.updateHP(newHp);
    }
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
    if (this.disposed) {
      return;
    }

    if (objA === this || objB === this) {
      const otherObject = objA === this ? objB : objA;

      if (otherObject instanceof Bullet && otherObject.shooter === this) {
          return;
      }


      if (otherObject instanceof PowerUp && this.faction === FACTION.PLAYER) {
        if (otherObject.isActive) {
          this.collectPowerUp(otherObject);
          otherObject.collect();
          // if (Game.instance.powerUpManager) {
          //    Game.instance.powerUpManager.onPowerUpCollected();
          // }
        }
        return;
      }
      if (otherObject instanceof Tank ||
        otherObject instanceof Rock ||
        otherObject instanceof Tree ||
        (otherObject instanceof Barrel && !otherObject.hasExploded)) {

        if (this.prevPosition) {
          this.model.position.copy(this.prevPosition);
          this.position.copy(this.prevPosition);

          if (this.model.rotation.y !== this.prevRotation) {
            this.model.rotation.y = this.prevRotation;
          }
        }
      }
    }
  }
  // collectPowerUp(powerUp) {
  //   const type = powerUp.powerUpType;
  //   console.log(`Player collected: ${type.name}`);

  //   EventManager.instance.notify(EVENT.POWERUP_COLLECTED, { tank: this, powerUpType: type });
  //   EventManager.instance.notify(EVENT.UI_SHOW_MESSAGE, {
  //     message: `${type.name} Activated!`,
  //     duration: 2000,
  //     type: 'heal' // Use 'heal' style for positive feedback
  //   });

  //   // Clear any existing timeout for this power-up type
  //   if (this.activePowerUps.has(type.name)) {
  //     clearTimeout(this.activePowerUps.get(type.name));
  //     this.expirePowerUp(type); // Reset stats before applying new buff
  //   }

  //   // Apply the effect
  //   switch (type.name) {
  //     case POWERUP_TYPE.HEALTH_PACK.name:
  //       this.heal(type.value);
  //       break;
  //     case POWERUP_TYPE.SHIELD.name:
  //       // For a shield, we can give temporary extra HP or a damage reduction flag
  //       this.defense *= 2; // Double defense
  //       break;
  //     case POWERUP_TYPE.RAPID_FIRE.name:
  //       this.shootCooldown /= 2; // Halve cooldown
  //       break;
  //     case POWERUP_TYPE.DAMAGE_BOOST.name:
  //       this.damage *= 1.5; // 50% more damage
  //       break;
  //   }

  //   // Set a timer to remove the effect (if it has a duration)
  //   if (type.duration > 0) {
  //     const timeoutId = setTimeout(() => {
  //       this.expirePowerUp(type);
  //     }, type.duration);
  //     this.activePowerUps.set(type.name, timeoutId);
  //   }
  // }

  // expirePowerUp(powerUpType) {
  //   console.log(`${powerUpType.name} expired.`);
  //   this.activePowerUps.delete(powerUpType.name);
  //   EventManager.instance.notify(EVENT.POWERUP_EXPIRED, { tank: this, powerUpType });

  //   // Revert the stat changes
  //   switch (powerUpType.name) {
  //     case POWERUP_TYPE.SHIELD.name:
  //       this.defense = this.originalStats.defense;
  //       break;
  //     case POWERUP_TYPE.RAPID_FIRE.name:
  //       this.shootCooldown = this.originalStats.shootCooldown;
  //       break;
  //     case POWERUP_TYPE.DAMAGE_BOOST.name:
  //       this.damage = this.originalStats.damage;
  //       break;
  //   }
  // }

/**
 * NEW: Applies a force to the tank, causing it to slide.
 * @param {THREE.Vector3} direction - The normalized direction of the force.
 * @param {number} force - The magnitude of the force.
 */
applyKnockback(direction, force) {
    const horizontalDirection = direction.clone();
    horizontalDirection.y = 0;
    horizontalDirection.normalize();
    this.knockbackVelocity.add(horizontalDirection.multiplyScalar(force / 100));
}

update() {
    if (this.knockbackVelocity.lengthSq() > 0.001) {
        this.model.position.add(this.knockbackVelocity);
        this.position.copy(this.model.position);
        this.knockbackVelocity.multiplyScalar(this.knockbackDamping);
    } else {
        this.knockbackVelocity.set(0, 0, 0);
    }
    this._hoverTime = performance.now() * 0.001;
    if (this.isHoverTank && this.model) {
      this.model.position.y = this.initialY + Math.sin(this._hoverTime * 2) * 0.1;
      this.model.rotation.x = Math.sin(this._hoverTime * 1.5) * 0.02;
      this.model.rotation.z = Math.cos(this._hoverTime * 1.2) * 0.02;
    }
    if (this.model) {
      this.position.copy(this.model.position);
    }

    if (this.healthBar) {
      this.healthBar.update();
    }
    if (this.reloadBar) {
      this.reloadBar.update();
    }


    if (this.enemyIndicator) {
      const indicatorTime = this._hoverTime * 2;
      this.enemyIndicator.position.y = 3.5 + Math.sin(indicatorTime) * 0.25;
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
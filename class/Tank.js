import * as THREE from "three";
import { loadTankModel, FACTION, EVENT, TANKTYPE, TANK_STATS } from "../utils.js";
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
  reloadBar;
  enemyIndicator; 
  indicatorLight;

  constructor(id, faction, position, isCollision, tankType = TANKTYPE.V001) {
      super(id, faction, position, isCollision);
      this.tankType = tankType;
      this.setTankStats(this.tankType);
      
      this.healthBar = new HealthBar(this, this.hp); 

      this.loadTankModelFromCache();

      this.prevPosition = this.position.clone();
      this.prevRotation = 0;
      

      if (this.faction === FACTION.PLAYER) {
          this.reloadBar = new ReloadBar(this);
      }
      
      EventManager.instance.subscribe(EVENT.COLLISION, this.handleCollision.bind(this));
      EventManager.instance.subscribe(EVENT.OBJECT_DAMAGED, this.handleDamage.bind(this));
      EventManager.instance.subscribe(EVENT.OBJECT_HEALED, this.handleHeal.bind(this)); 
  }

  setModel(model) {
    // --- DEBUG LOG ---
    console.log(`%c[Tank] SET_MODEL called for: ${this.id} (Faction: ${this.faction})`, 'color: lightblue');
    super.setModel(model); 

    if (this.healthBar) {
        // --- DEBUG LOG ---
        console.log(`%c[Tank] Calling healthBar.setReady() for ${this.id}`, 'color: lightblue; font-weight: bold;');
        this.healthBar.setReady();
    }

    if (this.faction === FACTION.ENEMY) {
      this.createEnemyIndicator();
    }
  }

  createEnemyIndicator() {
    if (!this.model) return; // Can't add indicator if there's no model to attach to

    // --- 1. Create the Arrow (Indicator) ---
    const arrowGeometry = new THREE.ConeGeometry(0.3, 0.6, 8); // Small cone
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 }); // Bright red
    this.enemyIndicator = new THREE.Mesh(arrowGeometry, arrowMaterial);

    // Position the arrow above the tank model
    this.enemyIndicator.position.set(0, 3.5, 0); // Adjust Y value as needed
    this.enemyIndicator.rotation.x = Math.PI; // Point it downwards

    // --- 2. Create the Red Light ---
    this.indicatorLight = new THREE.PointLight(0xff0000, 100, 8); // Red light, intensity 2, range 8
    this.indicatorLight.position.set(0, 1.5, 0); // Position it in the middle of the tank

    // --- 3. Attach them to the tank model ---
    // This makes them move and rotate along with the parent tank model automatically!
    this.model.add(this.enemyIndicator);
    this.model.add(this.indicatorLight);
  }

  // We need to override dispose to clean up the new objects
  dispose() {
    // --- Clean up indicator and light ---
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

    this.stopAutoShoot();
    
    if (this.hp <= 0) {
      this.playDestructionSound();
    }
    
    super.dispose(); // Call parent dispose AFTER removing our custom objects
    if (this.faction === FACTION.ENEMY) {
      Bot.instance.removeTank(this);
    }
    
    if (this.healthBar) {
      this.healthBar.remove();
      this.healthBar = null;
    }

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
      // Lấy vị trí gốc của đạn từ vị trí tank
      const bulletPosition = this.model.position.clone();
      
      // Thiết lập offset cho vị trí đạn dựa vào loại tank
      let bulletOffsetY = 1.2; // Offset Y mặc định
      let bulletOffsetZ = 4;   // Offset Z mặc định (phía trước tank)
      
      // Thiết lập offset riêng cho từng loại tank
      if (this.tankType === TANKTYPE.V001) {
        bulletOffsetY = 1.2;
        bulletOffsetZ = 4;
      } else if (this.tankType === TANKTYPE.V002) {
        bulletOffsetY = 1.4;
        bulletOffsetZ = 4.2;
      } else if (this.tankType === TANKTYPE.V003) {
        bulletOffsetY = 1.3;
        bulletOffsetZ = 4.1;
      } else if (this.tankType === TANKTYPE.V004) {
        bulletOffsetY = 1.0;
        bulletOffsetZ = 3.5;
      } else if (this.tankType === TANKTYPE.V005) {
        bulletOffsetY = 0.9;
        bulletOffsetZ = 3.2;
      } else if (this.tankType === TANKTYPE.V006) {
        bulletOffsetY = 1.5;
        bulletOffsetZ = 4.5;
      } else if (this.tankType === TANKTYPE.V007) {
        bulletOffsetY = 1.0;
        bulletOffsetZ = 3.0;
      }
      
      // Áp dụng offset Y
      bulletPosition.y += bulletOffsetY;
      
      // Tính toán hướng và áp dụng offset Z
      const forward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.model.quaternion)
        .normalize();
      bulletPosition.add(forward.clone().multiplyScalar(bulletOffsetZ));
      
      this.lastShotTime = currentTime;
      if (this.reloadBar) {
        this.reloadBar.startReload();
      }
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

  dispose() {
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

    this.stopAutoShoot();
    
    if (this.hp <= 0) {
      this.playDestructionSound();
    }
    
    super.dispose(); // Call parent dispose AFTER removing our custom objects
    if (this.faction === FACTION.ENEMY) {
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
    EventManager.instance.unsubscribe(EVENT.OBJECT_HEALED, this.handleHeal.bind(this));
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

      if (otherObject instanceof Tank || otherObject instanceof Rock || otherObject instanceof Tree) {
        if (this.prevPosition) {
          this.model.position.copy(this.prevPosition); // This is also good!
          this.position.copy(this.prevPosition);
          
          if (this.model.rotation.y !== this.prevRotation) {
            this.model.rotation.y = this.prevRotation;
          }
        }
      }
    }
}

  update() {
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
        // Create a simple bobbing motion using a sine wave based on time
        const time = performance.now() * 0.002; // Speed of the bobbing
        this.enemyIndicator.position.y = 3.5 + Math.sin(time) * 0.25; // Base height + bob amount
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

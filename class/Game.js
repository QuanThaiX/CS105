import * as THREE from 'three';
import { createGround, createSky, createCamera, createDebugHelpers, createLights, createRenderer, createScene, updateShadowArea, updateSceneFog } from './createEnvironment.js';
import { startLoadingScreen, hideLoadingScreen } from '../UI.js';
import { QUALITY, GAMECONFIG, gameSettings, loadSettings, saveSettings } from '../config.js';
import { FACTION, EVENT, TANKTYPE } from '../utils.js';
import { Tank } from './Tank.js';
import { PlayerControl } from './PlayerControl.js';
import { CollisionManager } from './CollisionManager.js';
import { EventManager } from './EventManager.js';
import { ProjectilesManager } from './ProjectilesManager.js';
import { Bot } from './Bot.js';
import { Rock } from './Rock.js';
import { Effect } from './EffectManager.js';
import { Tree } from './Tree.js';
import { Barrel } from './Barrel.js';
import { SoundManager } from './SoundManager.js';
import { SpawnManager } from './SpawnManager.js';
import { Generator } from './Generator.js';
import { GameStateManager } from './GameStateManager.js';
import { ModelLoader } from '../loader.js';

const DEFAULT_SCENERY_CONFIG = {
  NUM_ROCKS: 15,
  ROCK_TYPES: ['rock09', 'rock13'],
  ROCK_SCALE_MIN: 2.5,
  ROCK_SCALE_MAX: 7.5,
  NUM_TREES: 25,
  TREE_TYPES: ['tree01'],
  TREE_SCALE_MIN: 0.8,
  TREE_SCALE_MAX: 1.5,
  NUM_BARRELS: 8,
  BARREL_TYPES: ['barrel'],
  BARREL_SCALE_MIN: 0.8,
  BARREL_SCALE_MAX: 1.5,
  MIN_SPAWN_RADIUS: 80,
  MAX_SPAWN_RADIUS_FACTOR: 0.9
};

const DEFAULT_ENEMY_CONFIG = {
  NUM_ENEMIES: 6,
  ENEMY_TYPES: [TANKTYPE.V001, TANKTYPE.V002, TANKTYPE.V003, TANKTYPE.V004, TANKTYPE.V005, TANKTYPE.V006],
  ENEMY_POINT_VALUE: 100, // Can be a number or a function(type) => number
  ENEMY_HP: 100,          // Can be a number or a function(type) => number
  MIN_SPAWN_RADIUS: 30,   // Min distance from player start (0,0,0)
  MAX_SPAWN_RADIUS_FACTOR: 0.8 // Relative to world boundary
};

const HIGH_SCORE_STORAGE_KEY = 'tankGame_highScore';

// Local GAMECONFIG definition for internal use, will be merged with exported one.
// This ensures defaults are available if the exported one isn't fully defined yet.
const LOCAL_GAMECONFIG_DEFAULTS = {
  WORLD_BOUNDARY: 500,
  SCENERY: DEFAULT_SCENERY_CONFIG,
  ENEMY_CONFIG: DEFAULT_ENEMY_CONFIG
};


class Game {
  static instance;
  static debug = true;
  static isRunning = false;

  scene;
  camera;
  renderer;
  controls;
  soundManager;
  generator;
  gameStateManager;
  spawnManager;
  updatabledObjects = [];
  score = 0;
  highScore = 0;
  enemies = [];
  rocks = [];
  trees = [];
  barrels = [];

  boundHandlePlayerDie;
  boundHandleGameOver;
  boundHandleGameWin;
  boundHandleTankDestroyed;
  boundHandleFogSettingChanged;;
  boundOnWindowResize;

  // Respawn tracking
  totalEnemiesSpawned = 0;
  enemiesKilled = 0;
  nextSpawnId = 1;

  constructor(options = {}) {
    if (Game.instance) {
      return Game.instance;
    }
    Game.instance = this;

    this.gameConfig = {
      ...LOCAL_GAMECONFIG_DEFAULTS,
      ...(typeof GAMECONFIG !== 'undefined' ? GAMECONFIG : {}), // GAMECONFIG is exported later
      SCENERY: {
        ...DEFAULT_SCENERY_CONFIG,
        ...(typeof GAMECONFIG !== 'undefined' && GAMECONFIG.SCENERY ? GAMECONFIG.SCENERY : {})
      },
      ENEMY_CONFIG: {
        ...DEFAULT_ENEMY_CONFIG,
        ...(typeof GAMECONFIG !== 'undefined' && GAMECONFIG.ENEMY_CONFIG ? GAMECONFIG.ENEMY_CONFIG : {})
      }
    };
    Game.debug = this.gameConfig.DEBUG !== undefined ? this.gameConfig.DEBUG : Game.debug;

    this.highScore = this.loadHighScore();
    this.selectedTankType = this.setSelectedTank(options.tankType);

    // Respawn tracking
    this.totalEnemiesSpawned = 0;
    this.enemiesKilled = 0;
    this.nextSpawnId = 1;

    this.boundHandleFogSettingChanged = this.handleFogSettingChanged.bind(this);
    this.boundHandlePlayerDie = this.handlePlayerDie.bind(this);
    this.boundHandleGameOver = this.handleGameOver.bind(this);
    this.boundHandleGameWin = this.handleGameWin.bind(this);
    this.boundHandleTankDestroyed = this.handleTankDestroyed.bind(this);
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    this.initGame();
  }

  initGame() {
    this.score = 0;
    this.spawnManager = new SpawnManager(this.gameConfig.WORLD_BOUNDARY, 20)
    this.collisionManager = new CollisionManager();
    // this.eventManager = new EventManager();
    this.projectilesManager = new ProjectilesManager();
    this.effectManager = new Effect();
    this.soundManager = new SoundManager();
    this.bot = new Bot();
    this.generator = new Generator();
    this.gameStateManager = new GameStateManager(this);
    
    if (ProjectilesManager.instance) {
      ProjectilesManager.instance.clear();
    }
    this.enemies = [];
    this.rocks = [];
    this.trees = [];
    this.barrels = [];
    this.updatableObjects = [];
    this.scene = createScene();
    this.renderer = createRenderer();
    this.lights = createLights(this.scene);
    this.sky = createSky(this.scene);
    this.ground = createGround(this.scene, { width: this.gameConfig.WORLD_BOUNDARY, height: this.gameConfig.WORLD_BOUNDARY, repeatX: this.gameConfig.WORLD_BOUNDARY / 20, repeatY: this.gameConfig.WORLD_BOUNDARY / 20 });


    if (Game.debug) {
      this.debugHelpers = createDebugHelpers(this.scene);
    }
    this.updateFog();
    this.registerEventListeners();
    this.loadLevel();
  }

  loadLevel() {
    // Create player tank
    this.playerTank = new Tank(0, FACTION.PLAYER, { x: 0, y: 1, z: 0 }, true, this.selectedTankType);
    this.player = new PlayerControl(this.playerTank);
    this.collisionManager.add(this.playerTank);

    // Generate level using async Generator
    this.loadLevelAsync();

    // Setup camera
    const { camera, controls } = createCamera(this.scene, this.playerTank.position, this.renderer);
    this.camera = camera;
    this.controls = controls;

    // Notify with proper event data structure
    EventManager.instance.notify(EVENT.TANK_SPAWNED, {
        tank: this.playerTank,
        position: this.playerTank.position,
        tankType: this.selectedTankType
    });
  }

  async loadLevelAsync() {
    try {
      console.log('🎯 Starting async level generation...');
      
      // Log current model cache status
      const modelLoader = new ModelLoader();
      if (modelLoader.isPreloaded) {
        console.log("🔄 Using preloaded models for level generation");
        const cacheInfo = modelLoader.getCacheInfo();
        console.log("📊 Cache status before level generation:", cacheInfo);
      } else {
        console.warn("⚠️ Models not preloaded, level generation may be slower");
      }
      
      const levelData = await this.generator.generateLevel({
        worldBoundary: this.gameConfig.WORLD_BOUNDARY,
        sceneryConfig: this.gameConfig.SCENERY,
        enemyConfig: this.gameConfig.ENEMY_CONFIG
      });

      // Create enemies from definitions (async)
      this.enemies = await this.generator.createEnemyTanks(
        levelData.enemyDefinitions, 
        this.bot, 
        this.collisionManager
      );

      // Create scenery objects from definitions (async)
      this.rocks = await this.generator.createRocks(levelData.rockDefinitions, this.collisionManager);
      this.trees = await this.generator.createTrees(levelData.treeDefinitions, this.collisionManager);
      this.barrels = await this.generator.createBarrels(levelData.barrelDefinitions, this.collisionManager);
      this.updatableObjects.push(this.playerTank, ...this.enemies, ...this.trees, ...this.rocks, ...this.barrels);
      console.log('✅ Async level generation completed!');

      this.rocks.forEach(rock => this.spawnManager.markOccupied(rock.position, 5));
      this.trees.forEach(tree => this.spawnManager.markOccupied(tree.position, 3));
      this.barrels.forEach(barrel => this.spawnManager.markOccupied(barrel.position, 2));

      // Log enemy types generated
      if (this.enemies.length > 0) {
        const enemyTypes = this.enemies.map(enemy => enemy.tankType.name);
        const typeCounts = {};
        enemyTypes.forEach(type => {
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        console.log("🚙 Enemy tanks generated:", Object.entries(typeCounts)
          .map(([type, count]) => `${type}: ${count}`)
          .join(", "));
      }

      // Notify with enhanced event data
      EventManager.instance.notify(EVENT.LEVEL_LOADED, {
        playerTank: this.playerTank,
        enemies: this.enemies,
        rocks: this.rocks,
        trees: this.trees,
        barrels: this.barrels,
        totalObjects: this.enemies.length + this.rocks.length + this.trees.length + this.barrels.length,
        loadTime: performance.now()
      });

    } catch (error) {
      console.error('❌ Error during async level loading:', error);
      
      // Notify system error
      EventManager.instance.notify(EVENT.SYSTEM_ERROR, {
        error: error,
        context: 'loadLevelAsync',
        severity: 'high',
        timestamp: Date.now()
      });
    }
  }
  updateFog() {
      if (!this.scene) return;
      const qualityProfile = this.gameConfig.QUALITY_PROFILES[gameSettings.quality];
      const settings = {
          enabled: gameSettings.fog,
          useSky: qualityProfile.useSky
      };
      updateSceneFog(this.scene, settings);
  }
  
  // ADDED: New handler for when the fog setting is changed in the UI
  handleFogSettingChanged() {
    console.log('Fog setting updated. Applying changes to the scene.');
    this.updateFog();
  }
  registerEventListeners() {
    window.addEventListener('resize', this.boundOnWindowResize, false);
    
    // Subscribe with async support and proper priority
    EventManager.instance.subscribe(EVENT.PLAYER_DIE, this.boundHandlePlayerDie, {
      priority: 10,
      async: true
    });
    
    EventManager.instance.subscribe(EVENT.GAME_OVER, this.boundHandleGameOver, {
      priority: 10,
      async: true
    });
    
    EventManager.instance.subscribe(EVENT.GAME_WIN, this.boundHandleGameWin, {
      priority: 10,
      async: true
    });
    
    EventManager.instance.subscribe(EVENT.TANK_DESTROYED, this.boundHandleTankDestroyed, {
      priority: 5,
      async: false
    });
  }

  unregisterEventListeners() {
    window.removeEventListener('resize', this.boundOnWindowResize, false);
    EventManager.instance.unsubscribe(EVENT.PLAYER_DIE, this.boundHandlePlayerDie);
    EventManager.instance.unsubscribe(EVENT.GAME_OVER, this.boundHandleGameOver);
    EventManager.instance.unsubscribe(EVENT.GAME_WIN, this.boundHandleGameWin);
    EventManager.instance.unsubscribe(EVENT.TANK_DESTROYED, this.boundHandleTankDestroyed);
  }

  async handleGameWin(data) {
    if (this.isRunning) {
      const winScreen = document.getElementById('win-screen');
      if (winScreen) {
        document.getElementById('win-score').textContent = this.score;
        document.getElementById('win-highscore').textContent = this.highScore;
        winScreen.style.display = 'flex';
      }
      
      // Notify UI update with proper data structure
      EventManager.instance.notify(EVENT.UI_UPDATE_HUD, {
        playerHP: 0,
        score: this.score,
        highScore: this.highScore,
        ammo: 0
      });
      
      this.stop();
    }
  }

  async handleGameOver(data) {
    if (this.isRunning) {
      const gameOverScreen = document.getElementById('game-over-screen');
      if (gameOverScreen) {
        document.getElementById('gameover-score').textContent = this.score;
        document.getElementById('gameover-highscore').textContent = this.highScore;
        gameOverScreen.style.display = 'flex';
      }
      
      // Notify UI update
      EventManager.instance.notify(EVENT.UI_UPDATE_HUD, {
        playerHP: 0,
        score: this.score,
        highScore: this.highScore,
        ammo: 0
      });
      
      this.stop();
    }
  }

  handlePlayerRestart() {
    this.resetGame();
  }

  handleTankDestroyed(data) {
    const { tank, pointValue } = data;

    if (tank && tank.faction === FACTION.ENEMY && pointValue !== undefined) {
        this.addScore(pointValue);
        this.enemiesKilled++; // Track total kills
        tank.isDestroyed = true;
        const index = this.enemies.indexOf(tank);
        if (index !== -1) {
            this.enemies.splice(index, 1);
        }

        if (this.playerTank && !this.playerTank.isDestroyed && tank.maxHp > 0) {
            const healAmount = tank.maxHp * 1.0;
            
            const actualHealAmount = this.playerTank.heal(healAmount);

            if (actualHealAmount > 0) {
                const healPosition = this.playerTank.position.clone();

                const healLight = new THREE.PointLight(0x50ff50, 250, 30, 2);
                healLight.position.copy(healPosition).add(new THREE.Vector3(0, 1.5, 0)); 
                this.scene.add(healLight);

                setTimeout(() => {
                    if (this.scene) { 
                        this.scene.remove(healLight);
                        healLight.dispose();
                    }
                }, 600);

                EventManager.instance.notify(EVENT.AUDIO_PLAY, {
                    soundId: `heal_effect_${Date.now()}`, 
                    soundPath: './assets/sound/heal.mp3', 
                    volume: 0.7,
                    position: healPosition,
                    loop: false,
                });
                
                EventManager.instance.notify(EVENT.UI_SHOW_MESSAGE, {
                    message: `+${Math.round(actualHealAmount)} HP`,
                    duration: 1500,
                    type: 'heal',
                });
            }
        }

      // Enhanced event notification for score
      EventManager.instance.notify(EVENT.SCORE_CHANGED, {
        score: this.score,
        highScore: this.highScore,
        pointsAdded: pointValue,
        reason: `Enemy tank ${tank.id} destroyed`,
        enemiesKilled: this.enemiesKilled,
        totalSpawned: this.totalEnemiesSpawned
      });

      // Respawn system logic
      const respawnConfig = this.gameConfig.ENEMY_CONFIG.RESPAWN;
      // The enemy has already been removed, so we check current length
      if (respawnConfig.ENABLED && this.enemies.length < respawnConfig.MAX_ENEMIES_ALIVE) {
          const respawnDelay = this.generator.getRandomInRange(respawnConfig.MIN_DELAY, respawnConfig.MAX_DELAY);
          
          if (respawnDelay > 2000) {
              setTimeout(() => {
                  this.showSpawnWarning();
              }, respawnDelay - 2000); // Show warning 2s before spawn
          }
          
          setTimeout(() => {
              this.spawnNewEnemyTank();
          }, respawnDelay);

        console.log(`⏰ New enemy tank will spawn in ${(respawnDelay/1000).toFixed(1)}s (Killed: ${this.enemiesKilled}, Active: ${this.enemies.length})`);
      }

      // Check win condition - disable for infinite gameplay
      if (this.isWin()) {
        setTimeout(() => {
          EventManager.instance.notify(EVENT.GAME_WIN, {
            reason: "All enemies destroyed",
            score: this.score,
            highScore: this.highScore,
            timeToComplete: performance.now()
          });
        }, 1000);
      }
    }
  }

  /**
   * Spawn tank địch mới tại vị trí an toàn với progressive difficulty
   */
  async spawnNewEnemyTank() {
    try {
      const respawnConfig = this.gameConfig.ENEMY_CONFIG.RESPAWN;
      if (!respawnConfig.ENABLED || this.enemies.length >= respawnConfig.MAX_ENEMIES_ALIVE) {
        return;
      }

      // Use the SpawnManager to find a position instantly
      const safePosition = this.spawnManager.findSafeSpawnPosition(
          this.playerTank.position,
          respawnConfig.MIN_DISTANCE_FROM_PLAYER
      );

      if (!safePosition) {
        console.warn("⚠️ Could not find safe spawn position for new enemy tank via SpawnManager.");
        return;
      }
      
      const availableTankTypes = this.gameConfig.ENEMY_CONFIG.ENEMY_TYPES;
      const randomTankType = this.generator.getRandomElement(availableTankTypes);
      const newEnemyId = `enemy-respawn-${this.nextSpawnId++}`;
      const newEnemyTank = new Tank(newEnemyId, FACTION.ENEMY, safePosition, true, randomTankType);
      
      // Progressive difficulty scaling
      const difficultyMultiplier = this.calculateDifficultyMultiplier();
      
      // Set stats cho tank mới với scaling
      const basePointValue = this.gameConfig.ENEMY_CONFIG.ENEMY_POINT_VALUE;
      const baseHp = this.gameConfig.ENEMY_CONFIG.ENEMY_HP;
      
      const scaledHp = Math.floor((typeof baseHp === 'function' ? baseHp(randomTankType) : baseHp) * difficultyMultiplier.hp);
      const scaledPointValue = Math.floor((typeof basePointValue === 'function' ? basePointValue(randomTankType) : basePointValue) * difficultyMultiplier.points);
      
      newEnemyTank.setTankHP(scaledHp);
      newEnemyTank.pointValue = scaledPointValue;
      
      // Track spawned enemies
      this.totalEnemiesSpawned++;
      
      // Add vào game systems
      this.enemies.push(newEnemyTank);
      this.updatableObjects.push(newEnemyTank); 
      this.bot.addTank(newEnemyTank);
      this.collisionManager.add(newEnemyTank);
      
      this.createSpawnEffect(safePosition);
      
      // Notify spawn event
      EventManager.instance.notify(EVENT.TANK_SPAWNED, {
        tank: newEnemyTank,
        position: newEnemyTank.position,
        tankType: randomTankType,
        totalSpawned: this.totalEnemiesSpawned,
        enemiesKilled: this.enemiesKilled
      });
      
      console.log(`✅ Spawned enemy tank #${this.totalEnemiesSpawned}: ${randomTankType.name} (HP: ${scaledHp}, Points: ${scaledPointValue}) at position (${safePosition.x.toFixed(1)}, ${safePosition.z.toFixed(1)})`);
      
    } catch (error) {
      console.error("❌ Error spawning new enemy tank:", error);
    }
  }

  /**
   * Tạo hiệu ứng visual khi tank spawn
   * @param {Object} position - Vị trí spawn {x, y, z}
   */
  createSpawnEffect(position) {
    try {
      // Tạo spawn explosion effect
      EventManager.instance.notify(EVENT.OBJECT_SHOOT, {
        position: new THREE.Vector3(position.x, position.y + 2, position.z),
        direction: new THREE.Vector3(0, 1, 0),
        effectType: 'spawn'
      });

      // Play spawn sound
      EventManager.instance.notify(EVENT.AUDIO_PLAY, {
        soundId: 'tank_spawn',
        volume: 0.5,
        position: new THREE.Vector3(position.x, position.y, position.z),
        loop: false,
        soundPath: './assets/audio/tank-spawn.wav',
        distanceFalloff: true,
        maxDistance: 80
      });

      console.log("✨ Spawn effects created");
      
    } catch (error) {
      console.error("Error creating spawn effects:", error);
    }
  }

  /**
   * Hiển thị cảnh báo khi tank mới sắp spawn
   */
  showSpawnWarning() {
    try {
      // Audio warning
      EventManager.instance.notify(EVENT.AUDIO_PLAY, {
        soundId: 'spawn_warning',
        volume: 0.6,
        loop: false,
        soundPath: './assets/audio/warning-beep.wav'
      });

      // Visual warning - hiển thị message trên UI
      EventManager.instance.notify(EVENT.UI_SHOW_MESSAGE, {
        message: "⚠️ ENEMY TANK INCOMING!",
        duration: 2000,
        type: 'warning',
        position: 'top-center'
      });

      console.log("⚠️ Spawn warning displayed");
      
    } catch (error) {
      console.error("Error showing spawn warning:", error);
    }
  }

  /**
   * Tính toán difficulty multiplier dựa trên score hiện tại
   * @returns {Object} Multiplier cho HP và points
   */
  calculateDifficultyMultiplier() {
    const respawnConfig = this.gameConfig.ENEMY_CONFIG.RESPAWN;
    
    if (!respawnConfig.PROGRESSIVE_DIFFICULTY) {
      return { hp: 1.0, points: 1.0 };
    }
    
    const scaling = respawnConfig.DIFFICULTY_SCALING;
    const difficultyLevel = Math.floor(this.score / scaling.SCORE_THRESHOLD);
    
    return {
      hp: Math.pow(scaling.HP_MULTIPLIER, difficultyLevel),
      points: Math.pow(scaling.POINT_MULTIPLIER, difficultyLevel)
    };
  }

  /**
   * Tìm vị trí spawn an toàn cho tank mới
   * @returns {Promise<Object|null>} Safe spawn position hoặc null nếu không tìm được
   */
  async findSafeTankSpawnPosition() {
    const respawnConfig = this.gameConfig.ENEMY_CONFIG.RESPAWN;
    const worldBoundary = this.gameConfig.WORLD_BOUNDARY;

    for (let attempt = 0; attempt < respawnConfig.MAX_SPAWN_ATTEMPTS; attempt++) {
      // Generate random position trong world boundary
      const angle = Math.random() * Math.PI * 2;
      const radius = this.generator.getRandomInRange(
        respawnConfig.MIN_DISTANCE_FROM_PLAYER, 
        worldBoundary / 2 * 0.8
      );
      
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      const candidatePosition = { x, y: 1, z };

      // Check collision với tất cả objects hiện tại
      if (await this.isPositionSafeForTank(candidatePosition, respawnConfig.TANK_SIZE, respawnConfig.MIN_DISTANCE_FROM_OBSTACLES)) {
        return candidatePosition;
      }
    }

    // Nếu không tìm được position an toàn, thử tạo ở vị trí backup
    console.warn("⚠️ Could not find safe position, trying backup positions");
    const backupPositions = [
      { x: -100, y: 1, z: -100 },
      { x: 100, y: 1, z: -100 },
      { x: -100, y: 1, z: 100 },
      { x: 100, y: 1, z: 100 },
      { x: 0, y: 1, z: -150 },
      { x: 0, y: 1, z: 150 },
      { x: -150, y: 1, z: 0 },
      { x: 150, y: 1, z: 0 }
    ];

    const respawnConfigLocal = this.gameConfig.ENEMY_CONFIG.RESPAWN;
    for (const backupPos of backupPositions) {
      if (await this.isPositionSafeForTank(backupPos, respawnConfigLocal.TANK_SIZE, respawnConfigLocal.MIN_DISTANCE_FROM_OBSTACLES)) {
        console.log("✅ Using backup position for tank spawn");
        return backupPos;
      }
    }

    return null; // Không tìm được vị trí nào an toàn
  }

  /**
   * Kiểm tra xem vị trí có an toàn cho tank spawn không
   * @param {Object} position - Position to check {x, y, z}
   * @param {number} tankSize - Tank size for collision checking
   * @param {number} minDistance - Minimum distance from obstacles
   * @returns {Promise<boolean>} True nếu position an toàn
   */
  async isPositionSafeForTank(position, tankSize, minDistance) {
    const respawnConfig = this.gameConfig.ENEMY_CONFIG.RESPAWN;
    const posVector = new THREE.Vector3(position.x, position.y, position.z);

    // Check distance from player
    if (this.playerTank) {
      const playerPos = this.playerTank.position;
      const distanceFromPlayer = posVector.distanceTo(playerPos);
      if (distanceFromPlayer < respawnConfig.MIN_DISTANCE_FROM_PLAYER) {
        return false;
      }
    }

    // Check distance from other enemy tanks
    for (const enemy of this.enemies) {
      if (enemy && !enemy.disposed) {
        const distanceFromEnemy = posVector.distanceTo(enemy.position);
        if (distanceFromEnemy < minDistance * 2) { // Double distance cho tanks
          return false;
        }
      }
    }

    // Check distance from rocks
    if (this.rocks) {
      for (const rock of this.rocks) {
        if (rock && !rock.disposed) {
          const distanceFromRock = posVector.distanceTo(rock.position);
          if (distanceFromRock < minDistance) {
            return false;
          }
        }
      }
    }

    // Check distance from trees
    if (this.trees) {
      for (const tree of this.trees) {
        if (tree && !tree.disposed) {
          const distanceFromTree = posVector.distanceTo(tree.position);
          if (distanceFromTree < minDistance) {
            return false;
          }
        }
      }
    }

    // Check distance from barrels
    if (this.barrels) {
      for (const barrel of this.barrels) {
        if (barrel && !barrel.disposed) {
          const distanceFromBarrel = posVector.distanceTo(barrel.position);
          if (distanceFromBarrel < minDistance) {
            return false;
          }
        }
      }
    }

    // Check world boundaries
    const boundary = this.gameConfig.WORLD_BOUNDARY / 2;
    if (Math.abs(position.x) > boundary - tankSize || 
        Math.abs(position.z) > boundary - tankSize) {
      return false;
    }

    return true; // Position an toàn
  }

  // Modify isWin to account for respawning
  isWin() {
    // Disable win condition cho infinite gameplay với respawn
    const respawnConfig = this.gameConfig.ENEMY_CONFIG.RESPAWN;
    
    if (respawnConfig.ENABLED) {
      return false; // Infinite gameplay khi respawn enabled
    }
    
    // Original win condition khi respawn disabled
    return this.isRunning && this.enemies.length === 0;
  }

  async handlePlayerDie(data) {
    setTimeout(() => {
      EventManager.instance.notify(EVENT.GAME_OVER, {
        reason: "Player died",
        score: this.score,
        highScore: this.highScore,
        finalStats: {
          enemiesDestroyed: data.enemiesKilled || 0,
          survivalTime: data.survivalTime || 0
        }
      });
    }, 1000);
  }

  onWindowResize() {
    if (this.camera && this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  getHUDData() {
    return {
      playerHP: this.playerTank ? this.playerTank.hp || 0 : 0,
      score: this.score,
      highScore: this.highScore,
      enemiesAlive: this.enemies.length,
      enemiesKilled: this.enemiesKilled,
      totalSpawned: this.totalEnemiesSpawned,
      difficultyLevel: Math.floor(this.score / (this.gameConfig.ENEMY_CONFIG.RESPAWN?.DIFFICULTY_SCALING?.SCORE_THRESHOLD || 500))
    }
  }

  canResume() {
    return !this.isRunning && this.playerTank && !this.playerTank.disposed;
  }

  /**
   * Get game state manager for Bot AI access
   * @returns {GameStateManager} Game state manager instance
   */
  getGameStateManager() {
    return this.gameStateManager;
  }

  updateLogic() {
    const prevPlayerPos = this.playerTank.position.clone();

    this.player.update();
    this.bot.update();
    this.collisionManager.update();
    this.projectilesManager.update();
    this.playerTank.update();    for (let i = this.updatableObjects.length - 1; i >= 0; i--) {
        const obj = this.updatableObjects[i];
        
        if (obj.isDestroyed) {
            if (obj instanceof Tank && obj.faction === FACTION.ENEMY) {
                const enemyIndex = this.enemies.indexOf(obj);
                if (enemyIndex > -1) this.enemies.splice(enemyIndex, 1);
            }
            this.updatableObjects.splice(i, 1);
            continue; 
        }

        if (obj && !obj.disposed && typeof obj.update === 'function') {
            obj.update();
        }
    }

    this.bot.update();
    this.collisionManager.update();
    this.projectilesManager.update();

    const newPlayerPos = this.playerTank.position.clone();
    const delta = new THREE.Vector3().subVectors(newPlayerPos, prevPlayerPos);
    this.camera.position.add(delta);
    const playerPos = this.playerTank.position;
    this.controls.target.set(playerPos.x, playerPos.y + 1, playerPos.z);
    this.controls.update();

    updateShadowArea(this.lights.directionalLight, playerPos);
  }

  _animate() {
    if (!this.isRunning) return;
    this.updateLogic();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._animate.bind(this));
  }

  resetGame() {
    this.stop();
    this.unregisterEventListeners();

    // Reset respawn counters
    this.enemiesKilled = 0;
    this.totalEnemiesSpawned = 0;
    this.nextSpawnId = 1;

    if (this.rocks) {
      this.rocks.forEach(rock => {
        if (rock && !rock.disposed) rock.dispose();
      });
      this.rocks = [];
    }

    if (this.trees) {
      this.trees.forEach(tree => {
        if (tree && !tree.disposed) tree.dispose();
      });
      this.trees = [];
    }

    if (this.barrels) {
      this.barrels.forEach(barrel => {
        if (barrel && !barrel.disposed) barrel.dispose();
      });
      this.barrels = [];
    }

    if (this.enemies) {
      this.enemies.forEach(enemy => {
        if (enemy && !enemy.disposed) enemy.dispose();
      });
      this.enemies = [];
    }

    this.projectilesManager.clear();
    this.eventManager.clearAllEvents();
    this.initGame();
  }

  setSelectedTank(tankType = TANKTYPE.V001) {
    return tankType;
  }

  loadHighScore() {
    try {
      const savedHighScore = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      if (savedHighScore) {
        const parsedScore = parseInt(savedHighScore, 10);
        if (!isNaN(parsedScore)) {
          return parsedScore;
        }
      }
      return 0;
    } catch (e) {
      console.error("ERR--Game.loadHighScore()", e);
      return 0;
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem(HIGH_SCORE_STORAGE_KEY, this.highScore.toString());
    } catch (e) {
      console.error(e);
    }
  }

  addScore(points) {
    const previousScore = this.score;
    this.score += points;
    
    if (this.score > this.highScore) {
      const previousHighScore = this.highScore;
      this.highScore = this.score;
      this.saveHighScore();
      
      // Notify high score achievement
      EventManager.instance.notify(EVENT.HIGH_SCORE_ACHIEVED, {
        newHighScore: this.highScore,
        previousHighScore: previousHighScore,
        achievement: 'New High Score!'
      });
    }
    
    // Enhanced score change event
    EventManager.instance.notify(EVENT.SCORE_CHANGED, {
      score: this.score,
      highScore: this.highScore,
      pointsAdded: points,
      reason: 'Points added'
    });
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;

      startLoadingScreen();
      setTimeout(() => {
        // Enhanced game started event
        EventManager.instance.notify(EVENT.GAME_STARTED, {
          playerTank: this.playerTank,
          score: this.score,
          highScore: this.highScore,
          startTime: Date.now(),
          levelConfig: this.gameConfig
        });

        if (this.playerTank && this.camera) {
          const playerPos = this.playerTank.position;
          this.camera.position.set(playerPos.x, playerPos.y + 10, playerPos.z + 15);
          this.controls.target.set(playerPos.x, playerPos.y + 1, playerPos.z);
          this.controls.update();
        }
        
        this._animate();
        hideLoadingScreen();
      }, 5500);
    }
  }

  stop() {
    this.isRunning = false;
  }

  pause() {
    if (this.isRunning) {
      const pauseTime = Date.now();
      this.isRunning = false;
      
      EventManager.instance.notify(EVENT.GAME_PAUSED, {
        score: this.score,
        highScore: this.highScore,
        timestamp: pauseTime
      });
    }
  }

  resume() {
    if (!this.isRunning && this.canResume()) {
      const resumeTime = Date.now();
      this.isRunning = true;
      
      EventManager.instance.notify(EVENT.GAME_RESUMED, {
        score: this.score,
        highScore: this.highScore,
        pauseDuration: resumeTime - (this.pauseTime || resumeTime)
      });
      
      this._animate();
    }
  }

  dispose() {
    this.stop();
    this.unregisterEventListeners();

    if (this.player && typeof this.player.dispose === 'function') {
      this.player.dispose();
      this.player = null;
    }

    if (this.rocks) {
      this.rocks.forEach(rock => {
        if (rock && !rock.disposed) rock.dispose();
      });
      this.rocks = [];
    }

    if (this.trees) {
      this.trees.forEach(tree => {
        if (tree && !tree.disposed) tree.dispose();
      });
      this.trees = [];
    }

    if (this.barrels) {
      this.barrels.forEach(barrel => {
        if (barrel && !barrel.disposed) barrel.dispose();
      });
      this.barrels = [];
    }

    if (this.projectilesManager) {
      this.projectilesManager.clear();
    }

    if (this.playerTank && !this.playerTank.disposed) {
      this.playerTank.dispose();
      this.playerTank = null;
    }

    if (this.enemies) {
      this.enemies.forEach(enemy => {
        if (enemy && !enemy.disposed) enemy.dispose();
      });
      this.enemies = [];
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    if (this.scene) {
      this.scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.scene = null;
    }

    this.camera = null;
    if (this.controls && typeof this.controls.dispose === 'function') {
      this.controls.dispose();
    }
    this.controls = null;
    this.lights = null;
    this.sky = null;
    this.ground = null;
    this.debugHelpers = null;

    if (this.bot) {
      if (typeof this.bot.dispose === 'function') this.bot.dispose();
      this.bot = null;
    }
    if (this.collisionManager) {
      if (typeof this.collisionManager.dispose === 'function') this.collisionManager.dispose();
      this.collisionManager = null;
    }
    if (this.effectManager && typeof this.effectManager.dispose === 'function') {
      this.effectManager.dispose();
      this.effectManager = null;
    }
    if (this.generator) {
      if (typeof this.generator.dispose === 'function') this.generator.dispose();
      this.generator = null;
    }
    if (this.gameStateManager) {
      if (typeof this.gameStateManager.dispose === 'function') this.gameStateManager.dispose();
      this.gameStateManager = null;
    }

    // Note: Không dispose ModelLoader cache ở đây vì có thể cần cho game sessions khác
    // ModelLoader cache sẽ persist throughout application lifecycle
    // Nếu muốn clear cache, gọi ModelLoader.instance.clearCache() manually

    Game.instance = null;
  }
}

export { Game };
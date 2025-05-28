import * as THREE from 'three';
import { createGround, createSky, createCamera, createDebugHelpers, createLights, createRenderer, createScene, updateShadowArea } from './createEnvironment.js';
import { startLoadingScreen, hideLoadingScreen } from '../UI.js';
import { GAMECONFIG } from '../config.js';
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
import { Generator } from './Generator.js';
import { GameStateManager } from './GameStateManager.js';

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
  boundOnWindowResize;

  constructor(options = {}) {
    if (Game.instance) {
      return Game.instance;
    }
    Game.instance = this;

    // Use GAMECONFIG from the end of the file, falling back to local defaults
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

    this.boundHandlePlayerDie = this.handlePlayerDie.bind(this);
    this.boundHandleGameOver = this.handleGameOver.bind(this);
    this.boundHandleGameWin = this.handleGameWin.bind(this);
    this.boundHandleTankDestroyed = this.handleTankDestroyed.bind(this);
    this.boundOnWindowResize = this.onWindowResize.bind(this);

    this.initGame();
  }

  initGame() {
    this.score = 0;

    this.collisionManager = new CollisionManager();
    this.eventManager = new EventManager();
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

    this.scene = createScene();
    this.renderer = createRenderer();
    this.lights = createLights(this.scene);
    this.sky = createSky(this.scene);
    this.ground = createGround(this.scene, { width: this.gameConfig.WORLD_BOUNDARY, height: this.gameConfig.WORLD_BOUNDARY, repeatX: this.gameConfig.WORLD_BOUNDARY / 20, repeatY: this.gameConfig.WORLD_BOUNDARY / 20 });


    if (Game.debug) {
      this.debugHelpers = createDebugHelpers(this.scene);
    }

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

      console.log('✅ Async level generation completed!');

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
      const index = this.enemies.indexOf(tank);
      if (index !== -1) {
        this.enemies.splice(index, 1);
      }

      // Enhanced event notification
      EventManager.instance.notify(EVENT.SCORE_CHANGED, {
        score: this.score,
        highScore: this.highScore,
        pointsAdded: pointValue,
        reason: `Enemy tank ${tank.id} destroyed`
      });

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

  isWin() {
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
      highScore: this.highScore
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
    this.playerTank.update();

    this.enemies.forEach(enemy => {
      if (enemy && !enemy.disposed) enemy.update();
    });

    if (this.trees) {
      this.trees.forEach(tree => {
        if (tree && !tree.disposed) tree.update();
      });
    }

    if (this.rocks) {
      this.rocks.forEach(rock => {
        if (rock && !rock.disposed && rock.update) rock.update();
      });
    }

    if (this.barrels) {
      this.barrels.forEach(barrel => {
        if (barrel && !barrel.disposed && barrel.update) barrel.update();
      });
    }

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
      }, 2500);
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
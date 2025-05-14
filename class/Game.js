import * as THREE from 'three';
import { createGround, createSky, createCamera, createDebugHelpers, createLights, createRenderer, createScene, updateShadowArea } from './createEnvironment.js';
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

function getRandomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function getRandomElement(arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateScatteredObjects(count, types, scaleMin, scaleMax, maxSpawnRadius, minSpawnRadius = 0) {
  const objects = [];
  if (!types || types.length === 0) {
    console.warn("generateScatteredObjects: No types provided, cannot generate objects.");
    return objects;
  }

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const effectiveMinRadius = Math.min(minSpawnRadius, maxSpawnRadius);
    const radius = getRandomInRange(effectiveMinRadius, maxSpawnRadius);
    
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    objects.push({
      position: { x, y: 0, z },
      scale: getRandomInRange(scaleMin, scaleMax),
      rotation: Math.random() * Math.PI * 2,
      type: getRandomElement(types),
    });
  }
  return objects;
}

const DEFAULT_SCENERY_CONFIG = {
    NUM_ROCKS: 15,
    ROCK_TYPES: ['rock09', 'rock13'],
    ROCK_SCALE_MIN: 2.5,
    ROCK_SCALE_MAX: 7.5,
    NUM_TREES: 25,
    TREE_TYPES: ['tree01'],
    TREE_SCALE_MIN: 0.8,
    TREE_SCALE_MAX: 1.5,
    MIN_SPAWN_RADIUS: 80,
    MAX_SPAWN_RADIUS_FACTOR: 0.9
};

const HIGH_SCORE_STORAGE_KEY = 'tankGame_highScore';

class Game {
  static instance;
  static debug = true;
  static isRunning = false;

  scene;
  camera;
  renderer;
  controls;

  score = 0;
  highScore = 0;
  enemies = [];

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
    this.bot = new Bot();
    if (ProjectilesManager.instance) {
      ProjectilesManager.instance.clear();
    }
    this.enemies = [];

    this.scene = createScene();
    this.renderer = createRenderer();
    this.lights = createLights(this.scene);
    this.sky = createSky(this.scene);
    this.ground = createGround(this.scene, { width: 500, height: 500, repeatX: 25, repeatY: 25 });

    if (Game.debug) {
      this.debugHelpers = createDebugHelpers(this.scene);
    }

    this.registerEventListeners();
    this.loadLevel();
  }

  loadLevel() {
    this.playerTank = new Tank(0, FACTION.PLAYER, { x: 0, y: 1, z: 0 }, true, this.selectedTankType);
    this.player = new PlayerControl(this.playerTank);
    this.collisionManager.add(this.playerTank);

    const enemyDefinitions = [
      { id: 1, position: { x: 10, y: 1, z: 0 }, pointValue: 100, type: TANKTYPE.V001 },
      { id: 2, position: { x: -15, y: 1, z: 15 }, pointValue: 100, type: TANKTYPE.V001 },
      { id: 3, position: { x: 0, y: 1, z: -20 }, pointValue: 100, type: TANKTYPE.V002 },
      { id: 4, position: { x: 30, y: 1, z: 20 }, pointValue: 100, type: TANKTYPE.V001 },
      { id: 5, position: { x: -45, y: 1, z: 10 }, pointValue: 100, type: TANKTYPE.V002 },
      { id: 6, position: { x: 70, y: 1, z: -20 }, pointValue: 100, type: TANKTYPE.V001 },
    ];

    this.enemies = enemyDefinitions.map(def => {
      const enemyTank = new Tank(def.id, FACTION.ENEMY, def.position, true, def.type);
      enemyTank.setTankHP(100);
      enemyTank.pointValue = def.pointValue;
      this.bot.addTank(enemyTank);
      this.collisionManager.add(enemyTank);
      return enemyTank;
    });

    const worldBoundary = (GAMECONFIG.WORLD_BOUNDARY / 2) || (this.ground.geometry.parameters.width / 2) || 250;
    const activeSceneryConfig = { ...DEFAULT_SCENERY_CONFIG, ...(GAMECONFIG.SCENERY || {}) };
    
    const maxSpawnRadius = worldBoundary * activeSceneryConfig.MAX_SPAWN_RADIUS_FACTOR;
    const minSpawnRadius = activeSceneryConfig.MIN_SPAWN_RADIUS;

    const rockProperties = generateScatteredObjects(
      activeSceneryConfig.NUM_ROCKS,
      activeSceneryConfig.ROCK_TYPES,
      activeSceneryConfig.ROCK_SCALE_MIN,
      activeSceneryConfig.ROCK_SCALE_MAX,
      maxSpawnRadius,
      minSpawnRadius
    );
    this.rocks = Rock.createRocksFromList(rockProperties);
    this.rocks.forEach(rock => this.collisionManager.add(rock));

    const treeProperties = generateScatteredObjects(
      activeSceneryConfig.NUM_TREES,
      activeSceneryConfig.TREE_TYPES,
      activeSceneryConfig.TREE_SCALE_MIN,
      activeSceneryConfig.TREE_SCALE_MAX,
      maxSpawnRadius,
      minSpawnRadius
    );
    this.trees = Tree.createTreesFromList(treeProperties);
    this.trees.forEach(tree => this.collisionManager.add(tree));

    const { camera, controls } = createCamera(this.scene, this.playerTank.position, this.renderer);
    this.camera = camera;
    this.controls = controls;

    EventManager.instance.notify(EVENT.LEVEL_LOADED, {
      playerTank: this.playerTank,
      enemies: this.enemies,
      rocks: this.rocks,
      trees: this.trees
    });
  }

  registerEventListeners() {
    window.addEventListener('resize', this.boundOnWindowResize, false);
    EventManager.instance.subscribe(EVENT.PLAYER_DIE, this.boundHandlePlayerDie);
    EventManager.instance.subscribe(EVENT.GAME_OVER, this.boundHandleGameOver);
    EventManager.instance.subscribe(EVENT.GAME_WIN, this.boundHandleGameWin);
    EventManager.instance.subscribe(EVENT.TANK_DESTROYED, this.boundHandleTankDestroyed);
  }

  unregisterEventListeners() {
    window.removeEventListener('resize', this.boundOnWindowResize, false);
    EventManager.instance.unsubscribe(EVENT.PLAYER_DIE, this.boundHandlePlayerDie);
    EventManager.instance.unsubscribe(EVENT.GAME_OVER, this.boundHandleGameOver);
    EventManager.instance.unsubscribe(EVENT.GAME_WIN, this.boundHandleGameWin);
    EventManager.instance.unsubscribe(EVENT.TANK_DESTROYED, this.boundHandleTankDestroyed);
  }

  handleGameWin(data) {
    if (this.isRunning) {
      const winScreen = document.getElementById('win-screen');
      if (winScreen) {
        document.getElementById('win-score').textContent = this.score;
        document.getElementById('win-highscore').textContent = this.highScore;
        winScreen.style.display = 'flex';
      }
      this.stop();
    }
  }

  handleGameOver(data) {
    if (this.isRunning) {
      const gameOverScreen = document.getElementById('game-over-screen');
      if (gameOverScreen) {
        document.getElementById('gameover-score').textContent = this.score;
        document.getElementById('gameover-highscore').textContent = this.highScore;
        gameOverScreen.style.display = 'flex';
      }
      this.stop();
    }
  }

  handlePlayerRestart() {
    this.resetGame();
  }

  handleTankDestroyed(data) {
    const { tank, pointValue } = data;
    
    if (tank && tank.faction === FACTION.ENEMY && pointValue) {
      this.addScore(pointValue);
      const index = this.enemies.indexOf(tank);
      if (index !== -1) {
        this.enemies.splice(index, 1);
      }
    
      if (this.isWin()) {
        setTimeout(() => {
          EventManager.instance.notify(EVENT.GAME_WIN, {
            reason: "All enemies destroyed",
            score: this.score,
            highScore: this.highScore
          });
        }, 1000);
      }
    }
  }

  isWin() {
    return this.isRunning && this.enemies.length === 0;
  }

  handlePlayerDie(data) {
    setTimeout(() => {
      EventManager.instance.notify(EVENT.GAME_OVER, {
        reason: "Player died",
        score: this.score,
        highScore: this.highScore
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

    if (this.enemies) {
      this.enemies.forEach(enemy => {
        if (enemy && !enemy.disposed) enemy.dispose();
      });
      this.enemies = [];
    }
    
    this.projectilesManager.clear();
    this.eventManager.clearAllEvents(); // Assuming this clears subscriptions or is handled by re-init
    this.initGame(); // Re-initializes and re-subscribes
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
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
    EventManager.instance.notify(EVENT.SCORE_CHANGED, {
      score: this.score,
      highScore: this.highScore
    });
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      EventManager.instance.notify(EVENT.GAME_STARTED, {
        playerTank: this.playerTank,
        score: this.score,
        highScore: this.highScore
      });

      if (this.playerTank && this.camera) {
        const playerPos = this.playerTank.position;
        this.camera.position.set(playerPos.x, playerPos.y + 10, playerPos.z + 15);
        this.controls.target.set(playerPos.x, playerPos.y + 1, playerPos.z);
        this.controls.update();
      }
      this._animate();
    }
  }

  stop() {
    this.isRunning = false;
  }

  pause() {
    if (this.isRunning) {
      this.isRunning = false;
      EventManager.instance.notify(EVENT.GAME_PAUSED, {
        score: this.score,
        highScore: this.highScore
      });
    }
  }

  resume() {
    if (!this.isRunning && this.canResume()) {
      this.isRunning = true;
      EventManager.instance.notify(EVENT.GAME_RESUMED, {
        score: this.score,
        highScore: this.highScore
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
    this.controls = null;
    this.lights = null;
    this.sky = null;
    this.ground = null;
    this.debugHelpers = null;
    
    if(this.bot) {
        this.bot.dispose(); // Assuming bot has a dispose method to clear its tanks array or other resources
        this.bot = null;
    }
    if(this.collisionManager) {
        this.collisionManager.dispose(); // Assuming a dispose method to clear its collidables array
        this.collisionManager = null;
    }
    if(this.eventManager) {
        this.eventManager.clearAllEvents(); // Or a more specific dispose method
        this.eventManager = null;
    }
    // EffectManager might need disposal if it holds resources
    if(this.effectManager && typeof this.effectManager.dispose === 'function') {
        this.effectManager.dispose();
        this.effectManager = null;
    }


    Game.instance = null;
  }
}

export { Game };
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

  static ROCK_POSITIONS = [
    { position: { x: 30, y: 0, z: 30 }, scale: 5.5, rotation: 0, type: 'rock09' },
    { position: { x: -30, y: 0, z: 30 }, scale: 7.0, rotation: 1.5, type: 'rock09' },
    { position: { x: 30, y: 0, z: -30 }, scale: 4.5, rotation: 0.5, type: 'rock13' },
    { position: { x: -30, y: 0, z: -30 }, scale: 3.5, rotation: 2.0, type: 'rock13' },
    { position: { x: 0, y: 0, z: 45 }, scale: 6.5, rotation: 1.0, type: 'rock09' },
    { position: { x: 45, y: 0, z: 0 }, scale: 2.5, rotation: 0.3, type: 'rock13' },
    { position: { x: 0, y: 0, z: -45 }, scale: 6.7, rotation: 2.5, type: 'rock09' },
    { position: { x: -45, y: 0, z: 0 }, scale: 4.5, rotation: 3.0, type: 'rock13' },
    { position: { x: 20, y: 0, z: 20 }, scale: 6.7, rotation: 0.8, type: 'rock09' },
    { position: { x: -20, y: 0, z: -20 }, scale: 5.5, rotation: 1.2, type: 'rock13' }
  ];

  static TREE_POSITIONS = [
    { position: { x: 15, y: 0, z: 15 }, scale: 1.0, rotation: 0, type: 'tree01' },
    { position: { x: -15, y: 0, z: 15 }, scale: 1.2, rotation: 0.5, type: 'tree01' },
    { position: { x: 15, y: 0, z: -15 }, scale: 0.8, rotation: 1.0, type: 'tree01' },
    { position: { x: -15, y: 0, z: -15 }, scale: 1.5, rotation: 1.5, type: 'tree01' },
    { position: { x: 35, y: 0, z: 35 }, scale: 1.3, rotation: 2.0, type: 'tree01' },
    { position: { x: -35, y: 0, z: 35 }, scale: 0.9, rotation: 2.5, type: 'tree01' },
    { position: { x: 35, y: 0, z: -35 }, scale: 1.1, rotation: 3.0, type: 'tree01' },
    { position: { x: -35, y: 0, z: -35 }, scale: 1.4, rotation: 3.5, type: 'tree01' },
    { position: { x: 0, y: 0, z: 40 }, scale: 1.2, rotation: 4.0, type: 'tree01' },
    { position: { x: 40, y: 0, z: 0 }, scale: 1.0, rotation: 4.5, type: 'tree01' },
    { position: { x: 0, y: 0, z: -40 }, scale: 1.3, rotation: 5.0, type: 'tree01' },
    { position: { x: -40, y: 0, z: 0 }, scale: 0.8, rotation: 5.5, type: 'tree01' },
    { position: { x: 25, y: 0, z: 25 }, scale: 1.1, rotation: 0.2, type: 'tree01' },
    { position: { x: -25, y: 0, z: 25 }, scale: 1.4, rotation: 0.4, type: 'tree01' },
    { position: { x: 25, y: 0, z: -25 }, scale: 0.9, rotation: 0.6, type: 'tree01' },
    { position: { x: -25, y: 0, z: -25 }, scale: 1.2, rotation: 0.8, type: 'tree01' }
  ];

  constructor(options = {}) {
    if (Game.instance) {
      return Game.instance;
    }
    Game.instance = this;

    this.highScore = this.loadHighScore();
    this.selectedTankType = this.setSelectedTank(options.tankType);
    this.initGame();
  }

  initGame() {
    this.score = 0;

    this.collisionManager = new CollisionManager();
    this.eventManager = new EventManager();
    this.projectilesManager = new ProjectilesManager();
    this.effectManager = new Effect();
    this.bot = new Bot();
    
    // Khởi tạo mảng enemies trống
    this.enemies = [];

    this.scene = createScene();
    this.renderer = createRenderer();
    this.lights = createLights(this.scene);
    this.sky = createSky(this.scene);
    this.ground = createGround(this.scene, { width: 500, height: 500, repeatX: 25, repeatY: 25 });

    if (Game.debug == true) {
      this.debugHelpers = createDebugHelpers(this.scene);
    }

    this.registerEventListeners();
    this.loadLevel();
  }

  loadLevel() {
    this.playerTank = new Tank(0, FACTION.PLAYER, { x: 0, y: 1, z: 0 }, true, this.selectedTankType);
    this.playerTank.setTankHP(1000);
    this.player = new PlayerControl(this.playerTank);

    this.enemy1 = new Tank(1, FACTION.ENEMY, { x: 10, y: 1, z: 0 }, true);
    this.enemy1.pointValue = 100;
    this.bot.addTank(this.enemy1);

    this.enemy2 = new Tank(2, FACTION.ENEMY, { x: -15, y: 1, z: 15 }, true);
    this.enemy2.pointValue = 100;
    this.bot.addTank(this.enemy2);

    this.enemy3 = new Tank(3, FACTION.ENEMY, { x: 0, y: 1, z: -20 }, true);
    this.enemy3.pointValue = 100;
    this.bot.addTank(this.enemy3);

    this.enemy4 = new Tank(4, FACTION.ENEMY, { x: 30, y: 1, z: 20 }, true);
    this.enemy4.pointValue = 100;
    this.bot.addTank(this.enemy4);

    this.enemy5 = new Tank(5, FACTION.ENEMY, { x: -45, y: 1, z: 10 }, true);
    this.enemy5.pointValue = 100;
    this.bot.addTank(this.enemy5);

    this.enemy6 = new Tank(6, FACTION.ENEMY, { x: 70, y: 1, z: -20 }, true);
    this.enemy6.pointValue = 100;
    this.bot.addTank(this.enemy6);

    this.enemies = [this.enemy1, this.enemy2, this.enemy3, this.enemy4, this.enemy5, this.enemy6];

    this.collisionManager.add(this.playerTank);
    this.collisionManager.add(this.enemy1);
    this.collisionManager.add(this.enemy2);
    this.collisionManager.add(this.enemy3);
    this.collisionManager.add(this.enemy4);
    this.collisionManager.add(this.enemy5);
    this.collisionManager.add(this.enemy6);

    this.rocks = Rock.createRocksFromList(Game.ROCK_POSITIONS);
    this.trees = Tree.createTreesFromList(Game.TREE_POSITIONS);

    this.rocks.forEach(rock => {
      this.collisionManager.add(rock);
    });

    this.trees.forEach(tree => {
      this.collisionManager.add(tree);
    })

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
    window.addEventListener('resize', () => this.onWindowResize(), false);

    EventManager.instance.subscribe(EVENT.PLAYER_DIE, this.handlePlayerDie.bind(this));
    //EventManager.instance.subscribe(EVENT.PLAYER_RESTART, this.handlePlayerRestart.bind(this));
    EventManager.instance.subscribe(EVENT.GAME_OVER, this.handleGameOver.bind(this));
    EventManager.instance.subscribe(EVENT.GAME_WIN, this.handleGameWin.bind(this));
    //EventManager.instance.subscribe(EVENT.OBJECT_DESTROYED, this.handleObjectDestroyed.bind(this));
    EventManager.instance.subscribe(EVENT.TANK_DESTROYED, this.handleTankDestroyed.bind(this));

  }

  // HANDLE EVENT --------------------------------------------------------------------------------------------------------------------------------
  handleGameWin(data) {
    console.log("Game Won!");

    if (this.isRunning == true) {
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
    console.log("Game Over:", data.reason);
    this.score = 0;
    if (this.isRunning == true) {
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

  // handleObjectDestroyed({ object }) {
  //   if (object.faction === FACTION.ENEMY) {
  //     if (this.checkWinCondition()) {
  //       this.addScore(500);


  //     }
  //   }
  // }

  handleTankDestroyed(data) {
    const { tank, pointValue } = data;

    if (tank && tank.faction === FACTION.ENEMY && pointValue) {
      this.addScore(pointValue);
      const index = this.enemies.indexOf(tank);
      if (index !== -1) {
        this.enemies.splice(index, 1);
      }
    
      console.log("Remaining enemies:", this.enemies.length);

      if (this.isWin() == true) {
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
    return this.isRunning && this.enemies.length == 0;
  }

  handlePlayerDie(data) {
    console.log("Player died");
    setTimeout(() => {
      EventManager.instance.notify(EVENT.GAME_OVER, {
        reason: "Player died",
        score: this.score,
        highScore: this.highScore
      });
    }, 1000);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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

    // Cập nhật phạm vi cho phép đổ bóng
    updateShadowArea(this.lights.directionalLight, playerPos);
  }

  resetGame() {
    this.stop();

    EventManager.instance.unsubscribe(EVENT.PLAYER_DIE);
    EventManager.instance.unsubscribe(EVENT.GAME_OVER);
    EventManager.instance.unsubscribe(EVENT.GAME_WIN);
    EventManager.instance.unsubscribe(EVENT.TANK_DESTROYED);

    if (this.rocks) {
      this.rocks.forEach(rock => {
        if (rock && !rock.disposed) {
          rock.dispose();
        }
      });
      this.rocks = [];
    }

    if (this.trees) {
      this.trees.forEach(tree => {
        if (tree && !tree.disposed) {
          tree.dispose();
        }
      });
      this.trees = [];
    }

    if (this.enemies) {
      this.enemies.forEach(enemy => {
        if (enemy && !enemy.disposed) {
          enemy.dispose();
        }
      });
      this.enemies = [];
    }
    
    this.projectilesManager.clear();
    this.eventManager.clearAllEvents();
    //this.dispose();
    this.initGame();
  }

  setSelectedTank(tankType = TANKTYPE.V001) {
    return tankType;
  }

  loadHighScore() {
    try {
      const savedHighScore = localStorage.getItem('tankGame_highScore');
      let highScore = null;
      if (savedHighScore) {
        highScore = parseInt(savedHighScore);
      }
      return (highScore != null) ? highScore : 0;
    } catch (e) {
      console.error("ERR--Game.loadHighScore()", e);
      return 0;
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem('tankGame_highScore', this.highScore.toString());
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
      console.log("Starting game...");
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

      const animate = () => {
        if (this.isRunning) {
          this.updateLogic();
          this.renderer.render(this.scene, this.camera);
          requestAnimationFrame(animate);
        }
      };
      animate();
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

      const animate = () => {
        if (this.isRunning) {
          this.updateLogic();
          this.renderer.render(this.scene, this.camera);
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }

  dispose() {
    this.stop();

    EventManager.instance.unsubscribe(EVENT.PLAYER_DIE);
    EventManager.instance.unsubscribe(EVENT.GAME_OVER);
    EventManager.instance.unsubscribe(EVENT.GAME_WIN);
    EventManager.instance.unsubscribe(EVENT.TANK_DESTROYED);

    if (this.player && typeof this.player.dispose === 'function') {
      this.player.dispose();
      this.player = null;
    }

    if (this.rocks) {
      this.rocks.forEach(rock => {
        if (rock && !rock.disposed) {
          rock.dispose();
        }
      });
      this.rocks = [];
    }

    if (this.trees) {
      this.trees.forEach(tree => {
        if (tree && !tree.disposed) {
          tree.dispose();
        }
      });
      this.trees = [];
    }

    if (this.projectilesManager) {
      this.projectilesManager.clear();
    }

    if (this.playerTank && !this.playerTank.disposed) {
      this.playerTank.dispose();
    }

    // Tiêu hủy tất cả enemies từ mảng
    if (this.enemies) {
      this.enemies.forEach(enemy => {
        if (enemy && !enemy.disposed) {
          enemy.dispose();
        }
      });
      this.enemies = [];
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.scene) {
      this.scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

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
    
    this.player = null;
    this.camera = null;
    this.controls = null;
    this.lights = null;
    this.sky = null;
    this.ground = null;
    this.debugHelpers = null;

    console.log("Game instance disposed");
    Game.instance = null;
  }
}

export { Game };
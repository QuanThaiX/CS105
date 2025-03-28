import * as THREE from 'three';
import { createGround, createSky, createCamera, createDebugHelpers, createLights, createRenderer, createScene} from './createEnvironment.js';
import { GAMECONFIG } from '../config.js';
import { FACTION, EVENT} from '../utils.js';
import { Tank } from './Tank.js';
import { PlayerControl } from './PlayerControl.js';
import { CollisionManager } from './CollisionManager.js';
import { EventManager } from './EventManager.js';
import { ProjectilesManager } from './ProjectilesManager.js';
import { Bot } from './Bot.js';

/**
 * Tách việc cập nhật Logic và render
 * Refactor code
 * Level loader
 * Bổ sung texture
 * Bổ sung HUD
 * Thêm các vật thể
 * Thêm các sự kiện
 * Them các item
 * Thêm các loại đạn
 */

class Game {
  static instance;
  scene;
  camera;
  renderer;
  controls;
  isRunning = false;
  constructor() {
    if (Game.instance) {
      return Game.instance;
    }
    Game.instance = this;
    this.initGame()
  }
  initGame() {
    this.collisionManager = new CollisionManager();
    this.eventManager = new EventManager();
    this.projectilesManager = new ProjectilesManager();
    this.bot = new Bot();

    this.scene = createScene();
    this.renderer = createRenderer();
    this.lights = createLights(this.scene);
    this.sky = createSky(this.scene);
    this.ground = createGround(this.scene, {width: 500, height: 500, repeatX: 25, repeatY: 25});
    this.debugHelpers = createDebugHelpers(this.scene);

    this.registerEventListeners();
    this.loadLevel();
  }

  registerEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize(), false);
    EventManager.instance.subscribe(EVENT.PLAYER_DIE, this.handlePlayerDie.bind(this));
    EventManager.instance.subscribe(EVENT.PLAYER_RESTART, this.handlePlayerRestart.bind(this));
    EventManager.instance.subscribe(EVENT.GAME_OVER, this.handleGameOver.bind(this));
    EventManager.instance.subscribe(EVENT.GAME_WIN, this.handleGameWin.bind(this));
    EventManager.instance.subscribe(EVENT.OBJECT_DESTROYED, this.handleObjectDestroyed.bind(this));
  }

  handleObjectDestroyed({ object }) {
    if (object.faction === FACTION.ENEMY) {
      const remainingEnemies = [
        this.enemy1, this.enemy2, this.enemy3, 
        this.enemy4, this.enemy5, this.enemy6
      ].filter(enemy => enemy && !enemy.disposed);
      
      if (remainingEnemies.length === 0) {
        setTimeout(() => {
          EventManager.instance.notify(EVENT.GAME_WIN, { reason: "All enemies destroyed" });
        }, 1000);
      }
    }
  }

  loadLevel() {
    this.playerTank = new Tank(0, FACTION.PLAYER, { x: 0, y: 1, z: 0 }, true);
    this.player = new PlayerControl(this.playerTank);

    this.enemy1 = new Tank(1, FACTION.ENEMY, { x: 10, y: 1, z: 0 }, true);
    this.bot.addTank(this.enemy1);
    this.enemy2 = new Tank(2, FACTION.ENEMY, { x: -15, y: 1, z: 15 }, true);
    this.bot.addTank(this.enemy2);
    this.enemy3 = new Tank(3, FACTION.ENEMY, { x: 0, y: 1, z: -20 }, true);
    this.bot.addTank(this.enemy3);
    this.enemy4 = new Tank(4, FACTION.ENEMY, { x: 30, y: 1, z: 20 }, true);
    this.bot.addTank(this.enemy4);
    this.enemy5 = new Tank(5, FACTION.ENEMY, { x: -45, y: 1, z: 10 }, true);
    this.bot.addTank(this.enemy5);
    this.enemy6 = new Tank(6, FACTION.ENEMY, { x: 70, y: 1, z: -20 }, true);
    this.bot.addTank(this.enemy6);

    this.collisionManager.add(this.playerTank);
    this.collisionManager.add(this.enemy1);
    this.collisionManager.add(this.enemy2);
    this.collisionManager.add(this.enemy3);
    this.collisionManager.add(this.enemy4);
    this.collisionManager.add(this.enemy5);
    this.collisionManager.add(this.enemy6);

    const { camera, controls } = createCamera(this.scene, this.playerTank.position, this.renderer);
    this.camera = camera;
    this.controls = controls;
    
    // Thông báo level đã được tải
    EventManager.instance.notify(EVENT.LEVEL_LOADED, {
      playerTank: this.playerTank,
      enemies: [this.enemy1, this.enemy2, this.enemy3, this.enemy4, this.enemy5, this.enemy6]
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getHUDData() {
    return {
      playerHP: Game.instance.playerTank.hp || 500,
      ammo: 10
    }
  }

  updateLogic() {
    const prevPlayerPos = this.playerTank.position.clone();

    this.player.update();
    this.bot.update();
    this.collisionManager.update();
    this.projectilesManager.update();

    this.playerTank.update();
    if (this.enemy1 && !this.enemy1.disposed) this.enemy1.update();
    if (this.enemy2 && !this.enemy2.disposed) this.enemy2.update();
    if (this.enemy3 && !this.enemy3.disposed) this.enemy3.update();
    if (this.enemy4 && !this.enemy4.disposed) this.enemy4.update();
    if (this.enemy5 && !this.enemy5.disposed) this.enemy5.update();
    if (this.enemy6 && !this.enemy6.disposed) this.enemy6.update();

    const newPlayerPos = this.playerTank.position.clone();
    const delta = new THREE.Vector3().subVectors(newPlayerPos, prevPlayerPos);
    this.camera.position.add(delta);
    const playerPos = this.playerTank.position;
    this.controls.target.set(playerPos.x, playerPos.y + 1, playerPos.z);
    this.controls.update();

  }

  handlePlayerDie(data) {
    console.log("Player died");
    setTimeout(() => {
      EventManager.instance.notify(EVENT.GAME_OVER, { reason: "Player died" });
    }, 1000);
  }
  
  handlePlayerRestart() {
    this.resetGame();
  }
  
  handleGameOver(data) {
    console.log("Game Over:", data.reason);
    this.stop();
  }
  
  handleGameWin(data) {
    console.log("Game Won!");
    this.stop();
  }
  
  resetGame() {
    this.projectilesManager.clear();
    this.stop();
    this.initGame();
    this.start();
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      
      EventManager.instance.notify(EVENT.GAME_STARTED, {
        playerTank: this.playerTank
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

  stop() {
    this.isRunning = false;
  }
  
  pause() {
    if (this.isRunning) {
      this.isRunning = false;
      EventManager.instance.notify(EVENT.GAME_PAUSED, {});
    }
  }
  
  resume() {
    if (!this.isRunning) {
      this.isRunning = true;
      EventManager.instance.notify(EVENT.GAME_RESUMED, {});
      this.start();
    }
  }
}

export { Game };
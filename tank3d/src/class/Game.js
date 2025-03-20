import * as THREE from 'three';
import { createGround } from './Ground.js';
import { createSky } from './Sky.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GAMECONFIG } from '../config.js';
import { toRad, FACTION } from '../utils.js';
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

    // Scene setup-----------------------------------------------------------------------------------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x123456);

    // Add renderer-----------------------------------------------------------------------------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(this.renderer.domElement);


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

    // Add camera-----------------------------------------------------------------------------------------------------------------------------
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.playerTank.position).add(new THREE.Vector3(0, 1, 0));
    this.controls.update();
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    // console.log(this.camera.projectionMatrix);

    // Add Light-----------------------------------------------------------------------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 0);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
    directionalLight.position.set(200, 400, 200);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;

    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.near = 100;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.bias = -0.0001;
    this.scene.add(directionalLight);

    if (GAMECONFIG.DEBUG === true) {
      const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
      this.scene.add(shadowHelper);
    }


    // Add ground-----------------------------------------------------------------------------------------------------------------------------
    this.ground = createGround(this.scene, {
      width: 500,
      height: 500,
      repeatX: 25,
      repeatY: 25
    });

    // Add sky --------------------------------------------------------------------------------------------------------------------------------
    this.sky = createSky(this.scene);

    if (GAMECONFIG.DEBUG === true) {
      const axesHelper = new THREE.AxesHelper(100);
      this.scene.add(axesHelper);
    }

    window.addEventListener('resize', () => this.onWindowResize(), false);
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

  start() {
    const animate = () => {
      this.updateLogic();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(animate);
    };
    animate();
  }

  stop() {
    this.renderer.setAnimationLoop(null)
  }
}

export { Game };
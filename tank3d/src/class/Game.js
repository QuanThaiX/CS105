import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GAMECONFIG } from '../config.js';
import { toRad } from '../calc.js';
import { Tank, FACTION } from './Tank.js';
import { PlayerControl } from './PlayerControl.js';
import { CollisionManager } from './CollisionManager.js';
import { EventManager } from './EventManager.js';

class Game {
  static instance;
  scene;
  camera;
  renderer;
  projectiles = [];
  constructor() {
    if (Game.instance){
      return Game.instance;
    }
    Game.instance = this;
    this.initGame()
  }
  initGame() {
    this.collisionManager = new CollisionManager();
    this.eventManager = new EventManager();

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
    // this.enemy1.startAutoShoot();

    this.collisionManager.add(this.playerTank);
    this.collisionManager.add(this.enemy1);

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

    if (GAMECONFIG.DEBUG === true){
      const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
      this.scene.add(shadowHelper);
    }




    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0x13d64b })
    );
    plane.rotation.x = toRad(-90);
    plane.receiveShadow = true;
    this.scene.add(plane);


    if (GAMECONFIG.DEBUG === true){
      const axesHelper = new THREE.AxesHelper(100);
      this.scene.add(axesHelper);
    }

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  onKeyDown(event) {
    this.keys[event.code] = true;
    if (event.code === "Space" && !event.repeat) {
      const projectile = this.playerTank.shoot();
      if (projectile) {
        this.projectiles.push(projectile);
      }
    }
  }

  onKeyUp(event) {
    this.keys[event.code] = false;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getHUDData(){
    return {
      playerHP: Game.instance.playerTank.hp || 500,
      ammo: 10
    }
  }

  updateLogic() {
    const prevPlayerPos = this.playerTank.position.clone();
    
    this.player.update();
    this.collisionManager.update();

    this.projectiles.forEach((projectile, index) => {
      projectile.update();
      // Nếu đạn quá xa thì loại bỏ khỏi scene
      if (projectile.position.distanceTo(this.playerTank.position) > 100) {
        this.scene.remove(projectile.mesh);
        this.collisionManager.remove(projectile);
        this.projectiles.splice(index, 1);
      }
    });

    

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

export { Game }
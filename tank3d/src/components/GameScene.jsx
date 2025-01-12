import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Tank from './Tank';
import GameCamera from './GameCamera';

class GameScene {
  constructor(mountRef) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer();
    this.mountRef = mountRef;

    this.camera = new GameCamera(this.scene);

    this.controls = null;
    this.tank = null;

    this.initRenderer();
    this.addControls();
    this.addLights();
    this.addGround();
    this.addTank();
  }

  initRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.mountRef.current.appendChild(this.renderer.domElement);
  }

  addControls() {
    this.controls = new OrbitControls(this.camera.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;

    this.controls.mouseButtons = {
      RIGHT: THREE.MOUSE.ROTATE,
      LEFT: null,
      MIDDLE: null,
    };
    this.controls.enablePan = false;
    this.controls.enableKeys = false;
  }

  addLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  addGround() {
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
  }

  addTank() {
    this.tank = new Tank(this.scene);
  }

  update() {
    if (this.tank) {
      this.camera.update(this.tank.tank.position);
    }
  }

  startAnimation() {
    const animate = () => {
        if (this.tank) {
          this.tank.updatePosition();
          this.camera.update(this.tank.tank.position); 
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera.camera);
        requestAnimationFrame(animate);
      };
    animate();
  }

  cleanUp() {
    this.mountRef.current.removeChild(this.renderer.domElement);
  }
}

const Scene = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const gameScene = new GameScene(mountRef);
    gameScene.startAnimation();

    return () => {
      gameScene.cleanUp();
    };
  }, []);

  return <div ref={mountRef}></div>;
};

export default Scene;
// ./class/PowerUp.js
import * as THREE from 'three';
import { GameObject } from './GameObject.js';
import { Game } from './Game.js';
import { FACTION } from '../utils.js';
import { CollisionManager } from './CollisionManager.js';

const glowTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return new THREE.CanvasTexture(canvas);
})();


export class PowerUp extends GameObject {
    constructor(id, type) {
        // Create at an inactive position
        super(id, FACTION.NEUTRAL, { x: 0, y: -100, z: 0 }, false); // isCollision = false initially
        
        this.powerUpType = type;
        this.isActive = false;

        this.initialY = 1.5; 
        this.time = Math.random() * Math.PI * 2;

        this.innerCore = null;
        this.outerIndicator = null;
        
        this.createEnhancedModel();
        this.model.visible = false;
    }
    
    createEnhancedModel() {
        const powerUpGroup = new THREE.Group();
        const coreGeometry = new THREE.IcosahedronGeometry(0.6, 0);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: this.powerUpType.color,
            emissive: this.powerUpType.color,
            emissiveIntensity: 0.8,
            metalness: 0.2,
            roughness: 0.3,
            transparent: true,
            opacity: 0.9,
        });
        this.innerCore = new THREE.Mesh(coreGeometry, coreMaterial);
        powerUpGroup.add(this.innerCore);

        const indicatorGeometry = new THREE.TorusGeometry(1.0, 0.08, 8, 48);
        const indicatorMaterial = new THREE.MeshStandardMaterial({
            color: this.powerUpType.color,
            emissive: this.powerUpType.color,
            emissiveIntensity: 0.4,
            metalness: 0.5,
            roughness: 0.5,
        });
        this.outerIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        this.outerIndicator.rotation.x = Math.PI / 2;
        powerUpGroup.add(this.outerIndicator);
        
        const light = new THREE.PointLight(this.powerUpType.color, 20, 12);
        light.castShadow = true;
        powerUpGroup.add(light);
        
        const glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: this.powerUpType.color,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
        });
        const glowSprite = new THREE.Sprite(glowMaterial);
        glowSprite.scale.set(5, 5, 1);
        powerUpGroup.add(glowSprite);
        
        powerUpGroup.position.copy(this.position);
        this.setModel(powerUpGroup);
    }
    
    activate(position) {
        this.isActive = true;
        this.isCollision = true; 
        this.model.visible = true;
        this.model.scale.set(1, 1, 1); 

        this.position.copy(position);
        this.position.y = 1.5;
        this.initialY = this.position.y;
        this.model.position.copy(this.position);

        CollisionManager.instance.add(this);
    }
    
    deactivate() {
        this.isActive = false;
        this.isCollision = false; 
        this.model.visible = false;
        
        CollisionManager.instance.remove(this); 
        
        this.position.set(0, -100, 0);
        this.model.position.copy(this.position);
    }

    update() {
        if (!this.isActive || !this.model) return;

        this.time += 0.02;

        this.model.position.y = this.initialY + Math.sin(this.time) * 0.4;
        this.model.rotation.y += 0.01;
        this.innerCore.rotation.x += 0.015;
        this.innerCore.rotation.y += 0.015;
        this.outerIndicator.rotation.z += 0.02;
        this.position.copy(this.model.position);
    }
    
    collect() {
        if (!this.isActive) return;
        this.deactivate(); 
    }

}
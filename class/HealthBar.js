import * as THREE from 'three'
import { Game } from './Game.js'
import { GAMECONFIG } from '../config.js'

class HealthBar {
    constructor(parent, maxHp) {
        this.parent = parent;
        this.maxHp = maxHp;
        this.currentHP = maxHp;
        
        this.barWidth = 2.0;
        this.barHeight = 0.25;
        this.yOffset = 2.5;
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = 130;
        this.canvas.height = 25;
        this.context = this.canvas.getContext('2d');
        
        this.texture = new THREE.CanvasTexture(this.canvas);
        
        const material = new THREE.SpriteMaterial({
            map: this.texture,
            transparent: true,
            depthTest: true,
            sizeAttenuation: true // Đảm bảo thanh máu thay đổi kích thước theo khoảng cách
        });
        
        this.sprite = new THREE.Sprite(material);
        this.sprite.scale.set(this.barWidth, this.barHeight, 1);
        
        Game.instance.scene.add(this.sprite);
        
        this.updateBar();
    }
    
    updateHP(hp) {
        this.currentHP = Math.max(0, Math.min(hp, this.maxHp));
        this.sprite.scale.set(this.barWidth, this.barHeight, 1);
        this.updateBar();
    }
    
    updateBar() {
        const ctx = this.context;
        const canvas = this.canvas;
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#777777';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(2, 2, width - 4, height - 4);
        const healthPercent = this.currentHP / this.maxHp;
        if (healthPercent > 0) {
            ctx.fillStyle = '#00FF00';
            const healthWidth = (width - 4) * healthPercent;
            ctx.fillRect(2, 2, healthWidth, height - 4);
        }
        
        this.texture.needsUpdate = true;
    }
    
    update() {
        if (this.parent && this.parent.position && this.sprite) {
            let yOffset = this.yOffset;
            
            if (this.parent.tankType && this.parent.tankType.name === "V007") {
                yOffset = 3.5;
            }
            
            this.sprite.position.set(
                this.parent.position.x,
                this.parent.position.y + yOffset,
                this.parent.position.z
            );
            
            this.sprite.renderOrder = 100;
        }
    }
    
    remove() {
        if (this.sprite) {
            Game.instance.scene.remove(this.sprite);
            this.sprite.material.dispose();
            this.sprite.material.map.dispose();
            this.sprite = null;
        }
    }
}

export { HealthBar };
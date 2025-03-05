import * as THREE from 'three'
import { Game } from 'Game.js'
import { GAMECONFIG } from '../config.js'

class HealthBar {
    position;
    maxHP;
    curHP;
    barWidth;
    barHeight;
    constructor(pos){
        this.barHeight = 0.1;
        this.barWidth = 1;

        const bgMaterial = new THREE.SpriteMaterial({ color: 0x17fc03})
    }
    update(){

    }

    remove(){

    }
}
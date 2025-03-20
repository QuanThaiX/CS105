import * as THREE from 'three';
import { Game } from './Game.js'

/**
 * Bổ sung hitbox tạo thời điểm tạo, và đc cập nhật khi object di chuyển
 */

class GameObject {
    id;
    faction;
    position; // THREE.Vector3
    hitBox;
    model;
    isCollision; // bool

    constructor(id, faction, position, isCollision){
        this.id = id;
        this.faction = faction;
        this.position = new THREE.Vector3(position.x, position.y, position.z);
        this.isCollision = isCollision;
    }

    setDefault(){
    }

    setPosition(position){
        this.position = position;
        this.model.position = this.position;
        this.hitBox.position = this.position;
    }

    setModel(model){
        this.model = model;
        Game.instance.scene.add(this.model);
    }

    setFaction(faction){
        this.faction = faction;
    }

    setCollision(isCollision){
        this.isCollision = isCollision;
    }

    dispose(){
        if (this.model && Game.instance.scene) {
            Game.instance.scene.remove(this.model);
        }
        this.model = null;
    }

    update(){
    }
}

export { GameObject }
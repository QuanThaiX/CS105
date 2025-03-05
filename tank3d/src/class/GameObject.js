import * as THREE from 'three';
import { Game } from './Game.js'

class GameObject {
    id;
    type;
    position; // THREE.Vector3
    boundingBox;
    model;
    isCollision; // bool

    constructor(id, type, position, isCollision){
        this.id = id;
        this.type = type;
        this.position = new THREE.Vector3(position.x, position.y, position.z);
        this.isCollision = isCollision;
    }

    setDefault(){
    }

    setModel(model){
        this.model = model;
        Game.instance.scene.add(this.model);
    }

    setType(type){
        this.type = type;
    }

    setCollision(isCollision){
        this.isCollision = isCollision;
    }

    dispose(){

    }

    updateLogic(){
    }
}

export { GameObject }
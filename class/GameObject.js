import * as THREE from 'three';
import { Game } from './Game.js'
import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';

class GameObject {
    id;
    faction;
    position; // THREE.Vector3
    hitBox;
    model;
    isCollision; // bool
    hp;
    maxHp;
    disposed = false;

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
        if (!model) return;
        this.model = model;
        this.model.userData = model.userData;
        Game.instance.scene.add(this.model);
        EventManager.instance.notify(EVENT.OBJECT_LOADED, {
            object: this,
            model: this.model
        });
    }

    setFaction(faction){
        this.faction = faction;
    }

    setCollision(isCollision){
        this.isCollision = isCollision;
    }

    takeDamage(damage, source) {
        if (this.hp !== undefined) {
            this.hp -= damage;

            EventManager.instance.notify(EVENT.OBJECT_DAMAGED, {
                object: this,
                damage: damage,
                source: source,
                remainingHp: this.hp
            });
            
            if (this.hp <= 0) {
                this.destroy();
            }
            
            return true;
        }
        return false;
    }

    /**
     * Thực hiện xử lí các logic của game
     */
    destroy() {
        if (!this.disposed) {
            this.dispose();
        }
    }

    /*
     * Xóa khỏi scene
     */
    dispose(){
        if (this.disposed) return;
        if (this.model && Game.instance.scene) {
            Game.instance.scene.remove(this.model);
        }
        this.model = null;
        this.disposed = true;
    }

    update(){
    }
}

export { GameObject }
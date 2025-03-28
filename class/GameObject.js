import * as THREE from 'three';
import { Game } from './Game.js'
import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';

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
        // EventManager.instance.notify(EVENT.OBJECT_MOVED, {
        //     object: this,
        //     position: this.position
        // });
    }

    setModel(model){
        this.model = model;
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

    destroy() {
        if (!this.disposed) {
            EventManager.instance.notify(EVENT.OBJECT_DESTROYED, {
                object: this
            });
            
            this.dispose();
        }
    }

    dispose(){
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
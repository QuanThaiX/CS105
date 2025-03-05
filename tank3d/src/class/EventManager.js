import { instance } from "three/src/nodes/TSL.js";

class EventManager {
    static instance
    events // event -> callbacks[]

    constructor(events = {}) {
        if (EventManager.instance){
            return EventManager.instance;
          }
        EventManager.instance = this;
        this.events = events;
    }

    subscribe(event, callback){
        if (!this.events[event]){
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    unsubscribe(event, callback_remove){
        if (this.events[event]){
            this.events[event] = this.events[event].filter(callback => callback !== callback_remove);
        }
    }

    notify(event, data){
        if (this.events[event]){
            this.events[event].forEach(callback => callback(data));
        }
    }
}

export {EventManager}
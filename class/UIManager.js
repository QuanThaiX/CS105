
import { EventManager } from './EventManager.js';
import { EVENT, FACTION } from '../utils.js';

class UIManager {
    static instance;

    constructor() {
        if (UIManager.instance) {
            return UIManager.instance;
        }
        UIManager.instance = this;
        
        this.messageContainer = document.getElementById('message-container');
        if (!this.messageContainer) {
            this.messageContainer = document.createElement('div');
            this.messageContainer.id = 'message-container';
            document.body.appendChild(this.messageContainer);
            console.warn('UIManager: #message-container was not found in HTML. A new one has been created.');
        }

        this.killFeedContainer = document.getElementById('kill-feed-container');
        if (!this.killFeedContainer) {
            this.killFeedContainer = document.createElement('div');
            this.killFeedContainer.id = 'kill-feed-container';
            document.getElementById('hud')?.appendChild(this.killFeedContainer);
        }

        this.subscribeToEvents();
        console.log('✅ UI Manager initialized and listening for events.');
    }

    subscribeToEvents() {
        EventManager.instance.subscribe(EVENT.UI_SHOW_MESSAGE, this.handleShowMessage.bind(this));
        EventManager.instance.subscribe(EVENT.TANK_DESTROYED, this.handleKillFeedUpdate.bind(this));
    }

    /**
     * Handles the UI_SHOW_MESSAGE event to display a temporary message on screen.
     * @param {object} data - The event data.
     * @param {string} data.message - The text to display.
     * @param {number} [data.duration=1000] - How long the message stays on screen (in ms).
     * @param {string} [data.type='info'] - The type of message ('info', 'warning', 'heal', 'error').
     */
    handleShowMessage(data) {
        if (!this.messageContainer) return;
    
        const { message, duration = 1000, type = 'info' } = data;

        
        const messageElement = document.createElement('div');
        messageElement.className = `game-message ${type}`;
        messageElement.textContent = message;

        
        this.messageContainer.appendChild(messageElement);

        setTimeout(() => {
            messageElement.classList.add('fade-out');
            setTimeout(() => {
                if (messageElement.parentNode) {
                    this.messageContainer.removeChild(messageElement);
                }
            }, 500); 
        }, duration);
    }
    
    /**
     * @param {object} data - The event data.
     * @param {Tank} data.tank - The tank that was destroyed.
     * @param {GameObject} data.killer - The object that got the kill.
     */
    handleKillFeedUpdate(data) {
        if (!this.killFeedContainer) return;
        
        const { tank: victim, killer } = data;
        if (!victim) return;

        let killerName = 'The Environment';
        let killerFaction = FACTION.NEUTRAL;
        let victimName = victim.id;
        
        if (killer) {
            killerName = (killer.faction === FACTION.PLAYER) ? 'Player' : killer.id;
            killerFaction = killer.faction;
        }
        
        if (victim.faction === FACTION.PLAYER) {
            victimName = 'Player';
        }

        const killFeedElement = document.createElement('div');
        killFeedElement.className = 'kill-feed-item';
        
        const killerSpan = document.createElement('span');
        killerSpan.textContent = killerName;
        killerSpan.className = `killer faction-${killerFaction}`;
        
        const victimSpan = document.createElement('span');
        victimSpan.textContent = victimName;
        victimSpan.className = `victim faction-${victim.faction}`;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'kill-icon';
        iconSpan.innerHTML = '💥';

        killFeedElement.appendChild(killerSpan);
        killFeedElement.appendChild(iconSpan);
        killFeedElement.appendChild(victimSpan);

        this.killFeedContainer.prepend(killFeedElement);

        setTimeout(() => {
            killFeedElement.classList.add('fade-out');
            setTimeout(() => {
                if (killFeedElement.parentNode) {
                    this.killFeedContainer.removeChild(killFeedElement);
                }
            }, 1000);
        }, 5000);
    }
}

export { UIManager };
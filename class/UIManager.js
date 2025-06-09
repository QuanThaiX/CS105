// ./class/UIManager.js
import { EventManager } from './EventManager.js';
import { EVENT } from '../utils.js';

class UIManager {
    static instance;

    constructor() {
        if (UIManager.instance) {
            return UIManager.instance;
        }
        UIManager.instance = this;

        // Find or create the message container
        this.messageContainer = document.getElementById('message-container');
        if (!this.messageContainer) {
            this.messageContainer = document.createElement('div');
            this.messageContainer.id = 'message-container';
            document.body.appendChild(this.messageContainer);
            console.warn('UIManager: #message-container was not found in HTML. A new one has been created.');
        }

        this.subscribeToEvents();
        console.log('✅ UI Manager initialized and listening for events.');
    }

    subscribeToEvents() {
        EventManager.instance.subscribe(EVENT.UI_SHOW_MESSAGE, this.handleShowMessage.bind(this));
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

        // Create the message element
        const messageElement = document.createElement('div');
        messageElement.className = `game-message ${type}`;
        messageElement.textContent = message;

        // Add it to the container
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
}

export { UIManager };
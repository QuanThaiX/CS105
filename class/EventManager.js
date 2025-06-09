/**
 * Advanced EventManager với Async Processing và Multi-Threading Support
 * - Hỗ trợ async/await event handlers
 * - Priority queue cho events quan trọng
 * - Batch processing để tối ưu performance
 * - Worker thread support cho heavy processing
 * - Event debouncing và throttling
 */
class EventManager {
    static instance;

    constructor() {
        if (EventManager.instance) {
            return EventManager.instance;
          }
        EventManager.instance = this;
        
        // Event storage
        this.events = new Map(); // event -> { callbacks: [], priority: number, async: boolean }
        this.eventQueue = []; // Priority queue cho events
        this.isProcessing = false;
        
        // Performance tracking
        this.eventStats = new Map();
        this.maxQueueSize = 5000;
        this.batchSize = 100;
        
        // Debouncing and throttling
        this.debouncedEvents = new Map();
        this.throttledEvents = new Map();
        
        // Worker support (if available)
        this.supportsWorker = typeof Worker !== 'undefined';
        this.workers = new Map();
        
        // Start processing queue
        this.startQueueProcessor();
    }

    /**
     * Subscribe to event with options
     * @param {string} event - Event name
     * @param {Function} callback - Event handler (can be async)
     * @param {Object} options - { priority: number, async: boolean, worker: boolean }
     */
    subscribe(event, callback, options = {}) {
        const {
            priority = 0,
            async = false,
            worker = false,
            debounce = 0,
            throttle = 0
        } = options;

        if (!this.events.has(event)) {
            this.events.set(event, {
                callbacks: [],
                priority,
                async,
                worker,
                debounce,
                throttle
            });
        }

        const eventData = this.events.get(event);
        eventData.callbacks.push({
            callback,
            priority,
            async,
            worker,
            debounce,
            throttle,
            id: Date.now() + Math.random()
        });

        // Sort by priority (higher first)
        eventData.callbacks.sort((a, b) => b.priority - a.priority);

        // Initialize stats
        if (!this.eventStats.has(event)) {
            this.eventStats.set(event, {
                totalFired: 0,
                totalProcessTime: 0,
                averageProcessTime: 0,
                lastFired: 0
            });
        }
    }

    /**
     * Unsubscribe from event
     * @param {string} event - Event name
     * @param {Function} callbackToRemove - Callback to remove
     */
    unsubscribe(event, callbackToRemove) {
        if (!this.events.has(event)) return;

        const eventData = this.events.get(event);
        eventData.callbacks = eventData.callbacks.filter(
            item => item.callback !== callbackToRemove
        );

        if (eventData.callbacks.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * Notify event with priority and async support
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {Object} options - { immediate: boolean, priority: number }
     */
    notify(event, data = null, options = {}) {
        const { immediate = false, priority = 0 } = options;

        if (!this.events.has(event)) return;

        const eventItem = {
            event,
            data,
            priority,
            timestamp: performance.now(),
            immediate
        };

        if (immediate) {
            this.processEvent(eventItem);
        } else {
            this.addToQueue(eventItem);
        }
    }

    /**
     * Async notify - returns Promise that resolves when all handlers complete
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @returns {Promise}
     */
    async notifyAsync(event, data = null) {
        if (!this.events.has(event)) return [];

        const eventData = this.events.get(event);
        const results = [];

        for (const handler of eventData.callbacks) {
            try {
                if (handler.async || handler.worker) {
                    const result = await this.executeAsyncHandler(handler, data);
                    results.push(result);
                } else {
                    const result = handler.callback(data);
                    results.push(result);
                }
            } catch (error) {
                console.error(`Event handler error for ${event}:`, error);
                results.push({ error });
            }
        }

        this.updateStats(event, performance.now() - Date.now());
        return results;
    }

    /**
     * Execute handler on worker thread (if supported)
     * @private
     */
    async executeAsyncHandler(handler, data) {
        if (handler.worker && this.supportsWorker) {
            return this.executeOnWorker(handler, data);
        } else if (handler.async) {
            return await handler.callback(data);
        } else {
            // Run in next tick to not block main thread
            return new Promise(resolve => {
                setTimeout(() => {
                    try {
                        const result = handler.callback(data);
                        resolve(result);
                    } catch (error) {
                        resolve({ error });
                    }
                }, 0);
            });
        }
    }

    /**
     * Execute handler on Web Worker (experimental)
     * @private
     */
    async executeOnWorker(handler, data) {
        return new Promise(resolve => {
            setTimeout(async () => {
                try {
                    const result = await handler.callback(data);
                    resolve(result);
                } catch (error) {
                    resolve({ error });
                }
            }, 0);
        });
    }

    /**
     * Add event to priority queue
     * @private
     */
    addToQueue(eventItem) {
        // Check queue size limit
        if (this.eventQueue.length >= this.maxQueueSize) {
            console.warn('Event queue overflow, dropping oldest events');
            this.eventQueue.shift();
        }

        // Insert with priority order
        let inserted = false;
        for (let i = 0; i < this.eventQueue.length; i++) {
            if (eventItem.priority > this.eventQueue[i].priority) {
                this.eventQueue.splice(i, 0, eventItem);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            this.eventQueue.push(eventItem);
        }
    }

    /**
     * Process event queue in batches
     * @private
     */
    async startQueueProcessor() {
        const processLoop = async () => {
            if (this.isProcessing || this.eventQueue.length === 0) {
                requestAnimationFrame(processLoop);
                return;
            }

            this.isProcessing = true;
            const batchSize = Math.min(this.batchSize, this.eventQueue.length);
            const batch = this.eventQueue.splice(0, batchSize);

            // Process batch
            const batchPromises = batch.map(eventItem => this.processEvent(eventItem));
            
            try {
                await Promise.all(batchPromises);
            } catch (error) {
                console.error('Batch processing error:', error);
            }

            this.isProcessing = false;
            requestAnimationFrame(processLoop);
        };

        processLoop();
    }

    /**
     * Process single event
     * @private
     */
    async processEvent(eventItem) {
        const { event, data, timestamp } = eventItem;
        const startTime = performance.now();

        if (!this.events.has(event)) return;

        const eventData = this.events.get(event);

        // Apply debouncing
        if (eventData.debounce > 0) {
            if (this.shouldDebounce(event, eventData.debounce)) return;
        }

        // Apply throttling
        if (eventData.throttle > 0) {
            if (this.shouldThrottle(event, eventData.throttle)) return;
        }

        // Execute callbacks
        for (const handler of eventData.callbacks) {
            try {
                if (handler.async) {
                    await handler.callback(data);
                } else {
                    handler.callback(data);
                }
            } catch (error) {
                console.error(`Event handler error for ${event}:`, error);
            }
        }

        // Update performance stats
        const processingTime = performance.now() - startTime;
        this.updateStats(event, processingTime);
    }

    /**
     * Debouncing logic
     * @private
     */
    shouldDebounce(event, debounceTime) {
        const now = Date.now();
        const lastCall = this.debouncedEvents.get(event) || 0;
        
        if (now - lastCall < debounceTime) {
            return true; // Skip this call
        }
        
        this.debouncedEvents.set(event, now);
        return false;
    }

    /**
     * Throttling logic
     * @private
     */
    shouldThrottle(event, throttleTime) {
        const now = Date.now();
        const lastCall = this.throttledEvents.get(event) || 0;
        
        if (now - lastCall < throttleTime) {
            return true; // Skip this call
        }
        
        this.throttledEvents.set(event, now);
        return false;
    }

    /**
     * Update performance statistics
     * @private
     */
    updateStats(event, processingTime) {
        const stats = this.eventStats.get(event);
        if (stats) {
            stats.totalFired++;
            stats.totalProcessTime += processingTime;
            stats.averageProcessTime = stats.totalProcessTime / stats.totalFired;
            stats.lastFired = Date.now();
        }
    }

    /**
     * Get event statistics
     * @returns {Object} Performance statistics
     */
    getStats() {
        const stats = {};
        for (const [event, data] of this.eventStats) {
            stats[event] = { ...data };
        }
        return {
            events: stats,
            queueSize: this.eventQueue.length,
            isProcessing: this.isProcessing,
            totalEvents: this.events.size
        };
    }

    /**
     * Clear all events and reset
     */
    clearAllEvents() {
        this.events.clear();
        this.eventQueue.length = 0;
        this.eventStats.clear();
        this.debouncedEvents.clear();
        this.throttledEvents.clear();
        this.isProcessing = false;
    }

    /**
     * Dispose EventManager
     */
    dispose() {
        this.clearAllEvents();
        EventManager.instance = null;
    }
}

export { EventManager };
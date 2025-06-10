// ./class/ProjectileWorker.js

// --- A lightweight, self-contained Vec3 for math inside the worker ---
class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}

let projectiles = new Map();
let config = {
    lifeTime: 5000,
    worldBoundary: 500,
};
let updateInterval = null;
const TICK_RATE = 1000 / 60; // 60 FPS

// --- Main Message Handler ---
self.onmessage = (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            config = { ...config, ...payload };
            if (!updateInterval) {
                updateInterval = setInterval(tick, TICK_RATE);
            }
            break;
        case 'add':
            // Convert plain object to Vec3 instances for calculations
            payload.position = new Vec3(payload.position.x, payload.position.y, payload.position.z);
            payload.velocity = new Vec3(payload.velocity.x, payload.velocity.y, payload.velocity.z);
            payload.creationTime = performance.now();
            projectiles.set(payload.id, payload);
            break;
        case 'remove':
            projectiles.delete(payload.id);
            break;
        case 'clear':
            projectiles.clear();
            break;
    }
};

/**
 * The core loop of the worker. It runs at a fixed rate (60fps).
 */
function tick() {
    if (projectiles.size === 0) return;

    const updates = [];
    const removals = [];
    const now = performance.now();
    const boundary = config.worldBoundary / 2;

    projectiles.forEach(p => {
        // 1. Update position based on velocity
        p.position.x += p.velocity.x;
        p.position.y += p.velocity.y;
        p.position.z += p.velocity.z;

        const isExpired = now - p.creationTime > config.lifeTime;
        const isOutOfBounds = Math.abs(p.position.x) > boundary || Math.abs(p.position.z) > boundary || p.position.y < -10;

        if (isExpired || isOutOfBounds) {
            removals.push(p.id);
        } else {
            updates.push({
                id: p.id,
                newPosition: { x: p.position.x, y: p.position.y, z: p.position.z }
            });
        }
    });

    // 4. Process all removals
    if (removals.length > 0) {
        removals.forEach(id => projectiles.delete(id));
    }

    // 5. Send a single batch of updates back to the main thread
    if (updates.length > 0 || removals.length > 0) {
        self.postMessage({ type: 'updates', payload: { updates, removals } });
    }
}
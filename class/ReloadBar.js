// ./class/Rock.js

import * as THREE from 'three';
import { Game } from './Game.js';

class ReloadBar {
    constructor(tank) {
        this.tank = tank;
        this.scene = Game.instance.scene;
        this.isVisible = false;

        this.barWidth = 1.5;
        this.barHeight = 0.15;

        const bgGeometry = new THREE.PlaneGeometry(this.barWidth, this.barHeight);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.8
        });
        this.background = new THREE.Mesh(bgGeometry, bgMaterial);
        
        // Create the foreground of the bar (the filling part)
        const fgGeometry = new THREE.PlaneGeometry(this.barWidth, this.barHeight);
        const fgMaterial = new THREE.MeshBasicMaterial({
            color: 0xf0ad4e,
        });
        this.foreground = new THREE.Mesh(fgGeometry, fgMaterial);

        this.barGroup = new THREE.Group();
        this.barGroup.add(this.background);
        this.barGroup.add(this.foreground);
        

        this.foreground.position.z = 0.001;
        
        // The group is hidden by default
        this.barGroup.visible = false;
        this.scene.add(this.barGroup);
    }

    /**
     * Call this method right after the player shoots.
     * It simply makes the bar visible and lets the update loop handle the rest.
     */
    startReload() {
        if (!this.tank) return;
        this.isVisible = true;
        this.barGroup.visible = true;
    }

    /**
     * This function now runs every frame and handles EVERYTHING:
     * - Positioning and following the tank (relative to the health bar).
     * - Facing the camera.
     * - Calculating and displaying the reload progress.
     * - Hiding the bar when finished.
     */
    update() {
        if (!this.isVisible || !this.tank || this.tank.disposed) {
            if (this.barGroup.visible) {
                this.barGroup.visible = false;
            }
            return;
        }

        const now = Date.now();
        const timeSinceShot = now - this.tank.lastShotTime;
        const reloadProgress = Math.min(timeSinceShot / this.tank.shootCooldown, 1.0);

        this.foreground.scale.x = reloadProgress;
        this.foreground.position.x = - (1 - reloadProgress) * (this.barWidth / 2);

        const healthBar = this.tank.healthBar;

        if (healthBar && healthBar.sprite && healthBar.isReady) {
            const healthBarPosition = healthBar.sprite.position;
            const verticalOffset = (healthBar.barHeight / 2) + (this.barHeight / 2) + 0.05;

            this.barGroup.position.set(
                healthBarPosition.x,
                healthBarPosition.y - verticalOffset,
                healthBarPosition.z
            );
        } else {
            const barPosition = this.tank.position.clone();
            barPosition.y += 2.2; 
            this.barGroup.position.copy(barPosition);
        }


        // Make the bar always face the camera
        this.barGroup.quaternion.copy(Game.instance.camera.quaternion);

        // --- HIDE WHEN COMPLETE ---
        if (reloadProgress >= 1.0) {
            this.isVisible = false;
            this.barGroup.visible = false;
        }
    }

    /**
     * Cleans up the bar from the scene to prevent memory leaks.
     */
    remove() {
        if (this.scene && this.barGroup) {
            this.scene.remove(this.barGroup);
            this.background.geometry.dispose();
            this.background.material.dispose();
            this.foreground.geometry.dispose();
            this.foreground.material.dispose();
        }
        this.tank = null;
    }
}

export { ReloadBar };
// ./class/SpawnManager
export class SpawnManager {
  constructor(worldBoundary, cellSize) {
    this.worldBoundary = worldBoundary;
    this.cellSize = cellSize;
    this.gridSize = Math.ceil(worldBoundary / cellSize);
    this.grid = Array(this.gridSize * this.gridSize).fill(false); // false = empty
    this.halfBoundary = worldBoundary / 2;
  }

  // Convert world position to grid index
  getGridIndex(position) {
    const x = Math.floor((position.x + this.halfBoundary) / this.cellSize);
    const z = Math.floor((position.z + this.halfBoundary) / this.cellSize);
    return z * this.gridSize + x;
  }
  
  // Mark a cell as occupied
  markOccupied(position, objectRadius = 0) {
    // Mark a small area around the object
    const radiusInCells = Math.ceil(objectRadius / this.cellSize);
    const center_x = Math.floor((position.x + this.halfBoundary) / this.cellSize);
    const center_z = Math.floor((position.z + this.halfBoundary) / this.cellSize);

    for (let z = -radiusInCells; z <= radiusInCells; z++) {
        for (let x = -radiusInCells; x <= radiusInCells; x++) {
            const current_x = center_x + x;
            const current_z = center_z + z;
            if (current_x >= 0 && current_x < this.gridSize && current_z >= 0 && current_z < this.gridSize) {
                const index = current_z * this.gridSize + current_x;
                this.grid[index] = true; // true = occupied
            }
        }
    }
  }

  // Find a safe spawn position
  findSafeSpawnPosition(playerPos, minPlayerDist, maxAttempts = 50) {
    const minPlayerDistCells = Math.floor(minPlayerDist / this.cellSize);

    for (let i = 0; i < maxAttempts; i++) {
      const randIndex = Math.floor(Math.random() * this.grid.length);

      if (!this.grid[randIndex]) { // Is the cell empty?
        const gridZ = Math.floor(randIndex / this.gridSize);
        const gridX = randIndex % this.gridSize;

        // Check distance from player
        const playerGridX = Math.floor((playerPos.x + this.halfBoundary) / this.cellSize);
        const playerGridZ = Math.floor((playerPos.z + this.halfBoundary) / this.cellSize);
        const distSq = Math.pow(gridX - playerGridX, 2) + Math.pow(gridZ - playerGridZ, 2);

        if (distSq > Math.pow(minPlayerDistCells, 2)) {
          // Found a good cell, convert back to world coordinates
          const worldX = (gridX * this.cellSize) - this.halfBoundary + (this.cellSize / 2);
          const worldZ = (gridZ * this.cellSize) - this.halfBoundary + (this.cellSize / 2);
          return { x: worldX, y: 1, z: worldZ };
        }
      }
    }
    console.warn("Could not find a safe spawn position after max attempts.");
    return null; // Failed to find a spot
  }
}
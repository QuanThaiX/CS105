// ./loader.js
import * as THREE from 'three';
import { GLTFLoader } from "./three/examples/jsm/loaders/GLTFLoader.js";
import { TANKTYPE } from './utils.js';

class ModelLoader {
    static instance;
    
    constructor() {
        if (ModelLoader.instance) {
            return ModelLoader.instance;
        }
        ModelLoader.instance = this;
        
        this.loader = new GLTFLoader();
        this.modelCache = new Map(); // Cache for loaded models
        this.loadingPromises = new Map(); // Track loading promises
        this.isPreloaded = false;
        this.maxCacheSize = 20; // Giới hạn số lượng model trong cache
        this.cloneCount = new Map(); // Theo dõi số lần clone
    }

    /**
     * Preload all models when starting the game
     * @returns {Promise<boolean>} - Promise resolve when all models are loaded
     */
    async preloadAllModels() {
        console.log("🚀 Starting to preload all models...");
        
        const loadPromises = [];
        const failedLoads = [];
        
        // Load all tank models
        Object.values(TANKTYPE).forEach(tankType => {
            // Xử lý tank với custom renderer (JS model)
            if (tankType.useCustomRenderer && tankType.assetPathJS) {
                console.log(`📥 Adding custom JS tank ${tankType.name} to preload queue`);
                
                const promise = import(tankType.assetPathJS)
                    .then(module => {
                        // Gọi hàm createTank để tạo model
                        const tank = module.createTank();
                        this.modelCache.set(`tank_${tankType.name}`, tank);
                        this.cloneCount.set(`tank_${tankType.name}`, 0);
                        console.log(`📦 Cached custom JS tank model: ${tankType.name}`);
                        return tank;
                    })
                    .catch(err => {
                        console.warn(`⚠️ Failed to load custom JS tank ${tankType.name}:`, err.message);
                        failedLoads.push(`tank_${tankType.name}`);
                        return null;
                    });
                    
                loadPromises.push(promise);
            }
            // Xử lý tank với GLTF model
            else if (tankType.assetPathGLTF) {
                const promise = this._loadModel(tankType.assetPathGLTF, `tank_${tankType.name}`)
                    .catch(err => {
                        console.warn(`⚠️ Failed to load tank ${tankType.name}:`, err.message);
                        failedLoads.push(`tank_${tankType.name}`);
                        return null;
                    });
                loadPromises.push(promise);
            }
        });
        
        // Load rock models
        const rockTypes = ['rock09', 'rock13'];
        rockTypes.forEach(rockType => {
            const promise = this._loadModel(`./assets/${rockType}/${rockType}.gltf`, `rock_${rockType}`)
                .catch(err => {
                    console.warn(`⚠️ Cannot load rock ${rockType}:`, err.message);
                    failedLoads.push(`rock_${rockType}`);
                    return null;
                });
            loadPromises.push(promise);
        });
        
        // Load tree models
        const treeTypes = ['tree01'];
        treeTypes.forEach(treeType => {
            const promise = this._loadModel(`./assets/${treeType}/${treeType}.gltf`, `tree_${treeType}`)
                .catch(err => {
                    console.warn(`⚠️ Cannot load tree ${treeType}:`, err.message);
                    failedLoads.push(`tree_${treeType}`);
                    return null;
                });
            loadPromises.push(promise);
        });
        
        // Load barrel model (if available)
        const additionalModels = [
            { path: './assets/barrel/barrel.gltf', key: 'barrel' }
        ];
        
        additionalModels.forEach(({ path, key }) => {
            const promise = this._loadModel(path, key).catch(err => {
                console.warn(`⚠️ Cannot load model ${key}:`, err.message);
                failedLoads.push(key);
                return null;
            });
            loadPromises.push(promise);
        });
        
        try {
            const results = await Promise.all(loadPromises);
            const successfulLoads = results.filter(result => result !== null).length;
            
            this.isPreloaded = true;
            console.log(`✅ Preload completed: ${successfulLoads}/${loadPromises.length} models loaded successfully`);
            console.log(`📦 Cached ${this.modelCache.size} models in RAM`);
            
            if (failedLoads.length > 0) {
                console.warn(`❌ Failed to load: ${failedLoads.join(', ')}`);
            }
            
            return successfulLoads > 0; // Return true if at least some models loaded
        } catch (error) {
            console.error("❌ Critical error while preloading models:", error);
            return false;
        }
    }

    /**
     * Load a model from file path and cache it
     * @private
     * @param {string} path - Path to model file
     * @param {string} cacheKey - Key to cache the model
     * @returns {Promise<THREE.Group>} - Promise resolve with loaded model
     */
    async _loadModel(path, cacheKey) {
        // If already cached, return cached version
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey);
        }
        
        // If currently loading, return existing promise
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey);
        }
        
        // Check cache size limit
        if (this.modelCache.size >= this.maxCacheSize) {
            console.warn(`⚠️ Model cache full (${this.maxCacheSize}), clearing least used models`);
            this._clearLeastUsedModels();
        }
        
        const loadPromise = new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Setup shadows for all meshes in model
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Cải thiện material properties cho hiệu ứng metal (đặc biệt cho tank)
                            if (cacheKey.startsWith('tank_') && child.material) {
                                if (child.material.isMeshStandardMaterial) {
                                    // Giữ nguyên texture hiện có nhưng cải thiện material properties
                                    child.material.metalness = 0.1; // Tăng metalness cho hiệu ứng kim loại
                                    child.material.roughness = 0.9; // Giảm roughness để tăng phản chiếu
                                    //child.material.envMapIntensity = 1.0; // Tăng cường environment mapping
                                } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                    // Chuyển đổi sang MeshStandardMaterial để có hiệu ứng tốt hơn
                                    const newMaterial = new THREE.MeshStandardMaterial({
                                        map: child.material.map,
                                        color: child.material.color,
                                        metalness: 0.1,
                                        roughness: 0.9,
                                        //envMapIntensity: 1.0
                                    });
                                    child.material = newMaterial;
                                }
                            }
                        }
                    });
                    
                    // Cache model và khởi tạo clone counter
                    this.modelCache.set(cacheKey, model);
                    this.cloneCount.set(cacheKey, 0);
                    this.loadingPromises.delete(cacheKey);
                    
                    console.log(`📦 Cached model: ${cacheKey}`);
                    resolve(model);
                },
                (progress) => {
                    // Progress callback ít verbose hơn
                    if (progress.total > 0) {
                        const percent = (progress.loaded / progress.total * 100).toFixed(0);
                        if (percent % 25 === 0) { // Chỉ log ở 0%, 25%, 50%, 75%, 100%
                            console.log(`📥 Loading ${cacheKey}: ${percent}%`);
                        }
                    }
                },
                (error) => {
                    this.loadingPromises.delete(cacheKey);
                    console.error(`❌ Failed to load ${cacheKey}:`, error);
                    reject(error);
                }
            );
        });
        
        this.loadingPromises.set(cacheKey, loadPromise);
        return loadPromise;
    }

    /**
     * Clear least used models from cache to free memory
     * @private
     */
    _clearLeastUsedModels() {
        // Sắp xếp theo số lần sử dụng (clone count)
        const sortedEntries = Array.from(this.cloneCount.entries())
            .sort((a, b) => a[1] - b[1]); // Tăng dần theo clone count
        
        // Xóa 25% model ít được sử dụng nhất
        const toRemove = Math.floor(this.modelCache.size * 0.25);
        
        for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
            const [cacheKey] = sortedEntries[i];
            this._disposeModel(cacheKey);
            console.log(`🗑️ Removed least used model: ${cacheKey}`);
        }
    }

    /**
     * Properly dispose a model and remove from cache
     * @private
     * @param {string} cacheKey - Cache key of model to dispose
     */
    _disposeModel(cacheKey) {
        const model = this.modelCache.get(cacheKey);
        if (model) {
            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        
        this.modelCache.delete(cacheKey);
        this.cloneCount.delete(cacheKey);
    }

    /**
     * Get clone of tank model from cache with error handling
     * @param {Object} tankType - TANKTYPE object
     * @param {THREE.Vector3} position - Tank position
     * @returns {THREE.Group|null} - Clone of tank model or null if not loaded
     */
    getTankModel(tankType, position = new THREE.Vector3(0, 0, 0)) {
        const cacheKey = `tank_${tankType.name}`;
        if (!this.modelCache.has(cacheKey)) {
            // Xử lý custom JS tank model
            if (tankType.useCustomRenderer && tankType.assetPathJS) {
                console.log(`⚠️ Custom JS tank ${tankType.name} not in cache, loading on-demand...`);
                
                try {
                    // Sử dụng dynamic import để load module
                    return import(tankType.assetPathJS)
                        .then(module => {
                            const model = module.createTank();
                            // Cache model và khởi tạo clone counter
                            this.modelCache.set(cacheKey, model);
                            this.cloneCount.set(cacheKey, 1);
                            // Apply tank transforms
                            this._applyTankTransforms(model, tankType, position);
                            return model;
                        })
                        .catch(error => {
                            console.error(`❌ Error loading custom JS tank ${tankType.name}:`, error);
                            return null;
                        });
                } catch (error) {
                    console.error(`❌ Error importing JS module for tank ${tankType.name}:`, error);
                    return null;
                }
            } else {
                console.error(`❌ Tank model ${tankType.name} has not been preloaded!`);
                return null;
            }
        }
        
        try {
            const originalModel = this.modelCache.get(cacheKey);
            const clonedModel = this._deepCloneModel(originalModel);
            
            // Tăng clone counter
            this.cloneCount.set(cacheKey, (this.cloneCount.get(cacheKey) || 0) + 1);
            
            // Apply tank-specific transforms
            this._applyTankTransforms(clonedModel, tankType, position);
            return clonedModel;
        } catch (error) {
            console.error(`❌ Error cloning tank model ${tankType.name}:`, error);
            return null;
        }
    }

    /**
     * Get clone of rock model from cache with error handling
     * @param {string} rockType - Rock type (rock09, rock13)
     * @param {THREE.Vector3} position - Rock position
     * @param {number} scale - Rock scale
     * @param {number} rotation - Rock rotation
     * @returns {THREE.Group|null} - Clone of rock model
     */
    getRockModel(rockType, position = new THREE.Vector3(0, 0, 0), scale = 1, rotation = 0) {
        const cacheKey = `rock_${rockType}`;
        
        if (!this.modelCache.has(cacheKey)) {
            console.error(`❌ Rock model ${rockType} has not been preloaded!`);
            return null;
        }
        
        try {
            const originalModel = this.modelCache.get(cacheKey);
            const clonedModel = this._deepCloneModel(originalModel);
            
            // Tăng clone counter
            this.cloneCount.set(cacheKey, (this.cloneCount.get(cacheKey) || 0) + 1);
            
            clonedModel.position.copy(position);
            clonedModel.scale.setScalar(scale);
            clonedModel.rotation.y = rotation;
            
            return clonedModel;
        } catch (error) {
            console.error(`❌ Error cloning rock model ${rockType}:`, error);
            return null;
        }
    }

    /**
     * Get clone of tree model from cache with error handling
     * @param {string} treeType - Tree type (tree01)
     * @param {THREE.Vector3} position - Tree position
     * @param {number} scale - Tree scale
     * @param {number} rotation - Tree rotation
     * @returns {THREE.Group|null} - Clone of tree model
     */
    getTreeModel(treeType, position = new THREE.Vector3(0, 0, 0), scale = 1, rotation = 0) {
        const cacheKey = `tree_${treeType}`;
        
        if (!this.modelCache.has(cacheKey)) {
            console.error(`❌ Tree model ${treeType} has not been preloaded!`);
            return null;
        }
        
        try {
            const originalModel = this.modelCache.get(cacheKey);
            const clonedModel = this._deepCloneModel(originalModel);
            
            // Tăng clone counter
            this.cloneCount.set(cacheKey, (this.cloneCount.get(cacheKey) || 0) + 1);
            
            clonedModel.position.copy(position);
            clonedModel.scale.setScalar(scale);
            clonedModel.rotation.y = rotation;
            
            return clonedModel;
        } catch (error) {
            console.error(`❌ Error cloning tree model ${treeType}:`, error);
            return null;
        }
    }

    /**
     * Get clone of barrel model from cache with error handling
     * @param {string} barrelType - Barrel type
     * @param {THREE.Vector3} position - Barrel position
     * @param {number} scale - Barrel scale
     * @param {number} rotation - Barrel rotation
     * @returns {THREE.Group|null} - Clone of barrel model
     */
    getBarrelModel(barrelType, position = new THREE.Vector3(0, 0, 0), scale = 1, rotation = 0) {
        const cacheKey = 'barrel';
        
        if (!this.modelCache.has(cacheKey)) {
            console.error(`❌ Barrel model has not been preloaded!`);
            return null;
        }
        
        try {
            const originalModel = this.modelCache.get(cacheKey);
            const clonedModel = this._deepCloneModel(originalModel);
            
            // Tăng clone counter
            this.cloneCount.set(cacheKey, (this.cloneCount.get(cacheKey) || 0) + 1);
            
            clonedModel.position.copy(position);
            clonedModel.scale.setScalar(scale);
            clonedModel.rotation.y = rotation;
            
            return clonedModel;
        } catch (error) {
            console.error(`❌ Error cloning barrel model ${barrelType}:`, error);
            return null;
        }
    }

    /**
     * Deep clone model with proper material and geometry handling
     * @private
     * @param {THREE.Group} originalModel - Original model to clone
     * @returns {THREE.Group} - Deep cloned model
     */
    _deepCloneModel(originalModel) {
        const clonedModel = originalModel.clone();
        
        // Ensure materials are properly cloned to avoid sharing references
        clonedModel.traverse((child) => {
            if (child.isMesh && child.material) {
                // Clone material to avoid shared references
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => mat.clone());
                } else {
                    child.material = child.material.clone();
                }
            }
        });
        
        return clonedModel;
    }

    /**
     * Apply tank-specific transformations
     * @private
     * @param {THREE.Group} model - Tank model
     * @param {Object} tankType - TANKTYPE object
     * @param {THREE.Vector3} position - Tank position
     */
    _applyTankTransforms(model, tankType, position) {
        // ============================ THE FIX ============================
        // Compare tankType.name (a string) instead of the tankType object.
        // This is a robust way to identify the tank type.
        switch (tankType.name) {
            case TANKTYPE.V001.name:
                model.position.set(position.x, position.y, position.z);
                model.scale.set(3.5, 3.5, 3.5);
                break;
            case TANKTYPE.V003.name:
                model.position.set(position.x, position.y - 1, position.z);
                model.scale.set(3.0, 3.0, 3.0);
                break;
            case TANKTYPE.V002.name:
                model.position.set(position.x, position.y - 1, position.z);
                model.scale.set(2.0, 2.0, 2.0);
                break;
            case TANKTYPE.V004.name:
                model.position.set(position.x, position.y - 1, position.z);
                model.scale.set(2.4, 2.4, 2.4);
                break;
            case TANKTYPE.V005.name:
                model.position.set(position.x, position.y - 1, position.z);
                model.scale.set(1.4, 1.4, 1.4);
                break;
            case TANKTYPE.V006.name:
                model.position.set(position.x, position.y - 1, position.z);
                model.scale.set(1.2, 1.2, 1.2);
                break;
            case TANKTYPE.V007.name:
                model.position.set(position.x, position.y - 1 + 0.3, position.z);
                model.scale.set(1.2, 1.2, 1.2); 
                break;
            case TANKTYPE.V008.name:
                model.position.set(position.x, position.y - 1 + 0.3, position.z);
                model.scale.set(1.2, 1.2, 1.2); 
                break;
            case TANKTYPE.V009.name:
                model.position.copy(position);
                model.position.y = position.y - 1; 
                break;
            case TANKTYPE.V010.name:
                model.position.copy(position);
                model.position.y = position.y + 0.3; 
                break;
            case TANKTYPE.V011.name:
                model.position.copy(position);
                model.position.y = position.y - 0.2; 
                break;
            default:
                // Default behavior for any tanks not listed above
                model.position.copy(position);
                model.scale.set(3.5, 3.5, 3.5);
                break;
        }
        // ===============================================================
    }

    /**
     * Check if model is cached
     * @param {string} cacheKey - Cache key to check
     * @returns {boolean} - True if model is cached
     */
    isModelCached(cacheKey) {
        return this.modelCache.has(cacheKey);
    }

    /**
     * Get cache information
     * @returns {Object} - Cache statistics
     */
    getCacheInfo() {
        return {
            modelCount: this.modelCache.size,
            modelKeys: Array.from(this.modelCache.keys()),
            memoryUsage: this._estimateMemoryUsage()
        };
    }

    /**
     * Estimate memory usage (rough calculation)
     * @private
     * @returns {string} - Memory usage estimate
     */
    _estimateMemoryUsage() {
        let totalVertices = 0;
        let totalTriangles = 0;
        
        this.modelCache.forEach((model, key) => {
            model.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    const geometry = child.geometry;
                    if (geometry.attributes.position) {
                        totalVertices += geometry.attributes.position.count;
                        if (geometry.index) {
                            totalTriangles += geometry.index.count / 3;
                        }
                    }
                }
            });
        });
        
        const estimatedMB = (totalVertices * 32 + totalTriangles * 12) / (1024 * 1024);
        return `~${estimatedMB.toFixed(2)} MB`;
    }

    /**
     * Clear all cached models
     */
    clearCache() {
        this.modelCache.forEach((model, key) => {
            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        });
        
        this.modelCache.clear();
        this.loadingPromises.clear();
        this.isPreloaded = false;
        
        console.log("🗑️ Cleared model cache");
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        this.clearCache();
        ModelLoader.instance = null;
    }

    /**
     * Log detailed information about cached models
     */
    logCachedModels() {
        try {
            const tankTypes = Object.keys(this.modelCache.tanks || {});
            if (tankTypes.length > 0) {
                console.log(`Tank models in cache (${tankTypes.length} types):`);
                tankTypes.forEach(typeName => {
                    const model = this.modelCache.tanks[typeName];
                    console.log(`- ${typeName}: ${model ? '✅ Loaded' : '❌ Failed'}`);
                });
            } else {
                console.log("No tank models in cache");
            }

            const sceneryTypes = Object.keys(this.modelCache.scenery || {});
            if (sceneryTypes.length > 0) {
                console.log(`Scenery models in cache (${sceneryTypes.length} types):`);
                sceneryTypes.forEach(typeName => {
                    const model = this.modelCache.scenery[typeName];
                    console.log(`- ${typeName}: ${model ? '✅ Loaded' : '❌ Failed'}`);
                });
            } else {
                console.log("No scenery models in cache");
            }

            console.log("Cache memory usage estimation:", this.estimateCacheMemoryUsage());
        } catch (error) {
            console.error("Error logging cached models:", error);
        }
    }

    /**
     * Estimate memory usage of cached models
     * @returns {string} Estimated memory usage
     */
    estimateCacheMemoryUsage() {
        try {
            let totalGeometryVertices = 0;
            let totalMaterials = 0;
            let totalTextures = 0;
            
            // Count all model components
            Object.values(this.modelCache).forEach(category => {
                Object.values(category).forEach(model => {
                    if (model && model.traverse) {
                        model.traverse(obj => {
                            if (obj.geometry) {
                                totalGeometryVertices += obj.geometry.attributes.position ? 
                                    obj.geometry.attributes.position.count : 0;
                            }
                            if (obj.material) {
                                totalMaterials++;
                                if (obj.material.map) totalTextures++;
                            }
                        });
                    }
                });
            });
            
            // Rough estimation of memory (very approximate)
            const vertexBytes = totalGeometryVertices * 12; // 3 floats * 4 bytes per vertex
            const materialBytes = totalMaterials * 1024; // ~1KB per material (rough estimate)
            const textureBytes = totalTextures * 262144; // ~256KB per texture (very rough)
            
            const totalBytes = vertexBytes + materialBytes + textureBytes;
            
            if (totalBytes > 1048576) {
                return `~${(totalBytes / 1048576).toFixed(2)} MB`;
            } else {
                return `~${(totalBytes / 1024).toFixed(2)} KB`;
            }
        } catch (error) {
            console.error("Error estimating cache memory:", error);
            return "Unknown";
        }
    }
}

export { ModelLoader };
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
        this.modelCache = new Map(); // Cache cho models đã load
        this.loadingPromises = new Map(); // Track loading promises
        this.isPreloaded = false;
    }

    /**
     * Preload tất cả models khi khởi động game
     * @returns {Promise<boolean>} - Promise resolve khi tất cả models đã load xong
     */
    async preloadAllModels() {
        console.log("🚀 Bắt đầu preload tất cả models...");
        
        const loadPromises = [];
        
        // Load tất cả tank models
        Object.values(TANKTYPE).forEach(tankType => {
            if (tankType.assetPathGLTF) {
                const promise = this._loadModel(tankType.assetPathGLTF, `tank_${tankType.name}`);
                loadPromises.push(promise);
            }
        });
        
        // Load rock models
        const rockTypes = ['rock09', 'rock13'];
        rockTypes.forEach(rockType => {
            const promise = this._loadModel(`./assets/${rockType}/${rockType}.gltf`, `rock_${rockType}`);
            loadPromises.push(promise);
        });
        
        // Load tree models
        const treeTypes = ['tree01'];
        treeTypes.forEach(treeType => {
            const promise = this._loadModel(`./assets/${treeType}/${treeType}.gltf`, `tree_${treeType}`);
            loadPromises.push(promise);
        });
        
        // Load barrel model (nếu có)
        const additionalModels = [
            { path: './assets/barrel/barrel.gltf', key: 'barrel' }
        ];
        
        additionalModels.forEach(({ path, key }) => {
            const promise = this._loadModel(path, key).catch(err => {
                console.warn(`⚠️ Không thể load model ${key}:`, err.message);
                return null; // Không fail toàn bộ quá trình preload
            });
            loadPromises.push(promise);
        });
        
        try {
            await Promise.all(loadPromises);
            this.isPreloaded = true;
            console.log("✅ Preload tất cả models thành công!");
            console.log(`📦 Đã cache ${this.modelCache.size} models trong RAM`);
            return true;
        } catch (error) {
            console.error("❌ Lỗi khi preload models:", error);
            return false;
        }
    }

    /**
     * Load một model từ file path và cache nó
     * @private
     * @param {string} path - Đường dẫn đến file model
     * @param {string} cacheKey - Key để cache model
     * @returns {Promise<THREE.Group>} - Promise resolve với model đã load
     */
    async _loadModel(path, cacheKey) {
        // Nếu đã có trong cache, return cached version
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey);
        }
        
        // Nếu đang load, return existing promise
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey);
        }
        
        const loadPromise = new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Setup shadows cho tất cả mesh trong model
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Log texture info
                            if (child.material && child.material.map) {
                                console.log(`✅ Texture loaded for ${cacheKey}:`, child.material.map);
                            } else if (child.material) {
                                console.warn(`⚠️ Missing texture for ${cacheKey}:`, child.name);
                            }
                        }
                    });
                    
                    // Cache model
                    this.modelCache.set(cacheKey, model);
                    this.loadingPromises.delete(cacheKey);
                    
                    console.log(`📦 Cached model: ${cacheKey}`);
                    resolve(model);
                },
                (progress) => {
                    // Progress callback (optional)
                    const percent = (progress.loaded / progress.total * 100).toFixed(1);
                    console.log(`📥 Loading ${cacheKey}: ${percent}%`);
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
     * Lấy clone của tank model từ cache
     * @param {Object} tankType - TANKTYPE object
     * @param {THREE.Vector3} position - Vị trí đặt tank
     * @returns {THREE.Group|null} - Clone của tank model hoặc null nếu chưa load
     */
    getTankModel(tankType, position = new THREE.Vector3(0, 0, 0)) {
        const cacheKey = `tank_${tankType.name}`;
        
        if (!this.modelCache.has(cacheKey)) {
            console.error(`❌ Tank model ${tankType.name} chưa được preload!`);
            return null;
        }
        
        const originalModel = this.modelCache.get(cacheKey);
        const clonedModel = originalModel.clone();
        
        // Apply tank-specific transforms
        this._applyTankTransforms(clonedModel, tankType, position);
        
        return clonedModel;
    }

    /**
     * Lấy clone của rock model từ cache
     * @param {string} rockType - Loại rock (rock09, rock13)
     * @param {THREE.Vector3} position - Vị trí đặt rock
     * @param {number} scale - Scale của rock
     * @param {number} rotation - Rotation của rock
     * @returns {THREE.Group|null} - Clone của rock model
     */
    getRockModel(rockType, position = new THREE.Vector3(0, 0, 0), scale = 1, rotation = 0) {
        const cacheKey = `rock_${rockType}`;
        
        if (!this.modelCache.has(cacheKey)) {
            console.error(`❌ Rock model ${rockType} chưa được preload!`);
            return null;
        }
        
        const originalModel = this.modelCache.get(cacheKey);
        const clonedModel = originalModel.clone();
        
        clonedModel.position.copy(position);
        clonedModel.scale.setScalar(scale);
        clonedModel.rotation.y = rotation;
        
        return clonedModel;
    }

    /**
     * Lấy clone của tree model từ cache
     * @param {string} treeType - Loại tree (tree01)
     * @param {THREE.Vector3} position - Vị trí đặt tree
     * @param {number} scale - Scale của tree
     * @param {number} rotation - Rotation của tree
     * @returns {THREE.Group|null} - Clone của tree model
     */
    getTreeModel(treeType, position = new THREE.Vector3(0, 0, 0), scale = 1, rotation = 0) {
        const cacheKey = `tree_${treeType}`;
        
        if (!this.modelCache.has(cacheKey)) {
            console.error(`❌ Tree model ${treeType} chưa được preload!`);
            return null;
        }
        
        const originalModel = this.modelCache.get(cacheKey);
        const clonedModel = originalModel.clone();
        
        clonedModel.position.copy(position);
        clonedModel.scale.setScalar(scale);
        clonedModel.rotation.y = rotation;
        
        return clonedModel;
    }

    /**
     * Lấy clone của barrel model từ cache
     * @param {string} barrelType - Loại barrel (barrel)
     * @param {THREE.Vector3} position - Vị trí đặt barrel
     * @param {number} scale - Scale của barrel
     * @param {number} rotation - Rotation của barrel
     * @returns {THREE.Group|null} - Clone của barrel model
     */
    getBarrelModel(barrelType, position = new THREE.Vector3(0, 0, 0), scale = 1, rotation = 0) {
        const cacheKey = `barrel`;
        
        if (!this.modelCache.has(cacheKey)) {
            console.error(`❌ Barrel model chưa được preload!`);
            return null;
        }
        
        const originalModel = this.modelCache.get(cacheKey);
        const clonedModel = originalModel.clone();
        
        clonedModel.position.copy(position);
        clonedModel.scale.setScalar(scale);
        clonedModel.rotation.y = rotation;
        
        return clonedModel;
    }

    /**
     * Apply tank-specific transforms (tương tự như trong loadTankModel cũ)
     * @private
     * @param {THREE.Group} model - Tank model
     * @param {Object} tankType - TANKTYPE object
     * @param {THREE.Vector3} position - Vị trí tank
     */
    _applyTankTransforms(model, tankType, position) {
        if (tankType === TANKTYPE.V001) {
            model.position.set(position.x, position.y, position.z);
            model.scale.set(3.5, 3.5, 3.5);
        } else if (tankType === TANKTYPE.V003) {
            model.position.set(position.x, position.y - 1, position.z);
            model.scale.set(3.0, 3.0, 3.0);
        } else if (tankType === TANKTYPE.V002) {
            model.position.set(position.x, position.y - 1, position.z);
            model.scale.set(2.0, 2.0, 2.0);
        } else if (tankType === TANKTYPE.V004) {
            model.position.set(position.x, position.y - 1, position.z);
            model.scale.set(2.4, 2.4, 2.4);
        } else if (tankType === TANKTYPE.V005) {
            model.position.set(position.x, position.y - 1, position.z);
            model.scale.set(1.4, 1.4, 1.4);
        } else if (tankType === TANKTYPE.V006) {
            model.position.set(position.x, position.y - 1, position.z);
            model.scale.set(1.2, 1.2, 1.2);
        } else {
            model.position.copy(position);
            model.scale.set(3.5, 3.5, 3.5);
        }
    }

    /**
     * Kiểm tra xem model đã được cache chưa
     * @param {string} cacheKey - Key của model trong cache
     * @returns {boolean} - True nếu model đã có trong cache
     */
    isModelCached(cacheKey) {
        return this.modelCache.has(cacheKey);
    }

    getCacheInfo() {
        return {
            totalModels: this.modelCache.size,
            modelKeys: Array.from(this.modelCache.keys()),
            isPreloaded: this.isPreloaded,
            memoryUsage: this._estimateMemoryUsage()
        };
    }

    _estimateMemoryUsage() {
        let totalVertices = 0;
        let totalTextures = 0;
        
        this.modelCache.forEach((model, key) => {
            model.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    totalVertices += child.geometry.attributes.position.count;
                }
                if (child.material && child.material.map) {
                    totalTextures++;
                }
            });
        });
        
        const estimatedMB = (totalVertices * 48 + totalTextures * 2) / (1024 * 1024);
        return `~${estimatedMB.toFixed(1)} MB`;
    }

    /**
     * Clear cache và giải phóng memory
     */
    clearCache() {
        console.log("🧹 Clearing model cache...");
        
        this.modelCache.forEach((model, key) => {
            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
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
        
        console.log("✅ Model cache cleared");
    }

    /**
     * Dispose instance
     */
    dispose() {
        this.clearCache();
        ModelLoader.instance = null;
    }
}

export { ModelLoader }; 
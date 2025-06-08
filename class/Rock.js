import * as THREE from 'three';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { GameObject } from './GameObject.js';
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT, HITBOX_SCALE } from '../utils.js';
import { ModelLoader } from '../loader.js';

class Rock extends GameObject {
    constructor(id, position, scale = 1, rotation = 0, rockType = 'rock09') {
        super(id, 'neutral', position, true);
        this.scale = scale;
        this.rockType = rockType;
        this.rotation = rotation; 
        this.hitBoxScale = HITBOX_SCALE.ROCK;
        this.loadModel();
    }

    loadModel() {
        // Thử lấy từ ModelLoader cache trước
        const modelLoader = new ModelLoader();
        
        if (modelLoader.isPreloaded) {
            try {
                const model = modelLoader.getRockModel(
                    this.rockType, 
                    this.position, 
                    this.scale, 
                    this.rotation
                );
                
                if (model) {
                    // Setup shadows cho model từ cache
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Cải thiện material cho đá để tạo shadow và ánh sáng tốt hơn
                            if (child.material) {
                                if (child.material.isMeshStandardMaterial) {
                                    child.material.roughness = 0.9; // Đá có bề mặt nhám
                                    child.material.metalness = 0.1; // Đá không có tính kim loại
                                } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                    // Chuyển đổi sang MeshStandardMaterial để có shadow tốt hơn
                                    const newMaterial = new THREE.MeshStandardMaterial({
                                        map: child.material.map,
                                        color: child.material.color,
                                        roughness: 0.9,
                                        metalness: 0.1
                                    });
                                    child.material = newMaterial;
                                }
                            }
                        }
                    });
                    
                    this.setModel(model);
                    
                    // Hiển thị box helper nếu debug mode
                    if (Game.instance.debug) {
                        this.createBoxHelper();
                    }
                    return;
                }
            } catch (error) {
                console.error('Error getting rock model from cache:', error);
            }
        }

        // Fallback: Load trực tiếp nếu chưa preload
        console.warn(`⚠️ Rock model ${this.rockType} chưa được preload, đang load trực tiếp...`);
        this.loadModelDirect();
    }

    loadModelDirect() {
        // Xác định đường dẫn đến model dựa trên loại đá
        let modelPath;
        
        switch (this.rockType) {
            case 'rock09':
                modelPath = './assets/rock09/rock09.gltf';
                break;
            case 'rock13':
                modelPath = './assets/rock13/rock13.gltf';
                break;
            default:
                modelPath = './assets/rock09/rock09.gltf';
                break;
        }

        // Sử dụng GLTFLoader để tải model
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                
                // Thiết lập vị trí, kích thước và góc xoay
                model.position.copy(this.position);
                model.scale.set(this.scale, this.scale, this.scale);
                model.rotation.y = this.rotation;
                
                // Thiết lập bóng đổ
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Cải thiện material cho đá để tạo shadow và ánh sáng tốt hơn
                        if (child.material) {
                            if (child.material.isMeshStandardMaterial) {
                                child.material.roughness = 0.9; // Đá có bề mặt nhám
                                child.material.metalness = 0.1; // Đá không có tính kim loại
                            } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                // Chuyển đổi sang MeshStandardMaterial để có shadow tốt hơn
                                const newMaterial = new THREE.MeshStandardMaterial({
                                    map: child.material.map,
                                    color: child.material.color,
                                    roughness: 0.9,
                                    metalness: 0.1
                                });
                                child.material = newMaterial;
                            }
                        }
                    }
                });
                
                this.setModel(model);
                
                // Hiển thị box helper nếu debug mode
                if (Game.instance.debug) {
                    this.createBoxHelper();
                }
            },
            undefined,
            (error) => {
                console.error('Không thể tải model đá:', error);
                
                // Tạo hình khối đơn giản thay thế nếu không tải được model
                this.createFallbackModel();
            }
        );
    }

    createBoxHelper() {
        if (this.model && Game.instance.debug) {
            // Tạo box helper
            const boxHelper = new THREE.BoxHelper(this.model, 0xffff00);
            Game.instance.scene.add(boxHelper);
            
            // Lưu tham chiếu để có thể xóa sau này
            this.boxHelper = boxHelper;
        }
    }

    updateBoxHelper() {
        if (this.boxHelper && this.model) {
            this.boxHelper.update();
        }
    }

    createFallbackModel() {
        const geometry = new THREE.BoxGeometry(2 * this.scale, 2 * this.scale, 2 * this.scale);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x888888,
            roughness: 0.9,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.position);
        mesh.rotation.y = this.rotation;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const model = new THREE.Group();
        model.add(mesh);
        this.setModel(model);
        
        if (Game.instance.debug) {
            this.createBoxHelper();
        }
    }

    destroy() {
        super.destroy();
    }

    dispose() {
        if (this.boxHelper) {
            Game.instance.scene.remove(this.boxHelper);
            this.boxHelper = null;
        }
        super.dispose();
    }

    update() {
        if (this.boxHelper) {
            this.updateBoxHelper();
        }
    }
}

export { Rock }; 
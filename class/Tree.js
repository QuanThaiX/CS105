
import * as THREE from 'three';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { GameObject } from './GameObject.js';
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT, HITBOX_SCALE } from '../utils.js';
import { ModelLoader } from '../loader.js';

class Tree extends GameObject {
    constructor(id, position, scale = 1, rotation = 0, treeType = 'tree01') {
        super(id, 'neutral', position, true);
        this.scale = scale;
        this.treeType = treeType;
        this.rotation = rotation; 
        this.hitBoxScale = HITBOX_SCALE.TREE;
        this.loadModel();
    }

    loadModel() {
        
        const modelLoader = new ModelLoader();
        
        if (modelLoader.isPreloaded) {
            try {
                const model = modelLoader.getTreeModel(
                    this.treeType, 
                    this.position, 
                    this.scale, 
                    this.rotation
                );
                
                if (model) {
                    
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            
                            if (child.material) {
                                if (child.material.isMeshStandardMaterial) {
                                    child.material.roughness = 0.8; 
                                    child.material.metalness = 0.0; 
                                } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                    
                                    const newMaterial = new THREE.MeshStandardMaterial({
                                        map: child.material.map,
                                        color: child.material.color,
                                        roughness: 0.8,
                                        metalness: 0.0
                                    });
                                    child.material = newMaterial;
                                }
                            }
                        }
                    });
                    
                    this.setModel(model);
                    
                    
                    if (Game.instance.debug) {
                        this.createBoxHelper();
                    }
                    return;
                }
            } catch (error) {
                console.error('Error getting tree model from cache:', error);
            }
        }

        
        console.warn(`⚠️ Tree model ${this.treeType} chưa được preload, đang load trực tiếp...`);
        this.loadModelDirect();
    }

    loadModelDirect() {
        
        let modelPath;
        
        switch (this.treeType) {
            case 'tree01':
                modelPath = './assets/tree01/tree01.gltf';
                break;
            case 'tree02':
                modelPath = './assets/tree02/tree02.gltf';
                break;
            case 'tree03':
                modelPath = './assets/tree03/tree03.gltf';
                break;
            default:
                modelPath = './assets/tree01/tree01.gltf';
                break;
        }

        
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                
                
                model.position.copy(this.position);
                model.scale.set(this.scale, this.scale, this.scale);
                model.rotation.y = this.rotation;
                
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        
                        if (child.material) {
                            if (child.material.isMeshStandardMaterial) {
                                child.material.roughness = 0.8; 
                                child.material.metalness = 0.0; 
                            } else if (child.material.isMeshBasicMaterial || child.material.isMeshPhongMaterial) {
                                
                                const newMaterial = new THREE.MeshStandardMaterial({
                                    map: child.material.map,
                                    color: child.material.color,
                                    roughness: 0.8,
                                    metalness: 0.0
                                });
                                child.material = newMaterial;
                            }
                        }
                    }
                });
                
                this.setModel(model);
                
                
                if (Game.instance.debug) {
                    this.createBoxHelper();
                }
            },
            undefined,
            (error) => {
                console.error('Không thể tải model cây:', error);
                
                
                this.createFallbackModel();
            }
        );
    }

    createBoxHelper() {
        if (this.model && Game.instance.debug) {
            
            const boxHelper = new THREE.BoxHelper(this.model, 0x00ff00);
            Game.instance.scene.add(boxHelper);
            
            
            this.boxHelper = boxHelper;
        }
    }

    updateBoxHelper() {
        if (this.boxHelper && this.model) {
            this.boxHelper.update();
        }
    }

    createFallbackModel() {
        
        const geometry = new THREE.CylinderGeometry(0, 1 * this.scale, 2 * this.scale, 4);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x228B22,
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

export { Tree }; 
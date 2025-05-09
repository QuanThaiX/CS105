import * as THREE from 'three';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { GameObject } from './GameObject.js';
import { Game } from './Game.js';
import { EventManager } from './EventManager.js';
import { EVENT, HITBOX_SCALE } from '../utils.js';

class Rock extends GameObject {
    constructor(id, position, scale = 1, rotation = 0, rockType = 'rock09') {
        super(id, 'neutral', position, true);
        this.scale = scale;
        this.rockType = rockType;
        this.rotation = rotation; // Góc xoay theo trục y (radians)
        this.hitBoxScale = HITBOX_SCALE.ROCK;
        this.loadModel();
    }

    loadModel() {
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
        // Tạo hình khối đơn giản thay thế nếu không tải được model
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
        
        // Hiển thị box helper nếu debug mode
        if (Game.instance.debug) {
            this.createBoxHelper();
        }
    }

    // Phương thức này được gọi khi Rock bị phá hủy
    destroy() {
        // Có thể thêm hiệu ứng khi đá bị phá hủy ở đây nếu cần
        super.destroy();
    }

    // Phương thức này được gọi khi Rock bị loại bỏ khỏi scene
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

    // Phương thức tĩnh để tạo đá từ danh sách vị trí
    static createRocksFromList(rockList) {
        const rocks = [];
        
        rockList.forEach((rockData, index) => {
            const { position, scale = 1, rotation = 0, type = 'rock09' } = rockData;
            
            if (position) {
                const rockPosition = new THREE.Vector3(position.x, position.y || 0, position.z);
                const rock = new Rock(`rock_${index}`, rockPosition, scale, rotation, type);
                rocks.push(rock);
            }
        });
        
        return rocks;
    }

    // Phương thức tĩnh để tạo đá ngẫu nhiên trên bản đồ (giữ lại cho tương thích ngược)
    static createRandomRocks(count, minX, maxX, minZ, maxZ, minScale = 0.5, maxScale = 2.0) {
        const rocks = [];
        const rockTypes = ['rock09', 'rock13'];
        
        for (let i = 0; i < count; i++) {
            // Tạo vị trí ngẫu nhiên
            const x = minX + Math.random() * (maxX - minX);
            const z = minZ + Math.random() * (maxZ - minZ);
            const position = new THREE.Vector3(x, 0, z);
            
            // Tạo kích thước và góc xoay ngẫu nhiên
            const scale = minScale + Math.random() * (maxScale - minScale);
            const rotation = Math.random() * Math.PI * 2;
            
            // Chọn loại đá ngẫu nhiên
            const rockType = rockTypes[Math.floor(Math.random() * rockTypes.length)];
            
            // Tạo đối tượng đá mới
            const rock = new Rock(`rock_${i}`, position, scale, rotation, rockType);
            rocks.push(rock);
        }
        
        return rocks;
    }
}

export { Rock }; 
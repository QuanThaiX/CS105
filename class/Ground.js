import * as THREE from 'three';
import { toRad } from '../utils.js';

function createGround(scene, options = {}) {
    const width = options.width || 500;
    const height = options.height || 500;
    const repeatX = options.repeatX || 20;
    const repeatY = options.repeatY || 20;
    
    const textureLoader = new THREE.TextureLoader();
    const diffuseMap = textureLoader.load('./assets/ground/rocky_terrain_02_diff_1k.jpg');
    const normalMap = textureLoader.load('./assets/ground/rocky_terrain_02_nor_gl_1k.jpg');
    const specularMap = textureLoader.load('./assets/ground/rocky_terrain_02_spec_1k.jpg');
    const aoMap = textureLoader.load('./assets/ground/rocky_terrain_02_arm_1k.jpg');
    
    diffuseMap.wrapS = diffuseMap.wrapT = THREE.RepeatWrapping;
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    specularMap.wrapS = specularMap.wrapT = THREE.RepeatWrapping;
    aoMap.wrapS = aoMap.wrapT = THREE.RepeatWrapping;
    
    diffuseMap.repeat.set(repeatX, repeatY);
    normalMap.repeat.set(repeatX, repeatY);
    specularMap.repeat.set(repeatX, repeatY);
    aoMap.repeat.set(repeatX, repeatY);
    
    const material = new THREE.MeshStandardMaterial({
        map: diffuseMap,
        normalMap: normalMap,
        metalnessMap: specularMap,
        aoMap: aoMap,
        metalness: 0.5,
        roughness: 0.8,
    });
    
    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = toRad(-90);
    plane.receiveShadow = true;
    scene.add(plane);
    return plane;
}

export { createGround }; 
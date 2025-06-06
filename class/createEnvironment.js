import * as THREE from 'three';
import { Sky } from '../three/examples/jsm/objects/Sky.js';
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';
import { GAMECONFIG } from '../config.js';
import { toRad } from '../utils.js';

function createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.physicallyCorrectLights = true; // More realistic lighting
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; // Tăng exposure để scene sáng hơn
    document.body.appendChild(renderer.domElement);
    return renderer;
}

function createCamera(scene, targetPosition, renderer) {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    
    const controls = new OrbitControls(camera, renderer.domElement);
    if (targetPosition) {
        controls.target.copy(targetPosition).add(new THREE.Vector3(0, 1, 0));
    }
    controls.update();
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
    };
    
    return { camera, controls };
}

function createLights(scene) {
    // Ánh sáng môi trường - tăng lên một chút để tank có thể phản chiếu ánh sáng
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8); // Tăng cường độ
    scene.add(ambientLight);

    // Ánh sáng chính - directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5); // Giảm cường độ để bớt chói
    directionalLight.position.set(200, 400, 200);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;

    // Cải thiện shadow quality
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.radius = 3; // Tăng độ mềm của shadow
    directionalLight.shadow.normalBias = 0.02; // Giúp tránh shadow acne
    scene.add(directionalLight);

    // Thêm ánh sáng phụ để tạo hiệu ứng phản chiếu tốt hơn (rim light)
    const rimLight = new THREE.DirectionalLight(0x7799ff, 1.0);
    rimLight.position.set(-100, 200, -100);
    rimLight.target.position.set(0, 0, 0);
    scene.add(rimLight);

    // Ánh sáng điểm để tạo highlights trên metal
    const pointLight = new THREE.PointLight(0xffffcc, 0.8, 100);
    pointLight.position.set(0, 40, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.shadow.camera.near = 1;
    pointLight.shadow.camera.far = 100;
    pointLight.shadow.bias = -0.001;
    scene.add(pointLight);

    // Thêm vài ánh sáng điểm xung quanh để tank có độ phản xạ tốt hơn
    const pointLight2 = new THREE.PointLight(0xccccff, 0.5, 80);
    pointLight2.position.set(30, 20, 30);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xffcccc, 0.5, 80);
    pointLight3.position.set(-30, 20, -30);
    scene.add(pointLight3);

    let shadowHelper;
    if (GAMECONFIG.DEBUG === true) {
        shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
        scene.add(shadowHelper);
    }

    return { 
        ambientLight, 
        directionalLight, 
        rimLight, 
        pointLight,
        pointLight2,
        pointLight3,
        shadowHelper 
    };
}

function updateShadowArea(directionalLight, targetPosition) {
    directionalLight.target.position.copy(targetPosition);
    directionalLight.target.updateMatrixWorld();
}

function createSky(scene) {
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 100;  // Độ đục của khí quyển
    skyUniforms['rayleigh'].value = 2;    // Tán xạ ánh sáng
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // Mặt trời
    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(45);
    const theta = THREE.MathUtils.degToRad(60);   
    sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sun);

    return sky;
}

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

function createDebugHelpers(scene) {
    let helpers = {};
    
    if (GAMECONFIG.DEBUG === true) {
        const axesHelper = new THREE.AxesHelper(100);
        scene.add(axesHelper);
        helpers.axesHelper = axesHelper;
    }
    
    return helpers;
}

function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x123456);
    return scene;
}

function handleWindowResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export { 
    createRenderer, 
    createCamera, 
    createLights, 
    createSky, 
    createGround, 
    createDebugHelpers, 
    createScene,
    handleWindowResize,
    updateShadowArea
}; 
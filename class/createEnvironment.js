import * as THREE from 'three';
import { Sky } from '../three/examples/jsm/objects/Sky.js';
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';
import { GAMECONFIG } from '../config.js';
import { toRad } from '../utils.js';

// --- Constants for Configuration ---
const SHADOW_MAP_SIZE = 2048;
const RENDERER_CONFIG = {
    toneMappingExposure: 1.2,
};
const CAMERA_CONFIG = {
    fov: 75,
    near: 0.1,
    far: 1000,
    initialPosition: new THREE.Vector3(5, 5, 5),
};
const CONTROLS_CONFIG = {
    dampingFactor: 0.05,
    minDistance: 5,
    maxDistance: 100,
    maxPolarAngle: Math.PI / 2,
};

/**
 * Creates the WebGL renderer and appends it to the DOM.
 * @returns {THREE.WebGLRenderer} The configured renderer instance.
 */
function createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // For sharper images on high-DPI screens

    // Shadow mapping
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Color and lighting
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = RENDERER_CONFIG.toneMappingExposure;

    document.body.appendChild(renderer.domElement);
    return renderer;
}

/**
 * Creates a perspective camera and its orbit controls.
 * @param {THREE.WebGLRenderer} renderer - The renderer for the controls to listen to.
 * @param {THREE.Vector3} [targetPosition] - The initial position for the controls to target.
 * @returns {{camera: THREE.PerspectiveCamera, controls: OrbitControls}}
 */

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


/**
 * Creates and adds all lights to the scene.
 * @param {THREE.Scene} scene - The scene to add lights to.
 * @returns {{directionalLight: THREE.DirectionalLight, shadowHelper?: THREE.CameraHelper}} An object containing lights that may need to be updated.
 */
function createLights(scene) {
    // Ambient light provides soft, global illumination.
    scene.add(new THREE.AmbientLight(0x404040, 0.8));

    // Main directional light, which casts shadows.
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(200, 400, 200);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;

    // Configure shadow properties for better quality
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
    directionalLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.radius = 3;      // Soften shadow edges
    directionalLight.shadow.normalBias = 0.02; // Prevents shadow acne
    scene.add(directionalLight);

    // Rim light to create highlights on object edges.
    const rimLight = new THREE.DirectionalLight(0x7799ff, 1.0);
    rimLight.position.set(-100, 200, -100);
    rimLight.target.position.set(0, 0, 0);
    scene.add(rimLight);

    // Additional point lights for better reflections and highlights.
    const pointLightConfigs = [
        { color: 0xffffcc, intensity: 0.8, distance: 100, position: [0, 40, 0], castShadow: true },
        { color: 0xccccff, intensity: 0.5, distance: 80, position: [30, 20, 30] },
        { color: 0xffcccc, intensity: 0.5, distance: 80, position: [-30, 20, -30] },
    ];

    pointLightConfigs.forEach(config => {
        const light = new THREE.PointLight(config.color, config.intensity, config.distance);
        light.position.set(...config.position);
        if (config.castShadow) {
            light.castShadow = true;
            light.shadow.mapSize.set(1024, 1024);
            light.shadow.camera.near = 1;
            light.shadow.camera.far = 100;
            light.shadow.bias = -0.001;
        }
        scene.add(light);
    });

    let shadowHelper;
    if (GAMECONFIG.DEBUG) {
        shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
        scene.add(shadowHelper);
    }

    // Only return objects that need to be manipulated later.
    return { directionalLight, shadowHelper };
}

/**
 * Updates the main shadow camera to follow a target.
 * @param {THREE.DirectionalLight} directionalLight - The light whose shadow to update.
 * @param {THREE.Vector3} targetPosition - The position to target.
 */
function updateShadowArea(directionalLight, targetPosition) {
    directionalLight.target.position.copy(targetPosition);
    directionalLight.target.updateMatrixWorld();
}

/**
 * Creates a dynamic skybox and adds it to the scene.
 * @param {THREE.Scene} scene - The scene to add the sky to.
 * @returns {Sky} The sky instance.
 */
function createSky(scene) {
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 100;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(45);
    const theta = THREE.MathUtils.degToRad(60);
    sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sun);

    return sky;
}

/**
 * Creates a textured ground plane.
 * @param {THREE.Scene} scene - The scene to add the ground to.
 * @param {object} [options] - Configuration options for the ground.
 * @param {number} [options.width=500] - The width of the ground plane.
 * @param {number} [options.height=500] - The height of the ground plane.
 * @param {number} [options.repeatX=20] - Texture repetitions along the X-axis.
 * @param {number} [options.repeatY=20] - Texture repetitions along the Y-axis.
 * @returns {THREE.Mesh} The ground plane mesh.
 */
function createGround(scene, { width = 500, height = 500, repeatX = 20, repeatY = 20 } = {}) {
    const textureLoader = new THREE.TextureLoader();
    
    const texturePaths = {
        map: './assets/ground/rocky_terrain_02_diff_1k.jpg',
        normalMap: './assets/ground/rocky_terrain_02_nor_gl_1k.jpg',
        metalnessMap: './assets/ground/rocky_terrain_02_spec_1k.jpg', // Often spec map can be used for metalness
        aoMap: './assets/ground/rocky_terrain_02_arm_1k.jpg',
    };

    const textures = Object.entries(texturePaths).reduce((acc, [key, path]) => {
        const texture = textureLoader.load(path);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        acc[key] = texture;
        return acc;
    }, {});

    const material = new THREE.MeshStandardMaterial({
        ...textures,
        metalness: 0.5,
        roughness: 0.8,
    });

    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    // Add UV2 attributes for Ambient Occlusion map
    geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
    
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = toRad(-90);
    plane.receiveShadow = true;
    scene.add(plane);
    
    return plane;
}

/**
 * Adds debug helpers to the scene if debug mode is enabled.
 * @param {THREE.Scene} scene - The scene to add helpers to.
 * @returns {object} An object containing the created helpers.
 */
function createDebugHelpers(scene) {
    const helpers = {};
    if (GAMECONFIG.DEBUG) {
        helpers.axesHelper = new THREE.AxesHelper(100);
        scene.add(helpers.axesHelper);
    }
    return helpers;
}

/**
 * Creates the main scene object.
 * @returns {THREE.Scene} The scene instance.
 */
function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x123456);
    return scene;
}

/**
 * Handles window resize events to keep the viewport correct.
 * @param {THREE.PerspectiveCamera} camera - The camera to update.
 * @param {THREE.WebGLRenderer} renderer - The renderer to resize.
 */
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
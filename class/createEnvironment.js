
import * as THREE from 'three';
import { Sky } from '../three/examples/jsm/objects/Sky.js';
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';
import { GAMECONFIG } from '../config.js';
import { toRad } from '../utils.js';

const SHADOW_MAP_SIZE = 1024;
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

const DAY_CONFIG = {
    turbidity: 10,
    rayleigh: 2,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    sunPosition: new THREE.Vector3().setFromSphericalCoords(1, toRad(90 - 45), toRad(180)),
    ambientLightColor: new THREE.Color(0x66728c),
    ambientLightIntensity: 0.8,
    directionalLightIntensity: 1.5,
    rimLightIntensity: 1.0,
    fogColor: new THREE.Color(0x9fb8d1)
};

const NIGHT_CONFIG = {
    turbidity: 1,
    rayleigh: 0.05,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.7,
    sunPosition: new THREE.Vector3().setFromSphericalCoords(1, toRad(90 - (-5)), toRad(180)),
    ambientLightColor: new THREE.Color(0x0a142c),
    ambientLightIntensity: 0.2,
    directionalLightIntensity: 0.1,
    rimLightIntensity: 0.2,
    fogColor: new THREE.Color(0x050a14)
};


/**
 * Creates the WebGL renderer and appends it to the DOM.
 * @returns {THREE.WebGLRenderer} The configured renderer instance.
 */
function createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);


    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;


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
 * @returns {{directionalLight: THREE.DirectionalLight, ambientLight: THREE.AmbientLight, rimLight: THREE.DirectionalLight, shadowHelper?: THREE.CameraHelper}} An object containing lights that may need to be updated.
 */
function createLights(scene) {

    const ambientLight = new THREE.AmbientLight(DAY_CONFIG.ambientLightColor, DAY_CONFIG.ambientLightIntensity);
    scene.add(ambientLight);


    const directionalLight = new THREE.DirectionalLight(0xffffff, DAY_CONFIG.directionalLightIntensity);
    directionalLight.position.set(200, 400, 200);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;


    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
    directionalLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.radius = 3;
    directionalLight.shadow.normalBias = 0.02;
    scene.add(directionalLight);


    const rimLight = new THREE.DirectionalLight(0x7799ff, DAY_CONFIG.rimLightIntensity);
    rimLight.position.set(-100, 200, -100);
    rimLight.target.position.set(0, 0, 0);
    scene.add(rimLight);


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


    return { directionalLight, ambientLight, rimLight, shadowHelper };
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
        metalnessMap: './assets/ground/rocky_terrain_02_spec_1k.jpg',
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
        metalness: 0.0,
        roughness: 0.6,
    });

    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);

    geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));

    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = toRad(-90);
    plane.receiveShadow = true;
    plane.castShadow = true;
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

/**
 * Applies or removes fog from a scene based on settings.
 * @param {THREE.Scene} scene The scene to apply fog to.
 * @param {object} settings An object containing fog and sky settings.
 * @param {boolean} settings.enabled Whether to enable or disable fog.
 * @param {boolean} settings.useSky Whether a skybox is being used.
 * @param {THREE.Color} settings.fogColor The color to use for the fog.
 */
function updateSceneFog(scene, { enabled, useSky, fogColor }) {
    if (enabled) {
        const nearDistance = 10;
        const farDistance = 150;
        if (!scene.fog) {
            scene.fog = new THREE.Fog(fogColor, nearDistance, farDistance);
        } else {
            scene.fog.color.copy(fogColor);
            scene.fog.near = nearDistance;
            scene.fog.far = farDistance;
        }

        if (!useSky) {
            scene.background = new THREE.Color(fogColor);
        }
    } else {
        if (scene.fog) {
            scene.fog = null;
            if (!useSky) {
                scene.background = new THREE.Color(0x123456);
            }
        }
    }
}

/**
 * @param {number} progress - A value from 0 (full day) to 1 (full night).
 * @param {THREE.Scene} scene - The main scene.
 * @param {Sky} sky - The sky object.
 * @param {object} lights - The lights object from createLights.
 */
function updateEnvironment(progress, scene, sky, lights) {
    if (!sky || !lights || !lights.ambientLight) return;

    const uniforms = sky.material.uniforms;
    const easedProgress = 1 - Math.cos(progress * Math.PI / 2);

    uniforms['turbidity'].value = THREE.MathUtils.lerp(DAY_CONFIG.turbidity, NIGHT_CONFIG.turbidity, easedProgress);
    uniforms['rayleigh'].value = THREE.MathUtils.lerp(DAY_CONFIG.rayleigh, NIGHT_CONFIG.rayleigh, easedProgress);
    uniforms['mieCoefficient'].value = THREE.MathUtils.lerp(DAY_CONFIG.mieCoefficient, NIGHT_CONFIG.mieCoefficient, easedProgress);
    uniforms['mieDirectionalG'].value = THREE.MathUtils.lerp(DAY_CONFIG.mieDirectionalG, NIGHT_CONFIG.mieDirectionalG, easedProgress);


    const sunAngle = Math.PI * progress;
    const sunY = Math.cos(sunAngle);
    const sunX = Math.sin(sunAngle);
    uniforms['sunPosition'].value.set(sunX, sunY, 0.2);


    lights.ambientLight.intensity = THREE.MathUtils.lerp(DAY_CONFIG.ambientLightIntensity, NIGHT_CONFIG.ambientLightIntensity, easedProgress);
    lights.directionalLight.intensity = THREE.MathUtils.lerp(DAY_CONFIG.directionalLightIntensity, NIGHT_CONFIG.directionalLightIntensity, easedProgress);
    lights.rimLight.intensity = THREE.MathUtils.lerp(DAY_CONFIG.rimLightIntensity, NIGHT_CONFIG.rimLightIntensity, easedProgress);


    lights.ambientLight.color.lerpColors(DAY_CONFIG.ambientLightColor, NIGHT_CONFIG.ambientLightColor, easedProgress);


    const currentFogColor = new THREE.Color().lerpColors(DAY_CONFIG.fogColor, NIGHT_CONFIG.fogColor, easedProgress);
    updateSceneFog(scene, { enabled: true, useSky: true, fogColor: currentFogColor });
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
    updateShadowArea,
    updateSceneFog,
    updateEnvironment
};
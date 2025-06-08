import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Game } from './class/Game.js';
import { UIManager } from './class/UIManager.js'; // Import the new UIManager
import { EVENT, COLOR, TANKTYPE, loadTankModel } from './utils.js';
import { ModelLoader } from './loader.js';
import { EventManager } from './class/EventManager.js'; // Adjust path if needed
import { SoundManager } from './class/SoundManager.js'; // Adjust path if needed
import { QUALITY, GAMECONFIG, gameSettings, loadSettings, saveSettings } from './config.js';

const eventManager = new EventManager();
const soundManager = new SoundManager();
const uiManager = new UIManager();

let game = null;
let selectedTankModel = TANKTYPE.V001; // Default selected tank
let menuScene, menuCamera, menuRenderer, menuControls;
let tankModel = null; // Holds the 3D model in the menu
let availableTanks = [TANKTYPE.V001, TANKTYPE.V002, TANKTYPE.V003, TANKTYPE.V004, TANKTYPE.V005, TANKTYPE.V006, TANKTYPE.V007];
let currentTankIndex = 0;
let modelLoader = null; // ModelLoader instance
let isPreloadingModels = false; // Flag to track preload status

const GAME_START_DELAY = 250; // ms, for loading simulation or DOM readiness

const tankStatsData = {
    [TANKTYPE.V001.name]: { power: 80, speed: 60, defense: 70 },
    [TANKTYPE.V002.name]: { power: 90, speed: 40, defense: 90 },
    [TANKTYPE.V003.name]: { power: 90, speed: 50, defense: 85 },
    [TANKTYPE.V004.name]: { power: 70, speed: 80, defense: 60 },
    [TANKTYPE.V005.name]: { power: 60, speed: 90, defense: 50 },
    [TANKTYPE.V006.name]: { power: 100, speed: 30, defense: 100 },
    [TANKTYPE.V007.name]: { power: 85, speed: 65, defense: 75 }
};

async function preloadAllModels() {
    if (isPreloadingModels) {
        console.log("⏳ Models are already being preloaded...");
        return false;
    }
    
    if (modelLoader && modelLoader.isPreloaded) {
        console.log("✅ Models have been preloaded previously.");
        return true;
    }
    
    isPreloadingModels = true;
    try {
        console.log("🚀 Starting to preload all models...");
        modelLoader = new ModelLoader();
        
        const preloadPromise = modelLoader.preloadAllModels();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Preload timeout after 30 seconds')), 30000);
        });
        
        const success = await Promise.race([preloadPromise, timeoutPromise]);
        
        if (success) {
            console.log("✅ Preload models successful!");
        } else {
            console.warn("⚠️ Preload models completed with some failures, but game can still run.");
        }
        return success;
    } catch (error) {
        console.error("❌ Error while preloading models:", error);
        return false;
    } finally {
        isPreloadingModels = false;
    }
}
async function initMenuScene() {
    console.log(`🎯 Initializing menu with quality: ${gameSettings.quality}`);
    await preloadAllModels();

    const qualityProfile = GAMECONFIG.QUALITY_PROFILES[gameSettings.quality];

    menuScene = new THREE.Scene();
    menuScene.background = new THREE.Color(0x111827); 
    if (gameSettings.fog) {
        menuScene.fog = new THREE.Fog(0x111827, 1, 300);
    }
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemiLight.position.set(0, 20, 0);
    menuScene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffeeb1, 2.0);
    keyLight.position.set(5, 5, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = qualityProfile.shadowMapSize;
    keyLight.shadow.mapSize.height = qualityProfile.shadowMapSize;
    const shadowSize = 5;
    keyLight.shadow.camera.left = -shadowSize;
    keyLight.shadow.camera.right = shadowSize;
    keyLight.shadow.camera.top = shadowSize;
    keyLight.shadow.camera.bottom = -shadowSize;
    keyLight.shadow.bias = -0.0001;
    menuScene.add(keyLight);

    if (qualityProfile.extraLights) {
        const fillLight = new THREE.DirectionalLight(0xaaccff, 0.6);
        fillLight.position.set(-5, 2, -4);
        menuScene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
        rimLight.position.set(0, 4, -10);
        menuScene.add(rimLight);
    }
    
    const tankDisplayDiv = document.getElementById('tank-display');
    const displayWidth = tankDisplayDiv.clientWidth;
    const displayHeight = tankDisplayDiv.clientHeight;
    menuCamera = new THREE.PerspectiveCamera(45, displayWidth / displayHeight, 0.1, 100);
    menuCamera.position.set(0, 1.5, 6);
    menuRenderer = new THREE.WebGLRenderer({
        antialias: qualityProfile.antialias,
        powerPreference: "high-performance"
    });
    menuRenderer.setSize(displayWidth, displayHeight);
    menuRenderer.setPixelRatio(qualityProfile.pixelRatio);
    
    menuRenderer.shadowMap.enabled = true;
    menuRenderer.shadowMap.type = qualityProfile.shadowType;
    menuRenderer.outputColorSpace = THREE.SRGBColorSpace;
    menuRenderer.toneMapping = qualityProfile.toneMapping;
    menuRenderer.toneMappingExposure = 1.0;
    menuRenderer.physicallyCorrectLights = true;
    
    tankDisplayDiv.appendChild(menuRenderer.domElement);

    menuControls = new OrbitControls(menuCamera, menuRenderer.domElement);
    menuControls.enableDamping = true;
    menuControls.dampingFactor = 0.05;
    menuControls.target.set(0, 0.5, 0);
    menuControls.minDistance = 3;
    menuControls.maxDistance = 15;
    menuControls.autoRotate = true;
    menuControls.autoRotateSpeed = 0.9;

    const groundGeometry = new THREE.CircleGeometry(4, 64);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -1;
    menuScene.add(ground);

    loadTankForMenu(availableTanks[currentTankIndex]);
    animateMenu();
}

function disposeTankModel() {
    if (tankModel) {
        menuScene.remove(tankModel);
        tankModel.traverse(object => {
            if (object.isMesh) {
                object.geometry?.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        for (const key in material) {
                            if (material[key] && typeof material[key].dispose === 'function') {
                                material[key].dispose();
                            }
                        }
                        material.dispose();
                    });
                } else if (object.material) {
                    for (const key in object.material) {
                        if (object.material[key] && typeof object.material[key].dispose === 'function') {
                            object.material[key].dispose();
                        }
                    }
                    object.material.dispose();
                }
            }
        });
        tankModel = null;
    }
}

function loadTankForMenu(tankType) {
    document.getElementById('tank-name').textContent = `Loading ${tankType.name}...`;
    disposeTankModel();

    const placeModelInScene = (model) => {
        tankModel = model;
        tankModel.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                if (node.material && node.material.isMeshStandardMaterial) {
                    node.material.metalness = 0.7;
                    node.material.roughness = 0.3;
                    node.material.needsUpdate = true;
                }
            }
        });
        menuScene.add(tankModel);

        document.getElementById('tank-name').textContent = tankType.name;
        updateTankStatsUI(tankType.name);
        selectedTankModel = tankType;
        if (menuControls) {
            menuControls.target.set(0, 0.5, 0);
            menuControls.update();
        }
    };

    if (modelLoader && modelLoader.isPreloaded) {
        try {
            const modelFromCache = modelLoader.getTankModel(tankType, new THREE.Vector3(0, 0, 0));
            if (modelFromCache) {
                placeModelInScene(modelFromCache);
                return;
            } else {
                console.warn(`Model ${tankType.name} not in cache, falling back to direct load.`);
            }
        } catch (error) {
            console.error('Error getting tank model from cache:', error);
        }
    }
    
    loadTankModel(tankType)
        .then(placeModelInScene)
        .catch(error => {
            console.error('Failed to load tank model:', error);
            document.getElementById('tank-name').textContent = `Error loading ${tankType.name}`;
        });
}

function updateTankStatsUI(tankName) {
    const stats = tankStatsData[tankName];
    if (stats) {
        document.getElementById('power-stat').style.width = `${stats.power}%`;
        document.getElementById('speed-stat').style.width = `${stats.speed}%`;
        document.getElementById('defense-stat').style.width = `${stats.defense}%`;
    }
}

function animateMenu() {
    requestAnimationFrame(animateMenu);
    if (menuControls) menuControls.update();
    if (menuRenderer && menuScene && menuCamera) menuRenderer.render(menuScene, menuCamera);
}

function onWindowResize() {
    const tankDisplayDiv = document.getElementById('tank-display');
    if (menuCamera && menuRenderer && tankDisplayDiv && tankDisplayDiv.offsetParent !== null) {
        const displayWidth = tankDisplayDiv.clientWidth;
        const displayHeight = tankDisplayDiv.clientHeight;
        if (displayWidth > 0 && displayHeight > 0) {
            menuCamera.aspect = displayWidth / displayHeight;
            menuCamera.updateProjectionMatrix();
            menuRenderer.setSize(displayWidth, displayHeight);
        }
    }

    if (game && game.camera && game.renderer) {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer.style.display !== 'none') {
            game.camera.aspect = window.innerWidth / window.innerHeight;
            game.camera.updateProjectionMatrix();
            game.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
}

function setupGameRendererDOM(gameInstance) {
    const gameCanvasContainer = document.getElementById('game-container');
    const hudElement = document.getElementById('hud');

    if (!gameInstance || !gameInstance.renderer || !gameInstance.renderer.domElement) {
        console.warn("setupGameRendererDOM: Game instance or renderer not available.");
        return;
    }

    Array.from(gameCanvasContainer.childNodes).forEach(child => {
        if (child !== hudElement && child !== gameInstance.renderer.domElement && child.tagName === 'CANVAS') {
            gameCanvasContainer.removeChild(child);
        }
    });
    
    if (!gameCanvasContainer.contains(gameInstance.renderer.domElement)) {
        gameCanvasContainer.insertBefore(gameInstance.renderer.domElement, hudElement);
    }
}

function disposeCurrentGame() {
    stopHUDUpdates();
    if (game) {
        if (game.renderer && game.renderer.domElement && game.renderer.domElement.parentElement) {
            game.renderer.domElement.parentElement.removeChild(game.renderer.domElement);
        }
        if (typeof game.dispose === 'function') {
            game.dispose();
        }
        game = null;
        if (window.gc) {
            window.gc();
        }
    }
}

function startNewGame(tankTypeToUse) {
    hideLoadingScreen();
    
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('win-screen').style.display = 'none';

    disposeCurrentGame();

    try {
        game = new Game({ tankType: tankTypeToUse });

        setTimeout(() => {
            if (!game) { returnToMainMenu(false); return; }
            try {
                game.start();
                setupGameRendererDOM(game);

                document.getElementById('game-container').style.display = 'block';
                document.getElementById('continue-button').disabled = !(game && game.canResume());

                startHUDUpdates();
                onWindowResize();
            } catch (error) {
                console.error("Error starting game:", error);
                alert("Error starting game. Please try again.");
                returnToMainMenu(false);
            }
        }, GAME_START_DELAY);
    } catch (error) {
        console.error("Error creating game instance:", error);
        alert("Error initializing game. Please try again.");
        returnToMainMenu(false);
    }
}

function returnToMainMenu(preserveGameInstanceForPause = false) {
    if (!preserveGameInstanceForPause) {
        disposeCurrentGame();
    } else if (game) {
        game.pause();
        stopHUDUpdates();
    }

    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('win-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('menu-container').style.display = 'flex';

    eventManager.notify(EVENT.ENTER_LOBBY);

    document.getElementById('continue-button').disabled = !(game && game.canResume());
    onWindowResize();
}

document.getElementById('start-button').addEventListener('click', () => {
    startNewGame(selectedTankModel);
});

document.getElementById('continue-button').addEventListener('click', () => {
    if (game && game.canResume()) {
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        setupGameRendererDOM(game);
        game.resume();
        startHUDUpdates();
        onWindowResize();
    } else {
        startNewGame(selectedTankModel);
    }
});

const settingsModal = document.getElementById('settings-modal');
const openSettingsButton = document.getElementById('settings-button');
const closeSettingsButton = document.getElementById('close-settings-button');
const applySettingsButton = document.getElementById('apply-settings-button');

const masterVolumeSlider = document.getElementById('master-volume-slider');
const musicVolumeSlider = document.getElementById('music-volume-slider');
const sfxVolumeSlider = document.getElementById('sfx-volume-slider');
const fogToggle = document.getElementById('fog-toggle');
const masterVolumeValue = document.getElementById('master-volume-value');
const musicVolumeValue = document.getElementById('music-volume-value');
const sfxVolumeValue = document.getElementById('sfx-volume-value');
openSettingsButton.addEventListener('click', () => {
    // Quality settings
    const currentQuality = gameSettings.quality;
    const radioToCheck = document.querySelector(`#quality-options input[value="${currentQuality}"]`);
    if (radioToCheck) {
        radioToCheck.checked = true;
    }

    // Set slider positions and text based on current gameSettings
    fogToggle.checked = gameSettings.fog;
    masterVolumeSlider.value = gameSettings.volumeMaster * 100;
    musicVolumeSlider.value = gameSettings.volumeMusic * 100;
    sfxVolumeSlider.value = gameSettings.volumeSfx * 100;
    masterVolumeValue.textContent = `${Math.round(masterVolumeSlider.value)}%`;
    musicVolumeValue.textContent = `${Math.round(musicVolumeSlider.value)}%`;
    sfxVolumeValue.textContent = `${Math.round(sfxVolumeSlider.value)}%`;

    settingsModal.style.display = 'flex';
});

// Real-time update listeners for sliders
function createVolumeUpdater(slider, valueLabel, settingKey) {
    slider.addEventListener('input', () => {
        const volumePercentage = Math.round(slider.value);
        const volumeDecimal = volumePercentage / 100;

        valueLabel.textContent = `${volumePercentage}%`;

        gameSettings[settingKey] = volumeDecimal;
        eventManager.notify(EVENT.SETTINGS_UPDATED);
    });
}

createVolumeUpdater(masterVolumeSlider, masterVolumeValue, 'volumeMaster');
createVolumeUpdater(musicVolumeSlider, musicVolumeValue, 'volumeMusic');
createVolumeUpdater(sfxVolumeSlider, sfxVolumeValue, 'volumeSfx');


applySettingsButton.addEventListener('click', () => {
    const selectedQuality = document.querySelector('#quality-options input:checked').value;
    const newFogSetting = fogToggle.checked;
    let reloadNeeded = false;
    if (selectedQuality && selectedQuality !== gameSettings.quality) {
        gameSettings.quality = selectedQuality;
        reloadNeeded = true;
    }
    
    if (newFogSetting !== gameSettings.fog) {
        gameSettings.fog = newFogSetting;
        eventManager.notify('FOG_SETTING_CHANGED', { enabled: newFogSetting });
    }

    saveSettings();
    
    settingsModal.style.display = 'none';
    
    if (reloadNeeded) {
        alert("Graphics quality has been changed. The page will now reload to apply the new settings.");
        location.reload();
    }
});


// Listeners to close the modal
closeSettingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target == settingsModal) {
        settingsModal.style.display = 'none';
    }
});

document.getElementById('exit-button').addEventListener('click', () => {
    if (confirm('Are you sure you want to exit the game?')) {
        if (game) {
            game.stop();
        }
        stopHUDUpdates();
        try {
            window.close();
        } catch (e) {
            document.body.innerHTML = "<div style='text-align:center; padding-top: 50px; font-size: 24px; color: white;'>Thank you for playing! You can close this tab.</div>";
        }
    }
});

document.getElementById('prev-tank').addEventListener('click', () => {
    currentTankIndex = (currentTankIndex - 1 + availableTanks.length) % availableTanks.length;
    loadTankForMenu(availableTanks[currentTankIndex]);
});

document.getElementById('next-tank').addEventListener('click', () => {
    currentTankIndex = (currentTankIndex + 1) % availableTanks.length;
    loadTankForMenu(availableTanks[currentTankIndex]);
});

document.getElementById('select-button').addEventListener('click', () => {
    const successMessage = document.createElement('div');
    successMessage.textContent = `Selected ${selectedTankModel.name}!`;
    Object.assign(successMessage.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '15px 25px',
        backgroundColor: 'var(--accent-green)',
        color: 'var(--bg-dark)',
        borderRadius: '8px',
        fontWeight: 'bold',
        zIndex: '2000',
        transition: 'opacity 0.5s',
    });
    document.body.appendChild(successMessage);
    
    setTimeout(() => {
        successMessage.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successMessage), 500);
    }, 2000);
});

let hudUpdateRequestId = null;
function updateHUD() {
    if (game && game.isRunning) {
        const data = game.getHUDData();
        if (data) {
            document.getElementById('hp').innerText = `HP: ${data.playerHP}`;
            document.getElementById('score').innerText = `Score: ${data.score}`;
            document.getElementById('high-score').innerText = `High Score: ${data.highScore}`;
        }
    }
    hudUpdateRequestId = requestAnimationFrame(updateHUD);
}

function startHUDUpdates() {
    if (!hudUpdateRequestId) {
        hudUpdateRequestId = requestAnimationFrame(updateHUD);
    }
}
function stopHUDUpdates() {
    if (hudUpdateRequestId) {
        cancelAnimationFrame(hudUpdateRequestId);
        hudUpdateRequestId = null;
    }
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && game && game.isRunning) {
        returnToMainMenu(true);
    }
});

window.addEventListener('resize', onWindowResize, false);

function setupEndGameScreenEvents() {
    document.getElementById('gameover-restart-button').addEventListener('click', () => startNewGame(selectedTankModel));
    document.getElementById('gameover-menu-button').addEventListener('click', () => returnToMainMenu(false));
    document.getElementById('win-restart-button').addEventListener('click', () => startNewGame(selectedTankModel));
    document.getElementById('win-menu-button').addEventListener('click', () => returnToMainMenu(false));
}

// *** THIS IS THE CORRECTED FUNCTION ***
export function startLoadingScreen() {
    if (document.getElementById('loading-screen')) return;

    const loadingHTML = `
        <div id="loading-screen">
            <div class="loading-content">
                <div class="loader">
                    <div class="cube">
                        <div class="face"></div><div class="face"></div>
                        <div class="face"></div><div class="face"></div>
                        <div class="face"></div><div class="face"></div>
                    </div>
                </div>
                <div class="loaderBar"></div>
                <div class="game-info">
                    <h2 class="objective-title">OBJECTIVE</h2>
                    <p class="objective-text">Destroy all enemy tanks to achieve victory!</p>
                    <div class="controls-section">
                        <h3 class="controls-title">CONTROLS</h3>
                        <div class="controls-grid">
                            <div class="control-item">
                                <span class="control-key">WASD</span>
                                <span class="control-description">Move Tank</span>
                            </div>
                            <div class="control-item">
                                <span class="control-key">SPACE</span>
                                <span class="control-description">Shoot</span>
                            </div>
                            <div class="control-item">
                                <span class="control-key">MOUSE</span>
                                <span class="control-description">Camera Control</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

export function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => loadingScreen.remove(), 500); // Fade out then remove
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    console.log("🎮 DOM loaded, waiting for user interaction...");

    const enterButton = document.getElementById('enter-game-button');
    const enterScreen = document.getElementById('enter-screen');
    const menuContainer = document.getElementById('menu-container');

    // Make the whole screen clickable as a fallback
    enterButton.addEventListener('click', handleGameEntry);     
   async function handleGameEntry() {
        // Prevent this from running more than once
        enterButton.removeEventListener('click', handleGameEntry);
        enterButton.disabled = true; // Also good practice to disable it
        enterButton.textContent = 'Loading...';

        enterScreen.style.opacity = '0';
        setTimeout(() => {
            enterScreen.style.display = 'none';
        }, 500);

        menuContainer.style.display = 'flex';

        console.log("🚀 User interaction detected. Initializing game systems...");
        try {
            setupEndGameScreenEvents();
            await initMenuScene();

            console.log("🎵 Firing event to play lobby music.");
            eventManager.notify(EVENT.ENTER_LOBBY); 

        } catch (error) {
        console.error("❌ Critical error during game initialization:", error);
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#ff4444;color:white;padding:20px;border-radius:10px;text-align:center;z-index:9999;`;
        errorMessage.innerHTML = `<h3>Game Initialization Error</h3><p>Failed to load game resources. Please refresh the page and try again.</p><button onclick="location.reload()" style="margin-top:10px;padding:5px 10px;">Refresh Page</button>`;
        document.body.appendChild(errorMessage);
    }
}
});

window.addEventListener('beforeunload', () => {
    disposeTankModel();
    disposeCurrentGame();
    if (modelLoader) modelLoader.dispose();
    if (menuRenderer) menuRenderer.dispose();
    if (menuScene) menuScene.clear();
});
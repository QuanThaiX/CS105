import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Game } from './class/Game.js';
import { EVENT, COLOR, TANKTYPE, loadTankModel } from './utils.js';
import { ModelLoader } from './loader.js';

let game = null;
let selectedTankModel = TANKTYPE.V001; // Default selected tank
let menuScene, menuCamera, menuRenderer, menuControls;
let tankModel = null; // Holds the 3D model in the menu
let availableTanks = [TANKTYPE.V001, TANKTYPE.V002, TANKTYPE.V003, TANKTYPE.V004, TANKTYPE.V005, TANKTYPE.V006];
let currentTankIndex = 0;
let modelLoader = null; // ModelLoader instance
let isPreloadingModels = false; // Flag để track preload status

const GAME_START_DELAY = 250; // ms, for loading simulation or DOM readiness

const tankStatsData = {
    [TANKTYPE.V001.name]: {
        power: 80,
        speed: 60,
        defense: 70
    },
    [TANKTYPE.V002.name]: {
        power: 90,
        speed: 40,
        defense: 90
    },
    [TANKTYPE.V003.name]: {
        power: 90,
        speed: 50,
        defense: 85
    },
    [TANKTYPE.V004.name]: {
        power: 70,
        speed: 80,
        defense: 60
    },
    [TANKTYPE.V005.name]: {
        power: 60,
        speed: 90,
        defense: 50
    },
    [TANKTYPE.V006.name]: {
        power: 100,
        speed: 30,
        defense: 100
    }
};

// Cache for stat bar colors
const statBarColors = {
    power: new THREE.Color(COLOR.red).getStyle(),
    speed: new THREE.Color(COLOR.green).getStyle(),
    defense: new THREE.Color(COLOR.blue).getStyle()
};

/**
 * Preload tất cả models khi khởi động app
 * @returns {Promise<boolean>} - Promise resolve khi preload xong
 */
async function preloadAllModels() {
    if (isPreloadingModels) {
        console.log("⏳ Models đang được preload...");
        return false;
    }
    
    if (modelLoader && modelLoader.isPreloaded) {
        console.log("✅ Models đã được preload trước đó");
        return true;
    }
    
    isPreloadingModels = true;
    
    try {
        console.log("🚀 Bắt đầu preload tất cả models...");
        
        // Khởi tạo ModelLoader instance
        modelLoader = new ModelLoader();
        
        // Preload tất cả models
        const success = await modelLoader.preloadAllModels();
        
        if (success) {
            console.log("✅ Preload models thành công!");
            
            // Log cache info
            const cacheInfo = modelLoader.getCacheInfo();
            console.log("📊 Cache Info:", cacheInfo);
        } else {
            console.error("❌ Preload models thất bại!");
        }
        
        return success;
    } catch (error) {
        console.error("❌ Lỗi khi preload models:", error);
        return false;
    } finally {
        isPreloadingModels = false;
    }
}

/**
 * Hiển thị loading indicator khi preload
 */
function showPreloadingIndicator() {
    // Removed - preload runs silently in background
}

/**
 * Ẩn loading indicator
 */
function hidePreloadingIndicator() {
    // Removed - preload runs silently in background
}

async function initMenuScene() {
    // Preload models trước khi setup menu
    console.log("🎯 Khởi tạo menu và preload models...");
    
    const preloadSuccess = await preloadAllModels();
    if (!preloadSuccess) {
        console.warn("⚠️ Preload models thất bại, game vẫn có thể chạy nhưng có thể lag khi load models");
    }

    menuScene = new THREE.Scene();
    menuScene.background = new THREE.Color(COLOR.darkGray);

    const ambientLight = new THREE.AmbientLight(COLOR.white, 0.8);
    menuScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(COLOR.white, 1.2);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    menuScene.add(directionalLight);

    const tankDisplayDiv = document.getElementById('tank-display');
    if (!tankDisplayDiv) {
        console.error("Tank display div not found!");
        return;
    }

    const displayWidth = tankDisplayDiv.clientWidth;
    const displayHeight = tankDisplayDiv.clientHeight;

    menuCamera = new THREE.PerspectiveCamera(45, displayWidth / displayHeight, 0.1, 1000);
    menuCamera.position.set(0, 1.5, 6);

    menuRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    menuRenderer.setSize(displayWidth, displayHeight);
    menuRenderer.setPixelRatio(window.devicePixelRatio);
    menuRenderer.shadowMap.enabled = true;
    menuRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    tankDisplayDiv.appendChild(menuRenderer.domElement);

    menuControls = new OrbitControls(menuCamera, menuRenderer.domElement);
    menuControls.enableDamping = true;
    menuControls.dampingFactor = 0.15;
    menuControls.target.set(0, 0.5, 0);
    menuControls.minDistance = 3;
    menuControls.maxDistance = 15;

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: COLOR.gray,
        roughness: 0.7,
        metalness: 0.3
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
        tankModel.traverse(object => {
            if (object.isMesh) {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
        });
        menuScene.remove(tankModel);
        tankModel = null;
    }
}

function loadTankForMenu(tankType) {
    document.getElementById('tank-name').textContent = `Đang tải ${tankType.name}...`;

    disposeTankModel(); // Dispose previous model before loading new one

    // Sử dụng ModelLoader nếu đã preload
    if (modelLoader && modelLoader.isPreloaded) {
        try {
            const model = modelLoader.getTankModel(tankType, new THREE.Vector3(0, 0, 0));
            if (model) {
                tankModel = model;
                tankModel.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                menuScene.add(tankModel);

                document.getElementById('tank-name').textContent = tankType.name;
                updateTankStatsUI(tankType.name);
                selectedTankModel = tankType; // Update the globally selected tank
                if (menuControls) {
                    menuControls.target.set(0, 0.5, 0); // Re-center controls target
                    menuControls.update();
                }
                return;
            }
        } catch (error) {
            console.error('Error getting tank model from cache:', error);
        }
    }

    // Fallback to original loadTankModel if preload failed or not available
    console.warn(`⚠️ Falling back to direct loading for ${tankType.name}`);
    loadTankModel(tankType)
        .then(model => {
            tankModel = model;
            tankModel.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            menuScene.add(tankModel);

            document.getElementById('tank-name').textContent = tankType.name;
            updateTankStatsUI(tankType.name);
            selectedTankModel = tankType; // Update the globally selected tank
            if (menuControls) {
                menuControls.target.set(0, 0.5, 0); // Re-center controls target
                menuControls.update();
            }
        })
        .catch(error => {
            console.error('Error loading tank model for menu:', error);
            document.getElementById('tank-name').textContent = `Lỗi tải ${tankType.name}`;
        });
}

function updateTankStatsUI(tankName) {
    const stats = tankStatsData[tankName];
    if (stats) {
        const powerStatEl = document.getElementById('power-stat');
        powerStatEl.style.width = `${stats.power}%`;
        powerStatEl.style.backgroundColor = statBarColors.power;

        const speedStatEl = document.getElementById('speed-stat');
        speedStatEl.style.width = `${stats.speed}%`;
        speedStatEl.style.backgroundColor = statBarColors.speed;

        const defenseStatEl = document.getElementById('defense-stat');
        defenseStatEl.style.width = `${stats.defense}%`;
        defenseStatEl.style.backgroundColor = statBarColors.defense;
    }
}

function animateMenu() {
    requestAnimationFrame(animateMenu);
    if (tankModel) {
        tankModel.rotation.y += 0.005;
    }
    if (menuControls) menuControls.update();
    if (menuRenderer && menuScene && menuCamera) menuRenderer.render(menuScene, menuCamera);
}

function onWindowResize() {
    // Menu renderer resize
    const tankDisplayDiv = document.getElementById('tank-display');
    if (menuCamera && menuRenderer && tankDisplayDiv && tankDisplayDiv.offsetParent !== null) { // Check if visible
        const displayWidth = tankDisplayDiv.clientWidth;
        const displayHeight = tankDisplayDiv.clientHeight;
        if (displayWidth > 0 && displayHeight > 0) {
            menuCamera.aspect = displayWidth / displayHeight;
            menuCamera.updateProjectionMatrix();
            menuRenderer.setSize(displayWidth, displayHeight);
        }
    }

    // Game renderer resize
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

    // Remove any existing non-HUD, non-current-renderer canvas elements
    Array.from(gameCanvasContainer.childNodes).forEach(child => {
        if (child !== hudElement && child !== gameInstance.renderer.domElement && child.tagName === 'CANVAS') {
            gameCanvasContainer.removeChild(child);
        }
    });
    
    if (!gameCanvasContainer.contains(gameInstance.renderer.domElement)) {
        if (hudElement && gameCanvasContainer.contains(hudElement)) {
            gameCanvasContainer.insertBefore(gameInstance.renderer.domElement, hudElement);
        } else {
            gameCanvasContainer.appendChild(gameInstance.renderer.domElement);
        }
    }
}

function disposeCurrentGame() {
    stopHUDUpdates();
    if (game) {
        const gameCanvasContainer = document.getElementById('game-container');
        if (game.renderer && game.renderer.domElement && gameCanvasContainer.contains(game.renderer.domElement)) {
            gameCanvasContainer.removeChild(game.renderer.domElement);
        }
        if (typeof game.dispose === 'function') {
            game.dispose();
        }
        game = null;
    }
}

function startNewGame(tankTypeToUse) {
    // document.getElementById('loading-message').style.display = 'block';
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('win-screen').style.display = 'none';

    disposeCurrentGame(); // Ensure any old game is cleaned up

    game = new Game({ tankType: tankTypeToUse });

    setTimeout(() => {
        if (!game) return; // Game might have been disposed if user navigated away quickly

        game.start();
        setupGameRendererDOM(game);

        document.getElementById('game-container').style.display = 'block';
        // document.getElementById('loading-message').style.display = 'none';
        document.getElementById('continue-button').disabled = !(game && game.canResume());

        startHUDUpdates();
        onWindowResize(); // Resize after DOM is visible
    }, GAME_START_DELAY);
}

function returnToMainMenu(preserveGameInstanceForPause = false) {
    if (!preserveGameInstanceForPause) {
        disposeCurrentGame();
    } else if (game) {
        game.pause(); // Ensure game is paused if preserved
        stopHUDUpdates();
    }

    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('win-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    // document.getElementById('loading-message').style.display = 'none';
    document.getElementById('menu-container').style.display = 'flex';

    document.getElementById('continue-button').disabled = !(game && game.canResume());
    onWindowResize(); // Ensure menu is sized correctly
}


// Event Listeners
document.getElementById('start-button').addEventListener('click', () => {
    startNewGame(selectedTankModel);
});

document.getElementById('continue-button').addEventListener('click', () => {
    if (game && game.canResume()) {
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        // document.getElementById('loading-message').style.display = 'none';

        setupGameRendererDOM(game); // Ensure renderer is in place

        game.resume();
        startHUDUpdates();
        onWindowResize();
    } else {
        startNewGame(selectedTankModel); // Fallback to new game if cannot resume
    }
});

document.getElementById('settings-button').addEventListener('click', () => {
    alert('Chức năng cài đặt sẽ được phát triển trong tương lai!');
});

document.getElementById('exit-button').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn thoát game không?')) {
        if (game) {
            game.stop(); // Or disposeCurrentGame() if full cleanup desired
        }
        stopHUDUpdates();
        try {
            window.close(); // May not work in all browser contexts
        } catch (e) {
            // Fallback for browsers that block window.close
            document.body.innerHTML = "<div style='text-align:center; padding-top: 50px; font-size: 24px; color: white;'>Cảm ơn đã chơi! Bạn có thể đóng tab này.</div>";
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
    // selectedTankModel is already updated by prev/next. This button is more of a visual confirmation.
    alert(`Đã chọn ${selectedTankModel.name}`);
    // The actual tank used is `selectedTankModel` when 'start-button' is pressed.
});

// HUD Management
let hudUpdateRequestId = null;
function updateHUD() {
    if (game && game.isRunning) { // Use the local 'game' instance
        const data = game.getHUDData(); // Assuming Game instance has getHUDData method
        if (data) {
            const hpEl = document.getElementById('hp');
            if (hpEl) hpEl.innerText = `HP: ${data.playerHP}`;
            
            const scoreEl = document.getElementById('score');
            if (scoreEl) scoreEl.innerText = `Điểm: ${data.score}`;

            const highScoreEl = document.getElementById('high-score');
            if (highScoreEl) highScoreEl.innerText = `Điểm cao: ${data.highScore}`;
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

// Global Event Listeners
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && game && game.isRunning) {
        returnToMainMenu(true); // Preserve game instance for pausing
    }
});

window.addEventListener('resize', onWindowResize, false);

// End Game Screen Event Setup
function setupEndGameScreenEvents() {
    // Game Over Screen
    document.getElementById('gameover-restart-button').addEventListener('click', () => {
        startNewGame(selectedTankModel);
    });
    document.getElementById('gameover-menu-button').addEventListener('click', () => {
        returnToMainMenu(false); // Do not preserve game instance
    });

    // Win Screen
    document.getElementById('win-restart-button').addEventListener('click', () => {
        startNewGame(selectedTankModel);
    });
    document.getElementById('win-menu-button').addEventListener('click', () => {
        returnToMainMenu(false); // Do not preserve game instance
    });
}

export function startLoadingScreen() {
    if (!document.getElementById('loading-screen')) {
        const loadingHTML = `
            <div id="loading-screen">
                <div class="loader">
                    <div class="cube">
                        <div class="face"></div>
                        <div class="face"></div>
                        <div class="face"></div>
                        <div class="face"></div>
                        <div class="face"></div>
                        <div class="face"></div>
                    </div>
                </div>
                <div class="loaderBar"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loadingHTML);

        // document.body.style.overflow = 'hidden'; // Thêm dòng này nếu muốn ngăn cuộn
    }
}

export function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.remove();
        // document.body.style.overflow = ''; // Cho phép cuộn lại
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🎮 DOM loaded, khởi tạo Tank3D game...");
    
    // Setup end game screen events
    setupEndGameScreenEvents();
    
    // Initialize menu scene (bao gồm preload models)
    await initMenuScene();
    
    // Log memory usage if preload successful
    if (modelLoader && modelLoader.isPreloaded) {
        const cacheInfo = modelLoader.getCacheInfo();
        console.log("🎯 Game initialized successfully!");
        console.log("📊 Memory Usage:", cacheInfo.memoryUsage);
        console.log("📦 Cached Models:", cacheInfo.modelKeys);
    }
    
    console.log("✅ Tank3D ready to play!");
});
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Game } from './class/Game.js';
import { EVENT, COLOR, TANKTYPE, loadTankModel } from './utils.js';
import { ModelLoader } from './loader.js';

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
    },
    [TANKTYPE.V007.name]: {
        power: 85,
        speed: 65,
        defense: 75
    }
};

// Cache for stat bar colors
const statBarColors = {
    power: new THREE.Color(COLOR.red).getStyle(),
    speed: new THREE.Color(COLOR.green).getStyle(),
    defense: new THREE.Color(COLOR.blue).getStyle()
};

/**
 * Preload all models when starting the app
 * @returns {Promise<boolean>} - Promise resolve when preload is complete
 */
async function preloadAllModels() {
    if (isPreloadingModels) {
        console.log("⏳ Models are being preloaded...");
        return false;
    }
    
    if (modelLoader && modelLoader.isPreloaded) {
        console.log("✅ Models have been preloaded previously");
        
        // Log cache details even when already preloaded
        const cacheInfo = modelLoader.getCacheInfo();
        console.log("📊 Cache Info (already preloaded):", cacheInfo);
        
        return true;
    }
    
    isPreloadingModels = true;
    
    try {
        console.log("🚀 Starting to preload all models...");
        
        // Initialize ModelLoader instance
        modelLoader = new ModelLoader();
        
        // Set timeout để prevent loading quá lâu
        const preloadPromise = modelLoader.preloadAllModels();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Preload timeout after 30 seconds')), 30000);
        });
        
        // Race between preload and timeout
        const success = await Promise.race([preloadPromise, timeoutPromise]);
        
        if (success) {
            console.log("✅ Preload models successful!");
            
            // Log cache info
            const cacheInfo = modelLoader.getCacheInfo();
            console.log("📊 Cache Info:", cacheInfo);
            
            // Log detailed model list in cache
            console.log("🗂️ Cached Models List:");
            modelLoader.logCachedModels();
        } else {
            console.warn("⚠️ Preload models completed with some failures, but game can still run");
        }
        
        return success;
    } catch (error) {
        console.error("❌ Error while preloading models:", error);
        
        // Nếu preload fail hoàn toàn, vẫn cho phép game chạy
        if (error.message.includes('timeout')) {
            console.warn("⚠️ Preload timeout - game will use direct loading");
        }
        
        return false; // Game vẫn có thể chạy mà không preload
    } finally {
        isPreloadingModels = false;
    }
}

/**
 * Show loading indicator when preloading
 */
function showPreloadingIndicator() {
    // Removed - preload runs silently in background
}

/**
 * Hide loading indicator
 */
function hidePreloadingIndicator() {
    // Removed - preload runs silently in background
}

async function initMenuScene() {
    // Preload models before setting up menu với error handling
    console.log("🎯 Initializing menu and preloading models...");
    
    try {
        const preloadSuccess = await preloadAllModels();
        if (!preloadSuccess) {
            console.warn("⚠️ Preload models failed, game will use direct loading (may cause lag when starting)");
        }
    } catch (error) {
        console.error("❌ Critical error during preload:", error);
        // Continue với menu setup ngay cả khi preload fail
    }

    menuScene = new THREE.Scene();
    menuScene.background = new THREE.Color(COLOR.darkGray);

    // Tăng độ sáng ambient light để làm sáng tổng thể scene
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8); // Tăng từ 0.4 lên 0.8
    menuScene.add(ambientLight);

    // Giảm cường độ directional light và shadow quality để giảm lag
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8); // Giảm từ 2.5 xuống 1.8
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    // Giảm shadow resolution để tăng performance
    directionalLight.shadow.mapSize.width = 1024; // Giảm từ 2048 xuống 1024
    directionalLight.shadow.mapSize.height = 1024; // Giảm từ 2048 xuống 1024
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 30; // Giảm từ 50 xuống 30
    directionalLight.shadow.camera.left = -8; // Giảm shadow area
    directionalLight.shadow.camera.right = 8;
    directionalLight.shadow.camera.top = 8;
    directionalLight.shadow.camera.bottom = -8;
    // Giảm shadow radius để giảm chi tiết bóng
    directionalLight.shadow.radius = 2; // Thêm radius nhỏ
    directionalLight.shadow.bias = -0.0005; // Tối ưu shadow bias
    menuScene.add(directionalLight);

    // Tăng rim light để bù đắp cho directional light giảm
    // const rimLight = new THREE.DirectionalLight(0x7799ff, 1.5); // Tăng từ 1.0 lên 1.5
    // rimLight.position.set(-5, 5, -5);
    // Không có shadow cho rim light để giảm tải
    // menuScene.add(rimLight);

    // Giảm point light và shadow quality
    const pointLight = new THREE.PointLight(0xffffff, 1.2, 25); // Giảm intensity và distance
    pointLight.position.set(0, 8, 0);
    pointLight.castShadow = true;
    // Giảm shadow resolution cho point light
    pointLight.shadow.mapSize.width = 512; // Giảm từ 1024 xuống 512
    pointLight.shadow.mapSize.height = 512;
    pointLight.shadow.camera.near = 1;
    pointLight.shadow.camera.far = 20; // Giảm shadow distance
    menuScene.add(pointLight);

    const tankDisplayDiv = document.getElementById('tank-display');
    if (!tankDisplayDiv) {
        console.error("Tank display div not found!");
        return;
    }

    const displayWidth = tankDisplayDiv.clientWidth;
    const displayHeight = tankDisplayDiv.clientHeight;

    menuCamera = new THREE.PerspectiveCamera(45, displayWidth / displayHeight, 0.1, 1000);
    menuCamera.position.set(0, 1.5, 6);

    menuRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance" // Tối ưu performance
    });
    menuRenderer.setSize(tankDisplayDiv.clientWidth, tankDisplayDiv.clientHeight);
    menuRenderer.setClearColor(COLOR.darkGray);
    menuRenderer.shadowMap.enabled = true;
    menuRenderer.shadowMap.type = THREE.PCFShadowMap; // Chuyển từ PCFSoftShadowMap về PCFShadowMap để giảm lag
    menuRenderer.outputColorSpace = THREE.SRGBColorSpace;
    menuRenderer.physicallyCorrectLights = true;
    menuRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    menuRenderer.toneMappingExposure = 1.2; // Tăng exposure để làm sáng hơn
    // Thêm các tối ưu renderer
    menuRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Giới hạn pixel ratio
    tankDisplayDiv.appendChild(menuRenderer.domElement);

    menuControls = new OrbitControls(menuCamera, menuRenderer.domElement);
    menuControls.enableDamping = true;
    menuControls.dampingFactor = 0.15;
    menuControls.target.set(0, 0.5, 0);
    menuControls.minDistance = 3;
    menuControls.maxDistance = 15;

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x606060, // Làm sáng ground color
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
        // Proper disposal của tank model trong menu
        tankModel.traverse(object => {
            if (object.isMesh) {
                // Dispose geometry
                if (object.geometry) {
                    object.geometry.dispose();
                }
                
                // Dispose materials
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            if (material.normalMap) material.normalMap.dispose();
                            if (material.roughnessMap) material.roughnessMap.dispose();
                            if (material.metalnessMap) material.metalnessMap.dispose();
                            material.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        if (object.material.normalMap) object.material.normalMap.dispose();
                        if (object.material.roughnessMap) object.material.roughnessMap.dispose();
                        if (object.material.metalnessMap) object.material.metalnessMap.dispose();
                        object.material.dispose();
                    }
                }
            }
        });
        
        // Remove từ scene
        menuScene.remove(tankModel);
        tankModel = null;
        
        // Force garbage collection hint
        if (window.gc) {
            window.gc();
        }
    }
}

function loadTankForMenu(tankType) {
    document.getElementById('tank-name').textContent = `Loading ${tankType.name}...`;

    disposeTankModel(); // Dispose previous model before loading new one

    // Use ModelLoader if already preloaded với better error handling
    if (modelLoader && modelLoader.isPreloaded) {
        try {
            const model = modelLoader.getTankModel(tankType, new THREE.Vector3(0, 0, 0));
            if (model) {
                tankModel = model;
                tankModel.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        
                        // Đảm bảo material properties cho hiệu ứng metal trong menu
                        if (node.material && node.material.isMeshStandardMaterial) {
                            node.material.metalness = 0.6;
                            node.material.roughness = 0.4;
                            node.material.envMapIntensity = 1.0;
                        }
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
            } else {
                console.warn('Failed to get tank model from cache, falling back to direct load');
            }
        } catch (error) {
            console.error('Error getting tank model from cache:', error);
        }
    }
    
    // Fallback: load directly if preload failed hoặc model không có
    console.warn(`⚠️ Falling back to direct loading for ${tankType.name}`);
    loadTankModel(tankType)
        .then(model => {
            tankModel = model;
            tankModel.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                        
                    // Đảm bảo material properties cho hiệu ứng metal trong menu
                    if (node.material && node.material.isMeshStandardMaterial) {
                        node.material.metalness = 0.6;
                        node.material.roughness = 0.4;
                        node.material.envMapIntensity = 1.0;
                    }
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
            console.error('Failed to load tank model:', error);
            document.getElementById('tank-name').textContent = `Error loading ${tankType.name}`;
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
        
        // Enhanced game disposal
        if (typeof game.dispose === 'function') {
            game.dispose();
        }
        
        // Clear references
        game = null;
        
        // Force garbage collection hint
        if (window.gc) {
            window.gc();
        }
    }
}

function startNewGame(tankTypeToUse) {
    // Clear any existing loading screens
    const existingLoadingScreen = document.getElementById('loading-screen');
    if (existingLoadingScreen) {
        existingLoadingScreen.remove();
    }
    
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('win-screen').style.display = 'none';

    disposeCurrentGame(); // Ensure any old game is cleaned up

    try {
        game = new Game({ tankType: tankTypeToUse });

        setTimeout(() => {
            if (!game) {
                console.error("Game instance was disposed during initialization");
                returnToMainMenu(false);
                return;
            }

            try {
                game.start();
                setupGameRendererDOM(game);

                document.getElementById('game-container').style.display = 'block';
                document.getElementById('continue-button').disabled = !(game && game.canResume());

                startHUDUpdates();
                onWindowResize(); // Resize after DOM is visible
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
    alert('Settings feature will be developed in the future!');
});

document.getElementById('exit-button').addEventListener('click', () => {
    if (confirm('Are you sure you want to exit the game?')) {
        if (game) {
            game.stop(); // Or disposeCurrentGame() if full cleanup desired
        }
        stopHUDUpdates();
        try {
            window.close(); // May not work in all browser contexts
        } catch (e) {
            // Fallback for browsers that block window.close
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
    // selectedTankModel is already updated by prev/next. This button is more of a visual confirmation.
    // Show success message
    const successMessage = document.createElement('div');
    successMessage.classList.add('tank-selection-success');
    successMessage.textContent = `Đã chọn ${selectedTankModel.name} thành công!`;
    successMessage.style.position = 'absolute';
    successMessage.style.top = '20%';
    successMessage.style.left = '50%';
    successMessage.style.transform = 'translate(-50%, -50%)';
    successMessage.style.padding = '15px 25px';
    successMessage.style.backgroundColor = 'rgba(0, 200, 0, 0.8)';
    successMessage.style.color = 'white';
    successMessage.style.borderRadius = '10px';
    successMessage.style.fontWeight = 'bold';
    successMessage.style.zIndex = '1000';
    document.body.appendChild(successMessage);
    
    // Remove the message after 2 seconds
    setTimeout(() => {
        successMessage.style.opacity = '0';
        successMessage.style.transition = 'opacity 0.5s';
        setTimeout(() => document.body.removeChild(successMessage), 500);
    }, 2000);
    
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
            if (scoreEl) scoreEl.innerText = `Score: ${data.score}`;

            const highScoreEl = document.getElementById('high-score');
            if (highScoreEl) highScoreEl.innerText = `High Score: ${data.highScore}`;
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
                <div class="loading-content">
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

// Initialize everything when DOM is loaded với better error handling
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🎮 DOM loaded, initializing Tank3D game...");
    
    try {
        // Setup end game screen events
        setupEndGameScreenEvents();
        
        // Initialize menu scene (including preload models) với timeout
        await Promise.race([
            initMenuScene(),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Menu initialization timeout')), 45000);
            })
        ]);
        
        // Log memory usage if preload successful
        if (modelLoader && modelLoader.isPreloaded) {
            const cacheInfo = modelLoader.getCacheInfo();
            console.log("🎯 Game initialized successfully!");
            console.log("📊 Memory Usage:", cacheInfo.memoryUsage);
            console.log("📦 Cached Models:", cacheInfo.modelKeys);
        } else {
            console.warn("🎯 Game initialized with fallback mode (no preload)");
        }
        
        console.log("✅ Tank3D ready to play!");
    } catch (error) {
        console.error("❌ Critical error during game initialization:", error);
        
        // Hiển thị error message cho user
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 9999;
        `;
        errorMessage.innerHTML = `
            <h3>Game Initialization Error</h3>
            <p>Failed to load game resources. Please refresh the page and try again.</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px;">Refresh Page</button>
        `;
        document.body.appendChild(errorMessage);
    }
});

// Thêm cleanup khi rời khỏi trang
window.addEventListener('beforeunload', () => {
    console.log("🧹 Cleaning up resources before page unload...");
    
    // Dispose menu resources
    disposeTankModel();
    
    // Dispose game resources
    disposeCurrentGame();
    
    // Clear ModelLoader cache
    if (modelLoader) {
        modelLoader.dispose();
        modelLoader = null;
    }
    
    // Dispose menu renderer
    if (menuRenderer) {
        menuRenderer.dispose();
        menuRenderer = null;
    }
    
    // Clear scene
    if (menuScene) {
        menuScene.clear();
        menuScene = null;
    }
});

// Thêm memory monitoring (chỉ trong development)
if (Game.debug && performance && performance.memory) {
    setInterval(() => {
        const memInfo = performance.memory;
        const used = Math.round(memInfo.usedJSHeapSize / 1048576);
        const total = Math.round(memInfo.totalJSHeapSize / 1048576);
        
        if (used > 150) { // Warning khi > 150MB
            console.warn(`⚠️ High memory usage: ${used}MB / ${total}MB`);
        }
        
        // Log memory info mỗi 30 giây
        if (Date.now() % 30000 < 1000) {
            console.log(`📊 Memory: ${used}MB / ${total}MB`);
        }
    }, 5000);
}
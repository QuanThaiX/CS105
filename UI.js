import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Game } from './class/Game.js';
import { EVENT, COLOR, TANKTYPE, loadTankModel } from './utils.js';

let game = null;
let selectedTankModel = TANKTYPE.V001;
let menuScene, menuCamera, menuRenderer, menuControls;
let tankModel = null;
let availableTanks = [TANKTYPE.V001, TANKTYPE.V003];
let currentTankIndex = 0;

const tankStatsData = {
    [TANKTYPE.V001.name]: {
        power: 80,
        speed: 60,
        defense: 70
    },
    [TANKTYPE.V003.name]: {
        power: 90,
        speed: 50,
        defense: 85
    }
};

function initMenuScene() {
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

    const displayWidth = tankDisplayDiv.clientWidth;
    const displayHeight = tankDisplayDiv.clientHeight;

    menuCamera = new THREE.PerspectiveCamera(45, displayWidth / displayHeight, 0.1, 1000);
    menuCamera.position.set(0, 1.5, 6); // Adjust for better framing in the new aspect ratio

    menuRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha:true if #tank-display has CSS bg
    menuRenderer.setSize(displayWidth, displayHeight);
    menuRenderer.setPixelRatio(window.devicePixelRatio);
    menuRenderer.shadowMap.enabled = true;
    menuRenderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

    tankDisplayDiv.appendChild(menuRenderer.domElement);

    menuControls = new OrbitControls(menuCamera, menuRenderer.domElement);
    menuControls.enableDamping = true;
    menuControls.dampingFactor = 0.15; // Adjust damping
    menuControls.target.set(0, 0.5, 0); // Adjust target if model pivot is not at base
    menuControls.minDistance = 3;
    menuControls.maxDistance = 15;

    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: COLOR.gray,
        roughness: 0.7,
        metalness: 0.3
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    menuScene.add(ground);

    loadTankForMenu(availableTanks[currentTankIndex]);
    animateMenu(); // Changed from animate to avoid conflict if global animate exists
}

function loadTankForMenu(tankType) {
    document.getElementById('tank-name').textContent = `Đang tải ${tankType.name}...`;

    if (tankModel) {
        menuScene.remove(tankModel);
        // TODO: Properly dispose of old model's geometry and materials
        tankModel = null;
    }

    loadTankModel(tankType)
        .then(model => {
            tankModel = model;
            tankModel.traverse(node => { // Ensure all parts of model cast/receive shadow
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            // model.position.y = 0; // Adjust if tank pivot is not at its base
            menuScene.add(tankModel);

            document.getElementById('tank-name').textContent = tankType.name; // Use name from TANKTYPE

            updateTankStatsUI(tankType.name); // Changed name
            selectedTankModel = tankType;
            menuControls.target.set(0, 0.5, 0); // Re-center controls target
            menuControls.update();
        })
        .catch(error => {
            console.error('Error loading tank model:', error);
            document.getElementById('tank-name').textContent = `Lỗi tải ${tankType.name}`;
        });
}

function updateTankStatsUI(tankName) { // Renamed
    const stats = tankStatsData[tankName]; // Use renamed data object

    if (stats) {
        document.getElementById('power-stat').style.width = `${stats.power}%`;
        document.getElementById('power-stat').style.backgroundColor = new THREE.Color(COLOR.red).getStyle();

        document.getElementById('speed-stat').style.width = `${stats.speed}%`;
        document.getElementById('speed-stat').style.backgroundColor = new THREE.Color(COLOR.green).getStyle();

        document.getElementById('defense-stat').style.width = `${stats.defense}%`;
        document.getElementById('defense-stat').style.backgroundColor = new THREE.Color(COLOR.blue).getStyle();
    }
}

function animateMenu() { // Renamed
    requestAnimationFrame(animateMenu);

    if (tankModel) {
        tankModel.rotation.y += 0.005; // Slower rotation
    }

    if (menuControls) menuControls.update();
    if (menuRenderer && menuScene && menuCamera) menuRenderer.render(menuScene, menuCamera);
}

function onWindowResize() {
    const tankDisplayDiv = document.getElementById('tank-display');
    if (menuCamera && menuRenderer && tankDisplayDiv) {
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
            // Game renderer takes full window dimensions
            game.camera.aspect = window.innerWidth / window.innerHeight;
            game.camera.updateProjectionMatrix();
            game.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
}

document.getElementById('start-button').addEventListener('click', () => {
    document.getElementById('loading-message').style.display = 'block';
    document.getElementById('menu-container').style.display = 'none';

    if (game) {
        const gameCanvasContainer = document.getElementById('game-container');
        if (game.renderer && game.renderer.domElement && gameCanvasContainer.contains(game.renderer.domElement)) {
            gameCanvasContainer.removeChild(game.renderer.domElement);
        }

        game.dispose();
        game = null;
    }

    game = new Game({ tankType: selectedTankModel });

    setTimeout(() => {
        game.start();

        document.getElementById('game-container').style.display = 'block';
        document.getElementById('loading-message').style.display = 'none';
        document.getElementById('continue-button').disabled = false;

        const gameCanvasContainer = document.getElementById('game-container');
        if (game.renderer && game.renderer.domElement) {
            // Clear previous canvas if any
            while (gameCanvasContainer.firstChild && gameCanvasContainer.firstChild !== document.getElementById('hud')) {
                gameCanvasContainer.removeChild(gameCanvasContainer.firstChild);
            }
            gameCanvasContainer.insertBefore(game.renderer.domElement, document.getElementById('hud'));
        }
        startHUDUpdates();
        onWindowResize();
    }, 250);
});

document.getElementById('continue-button').addEventListener('click', () => {
    if (game && game.canResume()) {
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';

        // Đảm bảo renderer đã được gắn vào DOM
        const gameCanvasContainer = document.getElementById('game-container');
        if (game.renderer && game.renderer.domElement && !gameCanvasContainer.contains(game.renderer.domElement)) {
            // Xóa các canvas cũ nếu có
            while (gameCanvasContainer.firstChild && gameCanvasContainer.firstChild !== document.getElementById('hud')) {
                gameCanvasContainer.removeChild(gameCanvasContainer.firstChild);
            }
            gameCanvasContainer.insertBefore(game.renderer.domElement, document.getElementById('hud'));
        }

        game.resume();
        startHUDUpdates();
        onWindowResize();
    } else {
        // Nếu không thể tiếp tục, chuyển sang tạo game mới
        document.getElementById('start-button').click();
    }
});

document.getElementById('settings-button').addEventListener('click', () => {
    alert('Chức năng cài đặt sẽ được phát triển trong tương lai!');
});

document.getElementById('exit-button').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn thoát game không?')) {
        if (game) {
            game.stop();
        }
        stopHUDUpdates();
        try {
            window.close();
        } catch (e) {
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
    alert(`Đã chọn ${selectedTankModel.name}`);
    // The selectedTankModel is passed to the Game instance when 'start-button' is clicked.
});

let hudUpdateRequestId = null;
function updateHUD() {
    if (Game.instance && Game.instance.isRunning) {
        const data = Game.instance.getHUDData();
        if (data) {
            if (document.getElementById('hp')) {
                document.getElementById('hp').innerText = `HP: ${data.playerHP}`;
            }
            if (document.getElementById('score')) {
                document.getElementById('score').innerText = `Điểm: ${data.score}`;
            }
            if (document.getElementById('high-score')) {
                document.getElementById('high-score').innerText = `Điểm cao: ${data.highScore}`;
            }
        }
    }
    hudUpdateRequestId = requestAnimationFrame(updateHUD);
}

function startHUDUpdates() {
    if (!hudUpdateRequestId) {
        updateHUD();
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
        game.pause();
        stopHUDUpdates();
        document.getElementById('menu-container').style.display = 'flex'; // Show menu
        document.getElementById('game-container').style.display = 'none'; // Hide game
        // No need to re-init menu scene if it's preserved.
    }
});

window.addEventListener('resize', onWindowResize, false);
initMenuScene();

// Đăng ký lắng nghe sự kiện cho các nút trên màn hình thắng/thua
function setupEndGameScreenEvents() {
    // Màn hình Game Over
    document.getElementById('gameover-restart-button').addEventListener('click', function () {
        document.getElementById('game-over-screen').style.display = 'none';

        // Xóa game hiện tại và tạo mới
        if (game) {
            // Xóa renderer khỏi DOM
            const gameCanvasContainer = document.getElementById('game-container');
            if (game.renderer && game.renderer.domElement && gameCanvasContainer.contains(game.renderer.domElement)) {
                gameCanvasContainer.removeChild(game.renderer.domElement);
            }
            // Giải phóng hoàn toàn tài nguyên game
            game.dispose();
            // Xóa tham chiếu tới game cũ
            game = null;
        }

        // Tạo game mới
        document.getElementById('loading-message').style.display = 'block';
        document.getElementById('game-container').style.display = 'none';

        setTimeout(() => {
            game = new Game({ tankType: selectedTankModel });

            game.start();
            document.getElementById('game-container').style.display = 'block';
            document.getElementById('loading-message').style.display = 'none';
            document.getElementById('continue-button').disabled = false;

            const gameCanvasContainer = document.getElementById('game-container');
            if (game.renderer && game.renderer.domElement) {
                gameCanvasContainer.insertBefore(game.renderer.domElement, document.getElementById('hud'));
            }

            startHUDUpdates();
            onWindowResize();
        }, 250);
    });

    document.getElementById('gameover-menu-button').addEventListener('click', function () {
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('menu-container').style.display = 'flex';

        // Xóa game hiện tại
        if (game) {
            // Xóa renderer khỏi DOM
            const gameCanvasContainer = document.getElementById('game-container');
            if (game.renderer && game.renderer.domElement && gameCanvasContainer.contains(game.renderer.domElement)) {
                gameCanvasContainer.removeChild(game.renderer.domElement);
            }
            // Giải phóng hoàn toàn tài nguyên game
            game.dispose();
            // Xóa tham chiếu tới game cũ
            game = null;
        }

        stopHUDUpdates();
    });

    // Màn hình Win
    document.getElementById('win-restart-button').addEventListener('click', function () {
        document.getElementById('win-screen').style.display = 'none';

        // Xóa game hiện tại và tạo mới
        if (game) {
            // Xóa renderer khỏi DOM
            const gameCanvasContainer = document.getElementById('game-container');
            if (game.renderer && game.renderer.domElement && gameCanvasContainer.contains(game.renderer.domElement)) {
                gameCanvasContainer.removeChild(game.renderer.domElement);
            }
            // Giải phóng hoàn toàn tài nguyên game
            game.dispose();
            // Xóa tham chiếu tới game cũ
            game = null;
        }

        // Tạo game mới
        document.getElementById('loading-message').style.display = 'block';
        document.getElementById('game-container').style.display = 'none';

        setTimeout(() => {
            game = new Game({ tankType: selectedTankModel });

            game.start();
            document.getElementById('game-container').style.display = 'block';
            document.getElementById('loading-message').style.display = 'none';
            document.getElementById('continue-button').disabled = false;

            const gameCanvasContainer = document.getElementById('game-container');
            if (game.renderer && game.renderer.domElement) {
                gameCanvasContainer.insertBefore(game.renderer.domElement, document.getElementById('hud'));
            }

            startHUDUpdates();
            onWindowResize();
        }, 250);
    });

    document.getElementById('win-menu-button').addEventListener('click', function () {
        document.getElementById('win-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('menu-container').style.display = 'flex';

        // Xóa game hiện tại
        if (game) {
            // Xóa renderer khỏi DOM
            const gameCanvasContainer = document.getElementById('game-container');
            if (game.renderer && game.renderer.domElement && gameCanvasContainer.contains(game.renderer.domElement)) {
                gameCanvasContainer.removeChild(game.renderer.domElement);
            }
            // Giải phóng hoàn toàn tài nguyên game
            game.dispose();
            // Xóa tham chiếu tới game cũ
            game = null;
        }

        stopHUDUpdates();
    });
}

// Thiết lập sự kiện cho màn hình kết thúc game
setupEndGameScreenEvents();
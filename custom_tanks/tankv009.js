import * as THREE from 'three';

/**
 * @returns {THREE.Group} Tank model
 */
export function createTank() {
    const tank = new THREE.Group();
    tank.name = "TankV009_Sentinel";


    const textureLoader = new THREE.TextureLoader();
    const tankTexture = textureLoader.load('./assets/tankv009/tankv009.jpg');
    
    tankTexture.wrapS = THREE.RepeatWrapping;
    tankTexture.wrapT = THREE.RepeatWrapping;

    const bodyTexture = tankTexture.clone();
    bodyTexture.needsUpdate = true;
    bodyTexture.repeat.set(1, 0.5); 
    bodyTexture.offset.set(0, 0.5);

    const trackTexture = tankTexture.clone();
    trackTexture.needsUpdate = true;
    trackTexture.repeat.set(1, 0.5); 
    trackTexture.offset.set(0, 0);


    const bodyMaterial = new THREE.MeshStandardMaterial({
        map: bodyTexture,      
        metalness: 0.8,
        roughness: 0.5, 
    });

    const trackMaterial = new THREE.MeshStandardMaterial({
        color: 0x212121,
        // map: trackTexture,     // <<< SỬ DỤNG TEXTURE
        metalness: 0.2,
        roughness: 0.8,
    });

    // Các vật liệu khác giữ nguyên vì chúng không dùng texture chính
    const cannonMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.2,
    });

    const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 2.5,
        toneMapped: false,
    });
    
    const lightLensMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
    });


    const hull = new THREE.Group();
    hull.name = "Hull";

    // Khung chính
    const mainHullGeo = new THREE.BoxGeometry(3.2, 1, 4.8);
    const mainHull = new THREE.Mesh(mainHullGeo, bodyMaterial);
    mainHull.position.y = 0.8;
    hull.add(mainHull);

    // Tấm giáp nghiêng phía trước
    const frontArmorGeo = new THREE.BoxGeometry(3.2, 1, 1);
    const frontArmor = new THREE.Mesh(frontArmorGeo, bodyMaterial);
    frontArmor.position.set(0, 0.4, 2.1);
    frontArmor.rotation.x = THREE.MathUtils.degToRad(30);
    hull.add(frontArmor);
    
    // Khối động cơ phía sau với khe tản nhiệt phát sáng
    const engineBlockGeo = new THREE.BoxGeometry(2.5, 0.8, 0.5);
    const engineBlock = new THREE.Mesh(engineBlockGeo, bodyMaterial);
    engineBlock.position.set(0, 1, -2.5);
    hull.add(engineBlock);

    const engineVentGeo = new THREE.PlaneGeometry(1.5, 0.3);
    const engineVent = new THREE.Mesh(engineVentGeo, glowMaterial);
    engineVent.position.set(0, 1, -2.76); 
    engineVent.rotation.x = Math.PI / 2;
    hull.add(engineVent);
    
    const engineLight = new THREE.PointLight(0x00ffff, 5, 5);
    engineLight.position.set(0, 1, -2.7);
    hull.add(engineLight);

    tank.add(hull);

    const turret = new THREE.Group();
    turret.name = "Turret";
    turret.position.y = 1.4;

    const turretBaseGeo = new THREE.CylinderGeometry(1.4, 1.6, 1, 8);
    const turretBase = new THREE.Mesh(turretBaseGeo, bodyMaterial);
    turretBase.position.y = 0.5;
    turret.add(turretBase);

    const cannonMountGeo = new THREE.BoxGeometry(0.8, 0.7, 1.2);
    const cannonMount = new THREE.Mesh(cannonMountGeo, bodyMaterial);
    cannonMount.position.set(0, 0.6, 1);
    turret.add(cannonMount);

    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 3.5, 12);
    const cannon = new THREE.Mesh(cannonGeo, cannonMaterial);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 0.6, 2.9);
    turret.add(cannon);

    const muzzleGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12);
    const muzzle = new THREE.Mesh(muzzleGeo, cannonMaterial);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.6, 4.85);
    turret.add(muzzle);
    
    for (let i = 0; i < 3; i++) {
        const ringGeo = new THREE.TorusGeometry(0.2, 0.05, 8, 24);
        const ring = new THREE.Mesh(ringGeo, glowMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.6, 2.0 + i * 0.4);
        turret.add(ring);
    }
    
    tank.add(turret);
    
    
    const radar = new THREE.Group();
    radar.name = "Radar";
    radar.position.set(0.8, 1, -0.5);

    const radarPoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
    const radarPole = new THREE.Mesh(radarPoleGeo, bodyMaterial);
    radarPole.position.y = 0.25;
    radar.add(radarPole);
    
    const radarDishGeo = new THREE.BoxGeometry(0.8, 0.1, 0.2);
    const radarDish = new THREE.Mesh(radarDishGeo, bodyMaterial);
    radarDish.position.y = 0.5;
    radar.add(radarDish);

    turret.add(radar);

    tank.userData.update = (time) => {
        if (radar) {
            radar.rotation.y = time * 1.5;
        }
    };


    const createTrack = () => {
        const trackGroup = new THREE.Group();
        const trackHousingGeo = new THREE.BoxGeometry(1, 0.8, 5.4);
        const trackHousing = new THREE.Mesh(trackHousingGeo, bodyMaterial);
        trackHousing.position.y = 0.4;
        trackGroup.add(trackHousing);

        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 18);
        for (let i = 0; i < 6; i++) {
            const wheel = new THREE.Mesh(wheelGeo, trackMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(0, 0.3, -2.1 + i * 0.84);
            trackGroup.add(wheel);
        }
        return trackGroup;
    };

    const leftTrack = createTrack();
    leftTrack.position.x = -1.6;
    tank.add(leftTrack);
    
    const rightTrack = createTrack();
    rightTrack.position.x = 1.6;
    tank.add(rightTrack);


    const createHeadlight = (position) => {
        const lightGroup = new THREE.Group();
        const headLightGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.2, 12);
        const headLight = new THREE.Mesh(headLightGeo, bodyMaterial);
        headLight.rotation.z = -Math.PI / 2;
        lightGroup.add(headLight);
        
        const lensGeo = new THREE.CircleGeometry(0.1, 12);
        const lens = new THREE.Mesh(lensGeo, lightLensMaterial);
        lens.position.x = 0.11;
        lightGroup.add(lens);
        
        lightGroup.position.copy(position);
        return lightGroup;
    };
    
    const leftHeadlight = createHeadlight(new THREE.Vector3(-1, 1.1, 2.4));
    tank.add(leftHeadlight);
    
    const rightHeadlight = createHeadlight(new THREE.Vector3(1, 1.1, 2.4));
    tank.add(rightHeadlight);
    


    tank.position.y = -0.3;

    const scaleFactor = 0.8; 
    tank.scale.setScalar(scaleFactor);

    tank.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return tank;
}
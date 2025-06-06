import * as THREE from 'three';

/**
 * Tạo xe tank V007 hoàn toàn bằng code Three.js
 * @returns {THREE.Group} Tank model
 */
export function createTank() {
    const tank = new THREE.Group();
    
    // Load texture
    const textureLoader = new THREE.TextureLoader();
    const tankTexture = textureLoader.load('./assets/tankv007/tankv007_tt.jpg');
    
    // Màu sắc
    const mainColor = new THREE.Color(0x2a4080); // Xanh đậm
    const secondaryColor = new THREE.Color(0x4a6a9c); // Xanh nhạt hơn
    const darkGrey = new THREE.Color(0x333333);
    const trackColor = new THREE.Color(0x222222);
    const cannonColor = new THREE.Color(0x111111);
    
    // Tạo vật liệu cơ bản cho tank với texture
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        map: tankTexture,
        metalness: 0.6,
        roughness: 0.4
    });
    
    const towerMaterial = new THREE.MeshStandardMaterial({ 
        map: tankTexture,
        metalness: 0.7,
        roughness: 0.3
    });
    
    const darkMaterial = new THREE.MeshStandardMaterial({ 
        map: tankTexture,
        metalness: 0.5,
        roughness: 0.6
    });
    
    const trackMaterial = new THREE.MeshStandardMaterial({ 
        map: tankTexture,
        metalness: 0.4,
        roughness: 0.8
    });
    
    // Nòng pháo giữ nguyên màu đen, không dùng texture
    const cannonMaterial = new THREE.MeshStandardMaterial({ 
        color: cannonColor, 
        metalness: 0.9,
        roughness: 0.1
    });

    // 1. Thân xe (hull)
    const hullGeometry = new THREE.BoxGeometry(3, 1, 4);
    const hull = new THREE.Mesh(hullGeometry, bodyMaterial);
    hull.position.y = 0.6;
    hull.castShadow = true;
    hull.receiveShadow = true;
    tank.add(hull);
    
    // Thêm đỉnh trên thân xe
    const topHullGeometry = new THREE.BoxGeometry(2.6, 0.4, 3.5);
    const topHull = new THREE.Mesh(topHullGeometry, bodyMaterial);
    topHull.position.y = 1.3;
    topHull.castShadow = true;
    topHull.receiveShadow = true;
    tank.add(topHull);
    
    // 2. Tháp pháo (turret)
    const turretGeometry = new THREE.CylinderGeometry(1.2, 1.4, 0.9, 8);
    const turret = new THREE.Mesh(turretGeometry, towerMaterial);
    turret.position.y = 2;
    turret.castShadow = true;
    turret.receiveShadow = true;
    tank.add(turret);
    
    // Thêm phần trên tháp pháo
    const turretTopGeometry = new THREE.CylinderGeometry(0.8, 1.2, 0.3, 8);
    const turretTop = new THREE.Mesh(turretTopGeometry, towerMaterial);
    turretTop.position.y = 2.6;
    turretTop.castShadow = true;
    turretTop.receiveShadow = true;
    tank.add(turretTop);
    
    // Thêm dome trên tháp pháo
    const domeGeometry = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeometry, towerMaterial);
    dome.position.y = 2.9;
    dome.castShadow = true;
    dome.receiveShadow = true;
    tank.add(dome);
    
    // 3. Nòng súng (cannon) - không dùng texture
    const cannonGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3, 16);
    const cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
    cannon.position.set(0, 2, 2.2);
    cannon.rotation.x = Math.PI / 2;
    cannon.castShadow = true;
    cannon.receiveShadow = true;
    tank.add(cannon);
    
    // Thêm đầu nòng súng - không dùng texture
    const cannonTipGeometry = new THREE.CylinderGeometry(0.25, 0.2, 0.3, 16);
    const cannonTip = new THREE.Mesh(cannonTipGeometry, cannonMaterial);
    cannonTip.position.set(0, 2, 3.8);
    cannonTip.rotation.x = Math.PI / 2;
    cannonTip.castShadow = true;
    cannonTip.receiveShadow = true;
    tank.add(cannonTip);

    // 4. Xích xe bên trái (left track)
    const leftTrackGeometry = new THREE.BoxGeometry(0.8, 0.6, 5);
    const leftTrack = new THREE.Mesh(leftTrackGeometry, trackMaterial);
    leftTrack.position.set(-1.4, 0.3, 0);
    leftTrack.castShadow = true;
    leftTrack.receiveShadow = true;
    tank.add(leftTrack);
    
    // Chi tiết xích xe trái
    addTrackDetails(leftTrack, -1.4, 0.3, 0, trackMaterial, tank);

    // 5. Xích xe bên phải (right track)
    const rightTrackGeometry = new THREE.BoxGeometry(0.8, 0.6, 5);
    const rightTrack = new THREE.Mesh(rightTrackGeometry, trackMaterial);
    rightTrack.position.set(1.4, 0.3, 0);
    rightTrack.castShadow = true;
    rightTrack.receiveShadow = true;
    tank.add(rightTrack);
    
    // Chi tiết xích xe phải
    addTrackDetails(rightTrack, 1.4, 0.3, 0, trackMaterial, tank);
    
    // 6. Thêm ăng-ten
    const antennaGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
    const antenna = new THREE.Mesh(antennaGeometry, darkMaterial);
    antenna.position.set(0.7, 3.2, -0.5);
    antenna.castShadow = true;
    antenna.receiveShadow = true;
    tank.add(antenna);
    
    // 7. Thêm chi tiết trang trí - miếng đệm xung quanh tháp pháo
    addArmorPlates(tank, towerMaterial);
    
    // 8. Thêm đèn
    addLights(tank, darkMaterial);
    
    // Hiệu chỉnh vị trí cơ bản: giảm tọa độ y đi 1 đơn vị
    tank.position.y = -0.7; // Thay đổi từ 0.3 thành -0.7
    
    return tank;
}

/**
 * Thêm chi tiết cho xích xe
 */
function addTrackDetails(trackMesh, x, y, z, material, parent) {
    // Bánh xe phía trước
    const frontWheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16);
    const frontWheel = new THREE.Mesh(frontWheelGeometry, material);
    frontWheel.position.set(x, y, 2.1);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.castShadow = true;
    frontWheel.receiveShadow = true;
    parent.add(frontWheel);
    
    // Bánh xe phía sau
    const backWheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16);
    const backWheel = new THREE.Mesh(backWheelGeometry, material);
    backWheel.position.set(x, y, -2.1);
    backWheel.rotation.z = Math.PI / 2;
    backWheel.castShadow = true;
    backWheel.receiveShadow = true;
    parent.add(backWheel);
    
    // Bánh xe giữa
    const middleWheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.7, 16);
    const middleWheel = new THREE.Mesh(middleWheelGeometry, material);
    middleWheel.position.set(x, y, 0);
    middleWheel.rotation.z = Math.PI / 2;
    middleWheel.castShadow = true;
    middleWheel.receiveShadow = true;
    parent.add(middleWheel);
    
    // Thêm bánh dẫn hướng nhỏ hơn
    for (let i = -1.5; i <= 1.5; i += 1) {
        if (i === 0) continue; // Bỏ qua vị trí giữa đã có bánh lớn
        
        const smallWheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.7, 12);
        const smallWheel = new THREE.Mesh(smallWheelGeometry, material);
        smallWheel.position.set(x, y + 0.25, i);
        smallWheel.rotation.z = Math.PI / 2;
        smallWheel.castShadow = true;
        smallWheel.receiveShadow = true;
        parent.add(smallWheel);
    }
}

/**
 * Thêm miếng đệm giáp cho tháp pháo
 */
function addArmorPlates(tank, material) {
    // Thêm miếng giáp trang trí trên tháp pháo
    const plateGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.8);
    
    // Phía trước
    const frontPlate = new THREE.Mesh(plateGeometry, material);
    frontPlate.position.set(0, 2, 1.3);
    frontPlate.castShadow = true;
    frontPlate.receiveShadow = true;
    tank.add(frontPlate);
    
    // Phía sau
    const backPlate = new THREE.Mesh(plateGeometry, material);
    backPlate.position.set(0, 2, -1.3);
    backPlate.castShadow = true;
    backPlate.receiveShadow = true;
    tank.add(backPlate);
    
    // Bên trái
    const leftPlate = new THREE.Mesh(plateGeometry, material);
    leftPlate.position.set(-1.3, 2, 0);
    leftPlate.rotation.y = Math.PI / 2;
    leftPlate.castShadow = true;
    leftPlate.receiveShadow = true;
    tank.add(leftPlate);
    
    // Bên phải
    const rightPlate = new THREE.Mesh(plateGeometry, material);
    rightPlate.position.set(1.3, 2, 0);
    rightPlate.rotation.y = Math.PI / 2;
    rightPlate.castShadow = true;
    rightPlate.receiveShadow = true;
    tank.add(rightPlate);
}

/**
 * Thêm đèn và các chi tiết trang trí
 */
function addLights(tank, material) {
    // Đèn phía trước
    const frontLightGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const frontLight = new THREE.Mesh(frontLightGeometry, material);
    frontLight.position.set(0.8, 0.8, 2.1);
    frontLight.castShadow = true;
    frontLight.receiveShadow = true;
    tank.add(frontLight);
    
    const frontLight2 = new THREE.Mesh(frontLightGeometry, material);
    frontLight2.position.set(-0.8, 0.8, 2.1);
    frontLight2.castShadow = true;
    frontLight2.receiveShadow = true;
    tank.add(frontLight2);
    
    // Thêm các chi tiết trang trí nhỏ
    const detailGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.5);
    const detail = new THREE.Mesh(detailGeometry, material);
    detail.position.set(0, 1.3, -1.5);
    detail.castShadow = true;
    detail.receiveShadow = true;
    tank.add(detail);
} 
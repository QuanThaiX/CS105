import * as THREE from 'three';

export function createTank() {
    const tank = new THREE.Group();
    tank.name = "Tank_V008_Juggernaut";

    // --- Vật liệu ---
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a535b, metalness: 0.8, roughness: 0.5
    });
    const trackMaterial = new THREE.MeshStandardMaterial({
        color: 0x1c1c1c, metalness: 0.4, roughness: 0.8
    });
    const detailMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333, metalness: 0.9, roughness: 0.3
    });

    const hull = new THREE.Group(); hull.name = "Hull";
    const turret = new THREE.Group(); turret.name = "Turret";
    tank.add(hull, turret);
    

    const mainHullGeo = new THREE.BoxGeometry(2.2, 0.8, 3.8);
    const mainHull = new THREE.Mesh(mainHullGeo, bodyMaterial);
    mainHull.position.y = 0.6;
    hull.add(mainHull);

    const frontArmorShape = new THREE.Shape();
    frontArmorShape.moveTo(0, 0); frontArmorShape.lineTo(0.7, 0.35);
    frontArmorShape.lineTo(0.7, -0.35); frontArmorShape.lineTo(0, 0);
    const frontArmorGeo = new THREE.ExtrudeGeometry(frontArmorShape, { depth: 2.2, bevelEnabled: false });
    const frontArmor = new THREE.Mesh(frontArmorGeo, bodyMaterial);
    frontArmor.rotation.y = Math.PI / 2;
    frontArmor.position.set(-1.1, 0.6, 1.9);
    hull.add(frontArmor);

    const trackGeo = new THREE.BoxGeometry(0.8, 0.6, 4.2);
    const leftTrack = new THREE.Mesh(trackGeo, trackMaterial);
    leftTrack.position.set(-1.5, 0.3, 0);
    hull.add(leftTrack);

    const rightTrack = new THREE.Mesh(trackGeo, trackMaterial);
    rightTrack.position.set(1.5, 0.3, 0);
    hull.add(rightTrack);

    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.0, 12);
    for (let i = -1.6; i <= 1.6; i += 0.8) {
        const leftWheel = new THREE.Mesh(wheelGeo, detailMaterial);
        leftWheel.rotation.z = Math.PI / 2;
        leftWheel.position.set(-1.5, 0.3, i);
        hull.add(leftWheel);

        const rightWheel = new THREE.Mesh(wheelGeo, detailMaterial);
        rightWheel.rotation.z = Math.PI / 2;
        rightWheel.position.set(1.5, 0.3, i);
        hull.add(rightWheel);
    }

    turret.position.y = 1.0;

    const turretBaseGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.7, 8);
    const turretBase = new THREE.Mesh(turretBaseGeo, bodyMaterial);
    turret.add(turretBase);

    const turretTopGeo = new THREE.BoxGeometry(1.8, 0.6, 2.2);
    const turretTop = new THREE.Mesh(turretTopGeo, bodyMaterial);
    turretTop.position.y = 0.6;
    turret.add(turretTop);

    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.8, 12);
    const leftCannon = new THREE.Mesh(cannonGeo, detailMaterial);
    leftCannon.rotation.x = Math.PI / 2;
    leftCannon.position.set(-0.4, 0.6, 1.5);
    turret.add(leftCannon);

    const rightCannon = new THREE.Mesh(cannonGeo, detailMaterial);
    rightCannon.rotation.x = Math.PI / 2;
    rightCannon.position.set(0.4, 0.6, 1.5);
    turret.add(rightCannon);

    const cupolaGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.3, 8);
    const cupola = new THREE.Mesh(cupolaGeo, bodyMaterial);
    cupola.position.set(0.5, 1.0, -0.4);
    turret.add(cupola);

    tank.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    tank.position.y = -0.1;
    return tank;
}
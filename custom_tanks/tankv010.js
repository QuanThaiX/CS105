import * as THREE from 'three';

export function createTank() {
    const tank = new THREE.Group();
    tank.name = "TankV010_Spectre_MaxVisuality";


    const textureLoader = new THREE.TextureLoader();
    const tankTexture = textureLoader.load('./assets/tankv010/tankv010.jpg');
    
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

    const hullMaterial = new THREE.MeshStandardMaterial({
        // color: 0x555555, // Darker, more gunmetal color
        map: bodyTexture,
        metalness: 0.95,
        roughness: 0.4,
        flatShading: true,
    });
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555, // Darker, more gunmetal color
        // map: bodyTexture,
        metalness: 0.95,
        roughness: 0.4,
        flatShading: true,
    });

    const darkMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.8,
        roughness: 0.5,
    });

    const primaryGlowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 3,
        toneMapped: false,
    });

    const accentGlowMaterial = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        emissive: 0xff00ff,
        emissiveIntensity: 2,
        toneMapped: false,
    });
    
    // Material for the new engine glow
    const engineGlowMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4500, // Orange-Red glow
        emissive: 0xff4500,
        emissiveIntensity: 4,
        toneMapped: false,
    });

    // --- Hull (Thân xe) ---
    // The core chassis remains the same angular shape
    const hullShape = new THREE.Shape();
    const w = 1.6, l = 2.5;
    hullShape.moveTo(-w, -l);
    hullShape.lineTo(-w, l * 0.6);
    hullShape.lineTo(-w * 0.7, l);
    hullShape.lineTo(w * 0.7, l);
    hullShape.lineTo(w, l * 0.6);
    hullShape.lineTo(w, -l);
    hullShape.lineTo(-w, -l);

    const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 1 };
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
    const hull = new THREE.Mesh(hullGeo, hullMaterial);
    hull.rotation.x = -Math.PI / 2;
    hull.castShadow = true;
    hull.receiveShadow = true;
    tank.add(hull);

    // --- NEW: Side Armor Plating (Layering) ---
    const armorPlateGeo = new THREE.BoxGeometry(0.2, 0.4, 3.5);
    const leftArmor = new THREE.Mesh(armorPlateGeo, darkMaterial);
    leftArmor.position.set(-1.7, 0.1, 0);
    leftArmor.castShadow = true;
    tank.add(leftArmor);

    const rightArmor = new THREE.Mesh(armorPlateGeo, darkMaterial);
    rightArmor.position.set(1.7, 0.1, 0);
    rightArmor.castShadow = true;
    tank.add(rightArmor);
    
    // --- NEW: Rear Engine Block ---
    const engineBlockGeo = new THREE.BoxGeometry(2, 0.6, 0.8);
    const engineBlock = new THREE.Mesh(engineBlockGeo, darkMaterial);
    engineBlock.position.set(0, 0.2, -2.4);
    engineBlock.castShadow = true;
    tank.add(engineBlock);

    const engineGlowGeo = new THREE.PlaneGeometry(1.6, 0.3);
    const engineGlow = new THREE.Mesh(engineGlowGeo, engineGlowMaterial);
    engineGlow.position.set(0, 0.2, -2.81); // Positioned just on the outside
    tank.add(engineGlow);
    tank.userData.engineGlow = engineGlow; // Store for animation

    // --- NEW: Hull Detail Lights (Greebling) ---
    const lightGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const light1 = new THREE.Mesh(lightGeo, accentGlowMaterial);
    light1.position.set(-1, 0.45, 2.2);
    tank.add(light1);
    
    const light2 = new THREE.Mesh(lightGeo, accentGlowMaterial);
    light2.position.set(1, 0.45, 2.2);
    tank.add(light2);


    // --- Turret (Tháp pháo) ---
    const turretGroup = new THREE.Group();
    turretGroup.position.y = 0.35;
    
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 6), darkMaterial);
    turretBase.castShadow = true;
    turretGroup.add(turretBase);
    
    const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.8, 6), bodyMaterial);
    turretBody.position.y = 0.55;
    turretBody.castShadow = true;
    turretGroup.add(turretBody);
    
    // --- NEW: Sensor Pods on Turret ---
    const podGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
    const leftPod = new THREE.Mesh(podGeo, darkMaterial);
    leftPod.position.set(-1.1, 0.7, 0);
    turretGroup.add(leftPod);
    
    const rightPod = new THREE.Mesh(podGeo, darkMaterial);
    rightPod.position.set(1.1, 0.7, 0);
    turretGroup.add(rightPod);

    tank.add(turretGroup);

    // --- Cannon (Vũ khí năng lượng) ---
    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(0, 0.7, 0.5); // Attached to turret body
    turretGroup.add(cannonGroup);
    
    // --- NEW: Cannon Mantlet ---
    const mantletGeo = new THREE.BoxGeometry(0.8, 0.7, 0.3);
    const mantlet = new THREE.Mesh(mantletGeo, darkMaterial);
    mantlet.position.z = 0.8;
    cannonGroup.add(mantlet);

    // Barrel is now longer and originates from the mantlet
    const cannonBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.8, 8), darkMaterial);
    cannonBarrel.rotation.x = Math.PI / 2;
    cannonBarrel.position.z = 2.3; // Pushed forward
    cannonBarrel.castShadow = true;
    cannonGroup.add(cannonBarrel);

    const ringGeo = new THREE.TorusGeometry(0.2, 0.05, 8, 16);
    for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(ringGeo, accentGlowMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.z = 1.8 + i * 0.6;
        cannonGroup.add(ring);
    }

    const hoverCones = []; 
    const createPad = (x, z) => {
        const padGroup = new THREE.Group();
        
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.2, 8), darkMaterial);
        housing.castShadow = true;
        padGroup.add(housing);

        const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8), primaryGlowMaterial);
        emitter.position.y = -0.05;
        padGroup.add(emitter);

        const light = new THREE.PointLight(0x00ffff, 3, 4);
        light.position.y = -0.3;
        padGroup.add(light);
        
        const coneGeo = new THREE.ConeGeometry(0.5, 1.2, 8);
        const coneMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending, 
            depthWrite: false, 
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = -0.7;
        padGroup.add(cone);
        hoverCones.push(cone);
        
        padGroup.position.set(x, -0.3, z);
        tank.add(padGroup);
        return padGroup;
    };
    
    createPad(-1.2, 1.8);
    createPad(1.2, 1.8);
    createPad(-1.2, -1.8);
    createPad(1.2, -1.8);
    
    tank.userData.hoverCones = hoverCones; // Make cones accessible for animation


    // --- Animation ---
    const initialY = 1.0;
    tank.position.y = initialY;

    // This function will be called from your Tank class's update method
    tank.userData.update = (time) => {
        // Main hover animation
        tank.position.y = initialY + Math.sin(time * 2) * 0.1;
        tank.rotation.x = Math.sin(time * 1.5) * 0.02;
        tank.rotation.z = Math.cos(time * 1.2) * 0.02;

        // --- NEW ANIMATIONS ---
        // Animate the thruster cone opacity to make it flicker
        if (tank.userData.hoverCones) {
            tank.userData.hoverCones.forEach((cone, i) => {
                // Use a different offset for each cone so they don't flicker in sync
                cone.material.opacity = 0.2 + (Math.sin(time * 15 + i * 2) + 1) * 0.1;
            });
        }
        
        // Animate the engine glow intensity
        if(tank.userData.engineGlow) {
            const engineIntensity = 3 + (Math.sin(time * 5) + 1) * 1.5; // Pulse between 3 and 6
            tank.userData.engineGlow.material.emissiveIntensity = engineIntensity;
        }
    };
    
    return tank;
}
import * as THREE from 'three';

export function createTank() {
    const tank = new THREE.Group();
    tank.name = "TankM08_Tarantula_MaxVisuality";
    // --- Materials ---
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.95,
        roughness: 0.4,
        flatShading: true,
    });

    const darkMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.8,
        roughness: 0.5,
    });

    const accentGlowMaterial = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        emissive: 0xff00ff,
        emissiveIntensity: 2,
        toneMapped: false,
    });
    
    // --- Central Body ---
    const bodyGeo = new THREE.IcosahedronGeometry(1.5, 1);
    const body = new THREE.Mesh(bodyGeo, bodyMaterial);
    body.scale.y = 0.6;
    body.position.y = 0.2;
    body.castShadow = true;
    body.receiveShadow = true;
    tank.add(body);
    
    // --- Detail Lights ---
    const lightGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const light1 = new THREE.Mesh(lightGeo, accentGlowMaterial);
    light1.position.set(-0.7, 0.6, 1.2);
    tank.add(light1);
    
    const light2 = new THREE.Mesh(lightGeo, accentGlowMaterial);
    light2.position.set(0.7, 0.6, 1.2);
    tank.add(light2);


    // --- Turret ---
    const turretGroup = new THREE.Group();
    turretGroup.position.y = 0.8;
    
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 6), darkMaterial);
    turretBase.castShadow = true;
    turretGroup.add(turretBase);
    
    const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.8, 6), bodyMaterial);
    turretBody.position.y = 0.55;
    turretBody.castShadow = true;
    turretGroup.add(turretBody);

    tank.add(turretGroup);

    // --- Cannon ---
    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(0, 0.7, 0.5);
    turretGroup.add(cannonGroup);
    
    const mantletGeo = new THREE.BoxGeometry(0.8, 0.7, 0.3);
    const mantlet = new THREE.Mesh(mantletGeo, darkMaterial);
    mantlet.position.z = 0.8;
    cannonGroup.add(mantlet);

    const cannonBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.8, 8), darkMaterial);
    cannonBarrel.rotation.x = Math.PI / 2;
    cannonBarrel.position.z = 2.3;
    cannonBarrel.castShadow = true;
    cannonGroup.add(cannonBarrel);

    const ringGeo = new THREE.TorusGeometry(0.2, 0.05, 8, 16);
    for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(ringGeo, accentGlowMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.z = 1.8 + i * 0.6;
        cannonGroup.add(ring);
    }


    // --- Legs ---
    const legs = [];
    // CHANGE: Increased leg segment length from 1.5 to 2.2 for a longer, spidery look.
    const legSegmentLength = 2.2;
    const legSegmentGeo = new THREE.BoxGeometry(0.25, 0.25, legSegmentLength);

    const createLeg = () => {
        const legGroup = new THREE.Group(); 
        const upperLegPivot = new THREE.Group();
        const lowerLegPivot = new THREE.Group();

        upperLegPivot.position.y = 0;
        // CHANGE: Position the "knee" joint at the end of the new, longer segment.
        lowerLegPivot.position.z = legSegmentLength - 0.1; 

        // CHANGE: Center the mesh along the new length.
        const meshOffset = legSegmentLength / 2;
        const upperLeg = new THREE.Mesh(legSegmentGeo, darkMaterial);
        upperLeg.position.z = meshOffset;
        upperLeg.castShadow = true;
        
        const lowerLeg = new THREE.Mesh(legSegmentGeo, darkMaterial);
        lowerLeg.position.z = meshOffset;
        lowerLeg.castShadow = true;

        legGroup.add(upperLegPivot);
        upperLegPivot.add(upperLeg);
        upperLegPivot.add(lowerLegPivot);
        lowerLegPivot.add(lowerLeg);
        legGroup.rotateZ(-Math.PI)
        tank.add(legGroup);

        return { legGroup, upperLegPivot, lowerLegPivot };
    };

    const legPositions = [
        { angle: 35,  dist: 1.4 },
        { angle: 90,  dist: 1.6 },
        { angle: 145, dist: 1.4 },
        { angle: -35, dist: 1.4 },
        { angle: -90, dist: 1.4 },
        { angle: -145,dist: 1.4 },
    ];
    
    legPositions.forEach(p => {
        const leg = createLeg();
        const angleRad = THREE.MathUtils.degToRad(p.angle);
        leg.legGroup.position.set(Math.sin(angleRad) * p.dist, 0.2, Math.cos(angleRad) * p.dist);
        leg.legGroup.rotation.y = angleRad;
        
        leg.legGroup.userData.initialAngle = angleRad;

        legs.push(leg);
    });

    tank.userData.legs = legs;

    const initialY = 1.8; 
    tank.position.y = initialY;

    // Set a default "at rest" pose for the legs
    const initialUpperAngle = THREE.MathUtils.degToRad(40);
    const initialLowerAngle = THREE.MathUtils.degToRad(-110);
    legs.forEach(leg => {
        leg.upperLegPivot.rotation.x = initialUpperAngle;
        leg.lowerLegPivot.rotation.x = initialLowerAngle;
    });

    
    return tank;
}
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

function createSky(scene, renderer) {
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;  // Độ đục của khí quyển
    skyUniforms['rayleigh'].value = 2;    // Tán xạ ánh sáng
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // Mặt trời
    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - 20);
    const theta = THREE.MathUtils.degToRad(90);   
    sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sun);

    //scene.environment = sky;
}

export { createSky };

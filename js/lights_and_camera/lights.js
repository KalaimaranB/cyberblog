import * as THREE from 'three';
// in lights.js
export function addLights(scene) {
  // much dimmer ambient:
  scene.add(new THREE.AmbientLight(0x000000, 0.3));  
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5,10,7.5);
  dir.castShadow = true;
  scene.add(dir);
}

// static/js/camera.js
import * as THREE from 'three';
export function createCamera() {
  const cam = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
  cam.position.set(0, 3.75, 20);
  cam.lookAt(0,0,0);
  return cam;
}

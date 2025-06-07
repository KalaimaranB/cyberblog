import * as THREE from 'three';
export function createScene({ backgroundColor = 0x888888 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);
  return scene;
}

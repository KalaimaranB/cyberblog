import * as THREE from 'three';
export function createRenderer({ canvas, width, height }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000);
  renderer.shadowMap.enabled = true;
  return renderer;
}

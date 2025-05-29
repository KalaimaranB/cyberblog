// static/js/floor.js
import * as THREE from 'three';
export function addFloor(scene) {
  const mat = new THREE.MeshStandardMaterial({ color:0xffffff, metalness:1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(), mat);
  floor.receiveShadow = true;
  floor.rotation.x = -Math.PI*0.5;
  floor.scale.set(50,50,50);
  floor.position.y = -1;
  scene.add(floor);
}

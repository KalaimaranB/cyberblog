import * as THREE from 'three';

/**
 * Creates a ground plane that receives shadows and adds it to the scene.
 * @param {THREE.Scene} scene - The Three.js scene to attach the ground to.
 * @param {Object} options - Optional parameters for customization.
 * @param {number} options.size - Width/height of the square plane. Default 50.
 * @param {number} options.opacity - Opacity for the shadow material. Default 0.1.
 * @param {number} options.positionY - Y-position of the ground plane. Default -4.1.
 * @returns {THREE.Mesh} Reference to the ground mesh.
 */
export function createGround(scene, options = {}) {
  const {
    size = 50,
    opacity = 0.5,
    positionY = -4.1
  } = options;

  // Geometry + shadow material
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.ShadowMaterial({ opacity });
  const ground = new THREE.Mesh(geometry, material);

  // Rotate to be horizontal and position
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = positionY;
  ground.receiveShadow = true;

  scene.add(ground);
  return ground;
}

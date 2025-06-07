// static/js/effects/cloudBall.js
import * as THREE from 'three';

/**
 * Creates a translucent, interactive “cloud ball” at a given position.
 * When clicked, it logs a message to the console.
 *
 * @param {Object} options
 * @param {THREE.Scene} options.scene       - Your Three.js scene
 * @param {THREE.Vector3} options.position  - World-space position for the sphere
 * @param {number} options.color            - Hex color (e.g. 0x00ff00 or 0xff0000)
 * @param {THREE.Camera} options.camera     - The camera used for raycasting
 * @param {HTMLElement} options.domElement  - The renderer.domElement to attach click listener
 * @param {number} [options.radius=0.3]     - Radius of the sphere
 * @param {number} [options.opacity=0.25]   - Opacity (0.0 → 1.0)
 * @returns {THREE.Mesh}                    - The cloud-ball mesh (so you can further manipulate or dispose it)
 */
export function createCloudBall({
  scene,
  position,
  color,
  camera,
  domElement,
  radius = 0.3,
  opacity = 0.25
} = {}) {
  // 1) Build a simple translucent sphere geometry + material
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,            // so other objects “behind” still render
    blending: THREE.NormalBlending // you can also try AdditiveBlending if you want a glow
  });

  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position);
  scene.add(sphere);

  // 2) Set up raycasting on click
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onClick(event) {
    // Convert mouse x/y to normalized device coordinates (NDC)
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Cast a ray from the camera through the mouse point
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphere, false);

    if (intersects.length > 0) {
      console.log('☁️ Cloud ball clicked at:', position);
    }
  }

  domElement.addEventListener('click', onClick);

  // 3) Return the mesh and a simple dispose helper if you want to clean up later
  sphere.userData.dispose = () => {
    domElement.removeEventListener('click', onClick);
    geometry.dispose();
    material.dispose();
    scene.remove(sphere);
  };

  return sphere;
}

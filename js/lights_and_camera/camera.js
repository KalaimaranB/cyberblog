// static/js/camera.js
import * as THREE from 'three';

/**
 * Creates a PerspectiveCamera with the given parameters.
 * @param {Object} options
 * @param {number} [options.fov=45]       - Field of view in degrees.
 * @param {number} [options.aspect]       - Aspect ratio (defaults to window.innerWidth/window.innerHeight).
 * @param {number} [options.near=0.1]     - Near clipping plane.
 * @param {number} [options.far=1000]     - Far clipping plane.
 * @param {Array}  [options.position]     - [x, y, z] world coordinates for camera position (defaults to [0, 3.75, 20]).
 * @param {Array}  [options.lookAt]       - [x, y, z] point for camera to look at (defaults to [0, 0, 0]).
 */
export function createCamera({
  fov      = 45,
  aspect   = window.innerWidth / window.innerHeight,
  near     = 0.1,
  far      = 1000,
  position = [0, 3.75, 20],
  lookAt   = [0, 0, 0]
} = {}) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, near, far);
  cam.position.set(position[0], position[1], position[2]);
  cam.lookAt(new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]));
  return cam;
}

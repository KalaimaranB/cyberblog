import * as THREE from 'three';

/**
 * Creates a translucent cage (sphere) with a wireframe overlay and adds it to the scene.
 * @param {THREE.Scene} scene - The Three.js scene to attach the cage to.
 * @param {Object} options - Optional parameters for customization.
 * @param {number} options.radius - Radius of the cage sphere. Default 1.5.
 * @param {number} options.segments - Number of segments for the sphere geometry. Default 32.
 * @param {number} options.wireframeColor - Color of the wireframe lines. Default 0xffffff.
 * @param {number} options.wireframeOpacity - Opacity of the wireframe. Default 0.1 (more transparent).
 * @param {number} options.fillColor - Color of the translucent fill. Default 0xff0000.
 * @param {number} options.fillOpacity - Opacity of the fill material. Default 0.05 (mostly transparent).
 * @returns {{ cageFill: THREE.Mesh }} References to the fill 
 */
export function createCage(scene, options = {}) {
  const {
    radius = 1.5,
    segments = 32,
    fillColor = 0xff0000,
    fillOpacity = 0.01
  } = options;

  // Shared geometry for both fill and wireframe
  const cageGeo = new THREE.SphereGeometry(radius, segments, segments);

  // Translucent fill sphere
  const cageFill = new THREE.Mesh(
    cageGeo,
    new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: fillOpacity,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  scene.add(cageFill);



  return { cageFill};
}
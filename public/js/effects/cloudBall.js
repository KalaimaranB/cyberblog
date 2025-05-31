// static/js/effects/glowingSphere.js
import * as THREE from 'three';

/**
 * Creates a translucent, glowing sphere with two particles orbiting in an “X” pattern.
 *
 * @param {THREE.Scene} scene
 * @param {Object}      options
 * @param {number}      [options.radius=1.5]           – radius of the base sphere
 * @param {number}      [options.segments=32]          – sphere geometry segments
 * @param {number}      [options.fillColor=0x00ff00]   – hex color of the translucent fill
 * @param {number}      [options.fillOpacity=0.05]     – opacity of that fill (0→1)
 * @param {number}      [options.boundaryColor=0x00ff00]– hex color of the glowing boundary
 * @param {number}      [options.boundaryOpacity=0.2]  – opacity of boundary (0→1)
 * @param {number}      [options.particleColor=0x00ff00] – color of the orbiting particles
 * @param {number}      [options.particleSize=0.05]    – radius of each orbiting particle
 * @param {number}      [options.orbitSpeed=1.0]       – speed multiplier for particle orbits
 * @param {THREE.Camera}   options.camera              – your scene’s camera (for raycasting)
 * @param {HTMLElement}    options.domElement          – your renderer.domElement (for clicks)
 *
 * @returns {Object} An object containing:
 *   • group          (THREE.Group) – the parent Group you can add to scene (or already added)
 *   • update(time)   (Function)    – call this every frame (pass the loop’s time in ms)
 *   • dispose()      (Function)    – cleans up geometry, materials, event listeners
 */
export function createGlowingSphere(scene, options = {}) {
  const {
    radius          = 1.5,
    segments        = 32,
    fillColor       = 0x00ff00,
    fillOpacity     = 0.05,
    boundaryColor   = 0x00ff00,
    boundaryOpacity = 0.2,
    particleColor   = 0x00ff00,
    particleSize    = 0.05,
    orbitSpeed      = 1.0,
    camera,
    domElement
  } = options;

  // 1) Create a parent Group and add it to the scene
  const group = new THREE.Group();
  scene.add(group);

  // 2) Translucent “fill” sphere
  const baseGeo = new THREE.SphereGeometry(radius, segments, segments);
  const fillMat = new THREE.MeshBasicMaterial({
    color: fillColor,
    transparent: true,
    opacity: fillOpacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const fillMesh = new THREE.Mesh(baseGeo, fillMat);
  group.add(fillMesh);

  // 3) Glowing boundary (wireframe) using EdgesGeometry + AdditiveBlending
  const edgesGeo = new THREE.EdgesGeometry(baseGeo);
  const boundaryMat = new THREE.LineBasicMaterial({
    color: boundaryColor,
    transparent: true,
    opacity: boundaryOpacity,
    blending: THREE.AdditiveBlending,
    linewidth: 1 // note: linewidth may not have effect on all platforms
  });
  const boundary = new THREE.LineSegments(edgesGeo, boundaryMat);
  group.add(boundary);

  // 4) AmbientLight to ensure the fill & boundary never go completely dark
  const ambient = new THREE.AmbientLight(boundaryColor, 0.5);
  group.add(ambient);

  // 5) Two orbiting particles (simple Mesh spheres)
  const particleGeo = new THREE.SphereGeometry(particleSize, 16, 16);
  const particleMat = new THREE.MeshBasicMaterial({
    color: particleColor,
    emissive: new THREE.Color(particleColor),
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particle1 = new THREE.Mesh(particleGeo, particleMat);
  const particle2 = new THREE.Mesh(particleGeo, particleMat);
  group.add(particle1);
  group.add(particle2);

  // 6) Raycasting on the *center fill sphere* to detect clicks
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onClick(event) {
    if (!camera || !domElement) return;
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(fillMesh, false);
    if (intersects.length > 0) {
      console.log('🔘 Glowing sphere clicked at:', group.position);
    }
  }
  domElement.addEventListener('click', onClick);

  // 7) The update() function will be called every frame
  function update(time) {
    // time is in ms → convert to seconds
    const t = time * 0.001 * orbitSpeed;

    // a) Rotate the entire group slowly around Y (optional)
    group.rotation.y = t * 0.2; // adjust 0.2 to rotate faster/slower

    // b) Orbit particle1 in the XZ plane:
    particle1.position.set(
      radius * Math.cos(t),
      0,
      radius * Math.sin(t)
    );

    // c) Orbit particle2 in the YZ plane (perpendicular “X”)
    particle2.position.set(
      0,
      radius * Math.cos(t),
      radius * Math.sin(t)
    );

    // d) Make the boundary wireframe pulse opacity sinusoidally
    boundary.material.opacity = boundaryOpacity * (0.5 + 0.5 * Math.sin(2 * Math.PI * orbitSpeed * t));
  }

  // 8) Provide a dispose() helper to clean up all resources
  function dispose() {
    domElement.removeEventListener('click', onClick);
    baseGeo.dispose();
    fillMat.dispose();
    edgesGeo.dispose();
    boundaryMat.dispose();
    particleGeo.dispose();
    particleMat.dispose();
    scene.remove(group);
  }

  return {
    group,      // parent Group (already added to the scene)
    fillMesh,   // reference if you want to tweak later
    boundary,   // reference if you want to tweak later
    particle1,  // reference if you want to tweak later
    particle2,  // reference if you want to tweak later
    update,     // call this each frame (pass your loop’s time in ms)
    dispose     // call this if you ever want to remove the sphere entirely
  };
}

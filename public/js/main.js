//──────────────────────────────────────────────────────────────────────────────
//  Imports
//──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

import { createRenderer }       from './renderer.js';
import { createScene }          from './scene.js';
import { createCamera }         from './camera.js';
import { addLights }            from './lights.js';
import { createCage }           from './environment/cage.js';
import { createGround }         from './environment/ground.js';
import { createBallLightning }  from './lightningBall.js';
import { createLaser }          from './laser.js';
import { createPostProcessing } from './postProcessing.js';
import { startLoop }            from './animation.js';
import { setupResize }          from './resize.js';


//──────────────────────────────────────────────────────────────────────────────
//  Constants & Configuration
//──────────────────────────────────────────────────────────────────────────────
const CANVAS         = document.getElementById('canvas');
const WIDTH          = window.innerWidth;
const HEIGHT         = window.innerHeight;

const SPHERE_RADIUS  = 1;
const LASER_DIST     = SPHERE_RADIUS * 3;  
const COLOR_A        = 0x01ED67;  // Green
const COLOR_B        = 0xff0000;  // red
const MIX            = 0;       // blending factor (for environment color)

const AUTO_ROTATE_SPEED = Math.PI / 12; 
// ↳ radians per second. π/12 ≈ 15°/sec. Adjust to taste.


// Tetrahedron vertices (unnormalized). We'll normalize & scale to LASER_DIST:
const TETRA_DIRECTIONS = [
  new THREE.Vector3( 1,  1,  1),
  new THREE.Vector3( 1, -1, -1),
  new THREE.Vector3(-1,  1, -1),
  new THREE.Vector3(-1, -1,  1),
];

// Compute an “environment” color (blend of COLOR_A and COLOR_B) if needed:
const cA        = new THREE.Color(COLOR_A);
const cB        = new THREE.Color(COLOR_B);
const ENV_COLOR = cA.clone().lerp(cB, MIX).getHex();


//──────────────────────────────────────────────────────────────────────────────
//  Renderer / Scene / Camera Setup
//──────────────────────────────────────────────────────────────────────────────
const renderer = createRenderer({
  canvas: CANVAS,
  width:  WIDTH,
  height: HEIGHT
});

// We’ll create a “sceneRoot” group that holds everything except the camera:
const scene = createScene();
scene.background = new THREE.Color(0x000000);

// A container group that we’ll rotate when idle:
const sceneRoot = new THREE.Group();
scene.add(sceneRoot);

const camera = createCamera({
  fov:      75,
  aspect:   WIDTH / HEIGHT,
  near:     0.1,
  far:      1000,
  position: [0, 5, 5],
  lookAt:   [0, 0, 0]
});


//──────────────────────────────────────────────────────────────────────────────
//  TrackballControls + Interaction Flag
//──────────────────────────────────────────────────────────────────────────────
const controls = new TrackballControls(camera, renderer.domElement);

// Disable inertia/damping so camera “locks” exactly where released:
controls.staticMoving = true;
controls.dynamicDampingFactor = 0;

// (Optional) Tweak speeds to your liking:
controls.rotateSpeed = 1.0;
controls.zoomSpeed   = 1.2;
controls.panSpeed    = 0.8;

// Ensure camera’s up‐vector is world-up (Y axis):
camera.up.set(0, 1, 0);

// Flag to track whether user is currently dragging:
let isUserInteracting = false;

// Use TrackballControls’ built‐in events to know exactly when dragging starts/ends:
controls.addEventListener('start', () => {
  isUserInteracting = true;
});
controls.addEventListener('end', () => {
  isUserInteracting = false;
});


//──────────────────────────────────────────────────────────────────────────────
//  Environment: Lights, Cage, Ground, Ball Lightning, Post-Processing
//──────────────────────────────────────────────────────────────────────────────
addLights(sceneRoot);

createCage(sceneRoot, {
  radius:    SPHERE_RADIUS,
  fillColor: ENV_COLOR
});

createGround(sceneRoot);

const ballLightning = createBallLightning(
  sceneRoot,
  {
    boltCount:     10,
    radius:        SPHERE_RADIUS,
    surfaceBolts:  10,
    surfaceRadius: SPHERE_RADIUS,
    colorA:        COLOR_A,
    colorB:        COLOR_B,
    mix:           MIX
  }
);

const composer = createPostProcessing(renderer, scene, camera);


//──────────────────────────────────────────────────────────────────────────────
//  Laser Setup: Four lasers at tetrahedral vertices
//──────────────────────────────────────────────────────────────────────────────
const lasers = TETRA_DIRECTIONS.map(dir => {
  // 1) Normalize & push out to LASER_DIST
  const fromVec = dir.clone().normalize().multiplyScalar(LASER_DIST);

  // 2) “to” is the same direction, but shortened to SPHERE_RADIUS (on sphere surface)
  const toVec = fromVec.clone().setLength(SPHERE_RADIUS);

  // 3) Create a bright red laser from → to
  return createLaser(sceneRoot, fromVec, toVec, COLOR_A, 0.02);
});


//──────────────────────────────────────────────────────────────────────────────
//  Handle Window Resize
//──────────────────────────────────────────────────────────────────────────────
setupResize({
  renderer,
  camera,
  composer
});


//──────────────────────────────────────────────────────────────────────────────
//  Animation Loop (with delta-time + auto-rotate the sceneRoot)
//──────────────────────────────────────────────────────────────────────────────
let prevTimestamp = null;

startLoop({
  camera,
  scene,
  renderer,
  composer,
  onUpdate: time => {
    // 1) Compute time delta (in seconds)
    if (prevTimestamp === null) {
      prevTimestamp = time;
    }
    const delta = (time - prevTimestamp) * 0.001;
    prevTimestamp = time;

    // 2) If user is NOT dragging, rotate the entire sceneRoot around Y:
    if (!isUserInteracting) {
      sceneRoot.rotation.y += AUTO_ROTATE_SPEED * delta;
    }

    // 3) Always update TrackballControls (apply user drags to camera)
    controls.update();

    // 4) Animate lightning & lasers (they live under sceneRoot)
    ballLightning.update(time);
    lasers.forEach(l => l.update(time));
  }
});

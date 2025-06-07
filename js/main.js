//──────────────────────────────────────────────────────────────────────────────
//  static/js/main.js
//──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

import { createRenderer }       from './core/renderer.js';
import { createScene }          from './core/scene.js';
import { createCamera }         from './lights_and_camera/camera.js';
import { addLights }            from './lights_and_camera/lights.js';
import { createCage }           from './environment/cage.js';
import { createGround }         from './environment/ground.js';
import { createBallLightning }  from './effects/lightningBall.js';
import { createLaser }          from './effects/laser.js';
import { createPostProcessing } from './core/postProcessing.js';
import { startLoop }            from './animation.js';
import { setupResize }          from './lights_and_camera/resize.js';

// ← Import our glowing‐sphere factory
import { createGlowingSphere }  from './effects/glowingSphere.js';
// ← Import the radial drifting ring module
import { createParticleRing }   from './effects/particleRing.js';
// ← Import the new flow‐to‐laser module
import { createFlowParticles }  from './effects/flowToLaser.js';

//──────────────────────────────────────────────────────────────────────────────
//  Constants & Configuration
//──────────────────────────────────────────────────────────────────────────────
const CANVAS         = document.getElementById('canvas');
const WIDTH          = window.innerWidth;
const HEIGHT         = window.innerHeight;

const SPHERE_RADIUS  = 1;
const LASER_DIST     = SPHERE_RADIUS * 3;
const COLOR_A        = 0x01ED67;  // green for lasers + shells
const COLOR_B        = 0xff0000;  // (not used here)
const MIX            = 0;

const AUTO_ROTATE_SPEED = Math.PI / 12; // ~15°/sec

const TETRA_DIRECTIONS = [
  new THREE.Vector3( 1,  1,  1),
  new THREE.Vector3( 1, -1, -1),
  new THREE.Vector3(-1,  1, -1),
  new THREE.Vector3(-1, -1,  1),
];

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

const scene = createScene();
scene.background = new THREE.Color(0x000000);

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
controls.staticMoving         = true;
controls.dynamicDampingFactor = 0;
controls.rotateSpeed          = 1.0;
controls.zoomSpeed            = 1.2;
controls.panSpeed             = 0.8;
camera.up.set(0, 1, 0);

let isUserInteracting = false;
controls.addEventListener('start', () => { isUserInteracting = true; });
controls.addEventListener('end',   () => { isUserInteracting = false; });

//──────────────────────────────────────────────────────────────────────────────
//  Environment: Lights, Cage, Ground, BallLightning, PostProcessing
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
//  Four Themed Nodes: 'gear','cross','hacker','software'
//  (all green glow + neon‐orange interior symbols)
//──────────────────────────────────────────────────────────────────────────────
const types = ['gear', 'cross', 'hacker', 'software'];
const nodes = TETRA_DIRECTIONS.map((dir, i) => {
  const worldPos = dir.clone().normalize().multiplyScalar(LASER_DIST);
  return createGlowingSphere(
    sceneRoot,
    worldPos,
    {
      type:                    types[i],
      radius:                  0.4,
      interiorEmissive:        2,       // slightly brighter orange
      enableExterior:          true,    // draw green glow
      exteriorThickness:       0.05,    // outer radius = 0.45
      exteriorColor:           0x01ED67,
      exteriorOpacity:         0.005,
      exteriorEmissiveIntensity: 20     // strong green halo
    }
  );
});

//──────────────────────────────────────────────────────────────────────────────
//  Create two sets of particle effects per sphere:
//   1) A radial “drifting shell” (rings)
//   2) A continuous “flow into laser” (flows)
//──────────────────────────────────────────────────────────────────────────────
const rings = [];
const flows = [];
const impactPoints = [];

TETRA_DIRECTIONS.forEach((dir, i) => {
  // 1) Center of this node’s sphere
  const center = nodes[i].group.position.clone();

  // 1a) Setup the drifting shell (rings)
  const innerRadiusR = 0.4 + 0.05;      // 0.45
  const outerRadiusR = innerRadiusR + 0.3; // 0.75
  // rings.push(
  //   createParticleRing(
  //     sceneRoot,
  //     center,
  //     innerRadiusR,
  //     outerRadiusR,
  //     80,    // count
  //     0.5,   // vOut
  //     2.0    // vPulse
  //   )
  // );

  // 1b) Compute this node’s impact point (75% along laser path)
  const fromVec = dir.clone().normalize().multiplyScalar(LASER_DIST);
  const dirToCenter = new THREE.Vector3().subVectors(center, fromVec).normalize();
  const impactPt = fromVec.clone().addScaledVector(dirToCenter, LASER_DIST * 0.75);
  impactPoints.push(impactPt);

  // 2) Setup the continuous “flow into laser” emitter (flows)
  flows.push(
    createFlowParticles(
      sceneRoot,
      center,    // spawn around the sphere’s center
      impactPt,  // send toward this impact location
      {
        count:       120,  // more particles for a fuller flow
        innerRadius: 0.6,  // start a bit farther than the glow (0.45)
        outerRadius: 2.5,  // out to radius 1.2
        speed:       2.0,  // how fast they move toward impact
        threshold:   0.05  // respawn once they get within 0.05 units of impact
      }
    )
  );
});

//──────────────────────────────────────────────────────────────────────────────
//  Laser Setup: Four green lasers at tetrahedral vertices
//  Each laser’s onPulse callback pulls in the ring + spawns beam/ripple.
//──────────────────────────────────────────────────────────────────────────────
const lasers = TETRA_DIRECTIONS.map((dir, i) => {
  const fromVec = dir.clone().normalize().multiplyScalar(LASER_DIST);
  const toVec   = fromVec.clone().setLength(SPHERE_RADIUS);

  const onPulse = () => {
    // a) Pull in the drifting ring
    //rings[i].applyPulse();

    // b) Spike sphere glow
    const glowMat = nodes[i].group.userData.glowMaterial;
    if (glowMat) {
      glowMat.emissiveIntensity = 50;
      let elapsed = 0;
      const fadeDuration = 0.5;
      const baseIntensity = 20;
      const original = glowMat.emissiveIntensity;
      function fadeStep(delta) {
        elapsed += delta;
        const t = Math.min(elapsed / fadeDuration, 1);
        glowMat.emissiveIntensity = THREE.MathUtils.lerp(original, baseIntensity, t);
        if (t < 1) {
          requestAnimationFrame((now) => fadeStep((now - lastTime) * 0.001));
        }
      }
      let lastTime = performance.now();
      requestAnimationFrame((now) => { lastTime = now; fadeStep(0); });
    }

  };

  return createLaser(
    sceneRoot,
    fromVec,
    toVec,
    COLOR_A,
    0.02,
    onPulse
  );
});

//──────────────────────────────────────────────────────────────────────────────
//  Window Resize Handler
//──────────────────────────────────────────────────────────────────────────────
setupResize({
  renderer,
  camera,
  composer
});

//──────────────────────────────────────────────────────────────────────────────
//  Animation Loop (auto‐rotate + spin/tumble + update all effects)
//──────────────────────────────────────────────────────────────────────────────
let prevTimestamp = null;

startLoop({
  camera,
  scene,
  renderer,
  composer,
  onUpdate: time => {
    // 1) Compute delta (in seconds)
    if (prevTimestamp === null) prevTimestamp = time;
    const delta = (time - prevTimestamp) * 0.001;
    prevTimestamp = time;

    // 2) Auto‐rotate the entire sceneRoot if the user is not dragging
    if (!isUserInteracting) {
      sceneRoot.rotation.y += AUTO_ROTATE_SPEED * delta;
    }

    // 3) TrackballControls
    controls.update();

    // 4) Animate central ball‐lightning
    ballLightning.update(time);

    // 5) Animate lasers (shader bulge + impact + onPulse callback)
    lasers.forEach(l => l.update(time));

    // 6) Rotate/tumble each interior symbol inside its sphere
    nodes.forEach((node, i) => {
      const inner = node.group.userData.innerMesh;
      if (!inner) return;
      const t = time * 0.001;
      switch (types[i]) {
        case 'gear':
          inner.rotation.z += delta * 1.0;
          break;
        case 'cross':
          inner.rotation.x = t * 0.5;
          inner.rotation.y = t * 0.5;
          break;
        case 'hacker':
          inner.rotation.y += delta * 1.2;
          break;
        case 'software':
          inner.rotation.x += delta * 0.8;
          inner.rotation.z += delta * 0.8;
          break;
      }
    });

    // 7) Update each drifting ring (pull‐in / drift‐out)
    rings.forEach(ring => ring.update(delta));

    // 8) Update each flow‐to‐laser emitter (continuous flow)
    flows.forEach(flow => flow.update(delta));
  }
});

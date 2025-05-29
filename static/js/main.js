import { createRenderer }  from './renderer.js';
import { createScene }     from './scene.js';
import { createCamera }    from './camera.js';
import { addLights }       from './lights.js';
import { createCage }      from './environment/cage.js';
import { createGround }    from './environment/ground.js';
import { createBallLightning }  from './lightningBall.js';
import { createPostProcessing } from './postProcessing.js';
import { startLoop }       from './animation.js';
import { setupResize }     from './resize.js';
import { createLaser } from './laser.js';
import { Color } from 'three';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

//color management
const colorA = 0x7DF9FF;
const colorB = 0xff0000;
const mix    = 1.0;  

const cA  = new Color(colorA);
const cB  = new Color(colorB);
const cc  = cA.clone().lerp(cB, mix);

//Sphere geometry for laser
const sphereRadius = 1;
const from = new THREE.Vector3(0, sphereRadius * 3, 0);
const to = from.clone().setLength(sphereRadius);
const from2 = new THREE.Vector3(0, -sphereRadius * 3, 0);
const to2 = from2.clone().setLength(sphereRadius);






const canvas   = document.getElementById('canvas');
const renderer = createRenderer({ canvas, width: innerWidth, height: innerHeight });


const scene    = createScene();
scene.background = new THREE.Color(0x000000);
const camera   = createCamera({ 
  fov: 75, 
  aspect: innerWidth/innerHeight, 
  near: 0.1, 
  far: 1000, 
  position: [0, 3.75, 20], 
  lookAt: [0,0,0] 
});


// add this:
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping    = true;   // smooth eased motion
controls.dampingFactor    = 0.05;
controls.minDistance      = 5;      // how close you can zoom
controls.maxDistance      = 50;     // how far you can zoom out
controls.enablePan        = true;   // allow left-right/up-down panning
controls.screenSpacePanning = true;



// 3) create a bright red, thin laser
const laser = createLaser(
  scene,
  from,
  to,
  0xff0000  // red
);

const laser2 = createLaser(
  scene,
  from2,
  to2,
  0xff0000, // red
);

addLights(scene);
createCage(scene,{radius:sphereRadius, fillColor:cc.getHex()});
createGround(scene);

const ball = createBallLightning(scene, { boltCount:10, radius:sphereRadius, surfaceBolts:10, surfaceRadius:sphereRadius, colorA:colorA, colorB:colorB, mix:mix });
const composer = createPostProcessing(renderer, scene, camera);

startLoop({
  camera,
  scene,
  renderer,
  composer,
  onUpdate: time => {
    controls.update(); // update controls for smooth motion
    // optional camera orbit
    const t = time * 0.0001;
    camera.position.x = Math.cos(t) * 10;
    camera.position.z = Math.sin(t) * 10;
    camera.lookAt(0,0,0);
    ball.update(time);
    laser.update(time);
    laser2.update(time);
  }
});

setupResize({ renderer, camera, composer });

// static/js/lightingBall.js
import * as THREE from 'three';                                 // three.js core 
import { LightningStrike } from 'three/addons/geometries/LightningStrike.js';  // LightningStrike is in r152 

// Default parameters (tweak these for different jaggedness, glow, etc.)
const rayParams = {
  sourceOffset: new THREE.Vector3(),
  destOffset:   new THREE.Vector3(),
  radius0: 0.05, radius1: 0.05,
  minRadius: 2.5, maxIterations: 7,
  isEternal: true, timeScale: 0.7,
  propagationTimeFactor: 0.05, vanishingTimeFactor: 0.95,
  subrayPeriod: 2.5, subrayDutyCycle: 0.3,
  maxSubrayRecursion: 3, ramification: 7,
  recursionProbability: 0.6, roughness: 0.85, straightness: 0.68
};

export function createLightingBall(scene) {
  const strike = new LightningStrike(rayParams);                // instantiate geometry 
  const mesh   = new THREE.Mesh(strike, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(mesh);

  return {
    update: time => {
      // **ROUTE** the bolt between two points: here from (0,2,0) down to (0,-2,0)
      strike.rayParameters.sourceOffset.set(0, 2, 0);           // set start point 
      strike.rayParameters.destOffset.set(  0, -2, 0);          // set end point   
      strike.update(time);                                      // regenerate bolt 
    }
  };
}

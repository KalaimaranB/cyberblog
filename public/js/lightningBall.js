import * as THREE from 'three';
import { LightningStrike } from 'three/addons/geometries/LightningStrike.js';

function randomInSphere() {
  const v = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(2),
    THREE.MathUtils.randFloatSpread(2),
    THREE.MathUtils.randFloatSpread(2)
  );
  return v.normalize().multiplyScalar(Math.cbrt(Math.random()));
}

function randomOnSphere(radius) {
  return randomInSphere().setLength(radius);
}

export function makeParams() {
  return {
    sourceOffset:    new THREE.Vector3(),
    destOffset:      new THREE.Vector3(),
    radius0:         0.01,
    radius1:         0.015,
    minRadius:       THREE.MathUtils.randFloat(0.01, 0.015),
    maxIterations:   Math.floor(THREE.MathUtils.randFloat(3, 5)),
    isEternal:       true,
    timeScale:       THREE.MathUtils.randFloat(0.8, 1.2),
    propagationTimeFactor: THREE.MathUtils.randFloat(0.02, 0.06),
    vanishingTimeFactor:   THREE.MathUtils.randFloat(0.9, 0.97),
    subrayPeriod:    THREE.MathUtils.randFloat(0.5, 1.5),
    subrayDutyCycle: THREE.MathUtils.randFloat(0.2, 0.4),
    maxSubrayRecursion: Math.floor(THREE.MathUtils.randFloat(1, 3)),
    ramification:    Math.floor(THREE.MathUtils.randFloat(1, 3)),
    recursionProbability: THREE.MathUtils.randFloat(0.2, 0.8),
    roughness:       THREE.MathUtils.randFloat(0.6, 0.9),
    straightness:    THREE.MathUtils.randFloat(0.4, 0.8)
  };
}

export function createBallLightning(scene, {
  boltCount = 10,
  radius = 4,
  surfaceBolts = 5,
  surfaceRadius = radius,
  colorA        = 0x0000ff,  // start color (blue)
  colorB        = 0xff0000,  // end color (red)
  mix           = 0.5        // [0…1], fraction of bolts in colorB
} = {}) {
  const bolts = [];

  function spawnBolt(isSurface) {
    const params = makeParams();
    const strike = new LightningStrike(params);
    const boltColor = Math.random() < mix ? colorB : colorA;
    const mesh   = new THREE.Mesh(strike, new THREE.MeshBasicMaterial({
      color:       boltColor,
      transparent: true,
      opacity:     0.6,
      blending:    THREE.NormalBlending,
      depthWrite:  false
    }));
    scene.add(mesh);

    const endpointA = isSurface
      ? randomOnSphere(surfaceRadius)
      : randomInSphere().multiplyScalar(radius * 0.3);
    const endpointB = randomOnSphere(radius);
    const lifetime  = THREE.MathUtils.randFloat(500, 1500); // ms
    const birth     = performance.now();

    return { strike, mesh, params, isSurface, endpointA, endpointB, lifetime, birth };
  }

  for (let i = 0; i < boltCount; i++)    bolts.push(spawnBolt(false));
  for (let i = 0; i < surfaceBolts; i++) bolts.push(spawnBolt(true));

  return {
    update: nowTime => {
      const now = performance.now();
      bolts.forEach((b, i) => {
        const { strike, mesh, params, isSurface, endpointA, endpointB, lifetime, birth } = b;
        const age = now - birth;

        // If expired, dispose and respawn
        if (age > lifetime) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
          bolts[i] = spawnBolt(isSurface);
          return;
        }

        // Jitter endpoints
        endpointA.add(randomInSphere().multiplyScalar(0.02));
        endpointB.add(randomInSphere().multiplyScalar(0.05));
        // Clamp
        if (!isSurface) endpointA.setLength(Math.min(endpointA.length(), radius * 0.3));
        endpointB.setLength(Math.min(endpointB.length(), radius));

        // Assign to geometry
        strike.rayParameters.sourceOffset.copy(endpointA);
        strike.rayParameters.destOffset.copy(endpointB);

        // Occasional sub‐branch reseed
        if (Math.random() < 0.1) {
          Object.assign(params, makeParams());
          strike.rayParameters = params;
        }

        strike.update(nowTime);
        mesh.material.opacity = 0.4 + 0.4 * Math.random();
      });
    }
  };
}

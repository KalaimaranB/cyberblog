import * as THREE from 'three';
import { makeParams } from './lightningBall.js';
import { LightningStrike } from 'three/addons/geometries/LightningStrike.js';

// helper: sample a random direction inside a cone around `axis`
function randomInCone(axis, coneAngle) {
  const u = Math.random(), v = Math.random();
  const θ = coneAngle * Math.sqrt(u);
  const φ = 2 * Math.PI * v;
  const tangent = new THREE.Vector3().randomDirection().cross(axis).normalize();
  const bitan   = axis.clone().cross(tangent).normalize();
  return axis.clone().multiplyScalar(Math.cos(θ))
    .add(tangent.multiplyScalar(Math.sin(θ) * Math.cos(φ)))
    .add(bitan.multiplyScalar(Math.sin(θ) * Math.sin(φ)));
}

// Ray–sphere intersection: solve |P + t·D|² = R² for t > 0, pick nearest
function intersectSphere(P, D, R) {
  // P = origin relative to center, D normalized
  const PD = P.dot(D);
  const c  = P.dot(P) - R*R;
  const disc = PD*PD - c;
  if (disc <= 0) return null;        // no hit
  const root = Math.sqrt(disc);
  const t0 = -PD - root;
  const t1 = -PD + root;
  // pick the smallest positive
  if (t0 > 0) return t0;
  if (t1 > 0) return t1;
  return null;
}

export function createImpactLightning(
  scene,
  origin,               // THREE.Vector3 in world‐space
  {
    boltCount   = 6,
    sphereRadius,
    sphereCenter = new THREE.Vector3(0,0,0),
    coneAngle   = Math.PI * 0.4,  // ±40° from inward normal
    color       = 0xff0000,
    lifetime    = 500             // ms
  } = {}
) {
  const group     = new THREE.Group();
  const startTime = performance.now();
  let disposed    = false;
  scene.add(group);

  // Precompute origin relative to center
  const Pworld = origin.clone();
  const P = Pworld.clone().sub(sphereCenter);

  const bolts = [];
  for (let i = 0; i < boltCount; i++) {
    // 1) Create the Strike geometry & mesh
    const params = makeParams();
    const strike = new LightningStrike(params);
    const mat    = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      toneMapped:  false
    });
    const mesh   = new THREE.Mesh(strike, mat);
    mesh.position.copy(origin);
    group.add(mesh);

    // 2) Pick a random inward direction
    const normal = P.clone().normalize().negate();  
    const dir    = randomInCone(normal, coneAngle).normalize();

    // 3) Compute exact t for intersection
    const tHit = intersectSphere(P, dir, sphereRadius);
    const length = tHit !== null ? tHit : sphereRadius; // fallback

    // 4) Set offsets relative to mesh origin
    params.sourceOffset.copy(new THREE.Vector3(0,0,0));
    params.destOffset.copy(dir.clone().multiplyScalar(length));

    bolts.push({ strike, mesh });
  }

  return {
    update(time) {
      if (disposed) return;
      const age = performance.now() - startTime;
      if (age > lifetime) {
        this.dispose();
        disposed = true;
        return;
      }
      bolts.forEach(b => b.strike.update(time));
    },
    dispose() {
      bolts.forEach(b => {
        group.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
      });
      scene.remove(group);
    }
  };
}

//──────────────────────────────────────────────────────────────────────────────
//  static/js/effects/particleRing.js
//──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

/**
 * createParticleRing(parentScene, centerPos, innerRadius, outerRadius, count, vOut, vPulse)
 *
 * Builds a “drifting shell” of points around a sphere:
 *  • Each particle is identified by:
 *      - direction:  a THREE.Vector3 unit‐vector (constant)
 *      - r:          current distance from center ∈ [innerRadius, outerRadius]
 *      - v_r:        current radial velocity (either +vOut or -vPulse)
 *
 *  • On each update(dt):
 *      r_new = r_old + v_r * dt
 *      if r_new ≥ outerRadius:
 *        r_new = outerRadius
 *        v_r = +vOut    // clamp but keep drifting outward (or set to 0 if you prefer)
 *      if r_new ≤ innerRadius:
 *        r_new = innerRadius
 *        // once they hit the inner surface, switch back to outward drift:
 *        v_r = +vOut
 *
 *  • When applyPulse() is called, we instantly set v_r = -vPulse for every particle.
 *
 * Params:
 *  - parentScene : THREE.Scene or THREE.Group to add the Points mesh into
 *  - centerPos   : THREE.Vector3 (world‐space center of the shell)
 *  - innerRadius : number (particles never go below this radius)
 *  - outerRadius : number (particles never go above this radius)
 *  - count       : number of points in this ring
 *  - vOut        : number (units/sec drift‐out speed, e.g. 0.1)
 *  - vPulse      : number (units/sec inward “suction” speed, e.g. 2.0)
 *
 * Returns:
 *  {
 *    points: THREE.Points,    // the actual Points() in the scene
 *    update: (dt: number) => void,    // call each frame
 *    applyPulse: () => void           // call whenever you want to push all particles inward
 *  }
 */
export function createParticleRing(
  parentScene,
  centerPos,
  innerRadius,
  outerRadius,
  count = 50,
  vOut = 0.1,
  vPulse = 2.0
) {
  // 1) Precompute “directions” (unit vectors) and initial r (all start at innerRadius).
  const directions = new Array(count);
  const rValues    = new Float32Array(count);
  const vRadial    = new Float32Array(count); // current radial speed for each particle

  for (let i = 0; i < count; i++) {
    // pick a random point on the unit sphere using spherical coordinates
    const u   = Math.random();
    const v   = Math.random();
    const theta = 2 * Math.PI * u;
    const phi   = Math.acos(2 * v - 1);

    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);

    directions[i] = new THREE.Vector3(x, y, z);
    rValues[i]    = innerRadius;   // start each on the inner shell
    vRadial[i]    = +vOut;         // initially drifting outward
  }

  // 2) Build BufferGeometry with positions at r = innerRadius
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dir = directions[i];
    positions[i * 3 + 0] = dir.x * innerRadius;
    positions[i * 3 + 1] = dir.y * innerRadius;
    positions[i * 3 + 2] = dir.z * innerRadius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // 3) Create a PointsMaterial (small additive green sparks)
  const material = new THREE.PointsMaterial({
    color:       0x01ED67,
    size:        0.02,
    transparent: true,
    opacity:     0.6,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false
  });

  // 4) Build the Points mesh, position it at centerPos, and add to scene
  const points = new THREE.Points(geometry, material);
  points.position.copy(centerPos);
  parentScene.add(points);

  // 5) Update loop: move each r by vRadial[i] * dt, clamp to [inner, outer], switch direction
  function update(dt) {
    const posArr = geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      // Advance radial coordinate
      let r = rValues[i] + vRadial[i] * dt;

      // If we hit or exceed the outerRadius:
      if (r >= outerRadius) {
        r = outerRadius;
        // Continue drifting outward (or you could set vRadial[i] = 0 if you want them to stick to the shell)
        vRadial[i] = +vOut;
      }
      // If we hit or go below the innerRadius:
      else if (r <= innerRadius) {
        r = innerRadius;
        // Once they reach the inner shell, switch back to outward drift
        vRadial[i] = +vOut;
      }

      rValues[i] = r;

      // Write new position = direction * r
      const dir = directions[i];
      posArr[i * 3 + 0] = dir.x * r;
      posArr[i * 3 + 1] = dir.y * r;
      posArr[i * 3 + 2] = dir.z * r;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  // 6) When a laser pulse hits, push all particles inward by setting vRadial = -vPulse
  function applyPulse() {
    for (let i = 0; i < count; i++) {
      vRadial[i] = -vPulse;
    }
  }

  // 7) Return the public API
  return {
    points,
    update,
    applyPulse
  };
}

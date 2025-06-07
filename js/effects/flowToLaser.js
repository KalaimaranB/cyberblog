//──────────────────────────────────────────────────────────────────────────────
//  static/js/effects/flowToLaser.js
//──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

/**
 * createFlowParticles(parentScene, centerPos, impactPoint, options)
 *
 * Spawns `count` particles in a spherical shell around `centerPos`. Each particle
 * moves in a straight line toward `impactPoint` at a fixed `speed`. When a particle
 * reaches within `threshold` distance of impactPoint, it instantly “respawns” at a
 * new random location in the shell and repeats.
 *
 * @param {THREE.Scene|THREE.Group} parentScene
 *   The scene (or group) to which we add the Points mesh.
 *
 * @param {THREE.Vector3} centerPos
 *   World‐space center of the sphere around which particles start.
 *
 * @param {THREE.Vector3} impactPoint
 *   World‐space location where the laser meets the sphere (i.e. the “sink”).
 *
 * @param {Object} [options]
 * @param {number} [options.count=100]
 *   Total number of flow particles.
 * @param {number} [options.innerRadius=0.5]
 *   Minimum distance from center where a particle can spawn.
 * @param {number} [options.outerRadius=0.8]
 *   Maximum distance from center where a particle can spawn.
 * @param {number} [options.speed=1.5]
 *   How fast each particle moves (units/sec) toward the impactPoint.
 * @param {number} [options.threshold=0.05]
 *   When a particle comes within this distance of impactPoint, it respawns.
 *
 * @returns {{
 *   points: THREE.Points,
 *   update: (dt:number) => void
 * }}
 *   - `points` is the Points mesh you can inspect or tweak if desired.
 *   - `update(dt)` must be called each frame to advance the flow.
 */
export function createFlowParticles(
  parentScene,
  centerPos,
  impactPoint,
  {
    count       = 100,
    innerRadius = 0.5,
    outerRadius = 0.8,
    speed       = 1.5,
    threshold   = 0.05
  } = {}
) {
  // 1) Allocate buffers for positions and velocities
  const positions  = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  // 2) Helper: generate a random point in [innerRadius, outerRadius] shell
  function randomPointInShell() {
    // Generate a random unit vector via spherical coordinates
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi   = Math.acos(2 * v - 1);

    const xUnit = Math.sin(phi) * Math.cos(theta);
    const yUnit = Math.sin(phi) * Math.sin(theta);
    const zUnit = Math.cos(phi);

    // Pick a random radius between innerRadius and outerRadius
    const r = Math.random() * (outerRadius - innerRadius) + innerRadius;

    return {
      pos: new THREE.Vector3(
        xUnit * r + centerPos.x,
        yUnit * r + centerPos.y,
        zUnit * r + centerPos.z
      ),
      dirUnit: new THREE.Vector3(xUnit, yUnit, zUnit) // may not be needed beyond spawn
    };
  }

  // 3) Initialize each particle’s position and velocity→impactPoint
  for (let i = 0; i < count; i++) {
    const { pos } = randomPointInShell();
    // Write into positions buffer
    positions[i * 3 + 0] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;

    // Compute normalized direction from pos → impactPoint
    const dir = new THREE.Vector3().subVectors(impactPoint, pos).normalize();
    velocities[i * 3 + 0] = dir.x * speed;
    velocities[i * 3 + 1] = dir.y * speed;
    velocities[i * 3 + 2] = dir.z * speed;
  }

  // 4) Build BufferGeometry + PointsMaterial + Points mesh
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color:       0x01ED67,
    size:        0.015,
    transparent: true,
    opacity:     0.8,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false
  });

  const points = new THREE.Points(geometry, material);
  parentScene.add(points);

  // 5) Update loop: move each particle toward impact → check threshold → respawn
  function update(dt) {
    const posArr = geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      // Advance position: pos += vel * dt
      posArr[ix + 0] += velocities[ix + 0] * dt;
      posArr[ix + 1] += velocities[ix + 1] * dt;
      posArr[ix + 2] += velocities[ix + 2] * dt;

      // Test distance to impactPoint
      const dx = posArr[ix + 0] - impactPoint.x;
      const dy = posArr[ix + 1] - impactPoint.y;
      const dz = posArr[ix + 2] - impactPoint.z;
      const distSq = dx*dx + dy*dy + dz*dz;

      if (distSq <= threshold * threshold) {
        // Respawn this particle somewhere else in the shell
        const { pos } = randomPointInShell();
        posArr[ix + 0] = pos.x;
        posArr[ix + 1] = pos.y;
        posArr[ix + 2] = pos.z;

        // Recompute velocity → impactPoint
        const dir = new THREE.Vector3().subVectors(impactPoint, pos).normalize();
        velocities[ix + 0] = dir.x * speed;
        velocities[ix + 1] = dir.y * speed;
        velocities[ix + 2] = dir.z * speed;
      }
    }

    geometry.attributes.position.needsUpdate = true;
  }

  return {
    points,
    update
  };
}

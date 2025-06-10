import * as THREE from 'three';

export function spawnImpactSparks(scene, pos) {
  const PARTICLE_COUNT = 60;   // feel free to lower/higher for density
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  const lifetimes = new Float32Array(PARTICLE_COUNT);
  const ages = new Float32Array(PARTICLE_COUNT);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // 1) Start at impact point
    positions[3 * i + 0] = pos.x;
    positions[3 * i + 1] = pos.y;
    positions[3 * i + 2] = pos.z;

    // 2) Give each spark a random outward velocity
    const dir = new THREE.Vector3(
      (Math.random() * 2 - 1),
      (Math.random() * 2 - 1),
      (Math.random() * 2 - 1)
    ).normalize().multiplyScalar(1.0 + Math.random() * 0.5);

    velocities[3 * i + 0] = dir.x;
    velocities[3 * i + 1] = dir.y;
    velocities[3 * i + 2] = dir.z;

    // 3) Short lifetime (0.2 → 0.4s)
    lifetimes[i] = 0.2 + Math.random() * 0.2;

    // 4) Assign a bright cyan‐white color
    //    Mix between (1,1,1) and (0,1,1) randomly
    const t = Math.random();
    const r = 1.0 * (1 - t) + 0.0 * t; // white→cyan
    const g = 1.0;
    const b = 1.0;
    colors[3 * i + 0] = r;
    colors[3 * i + 1] = g;
    colors[3 * i + 2] = b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  geometry.setAttribute('age', new THREE.BufferAttribute(ages, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size:         0.08,
    vertexColors: true,
    transparent:  true,
    depthWrite:   false,
    blending:     THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const startTime = performance.now();
  let prevTime = startTime;

  function updateSparks(now) {
    const dt = (now - prevTime) * 0.001;
    prevTime = now;

    const posAttr = geometry.getAttribute('position');
    const velAttr = geometry.getAttribute('velocity');
    const ageAttr = geometry.getAttribute('age');
    const lifeAttr = geometry.getAttribute('lifetime');

    let anyAlive = false;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const age = ageAttr.array[i] + dt;
      ageAttr.array[i] = age;

      if (age < lifeAttr.array[i]) {
        anyAlive = true;
        // Move spark outward
        posAttr.array[3 * i + 0] += velAttr.array[3 * i + 0] * dt;
        posAttr.array[3 * i + 1] += velAttr.array[3 * i + 1] * dt;
        posAttr.array[3 * i + 2] += velAttr.array[3 * i + 2] * dt;
      } else {
        ageAttr.array[i] = lifeAttr.array[i];
      }
    }

    // Fade all sparks by the oldest‐alive fraction
    const maxAgeRatio = Math.max(
      ...lifeAttr.array.map((L, i) => ageAttr.array[i] / L)
    );
    material.opacity = Math.max(0, 1 - maxAgeRatio);

    posAttr.needsUpdate = true;
    ageAttr.needsUpdate = true;

    if (anyAlive) {
      requestAnimationFrame(updateSparks);
    } else {
      geometry.dispose();
      material.dispose();
      scene.remove(points);
    }
  }

  requestAnimationFrame(updateSparks);
}
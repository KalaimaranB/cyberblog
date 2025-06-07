// static/js/laser.js
import * as THREE from 'three';
import { createImpactLightning } from './impactLightning.js';

// ──────────────────────────────────────────────────────────────────────────────
//  Helper: spawn a quick, sci‐fi spark burst at a point
//  (same as before, but you can tune PARTICLE_COUNT, colors, etc.)
// ──────────────────────────────────────────────────────────────────────────────
function spawnImpactSparks(scene, pos) {
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

// ──────────────────────────────────────────────────────────────────────────────
//  createLaser: a cylinder + shader with visible pulsing glow
// ──────────────────────────────────────────────────────────────────────────────
export function createLaser(scene, from, to, color = 0xff0000, baseRadius = 0.02) {
  const dirVec = new THREE.Vector3().subVectors(to, from).normalize();
  const length = from.distanceTo(to);

  // ─── 1) Cylinder geometry ──────────────────────────────────────────────────
  const geo = new THREE.CylinderGeometry(
    baseRadius,       // top radius
    baseRadius,       // bottom radius
    length,           // height
    16,               // radial segments
    100,              // height segments
    true              // open‐ended
  );

  // ─── 2) Shader uniforms ───────────────────────────────────────────────────
  const uniforms = {
    time:        { value: 0 },
    color:       { value: new THREE.Color(color) },
    pulseWidth:  { value: 0.1 },   // width of the “throb” band (0.0 → 1.0 along cylinder)
    swellAmount: { value: 1.5 },   // up to 1.5× radius bulge
    pulseSpeed:  { value: 0.6 }    // cycles per second (2.5s per full cycle)
  };

  // ─── 3) Vertex shader: moderate bulge around the pulse ────────────────────
  const vertexShader = `
    uniform float time;
    uniform float pulseWidth;
    uniform float swellAmount;
    uniform float pulseSpeed;
    varying float vUvY;

    void main() {
      vUvY = uv.y;  // uv.y goes 0→1 along the cylinder's length
      float p = mod(time * pulseSpeed, 1.0);
      float d = abs(vUvY - p);
      float e = smoothstep(pulseWidth, 0.0, d);
      float scale = 1.0 + e * swellAmount;

      vec3 pos = position;
      pos.x *= scale;
      pos.z *= scale;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // ─── 4) Fragment shader: gentle brightness pulse + white core ─────────────
  const fragmentShader = `
    uniform vec3 color;
    uniform float time;
    uniform float pulseSpeed;
    uniform float pulseWidth;
    varying float vUvY;

    void main() {
      // Brightness swings between 1.0 → 1.5
      float sinVal = sin(time * pulseSpeed * 6.28318); // 2π * (time * speed)
      float brightness = 4.0 + 0.5 * sinVal;

      // White “core” around the exact pulse location
      float p = mod(time * pulseSpeed, 1.0);
      float dist = abs(vUvY - p);
      float core = smoothstep(pulseWidth * 0.5, 0.0, dist);

      // Mix base color and white for the core highlight
      vec3 finalColor = mix(color, vec3(1.0, 1.0, 1.0), core);

      gl_FragColor = vec4(finalColor * brightness, 1.0);
    }
  `;

  // ─── 5) ShaderMaterial setup ──────────────────────────────────────────────
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
    toneMapped:  false
  });

  // ─── 6) Build + orient the mesh ────────────────────────────────────────────
  const laser = new THREE.Mesh(geo, mat);
  laser.position.copy(from).lerp(to, 0.5);
  laser.lookAt(to);
  laser.rotateX(Math.PI / 2);
  scene.add(laser);

  // ─── 7) Track pulse state for impact bursts ─────────────────────────────────
  let lastPhase = 0;
  let impactSystem = null;

  // ─── 8) Return the update loop ─────────────────────────────────────────────
  return {
    mesh: laser,
    update: t => {
      const timeSec = t * 0.001;
      mat.uniforms.time.value = timeSec;

      // Compute where the pulse currently is (0→1)
      const phase = (timeSec * uniforms.pulseSpeed.value) % 1;
      const impactPoint = from.clone().addScaledVector(dirVec, length * 0.75);

      // When phase wraps around, fire new lightning + sparks
      if (phase < lastPhase) {
        if (impactSystem) impactSystem.dispose();
        impactSystem = createImpactLightning(scene, impactPoint, {
          boltCount:    6,
          sphereRadius: 1,
          sphereCenter: new THREE.Vector3(0, 0, 0),
          color,
          lifetime:     500
        });

        spawnImpactSparks(scene, to.clone());
      }
      lastPhase = phase;

      if (impactSystem) impactSystem.update(t);
    }
  };
}

//──────────────────────────────────────────────────────────────────────────────
//  static/js/laser.js
//──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createImpactLightning } from './impactLightning.js';
import { spawnImpactSparks }    from './spawnImpactSparks.js';

/**
 * createLaser(scene, from, to, color, baseRadius, onPulse)
 *
 * Builds a pulsing‐shader cylinder between `from` and `to`. Whenever the internal `phase`
 * wraps (phase < lastPhase), it:
 *   • Creates an impact lightning at 75% along the beam
 *   • Spawns some impact sparks at `to`
 *   • Calls `onPulse()` if provided
 *
 * @param {THREE.Scene|THREE.Group} scene
 *   The scene (or group) to which the laser mesh and its updates belong.
 *
 * @param {THREE.Vector3} from
 *   World space start point of the laser.
 *
 * @param {THREE.Vector3} to
 *   World space end point of the laser.
 *
 * @param {number} [color=0xff0000]
 *   Hex color of the laser’s glow.
 *
 * @param {number} [baseRadius=0.02]
 *   Base radius of the cylindrical beam.
 *
 * @param {Function} [onPulse]
 *   Optional callback to invoke each time the pulse “wraps” (i.e. when a new impact fires).
 *   Signature: () => void
 *
 * @returns {{
 *   mesh: THREE.Mesh,
 *   update: (t:number) => void
 * }}
 *   - `mesh` is the laser’s THREE.Mesh (cylinder + shader).
 *   - `update(t)` must be called every frame (pass a high‐resolution timestamp).
 */
export function createLaser(
  scene,
  from,
  to,
  color = 0xff0000,
  baseRadius = 0.02,
  onPulse = null
) {
  // ─── Setup direction & length ──────────────────────────────────────────────
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
    pulseSpeed:  { value: 0.6 }    // cycles per second (≈1.67s per full cycle)
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

      // Compute normalized pulse position (0→1)
      float p = mod(time * pulseSpeed, 1.0);
      float d = abs(vUvY - p);
      float e = smoothstep(pulseWidth, 0.0, d);
      float scale = 1.0 + e * swellAmount;

      // Bulge the cylinder’s x/z coordinates:
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
      float sinVal = sin(time * pulseSpeed * 6.28318); // 2π × (time × speed)
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
  // Center it halfway between “from” and “to”
  laser.position.copy(from).lerp(to, 0.5);
  // Orient so its “up” is along the beam direction:
  laser.lookAt(to);
  laser.rotateX(Math.PI / 2); // because CylinderGeometry’s long axis is along Y by default
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

      // Compute normalized phase (0→1 along cylinder’s length)
      const phase = (timeSec * uniforms.pulseSpeed.value) % 1;
      // Impact point at 75% along the beam (from “from” toward “to”)
      const impactPoint = from.clone().addScaledVector(dirVec, length * 0.75);

      // If phase just wrapped (new pulse), fire impact lightning + sparks + callback
      if (phase < lastPhase) {
        // 1) Dispose previous impact if still alive
        if (impactSystem) impactSystem.dispose();

        // 2) Spawn new impact lightning
        impactSystem = createImpactLightning(scene, impactPoint, {
          boltCount:    6,
          sphereRadius: 1,
          sphereCenter: new THREE.Vector3(0, 0, 0),
          color,
          lifetime:     500
        });

        // 3) Spawn impact sparks at the “to” end
        spawnImpactSparks(scene, to.clone());

        // 4) Invoke the callback (if provided)
        if (typeof onPulse === 'function') {
          onPulse();
        }
      }

      lastPhase = phase;

      // 5) Update the impact system if it’s active
      if (impactSystem) {
        impactSystem.update(t);
      }
    }
  };
}

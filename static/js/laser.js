import * as THREE from 'three';
import { createImpactLightning } from './impactLightning.js';

/**
 * Creates a laser beam (cylinder) with a traveling pulse and impact lightning bursts at its endpoint.
 * @param {THREE.Scene} scene - the Three.js scene
 * @param {THREE.Vector3} from - start position of the laser
 * @param {THREE.Vector3} to - end position (on sphere surface)
 * @param {number} color - hex color of the laser
 * @param {number} baseRadius - base thickness of the beam
 * @returns {{mesh: THREE.Mesh, update: function(number):void}}
 */
export function createLaser(scene, from, to, color = 0xff0000, baseRadius = 0.02) {
  // Compute beam direction & length
  const dirVec = new THREE.Vector3().subVectors(to, from).normalize();
  const length = from.distanceTo(to);

  // 1) Cylinder geometry for the beam
  const geo = new THREE.CylinderGeometry(
    baseRadius,
    baseRadius,
    length,
    16,    // radial segments
    100,   // height segments for smooth pulse scaling
    true   // open-ended
  );

  // 2) Shader uniforms
  const uniforms = {
    time:        { value: 0 },
    color:       { value: new THREE.Color(color) },
    pulseWidth:  { value: 0.1 },   // relative thickness of the pulse band
    swellAmount: { value: 1.5 },   // how many × wider at the pulse
    pulseSpeed:  { value: 0.3 }    // cycles per second
  };

  // 3) Vertex shader: scales geometry radially based on pulse
  const vertexShader = `
    uniform float time;
    uniform float pulseWidth;
    uniform float swellAmount;
    uniform float pulseSpeed;
    varying float vUvY;

    void main() {
      vUvY = uv.y;
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

  // 4) Fragment shader: emit HDR-bright pixels for bloom
  const fragmentShader = `
    uniform vec3 color;
    void main() {
      // push brightness above 1.0 so UnrealBloomPass can grab it
      gl_FragColor = vec4(color * 5.0, 1.0);
    }
  `;

  // 5) Shader material setup
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
    toneMapped:  false  // preserve HDR values
  });

  // 6) Build and orient the mesh
  const laser = new THREE.Mesh(geo, mat);
  laser.position.copy(from).lerp(to, 0.5);
  laser.lookAt(to);
  laser.rotateX(Math.PI / 2);
  scene.add(laser);

  // 7) Impact lightning state
  let lastPhase = 0;
  let impactSystem = null;

  // 8) Return update loop
  return {
    mesh: laser,
    update: t => {
      // time in seconds for shader
      const timeSec = t * 0.001;
      mat.uniforms.time.value = timeSec;

      // detect pulse wrap-around to trigger impact
      const phase = (timeSec * uniforms.pulseSpeed.value) % 1;
      const impactPoint = from.clone().addScaledVector(dirVec, length * 0.75);

      // spawn a burst that lives 500ms, and shoots 50% of the sphere radius inward
      if (phase < lastPhase) {
        if (impactSystem) impactSystem.dispose();
        impactSystem = createImpactLightning(scene, impactPoint, {
        boltCount:   6,
        sphereRadius:1,         // pass your known radius
        sphereCenter: new THREE.Vector3(0,0,0),
        color,
        lifetime:    500
      });
      }
      lastPhase = phase;

      // update the lightning burst if active
      if (impactSystem) impactSystem.update(t);
    }
  };
}
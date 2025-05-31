// static/js/effects/glowingSphere.js

import * as THREE from 'three';

/**
 * Creates a neon-orange interior symbol plus an optional glowing green shell.
 *
 * Interior symbols (all in neon-orange):
 *   • 'gear'     – an 8-tooth gear with properly aligned teeth  
 *   • 'cross'    – a thick medical cross  
 *   • 'hacker'   – a simple laptop (base + screen)  
 *   • 'software' – three clearly separated plates (a “stack”)  
 *
 * Outer shell (if enabled) is a slightly larger sphere with an emissive green material,
 * useful for bloom.  You can completely disable it by leaving exteriorEmissiveIntensity = 0.
 *
 * @param {THREE.Scene|THREE.Group} scene
 * @param {THREE.Vector3}           position
 * @param {Object} [options]
 * @param {'gear'|'cross'|'hacker'|'software'} [options.type]  – which interior symbol to create
 * @param {number} [options.radius=0.4]          – base “radius” scale for the interior symbol
 *
 * // Interior customization:
 * @param {number} [options.interiorEmissive=1.5] – emissive intensity for the neon-orange interior
 *
 * // Exterior (outer glow) customization:
 * @param {boolean} [options.enableExterior=true]           – whether to draw a glowing shell
 * @param {number}  [options.exteriorThickness=0.05]        – how much larger (in world units) the shell is than `radius`
 * @param {number}  [options.exteriorColor=0x01ED67]         – hex color for glow (green)
 * @param {number}  [options.exteriorOpacity=0.2]            – opacity of the glow shell (0→1)
 * @param {number}  [options.exteriorEmissiveIntensity=3.0]  – emissive strength of the glow shell
 *
 * @returns {{ group: THREE.Group, dispose(): void }}
 */
export function createGlowingSphere(
  scene,
  position,
  {
    type                    = undefined,
    radius                  = 0.4,
    interiorEmissive        = 1.5,
    enableExterior          = true,
    exteriorThickness       = 0.05,
    exteriorColor           = 0x01ED67,
    exteriorOpacity         = 0.2,
    exteriorEmissiveIntensity = 3.0
  } = {}
) {
  if (!scene || !position) {
    console.error('createGlowingSphere: scene and position are required.');
    return;
  }

  // Parent group—everything (interior + optional exterior) goes here
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  // 1) Create neon-orange material for interior symbol
  const neonOrange = new THREE.Color(0xffa500);
  const interiorMat = new THREE.MeshStandardMaterial({
    color:             neonOrange,
    emissive:          neonOrange,
    emissiveIntensity: interiorEmissive,
    flatShading:       true
  });

  let interiorMesh = null;


  // ─── INTERIOR SYMBOL ──────────────────────────────────────────────────────────

  switch (type) {
    //─────────────────── GEAR (8 TEETH, PROPERLY ALIGNED) ───────────────────
    case 'gear': {
      // Build the gear in the XY plane, then rotate it as a whole.
      // Gear ring radius = 0.6 * radius
      const gearRadius = radius * 0.6;
      const toothCount = 8;

      // 1a) Torus rim (in XY plane)
      const torusGeo = new THREE.TorusGeometry(gearRadius, gearRadius * 0.12, 16, 64);
      const torusMesh = new THREE.Mesh(torusGeo, interiorMat.clone());
      // No rotation yet—we want rim in XY so teeth align correctly

      // 1b) Parent object to hold rim + teeth (so they spin together)
      const gearParent = new THREE.Group();
      gearParent.add(torusMesh);
      group.add(gearParent);

      // 1c) Create eight teeth as boxes, positioned around XY circle
      const toothWidth  = gearRadius * 0.3;
      const toothHeight = gearRadius * 0.6;
      const toothDepth  = gearRadius * 0.12;
      const toothGeo    = new THREE.BoxGeometry(toothWidth, toothHeight, toothDepth);
      const toothMat    = interiorMat.clone();

      for (let i = 0; i < toothCount; i++) {
        const angle = (i / toothCount) * Math.PI * 2;
        // Each tooth’s center sits at (gearRadius + toothHeight/2) on the circle
        const x = (gearRadius + toothHeight / 2) * Math.cos(angle);
        const y = (gearRadius + toothHeight / 2) * Math.sin(angle);
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(x, y, 0);
        // Rotate tooth so its long face is radial
        tooth.rotation.z = angle;
        gearParent.add(tooth);
      }

      // 1d) Now rotate the entire gearParent so it sits in XZ plane (vertical gear)
      gearParent.rotation.x = Math.PI / 2;

      interiorMesh = gearParent;
      break;
    }

    //─────────────────── CROSS (MEDICAL “+”) ───────────────────
    case 'cross': {
      const crossSize    = radius * 1.0;
      const barThickness = crossSize * 0.25;
      const barLength    = crossSize * 1.0;

      const barGeo1 = new THREE.BoxGeometry(barLength, barThickness, barThickness);
      const barGeo2 = new THREE.BoxGeometry(barThickness, barLength, barThickness);
      const barMat  = interiorMat.clone();

      const bar1 = new THREE.Mesh(barGeo1, barMat);
      const bar2 = new THREE.Mesh(barGeo2, barMat);
      const crossGroup = new THREE.Group();
      crossGroup.add(bar1, bar2);
      group.add(crossGroup);

      interiorMesh = crossGroup;
      break;
    }

    //─────────────────── HACKER (LAPTOP) ───────────────────
    case 'hacker': {
      const laptopGroup = new THREE.Group();

      // 2a) Base: flat box
      const baseWidth  = radius * 1.2;
      const baseDepth  = radius * 0.8;
      const baseHeight = radius * 0.05;
      const baseGeo    = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
      const baseMesh   = new THREE.Mesh(baseGeo, interiorMat.clone());
      // Move base so its top edge is at y = 0
      baseMesh.position.y = - (baseHeight / 2);
      laptopGroup.add(baseMesh);

      // 2b) Screen: narrower, taller, hinged at back
      const screenWidth  = baseWidth * 0.9;
      const screenHeight = radius * 0.7;
      const screenDepth  = radius * 0.05;
      const screenGeo    = new THREE.BoxGeometry(screenWidth, screenHeight, screenDepth);
      const screenMesh   = new THREE.Mesh(screenGeo, interiorMat.clone());
      // Position screen bottom at y = baseHeight/2, and back edge at top of base
      screenMesh.position.set(
        0,
        screenHeight / 2 - (baseHeight / 2),
        - (baseDepth / 2) + (screenDepth / 2)
      );
      screenMesh.rotation.x = -Math.PI / 5; // ~36° open
      laptopGroup.add(screenMesh);

      group.add(laptopGroup);
      interiorMesh = laptopGroup;
      break;
    }

    //─────────────────── SOFTWARE (3 PLATES, SPACED FARTHER APART) ───────────────────
    case 'software': {
      const stackGroup = new THREE.Group();
      const plateMat   = interiorMat.clone();

      // Plate dimensions
      const w = radius * 1.4;
      const h = radius * 0.04;
      const d = radius * 1.0;
      const separation = radius * 0.15; // increased from 0.10

      for (let i = 0; i < 3; i++) {
        const factor = 1 - (i * 0.1); // each subsequent plate slightly narrower
        const geo    = new THREE.BoxGeometry(w * factor, h, d * factor);
        const mesh   = new THREE.Mesh(geo, plateMat.clone());
        mesh.position.y = (i - 1) * separation; // bottom at -sep, mid at 0, top at +sep
        stackGroup.add(mesh);
      }

      group.add(stackGroup);
      interiorMesh = stackGroup;
      break;
    }

    //─────────────────── FALLBACK (SIMPLE SPHERE) ───────────────────
    default: {
      const fallbackGeo = new THREE.SphereGeometry(radius * 0.5, 16, 16);
      const fallbackMat = interiorMat.clone();
      const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
      group.add(fallbackMesh);
      interiorMesh = fallbackMesh;
      break;
    }
  }


  // ─── OPTIONAL OUTER GLOW SHELL ─────────────────────────────────────────────

  if (enableExterior && exteriorEmissiveIntensity > 0) {
    const glowColor = new THREE.Color(exteriorColor);
    const glowMat   = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x000000),
      emissive:          glowColor,
      emissiveIntensity: exteriorEmissiveIntensity,
      transparent:       true,
      opacity:           exteriorOpacity,
      blending:          THREE.AdditiveBlending,
      depthWrite:        false
    });

    const glowGeo = new THREE.SphereGeometry(radius + exteriorThickness, 64, 64);
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    group.add(glowMesh);
  }


  // Expose interior mesh for animation
  if (interiorMesh) group.userData.innerMesh = interiorMesh;


  // 3) dispose() helper
  function dispose() {
    group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    scene.remove(group);
  }

  return { group, dispose };
}

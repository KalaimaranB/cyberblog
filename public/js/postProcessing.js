// static/js/postProcessing.js
import * as THREE          from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { WebGLRenderTarget } from 'three';

export function createPostProcessing(renderer, scene, camera) {
  // 1) Tell the renderer to use full-res DPR
  renderer.setPixelRatio(window.devicePixelRatio);

  // 2) Make an HDR-capable render target
  const rtParams = {
    format: THREE.RGBAFormat,
    type:   THREE.HalfFloatType,   // ← allow >1.0 values
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    encoding:  THREE.LinearEncoding
  };
  const renderTarget = new WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    rtParams
  );

  // 3) Plug that into your composer
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  // 4) Base scene pass
  composer.addPass(new RenderPass(scene, camera));

  // 5) HDR Bloom pass
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    /*strength*/ 2.5,
    /*radius*/   0.4,
    /*threshold*/0.8
  );
  composer.addPass(bloom);

  return composer;
}

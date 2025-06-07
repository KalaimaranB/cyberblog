// static/js/controls.js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export function createControls(camera, domEl) {
  return new OrbitControls(camera, domEl);
}

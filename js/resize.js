export function setupResize({ renderer, camera, composer }) {
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);

    camera.aspect = w/h;
    camera.updateProjectionMatrix();

    composer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
  });
}

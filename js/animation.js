export function startLoop({ camera, scene, renderer, composer, onUpdate }) {
  function animate(time) {
    onUpdate(time);
    composer.render();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

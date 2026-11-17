// The three.js scene: a golden-hour sun, a warm sky, fog on the horizon, and the
// third-person camera that follows the player on foot and in a car, with orbit, zoom and shake.

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd4ef);
  scene.fog = new THREE.Fog(0xf7c98b, 120, 520);

  // Golden-hour sun from the west, warm and low.
  const sun = new THREE.DirectionalLight(0xffe3b3, 2.2);
  sun.position.set(-160, 140, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.9));

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

  // Camera state: orbit yaw/pitch around the target, distance, and trauma for shake.
  const cam = {
    yaw: Math.PI,
    pitch: 0.32,
    distance: 9,
    targetDistance: 9,
    trauma: 0,
    // The yaw the camera drifts back to when the player moves (behind the heading).
    followYaw: Math.PI,
  };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /** Orbit the camera by pixel deltas; the wheel zooms. */
  function orbit(dx, dy, wheel) {
    cam.yaw -= dx * 0.005;
    cam.pitch = Math.max(0.08, Math.min(1.1, cam.pitch + dy * 0.004));
    if (wheel) cam.targetDistance = Math.max(5, Math.min(16, cam.targetDistance + wheel * 0.004));
  }

  function addShake(amount) {
    cam.trauma = Math.min(1, cam.trauma + amount);
  }

  /**
   * Place the camera behind `target` (a {x, y, z} point) facing along `heading` radians,
   * eased toward the orbit yaw so it trails the player instead of snapping.
   */
  function follow(target, heading, dt, inCar) {
    cam.distance += (cam.targetDistance - cam.distance) * Math.min(1, dt * 4);
    // Ease the orbit yaw toward the heading when moving, so the view settles behind.
    let diff = heading - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const settle = inCar ? 2.2 : 1.2;
    cam.yaw += diff * Math.min(1, dt * settle);
    cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
    const shake = cam.trauma * cam.trauma;
    const sx = (Math.random() - 0.5) * shake * 0.6;
    const sy = (Math.random() - 0.5) * shake * 0.4;
    const dist = cam.distance + (inCar ? 2.5 : 0);
    const height = dist * Math.sin(cam.pitch) + (inCar ? 1.2 : 1.4);
    const back = dist * Math.cos(cam.pitch);
    const cx = target.x - Math.sin(cam.yaw) * back + sx;
    const cz = target.z - Math.cos(cam.yaw) * back;
    const cy = target.y + height + sy;
    camera.position.set(cx, cy, cz);
    camera.lookAt(target.x + sx, target.y + 1.2, target.z);
    // Keep the sun's shadow box centred on the action.
    sun.position.set(target.x - 160, 140, target.z - 60);
    sun.target.position.set(target.x, 0, target.z);
    sun.target.updateMatrixWorld();
  }

  return {
    renderer,
    scene,
    camera,
    sun,
    cam,
    orbit,
    addShake,
    follow,
    render() {
      renderer.render(scene, camera);
    },
  };
}

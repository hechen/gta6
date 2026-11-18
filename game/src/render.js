// The renderer: a WebGL renderer with a sun, a warm sky and fog, sized to the
// window. Also the sun-soaked look: a bright directional light and a soft
// hemisphere fill.

import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3d8, 120, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 30, 60);

  // Sun: warm, high, from the south-east.
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sun.position.set(120, 180, 80);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5a, 0.75);
  scene.add(hemi);

  // A big sky dome gradient (a large sphere, back side).
  const skyGeo = new THREE.SphereGeometry(700, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x87b5d6, side: THREE.BackSide, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // A low sun disc in the sky.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
  );
  sunDisc.position.set(300, 220, 180);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    renderer, scene, camera,
    render() { renderer.render(scene, camera); },
    // Time-of-day tint: 0 = noon, 1 = golden hour.
    setGoldenHour(t) {
      sun.color.setHex(t > 0.5 ? 0xffd9a0 : 0xfff2d8);
      scene.background.setHex(t > 0.5 ? 0xe8a06a : 0x87b5d6);
      scene.fog.color.setHex(t > 0.5 ? 0xe8b080 : 0x9fc3d8);
    },
  };
}

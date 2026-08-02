import * as THREE from 'three';
import { createDualViewport } from './viewport.js';
const vp = createDualViewport(document.getElementById('scene-canvas'));
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100); cam.position.z = 5;
const cam2 = cam.clone();
for (const [scene, color] of [[vp.flatScene, 0xff4444], [vp.globeScene, 0x44ff44]]) {
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color })));
}
vp.setCameras(cam, cam2);
window.addEventListener('resize', vp.resize);
document.getElementById('loading-screen').hidden = true;
(function loop() { vp.render(); requestAnimationFrame(loop); })();

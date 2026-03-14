import * as THREE from 'three';
import {
    createScene, createCamera, createRenderer, createLabelRenderer,
    createControls, createComposer, createLights, createStarfield,
    createAsteroidBelt, setupResize
} from './scene.js';
import { Planet } from './planet.js';
import { BODIES } from './data.js';
import { UIManager, setupRaycaster, updateLoadingProgress, hideLoadingScreen } from './ui.js';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function init() {
    updateLoadingProgress(5, 'Creating scene...');

    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    const labelRenderer = createLabelRenderer();
    const controls = createControls(camera, renderer);

    updateLoadingProgress(15, 'Setting up lighting...');
    createLights(scene);

    updateLoadingProgress(20, 'Generating starfield...');
    createStarfield(scene);

    updateLoadingProgress(25, 'Generating asteroid belt...');
    createAsteroidBelt(scene);

    updateLoadingProgress(30, 'Setting up post-processing...');
    const { composer } = createComposer(renderer, scene, camera);
    setupResize(camera, renderer, labelRenderer, composer);

    // ── Generate planets (with progress) ─────────
    const planets = [];
    for (let i = 0; i < BODIES.length; i++) {
        const data = BODIES[i];
        const pct = 35 + Math.floor((i / BODIES.length) * 55);
        updateLoadingProgress(pct, `Generating ${data.name}...`);

        // Yield to allow UI update
        await new Promise(r => setTimeout(r, 30));

        const planet = new Planet(data, scene);
        planets.push(planet);
    }

    updateLoadingProgress(95, 'Finishing up...');
    await new Promise(r => setTimeout(r, 100));

    // ── UI ────────────────────────────────────────
    const ui = new UIManager(planets, camera, controls);
    setupRaycaster(camera, renderer, planets, ui);

    updateLoadingProgress(100, 'Ready');
    await new Promise(r => setTimeout(r, 300));
    hideLoadingScreen();

    // ── Animation Loop ───────────────────────────
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.1); // cap delta to prevent jumps
        const speed = ui.getEffectiveSpeed();

        // Update planets
        planets.forEach(planet => planet.update(dt, speed));

        // Camera animation / follow
        ui.updateCameraAnimation(dt);

        controls.update();
        composer.render();
        labelRenderer.render(scene, camera);
    }

    animate();
}

init().catch(err => {
    console.error('Solar System Explorer failed to initialize:', err);
    const status = document.getElementById('loading-status');
    if (status) status.textContent = 'Error: ' + err.message;
});

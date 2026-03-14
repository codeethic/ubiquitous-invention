import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ─── Scene Setup ─────────────────────────────────────────────────────────────

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000006);
    return scene;
}

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 50000);
    camera.position.set(80, 200, 350);
    return camera;
}

export function createRenderer() {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);
    return renderer;
}

export function createLabelRenderer() {
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(labelRenderer.domElement);
    return labelRenderer;
}

export function createControls(camera, renderer) {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.5;
    controls.minDistance = 5;
    controls.maxDistance = 3000;
    controls.enablePan = true;
    return controls;
}

// ─── Post-Processing (Bloom) ─────────────────────────────────────────────────

export function createComposer(renderer, scene, camera) {
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.2,   // strength
        0.5,   // radius
        0.75   // threshold
    );
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    return { composer, bloomPass };
}

// ─── Lighting ────────────────────────────────────────────────────────────────

export function createLights(scene) {
    // Very dim ambient — space is dark
    const ambient = new THREE.AmbientLight(0x101020, 0.4);
    scene.add(ambient);

    // Sun point light
    const sunLight = new THREE.PointLight(0xfff5e0, 2.5, 0, 0);
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 1500;
    scene.add(sunLight);

    return sunLight;
}

// ─── Starfield ───────────────────────────────────────────────────────────────

export function createStarfield(scene) {
    const layers = [
        { count: 12000, size: 0.5, opacity: 0.6, spread: 8000 },
        { count: 4000,  size: 1.0, opacity: 0.8, spread: 8000 },
        { count: 1200,  size: 1.6, opacity: 0.9, spread: 8000 },
        { count: 300,   size: 2.5, opacity: 1.0, spread: 8000 },
    ];

    // Star colors (spectral types)
    const starColors = [
        new THREE.Color(0.7, 0.8, 1.0),   // Blue-white (O/B)
        new THREE.Color(1.0, 1.0, 1.0),   // White (A)
        new THREE.Color(1.0, 0.95, 0.85), // Yellow-white (F)
        new THREE.Color(1.0, 0.9, 0.6),   // Yellow (G, like our Sun)
        new THREE.Color(1.0, 0.75, 0.5),  // Orange (K)
        new THREE.Color(1.0, 0.6, 0.4),   // Red (M)
    ];

    layers.forEach(layer => {
        const positions = new Float32Array(layer.count * 3);
        const colors = new Float32Array(layer.count * 3);

        for (let i = 0; i < layer.count; i++) {
            // Distribute on sphere surface for uniform appearance
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = layer.spread * (0.8 + Math.random() * 0.2);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Weighted color distribution (more common stars are dimmer/redder)
            const colorIdx = Math.min(
                starColors.length - 1,
                Math.floor(Math.pow(Math.random(), 0.6) * starColors.length)
            );
            const c = starColors[colorIdx];
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: layer.size,
            vertexColors: true,
            transparent: true,
            opacity: layer.opacity,
            sizeAttenuation: false,
            depthWrite: false,
        });

        scene.add(new THREE.Points(geo, mat));
    });
}

// ─── Asteroid Belt ───────────────────────────────────────────────────────────

export function createAsteroidBelt(scene) {
    const count = 3000;
    const innerRadius = 178;
    const outerRadius = 220;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const r = innerRadius + Math.random() * (outerRadius - innerRadius);
        const angle = Math.random() * Math.PI * 2;
        const ySpread = (Math.random() - 0.5) * 6;

        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = ySpread;
        positions[i * 3 + 2] = Math.sin(angle) * r;

        const brightness = 0.25 + Math.random() * 0.3;
        colors[i * 3] = brightness;
        colors[i * 3 + 1] = brightness * 0.9;
        colors[i * 3 + 2] = brightness * 0.8;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        depthWrite: false,
    });

    const belt = new THREE.Points(geo, mat);
    scene.add(belt);
    return belt;
}

// ─── Resize Handler ──────────────────────────────────────────────────────────

export function setupResize(camera, renderer, labelRenderer, composer) {
    window.addEventListener('resize', () => {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        labelRenderer.setSize(w, h);
        composer.setSize(w, h);
    });
}

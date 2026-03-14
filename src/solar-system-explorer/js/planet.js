import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { generatePlanetTexture, generateCloudTexture, generateRingTexture, generateBumpMap } from './textures.js';
import { getOrbitalSpeed } from './data.js';

// ─── Atmosphere Shader ───────────────────────────────────────────────────────

const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
    vNormal = normalize(normalMatrix * normal);
    vViewPos = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const atmosphereFragmentShader = `
uniform vec3 glowColor;
uniform float intensity;
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
    vec3 viewDir = normalize(-vViewPos);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float glow = pow(rim, 2.5) * intensity;
    gl_FragColor = vec4(glowColor, glow);
}`;

// ─── Sun Shader ──────────────────────────────────────────────────────────────

const sunVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
}`;

const sunFragmentShader = `
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
    );
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = vUv * 4.0;

    float n1 = fbm(uv + time * 0.04);
    float n2 = fbm(uv * 1.8 - time * 0.025 + 10.0);
    float n3 = fbm(uv * 3.0 + time * 0.06 + 20.0);
    float n = n1 * 0.45 + n2 * 0.35 + n3 * 0.20;

    vec3 hot    = vec3(1.0, 0.98, 0.85);
    vec3 bright = vec3(1.0, 0.75, 0.20);
    vec3 mid    = vec3(0.95, 0.45, 0.05);
    vec3 dark   = vec3(0.60, 0.15, 0.02);

    vec3 color = mix(dark, mid, smoothstep(0.25, 0.45, n));
    color = mix(color, bright, smoothstep(0.45, 0.65, n));
    color = mix(color, hot, smoothstep(0.7, 0.90, n));

    // Bright granules
    float granule = pow(fbm(uv * 5.0 + time * 0.07), 2.0);
    color += hot * granule * 0.25;

    // Limb darkening (view-relative)
    float limb = max(dot(vViewDir, vNormal), 0.0);
    limb = pow(limb, 0.4);
    color *= 0.5 + 0.5 * limb;

    gl_FragColor = vec4(color, 1.0);
}`;

// ─── Planet Class ────────────────────────────────────────────────────────────

export class Planet {
    constructor(data, scene) {
        this.data = data;
        this.scene = scene;
        this.angle = Math.random() * Math.PI * 2;
        this.group = new THREE.Group();
        this.moons = [];
        this.label = null;
        this.orbitLine = null;

        this.orbitalSpeed = getOrbitalSpeed(data);

        if (data.type === 'star') {
            this._createSun();
        } else {
            this._createPlanet();
        }

        // Label
        this._createLabel();

        scene.add(this.group);

        // Orbit line
        if (data.visualDistance > 0) {
            this._createOrbit();
        }
    }

    // ── Sun ──────────────────────────────────────
    _createSun() {
        const r = this.data.visualRadius;
        const geo = new THREE.SphereGeometry(r, 64, 64);

        this.sunTimeUniform = { value: 0 };
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                time: this.sunTimeUniform,
            },
            vertexShader: sunVertexShader,
            fragmentShader: sunFragmentShader,
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.userData = { isPlanet: true, planetData: this.data };
        this.group.add(this.mesh);

        // Corona glow
        const coronaGeo = new THREE.SphereGeometry(r * 1.35, 48, 48);
        const coronaMat = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(1.0, 0.6, 0.1) },
                intensity: { value: 1.2 },
            },
            vertexShader: atmosphereVertexShader,
            fragmentShader: atmosphereFragmentShader,
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const corona = new THREE.Mesh(coronaGeo, coronaMat);
        this.group.add(corona);

        // Outer halo
        const haloGeo = new THREE.SphereGeometry(r * 2.0, 32, 32);
        const haloMat = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(1.0, 0.8, 0.3) },
                intensity: { value: 0.5 },
            },
            vertexShader: atmosphereVertexShader,
            fragmentShader: atmosphereFragmentShader,
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.group.add(new THREE.Mesh(haloGeo, haloMat));
    }

    // ── Planet ───────────────────────────────────
    _createPlanet() {
        const r = this.data.visualRadius;
        const geo = new THREE.SphereGeometry(r, 64, 48);

        // Generate procedural texture
        const texCanvas = generatePlanetTexture(this.data.name, 1024);
        let material;

        if (texCanvas) {
            const texture = new THREE.CanvasTexture(texCanvas);
            texture.colorSpace = THREE.SRGBColorSpace;

            const bumpCanvas = generateBumpMap(texCanvas);
            const bumpTex = new THREE.CanvasTexture(bumpCanvas);

            material = new THREE.MeshStandardMaterial({
                map: texture,
                bumpMap: bumpTex,
                bumpScale: this.data.type === 'terrestrial' ? 0.03 : 0.01,
                roughness: this.data.type === 'terrestrial' ? 0.85 : 0.7,
                metalness: 0.05,
            });
        } else {
            material = new THREE.MeshStandardMaterial({
                color: this.data.colorHex,
                roughness: 0.8,
                metalness: 0.1,
            });
        }

        this.mesh = new THREE.Mesh(geo, material);
        this.mesh.userData = { isPlanet: true, planetData: this.data };
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Axial tilt
        const tiltRad = (this.data.axialTilt || 0) * Math.PI / 180;
        this.mesh.rotation.x = tiltRad;

        this.group.add(this.mesh);

        // Cloud layer for Earth
        if (this.data.hasClouds) {
            this._createClouds(r);
        }

        // Atmosphere glow
        if (this.data.hasAtmosphere) {
            this._createAtmosphere(r);
        }

        // Rings
        if (this.data.hasRings) {
            this._createRings();
        }

        // Moons
        if (this.data.moons) {
            this._createMoons();
        }
    }

    _createClouds(r) {
        const cloudCanvas = generateCloudTexture(512);
        const cloudTex = new THREE.CanvasTexture(cloudCanvas);
        cloudTex.colorSpace = THREE.SRGBColorSpace;

        const cloudGeo = new THREE.SphereGeometry(r * 1.015, 48, 32);
        const cloudMat = new THREE.MeshStandardMaterial({
            alphaMap: cloudTex,
            color: 0xffffff,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            roughness: 1,
        });
        this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        this.cloudMesh.rotation.x = (this.data.axialTilt || 0) * Math.PI / 180;
        this.group.add(this.cloudMesh);
    }

    _createAtmosphere(r) {
        const color = new THREE.Color(this.data.atmosphereColor || '#6ab6ff');
        const atmoGeo = new THREE.SphereGeometry(r * 1.06, 48, 32);
        const atmoMat = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: color },
                intensity: { value: (this.data.atmosphereOpacity || 0.1) * 8 },
            },
            vertexShader: atmosphereVertexShader,
            fragmentShader: atmosphereFragmentShader,
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.group.add(new THREE.Mesh(atmoGeo, atmoMat));
    }

    _createRings() {
        const isSaturn = this.data.name === 'Saturn';
        const inner = this.data.ringInnerRadius;
        const outer = this.data.ringOuterRadius;

        const ringCanvas = generateRingTexture(1024, isSaturn);
        const ringTex = new THREE.CanvasTexture(ringCanvas);
        ringTex.colorSpace = THREE.SRGBColorSpace;

        const ringGeo = new THREE.RingGeometry(inner, outer, 128);
        // Fix UVs to go from inner to outer
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getY(i);
            const dist = Math.sqrt(x * x + z * z);
            uv.setXY(i, (dist - inner) / (outer - inner), 0.5);
        }

        const ringMat = new THREE.MeshStandardMaterial({
            map: ringTex,
            side: THREE.DoubleSide,
            transparent: true,
            roughness: 0.9,
            metalness: 0.0,
            depthWrite: false,
        });

        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.receiveShadow = true;
        this.mesh.add(ringMesh);
    }

    _createMoons() {
        this.data.moons.forEach(moonData => {
            const moonGeo = new THREE.SphereGeometry(moonData.visualRadius, 24, 16);

            let moonMat;
            const moonTexCanvas = generatePlanetTexture(moonData.name);
            if (moonTexCanvas) {
                const tex = new THREE.CanvasTexture(moonTexCanvas);
                tex.colorSpace = THREE.SRGBColorSpace;
                moonMat = new THREE.MeshStandardMaterial({
                    map: tex,
                    roughness: 0.9,
                    metalness: 0.05,
                });
            } else {
                moonMat = new THREE.MeshStandardMaterial({
                    color: moonData.colorHex,
                    roughness: 0.9,
                    metalness: 0.1,
                });
            }

            const moonMesh = new THREE.Mesh(moonGeo, moonMat);
            moonMesh.castShadow = true;

            const moonObj = {
                mesh: moonMesh,
                data: moonData,
                angle: Math.random() * Math.PI * 2,
            };
            this.moons.push(moonObj);
            this.group.add(moonMesh);
        });
    }

    _createOrbit() {
        const r = this.data.visualDistance;
        const inc = (this.data.inclination || 0) * Math.PI / 180;
        const points = [];
        const segments = 256;

        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta) * r;
            const y = Math.sin(theta) * Math.sin(inc) * r;
            const z = Math.sin(theta) * Math.cos(inc) * r;
            points.push(new THREE.Vector3(x, y, z));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0x4488cc,
            transparent: true,
            opacity: 0.12,
        });

        this.orbitLine = new THREE.Line(geo, mat);
        this.scene.add(this.orbitLine);
    }

    _createLabel() {
        const div = document.createElement('div');
        div.className = 'planet-label';
        div.textContent = this.data.name;
        const label = new CSS2DObject(div);

        const offset = this.data.type === 'star'
            ? this.data.visualRadius * 1.15
            : this.data.visualRadius * 1.6 + 1;
        label.position.set(0, offset, 0);

        this.label = label;
        this.labelElement = div;
        this.group.add(label);
    }

    // ── Update ───────────────────────────────────

    update(deltaTime, speedMultiplier = 1) {
        // Sun animation
        if (this.data.type === 'star') {
            if (this.sunTimeUniform) {
                this.sunTimeUniform.value += deltaTime;
            }
            this.mesh.rotation.y += deltaTime * 0.03;
            return;
        }

        // Orbital motion
        if (this.data.visualDistance > 0) {
            this.angle += this.orbitalSpeed * speedMultiplier * deltaTime;
            const r = this.data.visualDistance;
            const inc = (this.data.inclination || 0) * Math.PI / 180;
            const x = Math.cos(this.angle) * r;
            const y = Math.sin(this.angle) * Math.sin(inc) * r;
            const z = Math.sin(this.angle) * Math.cos(inc) * r;
            this.group.position.set(x, y, z);
        }

        // Axial rotation — Earth completes ~1 rotation per 10s at 1× speed
        const earthHours = 23.93;
        const rotDir = this.data.rotationPeriodHours < 0 ? -1 : 1;
        const rotRate = (Math.PI * 2 / 10) * (earthHours / Math.abs(this.data.rotationPeriodHours));
        this.mesh.rotation.y += rotDir * rotRate * deltaTime * speedMultiplier;

        // Cloud rotation (slightly different speed)
        if (this.cloudMesh) {
            this.cloudMesh.rotation.y += deltaTime * speedMultiplier * 0.015;
        }

        // Moon orbits
        this.moons.forEach(moon => {
            const moonSpeed = (2 * Math.PI) / (Math.abs(moon.data.orbitalPeriodDays) * 2); // sped up for visibility
            const dir = moon.data.orbitalPeriodDays < 0 ? -1 : 1;
            moon.angle += dir * moonSpeed * speedMultiplier * deltaTime;
            const mr = moon.data.visualDistance;
            moon.mesh.position.set(
                Math.cos(moon.angle) * mr,
                0,
                Math.sin(moon.angle) * mr
            );
        });
    }

    setOrbitVisible(v) { if (this.orbitLine) this.orbitLine.visible = v; }
    setLabelVisible(v) { if (this.labelElement) this.labelElement.style.display = v ? '' : 'none'; }
}

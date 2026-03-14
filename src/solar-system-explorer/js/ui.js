import * as THREE from 'three';

// ─── UI Manager ──────────────────────────────────────────────────────────────

export class UIManager {
    constructor(planets, camera, controls) {
        this.planets = planets;
        this.camera = camera;
        this.controls = controls;

        this.selectedPlanet = null;
        this.focusedGroup = null;
        this.orbitsVisible = true;
        this.labelsVisible = true;
        this.speedMultiplier = 1;
        this.paused = false;
        this.cameraAnimating = false;

        // Animation state for camera transitions
        this._camFrom = new THREE.Vector3();
        this._camTo = new THREE.Vector3();
        this._targetFrom = new THREE.Vector3();
        this._targetTo = new THREE.Vector3();
        this._animProgress = 0;
        this._animDuration = 1.2; // seconds

        this._cacheElements();
        this._buildNavigation();
        this._bindEvents();
    }

    _cacheElements() {
        this.infoPanel = document.getElementById('info-panel');
        this.planetNameEl = document.getElementById('planet-name');
        this.planetTypeEl = document.getElementById('planet-type');
        this.planetDotEl = document.getElementById('planet-dot');
        this.planetDescEl = document.getElementById('planet-desc');
        this.planetFactsEl = document.getElementById('planet-facts');
        this.statDistance = document.getElementById('stat-distance');
        this.statRadius = document.getElementById('stat-radius');
        this.statPeriod = document.getElementById('stat-period');
        this.statDay = document.getElementById('stat-day');
        this.statTemp = document.getElementById('stat-temp');
        this.statMoons = document.getElementById('stat-moons');
        this.speedLabel = document.getElementById('speed-label');
    }

    _buildNavigation() {
        const nav = document.getElementById('planet-nav');
        this.planets.forEach((planet, index) => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn' + (planet.data.type === 'star' ? ' sun-btn' : '');
            btn.innerHTML = `
                <span class="nav-dot" style="background:${planet.data.color};"></span>
                <span>${planet.data.name}</span>
            `;
            btn.addEventListener('click', () => this.selectPlanet(planet));
            btn.dataset.planetIndex = index;
            nav.appendChild(btn);
        });
        this.navButtons = nav.querySelectorAll('.nav-btn');
    }

    _bindEvents() {
        // Close info
        document.getElementById('close-info').addEventListener('click', () => this.deselect());

        // Toggle orbits
        const orbBtn = document.getElementById('toggle-orbits');
        orbBtn.addEventListener('click', () => {
            this.orbitsVisible = !this.orbitsVisible;
            orbBtn.classList.toggle('active', this.orbitsVisible);
            this.planets.forEach(p => p.setOrbitVisible(this.orbitsVisible));
        });

        // Toggle labels
        const lblBtn = document.getElementById('toggle-labels');
        lblBtn.addEventListener('click', () => {
            this.labelsVisible = !this.labelsVisible;
            lblBtn.classList.toggle('active', this.labelsVisible);
            this.planets.forEach(p => p.setLabelVisible(this.labelsVisible));
        });

        // Speed controls
        document.getElementById('speed-up').addEventListener('click', () => this._changeSpeed(1));
        document.getElementById('speed-down').addEventListener('click', () => this._changeSpeed(-1));
        document.getElementById('speed-pause').addEventListener('click', () => this._togglePause());

        // Reset camera
        document.getElementById('reset-camera').addEventListener('click', () => this.resetCamera());

        // Keyboard
        window.addEventListener('keydown', (e) => this._onKeyDown(e));
    }

    _changeSpeed(dir) {
        if (this.paused) this._togglePause();
        const speeds = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50];
        const cur = speeds.indexOf(this.speedMultiplier);
        let next;
        if (cur === -1) {
            next = dir > 0 ? 3 : 3; // default to 1×
        } else {
            next = Math.max(0, Math.min(speeds.length - 1, cur + dir));
        }
        this.speedMultiplier = speeds[next];
        this._updateSpeedLabel();
    }

    _togglePause() {
        this.paused = !this.paused;
        const btn = document.getElementById('speed-pause');
        btn.textContent = this.paused ? '▶️' : '⏸';
        this._updateSpeedLabel();
    }

    _updateSpeedLabel() {
        if (this.paused) {
            this.speedLabel.textContent = 'PAUSED';
        } else {
            this.speedLabel.textContent = this.speedMultiplier + '×';
        }
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') this.deselect();
        if (e.key === 'r' || e.key === 'R') this.resetCamera();
        if (e.key === 'o' || e.key === 'O') document.getElementById('toggle-orbits').click();
        if (e.key === 'l' || e.key === 'L') document.getElementById('toggle-labels').click();
        if (e.key === ' ') { e.preventDefault(); this._togglePause(); }
        if (e.key === 'ArrowRight') this._changeSpeed(1);
        if (e.key === 'ArrowLeft') this._changeSpeed(-1);

        // Number keys 1-9 for planet selection
        const num = parseInt(e.key);
        if (num >= 1 && num <= this.planets.length) {
            this.selectPlanet(this.planets[num - 1]);
        }
    }

    // ── Planet Selection ─────────────────────────

    selectPlanet(planet) {
        this.selectedPlanet = planet;
        this.focusedGroup = planet.group;

        // Update nav
        this.navButtons.forEach((btn, i) => {
            btn.classList.toggle('active', i === this.planets.indexOf(planet));
        });

        // Update info panel
        const d = planet.data;
        this.planetNameEl.textContent = d.name;
        this.planetTypeEl.textContent = d.classification || d.type;
        this.planetDotEl.style.background = d.color;
        this.planetDotEl.style.boxShadow = `0 0 8px ${d.color}`;
        this.planetDescEl.textContent = d.description;
        this.planetFactsEl.textContent = d.facts;
        this.statDistance.textContent = d.distanceDisplay || '—';
        this.statRadius.textContent = d.radiusDisplay || '—';
        this.statPeriod.textContent = d.periodDisplay || '—';
        this.statDay.textContent = d.dayLength || '—';
        this.statTemp.textContent = d.temperature || '—';
        this.statMoons.textContent = d.moonCount || '—';
        this.infoPanel.classList.remove('hidden');

        // Animate camera to planet
        this._animateCameraTo(planet);
    }

    deselect() {
        this.selectedPlanet = null;
        this.focusedGroup = null;
        this.infoPanel.classList.add('hidden');
        this.navButtons.forEach(btn => btn.classList.remove('active'));
    }

    resetCamera() {
        this.deselect();
        this._camFrom.copy(this.camera.position);
        this._targetFrom.copy(this.controls.target);
        this._camTo.set(80, 200, 350);
        this._targetTo.set(0, 0, 0);
        this._animProgress = 0;
        this.cameraAnimating = true;
    }

    // ── Camera Animation ─────────────────────────

    _animateCameraTo(planet) {
        const pos = planet.group.position.clone();
        const r = planet.data.visualRadius;

        // Camera offset based on planet size
        const dist = Math.max(r * 5, 15);
        const offset = new THREE.Vector3(dist * 0.7, dist * 0.5, dist);

        this._camFrom.copy(this.camera.position);
        this._targetFrom.copy(this.controls.target);
        this._camTo.copy(pos).add(offset);
        this._targetTo.copy(pos);
        this._animProgress = 0;
        this.cameraAnimating = true;
    }

    updateCameraAnimation(dt) {
        if (!this.cameraAnimating) {
            // Follow selected planet
            if (this.focusedGroup) {
                this.controls.target.lerp(this.focusedGroup.position, 0.05);
            }
            return;
        }

        this._animProgress += dt / this._animDuration;
        if (this._animProgress >= 1) {
            this._animProgress = 1;
            this.cameraAnimating = false;
        }

        // Smooth easing
        const t = this._easeInOutCubic(this._animProgress);

        this.camera.position.lerpVectors(this._camFrom, this._camTo, t);
        this.controls.target.lerpVectors(this._targetFrom, this._targetTo, t);
    }

    _easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    getEffectiveSpeed() {
        return this.paused ? 0 : this.speedMultiplier;
    }
}

// ─── Raycaster for click detection ───────────────────────────────────────────

export function setupRaycaster(camera, renderer, planets, uiManager) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Collect all clickable meshes
    function getMeshes() {
        const meshes = [];
        planets.forEach(p => {
            meshes.push(p.mesh);
        });
        return meshes;
    }

    renderer.domElement.addEventListener('click', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(getMeshes(), true);

        if (intersects.length > 0) {
            // Find the planet whose mesh (or child) was hit
            let hit = intersects[0].object;
            while (hit && !hit.userData.isPlanet) {
                hit = hit.parent;
            }
            if (hit && hit.userData.isPlanet) {
                const planet = planets.find(p => p.mesh === hit);
                if (planet) uiManager.selectPlanet(planet);
            }
        }
    });
}

// ─── Loading Screen ──────────────────────────────────────────────────────────

export function updateLoadingProgress(pct, status) {
    const bar = document.getElementById('loading-bar');
    const text = document.getElementById('loading-status');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = status;
}

export function hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    const ui = document.getElementById('ui-container');
    if (screen) {
        screen.classList.add('fade-out');
        setTimeout(() => { screen.style.display = 'none'; }, 900);
    }
    if (ui) {
        setTimeout(() => { ui.classList.add('visible'); }, 400);
    }
}

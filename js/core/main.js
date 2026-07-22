// @ts-check
/**
 * Main application entry point.
 * Initializes and orchestrates all modules.
 */

import { SceneManager } from './scene.js';
import { ObjectFactory } from '../factories/objects.js';
import { InteractionManager } from './interactions.js';
import { initOrientationDetection } from '../systems/orientation.js';
import { createPerfMonitor } from '../systems/utils.js';

// Render-on-demand tuning (Phase 1). The scene is idle almost all the time —
// dust drift, film grain, and coffee steam are the only things moving, and
// none of them need display-refresh-rate updates to read as continuous.
const INTERACTION_TIMEOUT_MS = 500; // How long to keep rendering at full rate after the last change.
const IDLE_FRAME_INTERVAL_MS = 1000 / 30; // Cadence for ambient-only frames once idle.

class Portfolio3D {
    constructor() {
        /** @type {import('./scene.js').SceneManager | null} */ this.sceneManager = null;
        /** @type {import('../factories/objects.js').ObjectFactory | null} */ this.objectFactory = null;
        /** @type {import('./interactions.js').InteractionManager | null} */ this.interactionManager = null;
        /** @type {THREE.Object3D | null} */ this._coffeeMug = null;
        /** @type {THREE.Object3D | null} */ this._clock = null;
        /** @type {THREE.Object3D | null} */ this._monitor = null;

        // Render-on-demand state (Phase 1)
        this._lastInteractionTime = 0; // 0 keeps the reveal frame(s) rendering at full rate.
        this._lastRenderTime = 0;
        this._bloomDirty = true;
        this._rafId = null;

        // Dev-only frame profiler (Phase 0), enabled via `?perf=1`. Created in
        // init() once the renderer exists.
        this._perfEnabled = new URLSearchParams(window.location.search).get('perf') === '1';
        /** @type {(() => void) | null} */
        this._perfUpdate = null;
    }

    /**
     * Notify the render-on-demand loop that a frame is needed. Called from
     * OrbitControls' `change` event, GSAP camera/UI tweens, hover-light changes,
     * monitor scroll, clock redraws, and the day/night cycle.
     * @param {boolean} [bloomAffecting] - True when the change touches
     *   bloom-layer content or moves the camera, so the bloom composer needs
     *   to re-render this frame too (see `SceneManager.render`).
     */
    requestRender(bloomAffecting = true) {
        this._lastInteractionTime = performance.now();
        if (bloomAffecting) this._bloomDirty = true;
    }

    async init() {
        this.sceneManager = new SceneManager();
        const { scene: _scene, camera, controls } = this.sceneManager.init();
        const scene = /** @type {THREE.Scene} */ (_scene);

        // Pass lightingSystem to ObjectFactory for dynamic glare materials
        this.objectFactory = new ObjectFactory(
            scene,
            /** @type {null | undefined} */ (this.sceneManager.lightingSystem),
            this.sceneManager.loadingManager
        );
        const interactiveObjects = await this.objectFactory.createAllObjects();

        // Fit the sun's shadow frustum to actual scene bounds now that every object exists.
        this.sceneManager.lightingSystem?.fitMainShadowToScene(scene);

        // Wait for the env map, floor, diploma, and vinyl textures to actually finish
        // loading before revealing the scene, so nothing pops in after the fade.
        await this.sceneManager.waitForAssets();

        this.interactionManager = new InteractionManager(
            /** @type {THREE.PerspectiveCamera} */ (camera),
            /** @type {import('three').OrbitControls} */ (controls),
            interactiveObjects, scene,
            (bloomAffecting) => this.requestRender(bloomAffecting)
        );

        // OrbitControls fires 'change' on every user drag step and on each damping
        // settle step afterward — exactly the signal the render-on-demand loop
        // needs to know the camera moved.
        /** @type {import('three').OrbitControls} */ (controls).addEventListener(
            'change', () => this.requestRender(true)
        );

        // Pause rendering entirely while the tab is hidden; resume on return.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this._rafId !== null) cancelAnimationFrame(this._rafId);
                this._rafId = null;
            } else if (this._rafId === null) {
                this.requestRender(true);
                this.animate();
            }
        });

        // Cache frequently-accessed objects
        /** @param {string} name @returns {THREE.Object3D | null} */
        const findByName = (name) => {
            // Search scene children first
            for (const child of scene.children) {
                if (child.userData?.name === name) return child;
            }
            // Also search interactiveObjects (some objects may only be there)
            for (const obj of interactiveObjects) {
                if (obj.userData?.name === name) return obj;
            }
            return null;
        };
        this._coffeeMug = findByName('coffee');
        this._clock = findByName('clock');
        this._monitor = findByName('monitor');

        // Force full render while loading screen is visible (compiles shaders + uploads to GPU),
        // populating the shadow maps before we freeze them.
        this.sceneManager.render();
        this.sceneManager.freezeShadowMap();
        this.hideLoadingScreen();

        // Finalize objects that need post-render setup (e.g., light targeting)
        this.objectFactory.finalizeObjects();

        // Build hint-glow outlines after finalizeObjects() so world matrices are final.
        // Unlike the old OutlinePass this doesn't depend on the lazy-loaded postfx
        // bundle at all, so it no longer needs to wait on postFXReady.
        this.interactionManager.initHintOutline(interactiveObjects);

        if (this._perfEnabled && this.sceneManager.renderer) {
            this._perfUpdate = createPerfMonitor(this.sceneManager.renderer);
        }

        this.animate();
    }

    /**
     * Hide the loading screen with smooth fade
     */
    hideLoadingScreen() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            // CSS transitions opacity/visibility on .loading-hidden (see styles.css)
            loadingElement.classList.add('loading-hidden');
            loadingElement.addEventListener('transitionend', () => {
                loadingElement.style.display = 'none';
            }, { once: true });
        }
    }

    /**
     * Render-on-demand loop (Phase 1). Ambient effects (dust, grain, steam)
     * animate continuously, so frames never fully stop — but they're throttled
     * to IDLE_FRAME_INTERVAL_MS once nothing has changed for INTERACTION_TIMEOUT_MS,
     * instead of running the whole pipeline at display refresh rate forever.
     */
    animate() {
        this._rafId = requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const interacting = now - this._lastInteractionTime < INTERACTION_TIMEOUT_MS;
        const frameInterval = interacting ? 0 : IDLE_FRAME_INTERVAL_MS;
        if (now - this._lastRenderTime < frameInterval) return;
        this._lastRenderTime = now;

        this.updateAnimations();
        this.sceneManager?.render(this._bloomDirty);
        this._bloomDirty = false;

        this._perfUpdate?.();
    }

    /**
     * Update all animated elements each frame
     */
    updateAnimations() {
        // sceneManager is guaranteed non-null after init(); narrow for type checker
        const sm = /** @type {import('./scene.js').SceneManager} */ (this.sceneManager);
        if (sm.lightingSystem && sm.camera) {
            const dayNightChanged = sm.lightingSystem.update(sm.camera);
            if (dayNightChanged) this.requestRender(false);
        }
        sm.updateDustParticles();
        sm.updateFilmGrain();

        // Animate coffee steam (using cached reference)
        if (this._coffeeMug?.userData.animateSteam) {
            this._coffeeMug.userData.animateSteam.call(this._coffeeMug);
        }

        // Update digital clock (using cached reference)
        if (this._clock?.userData.updateTime) {
            const clockChanged = this._clock.userData.updateTime();
            if (clockChanged) this.requestRender(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initOrientationDetection();

    const portfolio = new Portfolio3D();
    window._portfolio = portfolio;
    await portfolio.init();
});

window.Portfolio3D = Portfolio3D;

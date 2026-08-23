// @ts-check
/**
 * Main application entry point.
 * Initializes and orchestrates all modules.
 */

import { SceneManager } from './scene.js';
import { ObjectFactory } from '../factories/objects.js';
import { InteractionManager } from './interactions.js';
import { SemanticPortfolioController } from './accessibility.js';
import { createPerfMonitor, isMobileDevice } from '../systems/utils.js';

// The semantic portfolio is an alternate view once the visual experience is
// running. Leaving this class off until the module executes preserves the
// semantic page as a no-JavaScript fallback.
document.body.classList.add('js-enabled');

/** @typedef {import('three/webgpu').Object3D} Object3D */
/** @typedef {import('three/webgpu').Scene} Scene */
/** @typedef {import('three/webgpu').PerspectiveCamera} PerspectiveCamera */

// Render-on-demand tuning (Phase 1). The scene is idle almost all the time —
// dust drift, film grain, and coffee steam are the only things moving, and
// none of them need display-refresh-rate updates to read as continuous.
const INTERACTION_TIMEOUT_MS = 500; // How long to keep rendering at full rate after the last change.
const IDLE_FRAME_INTERVAL_MS = 1000 / 30; // Cadence for ambient-only frames once idle.
const DEEP_IDLE_TIMEOUT_MS = 60000; // Tab-visible but unattended for about a minute.
const DEEP_IDLE_FRAME_INTERVAL_MS = 1000 / 10; // Preserve motion while reducing battery/thermals.

// Adaptive quality tuning (Phase 6). Measures actual render() cost -- not the
// idle-throttled frame cadence above, which is deliberately slow and would
// otherwise look like a slow device. A device that needs to step down usually
// needs it within the first couple of tiers, so this only ever steps down,
// never back up.
const QUALITY_SAMPLE_SIZE = 60; // render() calls averaged per tier evaluation.
const QUALITY_FRAME_BUDGET_MS = 20; // ~50fps; above this, step down a tier.
const QUALITY_FRAME_INTERVAL_BUDGET_MS = 22; // GPU/vsync budget; catches missed frames.
const MIN_GPU_INTERVAL_SAMPLES = 30; // Require a real interaction window before judging GPU pacing.
const QUALITY_TIER_ORDER = /** @type {const} */ (['high', 'medium', 'low']);

class Portfolio3D {
    constructor() {
        /** @type {import('./scene.js').SceneManager | null} */ this.sceneManager = null;
        /** @type {import('../factories/objects.js').ObjectFactory | null} */ this.objectFactory = null;
        /** @type {import('./interactions.js').InteractionManager | null} */ this.interactionManager = null;
        this.semanticPortfolio = new SemanticPortfolioController();
        /** @type {Object3D | null} */ this._coffeeMug = null;
        /** @type {Object3D | null} */ this._clock = null;

        // Render-on-demand state (Phase 1)
        this._lastInteractionTime = 0; // 0 keeps the reveal frame(s) rendering at full rate.
        this._lastRenderTime = 0;
        this._lastLoopTime = 0;
        this._animationLoopActive = false;
        this._ambientTimer = null;

        // Dev-only frame profiler (Phase 0), enabled via `?perf=1`. Created in
        // init() once the renderer exists.
        this._perfEnabled = new URLSearchParams(window.location.search).get('perf') === '1';
        /** @type {(() => void) | null} */
        this._perfUpdate = null;

        // Adaptive quality tier detection (Phase 6). Runs for every session
        // (unlike the perf monitor above), sampling real render() duration until
        // either a tier proves fast enough or 'low' is reached.
        /** @type {number[]} */
        this._qualitySamples = [];
        /** @type {number[]} */
        this._qualityFrameIntervals = [];
        this._hasUserActivity = false;
        this._qualityEvalDone = false;

        // Mobile orientation hint: shown once after the reveal if the camera has
        // not moved, then dismissed as soon as the user looks around.
        this._lookAroundHintTimer = null;
        this._lookAroundHintDismissed = false;
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Notify the render-on-demand loop that user input occurred.
     */
    requestRender() {
        this._lastInteractionTime = performance.now();
        this._hasUserActivity = true;
        if (!this._animationLoopActive && !document.hidden) this.animate();
    }

    async init() {
        this.sceneManager = new SceneManager();
        const { scene: _scene, camera, controls } = await this.sceneManager.init();
        const scene = /** @type {Scene} */ (_scene);

        // Pass lightingSystem to ObjectFactory for dynamic glare materials
        this.objectFactory = new ObjectFactory(
            scene,
            /** @type {null | undefined} */ (this.sceneManager.lightingSystem)
        );
        const interactiveObjects = await this.objectFactory.createAllObjects();

        // Fit the sun's shadow frustum to actual scene bounds now that every object exists.
        this.sceneManager.lightingSystem?.fitMainShadowToScene(scene);

        // Wait for the env map, floor, diploma, and vinyl textures to actually finish
        // loading before revealing the scene, so nothing pops in after the fade.
        await this.sceneManager.waitForAssets();

        this.interactionManager = new InteractionManager(
            /** @type {PerspectiveCamera} */ (camera),
            /** @type {import('three/addons/controls/OrbitControls.js').OrbitControls} */ (controls),
            interactiveObjects, scene,
            () => this.requestRender(),
            this.objectFactory.factories.technology.monitorRenderer,
            this.semanticPortfolio
        );

        // OrbitControls fires 'change' on every user drag step and on each damping
        // settle step afterward — exactly the signal the render-on-demand loop
        // needs to know the camera moved.
        /** @type {import('three/addons/controls/OrbitControls.js').OrbitControls} */ (controls).addEventListener(
            'change', () => this.requestRender()
        );
        /** @type {import('three/addons/controls/OrbitControls.js').OrbitControls} */ (controls).addEventListener(
            'change', () => this.dismissLookAroundHint()
        );

        // Pause rendering entirely while the tab is hidden; resume on return.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.sceneManager?.renderer?.setAnimationLoop(null);
                this._animationLoopActive = false;
                if (this._ambientTimer !== null) {
                    window.clearTimeout(this._ambientTimer);
                    this._ambientTimer = null;
                }
            } else if (!this._animationLoopActive) {
                this.animate();
            }
        });

        // Cache frequently-accessed objects
        /** @param {string} name @returns {Object3D | null} */
        const findByName = (name) => scene.children.find((child) => child.userData?.name === name) || null;
        this._coffeeMug = findByName('coffee');
        this._clock = findByName('clock');

        // Force full render while loading screen is visible (compiles shaders + uploads to GPU),
        // populating the shadow maps before we freeze them.
        this.sceneManager.render();
        this.sceneManager.freezeShadowMap();
        this.hideLoadingScreen();

        // Diploma frame + vinyl cover art (Phase 5.3): behind the initial camera,
        // so their loads start now instead of gating the reveal above.
        this.objectFactory.loadDeferredTextures();

        // Build hint-glow outlines after the deferred texture setup so world
        // matrices are final.
        // This outline is ordinary scene geometry, so it does not need a separate
        // post-processing pass or asynchronous effect bundle.
        this.interactionManager.initHintOutline(interactiveObjects);

        // Warm-up render (Phase 5.4): the hint-outline meshes above and the deferred
        // diploma/vinyl materials above didn't exist (or didn't have a map yet) at the
        // first forced render, so each needs its own shader variant compiled. Paying
        // that cost here — still inside init(), before animate() starts — means it
        // never lands on a frame the user is watching for a reaction to their input.
        this.sceneManager?.render();

        // Start the unattended timer after the reveal/warm-up work, rather than
        // treating startup as a 60-second-old idle session.
        this._lastInteractionTime = performance.now();
        this.markPortfolioReady();

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
            loadingElement.setAttribute('aria-hidden', 'true');
            loadingElement.addEventListener('transitionend', () => {
                loadingElement.style.display = 'none';
            }, { once: true });
        }

        this.scheduleLookAroundHint();
    }

    /** Mark the semantic experience ready once the visual layer has completed. */
    markPortfolioReady() {
        document.getElementById('portfolio-content')?.setAttribute('aria-busy', 'false');
    }

    /**
     * Reveal a semantic fallback when neither the WebGPU nor WebGL2 backend can
     * initialize. This keeps the failure actionable instead of leaving users
     * on the boot screen indefinitely.
     * @param {unknown} error
     */
    showFallback(error) {
        console.error('Portfolio renderer failed to initialize.', error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
            loadingElement.setAttribute('aria-hidden', 'true');
        }

        document.body.classList.add('no-webgl');
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.hidden = true;
            canvasContainer.setAttribute('aria-hidden', 'true');
        }
        this.markPortfolioReady();

        const fallback = document.getElementById('non-webgl-fallback');
        if (fallback) {
            fallback.hidden = false;
            fallback.setAttribute('aria-live', 'polite');
        }

        document.getElementById('portfolio-title')?.focus();
    }

    /**
     * Give touch users a short orientation prompt if they remain idle after
     * the loading screen has cleared. Desktop users keep the existing UI.
     */
    scheduleLookAroundHint() {
        if (!isMobileDevice() || this.reducedMotion) return;

        this._lookAroundHintTimer = window.setTimeout(() => {
            if (this._lookAroundHintDismissed) return;
            const hint = document.getElementById('look-around-hint');
            if (!hint) return;
            hint.classList.add('look-around-hint-visible');
            hint.setAttribute('aria-hidden', 'false');
        }, 3600); // 600ms loading fade + 3s of idle time
    }

    /** Hide the prompt permanently once the user starts moving the camera. */
    dismissLookAroundHint() {
        if (this._lookAroundHintDismissed) return;
        this._lookAroundHintDismissed = true;
        if (this._lookAroundHintTimer !== null) {
            window.clearTimeout(this._lookAroundHintTimer);
            this._lookAroundHintTimer = null;
        }

        const hint = document.getElementById('look-around-hint');
        if (hint) {
            hint.classList.remove('look-around-hint-visible');
            hint.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Render-on-demand loop (Phase 1). Ambient effects (dust, grain, steam)
     * animate continuously, so frames never fully stop — but they're throttled to
     * 30 fps when recently idle and 10 fps after a minute without user activity.
     */
    animate() {
        const renderer = this.sceneManager?.renderer;
        if (!renderer || this._animationLoopActive) return;
        if (this._ambientTimer !== null) {
            window.clearTimeout(this._ambientTimer);
            this._ambientTimer = null;
        }
        this._animationLoopActive = true;
        renderer.setAnimationLoop(() => this.renderFrame());
    }

    /** @param {number} delay */
    scheduleAmbientFrame(delay) {
        if (document.hidden || this._ambientTimer !== null) return;
        this._ambientTimer = window.setTimeout(() => {
            this._ambientTimer = null;
            if (document.hidden) return;
            this.renderFrame();
        }, delay);
    }

    renderFrame() {

        const now = performance.now();
        const loopInterval = this._lastLoopTime === 0 ? 0 : now - this._lastLoopTime;
        this._lastLoopTime = now;
        const idleDuration = now - this._lastInteractionTime;
        const interacting = idleDuration < INTERACTION_TIMEOUT_MS;
        const deepIdle = idleDuration >= DEEP_IDLE_TIMEOUT_MS;
        const frameInterval = interacting ? 0 : deepIdle ? DEEP_IDLE_FRAME_INTERVAL_MS : IDLE_FRAME_INTERVAL_MS;

        if (!this._qualityEvalDone && this._hasUserActivity && interacting && loopInterval > 0 && loopInterval < 1000) {
            this._qualityFrameIntervals.push(loopInterval);
        }
        if (now - this._lastRenderTime < frameInterval) {
            if (!this._animationLoopActive && !document.hidden) {
                this.scheduleAmbientFrame(frameInterval - (now - this._lastRenderTime));
            }
            return;
        }
        this._lastRenderTime = now;

        this.updateAnimations();

        const renderStart = this._qualityEvalDone ? 0 : performance.now();
        this.sceneManager?.render();
        if (!this._qualityEvalDone) this._sampleQualityTier(performance.now() - renderStart);

        this._perfUpdate?.();

        // Keep the display-rate loop only for interaction. Ambient motion uses
        // a timer at the already-selected cadence once the camera settles.
        if (idleDuration >= INTERACTION_TIMEOUT_MS && this._animationLoopActive) {
            this.sceneManager?.renderer?.setAnimationLoop(null);
            this._animationLoopActive = false;
            this.scheduleAmbientFrame(frameInterval || IDLE_FRAME_INTERVAL_MS);
        } else if (!this._animationLoopActive && !document.hidden) {
            this.scheduleAmbientFrame(frameInterval || IDLE_FRAME_INTERVAL_MS);
        }
    }

    /**
     * Startup adaptive-quality tier detection (Phase 6). Averages real render()
     * duration over QUALITY_SAMPLE_SIZE calls; if the average is over budget,
     * steps the scene down one tier and starts a fresh sample window for that
     * tier. Stops evaluating once a tier is fast enough, or once 'low' -- the
     * floor -- has been reached.
     * @param {number} renderMs
     */
    _sampleQualityTier(renderMs) {
        this._qualitySamples.push(renderMs);
        if (this._qualitySamples.length < QUALITY_SAMPLE_SIZE) return;

        const avg = this._qualitySamples.reduce((sum, t) => sum + t, 0) / this._qualitySamples.length;
        this._qualitySamples.length = 0;

        const hasGpuSamples = this._qualityFrameIntervals.length >= MIN_GPU_INTERVAL_SAMPLES;
        const avgFrameInterval = hasGpuSamples
            ? this._qualityFrameIntervals.reduce((sum, t) => sum + t, 0) / this._qualityFrameIntervals.length
            : 0;
        this._qualityFrameIntervals.length = 0;

        const currentTier = this.sceneManager?.qualityTier ?? 'high';
        const currentIndex = QUALITY_TIER_ORDER.indexOf(currentTier);
        const isLastTier = currentIndex >= QUALITY_TIER_ORDER.length - 1;

        const cpuTooSlow = avg > QUALITY_FRAME_BUDGET_MS;
        const gpuTooSlow = hasGpuSamples && avgFrameInterval > QUALITY_FRAME_INTERVAL_BUDGET_MS;

        if (isLastTier) {
            this._qualityEvalDone = true;
            return;
        }

        // A fast CPU sample without an interaction interval is inconclusive for a
        // GPU-bound device. Keep sampling until the user gives us a real frame window.
        if (!cpuTooSlow && !gpuTooSlow && !hasGpuSamples) return;

        if (!cpuTooSlow && !gpuTooSlow) {
            this._qualityEvalDone = true;
            return;
        }

        // currentIndex + 1 is always 'medium' or 'low' here: isLastTier above
        // already returned for currentIndex at the 'low' end of the order.
        const nextTier = /** @type {'medium' | 'low'} */ (QUALITY_TIER_ORDER[currentIndex + 1]);
        this.sceneManager?.applyQualityTier(nextTier);
    }

    /**
     * Update all animated elements each frame
     */
    updateAnimations() {
        // sceneManager is guaranteed non-null after init(); narrow for type checker
        const sm = /** @type {import('./scene.js').SceneManager} */ (this.sceneManager);
        if (!this.reducedMotion && sm.lightingSystem) {
            sm.lightingSystem.update();
        }
        if (!this.reducedMotion) {
            sm.updateDustParticles();
        }

        // Animate coffee steam (using cached reference)
        if (!this.reducedMotion && this._coffeeMug?.userData.animateSteam) {
            this._coffeeMug.userData.animateSteam.call(this._coffeeMug);
        }

        // Update digital clock (using cached reference)
        if (this._clock?.userData.updateTime) {
            this._clock.userData.updateTime();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Give the browser two compositor opportunities to commit the opaque boot
    // screen before WebGL setup starts competing for the main thread/GPU.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const portfolio = new Portfolio3D();
    window._portfolio = portfolio;
    // Manual verification hook for the documented no-WebGL test path.
    if (new URLSearchParams(window.location.search).get('fallback') === '1') {
        portfolio.showFallback(new Error('Forced fallback test'));
        return;
    }
    try {
        await portfolio.init();
    } catch (error) {
        portfolio.showFallback(error);
    }
});

window.Portfolio3D = Portfolio3D;

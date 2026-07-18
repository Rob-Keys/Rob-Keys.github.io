// @ts-check
/**
 * Main application entry point.
 * Initializes and orchestrates all modules.
 */

import { SceneManager } from './scene.js';
import { ObjectFactory } from '../factories/objects.js';
import { InteractionManager } from './interactions.js';

class Portfolio3D {
    constructor() {
        /** @type {import('./scene.js').SceneManager | null} */ this.sceneManager = null;
        /** @type {import('../factories/objects.js').ObjectFactory | null} */ this.objectFactory = null;
        /** @type {import('./interactions.js').InteractionManager | null} */ this.interactionManager = null;
        /** @type {THREE.Object3D | null} */ this._coffeeMug = null;
        /** @type {THREE.Object3D | null} */ this._clock = null;
        /** @type {THREE.Object3D | null} */ this._monitor = null;
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

        this.interactionManager = new InteractionManager(camera, controls, interactiveObjects, scene);

        // Post-processing (bloom/SSAO/outline) loads async in the background, so the
        // outline pass may not exist yet — wire it up once it does, whenever that is.
        this.sceneManager.postFXReady?.then(() => {
            const outlinePass = this.sceneManager?.getOutlinePass();
            if (outlinePass && this.interactionManager) {
                this.interactionManager.setOutlinePass(outlinePass, interactiveObjects);
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

    animate() {
        requestAnimationFrame(() => this.animate());
        this.updateAnimations();
        this.sceneManager?.render();
    }

    /**
     * Update all animated elements each frame
     */
    updateAnimations() {
        // sceneManager is guaranteed non-null after init(); narrow for type checker
        const sm = /** @type {import('./scene.js').SceneManager} */ (this.sceneManager);
        if (sm.lightingSystem && sm.camera) {
            sm.lightingSystem.update(sm.camera);
        }

        // Animate coffee steam (using cached reference)
        if (this._coffeeMug?.userData.animateSteam) {
            this._coffeeMug.userData.animateSteam.call(this._coffeeMug);
        }

        // Update digital clock (using cached reference)
        if (this._clock?.userData.updateTime) {
            this._clock.userData.updateTime();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const portfolio = new Portfolio3D();
    window._portfolio = portfolio;
    await portfolio.init();
});

window.Portfolio3D = Portfolio3D;

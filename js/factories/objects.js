// @ts-check
/**
 * Main Object Factory — orchestrates all object creation.
 * Imports and coordinates all modular object factories.
 */

import { FurnitureFactory } from './furniture.js';
import { TechnologyFactory } from './technology.js';
import { ShelfObjectFactory } from './shelf-objects.js';
import { DeskObjectFactory } from './desk-objects.js';
import { WallObjectFactory } from './wall-objects.js';

export class ObjectFactory {
    /**
     * @param {THREE.LoadingManager | null} [loadingManager]
     */
    constructor(scene, lightingSystem = null, loadingManager = null) {
        this.scene = scene;
        this.lightingSystem = lightingSystem;
        this.interactiveObjects = [];

        // Initialize modular factories
        this.factories = {
            furniture: new FurnitureFactory(scene),
            technology: new TechnologyFactory(scene, lightingSystem),
            shelf: new ShelfObjectFactory(scene),
            desk: new DeskObjectFactory(scene),
            wall: new WallObjectFactory(scene, loadingManager)
        };
    }

    /**
     * Add object to scene and optionally register as interactive.
     * @param {THREE.Object3D} object - The object to add
     * @param {boolean} interactive - Whether object is interactive
     */
    addToScene(object, interactive = false) {
        this.scene.add(object);
        if (interactive) {
            this.interactiveObjects.push(object);
        }
    }

    async createAllObjects() {
        const { furniture, technology, shelf, desk, wall } = this.factories;

        // Create all objects - interactive: true means clickable for zoom/info panel
        const objects = [
            // Furniture (non-interactive)
            { obj: furniture.createWall(), interactive: false },
            // { obj: furniture.createCeiling(), interactive: false },
            // { obj: furniture.createSideWalls(), interactive: false },
            { obj: furniture.createDesk(), interactive: false },
            { obj: furniture.createWallShelf(), interactive: false },
            // Wall objects
            { obj: wall.createWallDiploma(), interactive: true },
            { obj: wall.createVinylRecord(), interactive: false },
            // Shelf objects
            { obj: shelf.createShelfPlant(), interactive: false },
            { obj: shelf.createShelfBooks(), interactive: false },
            { obj: shelf.createTidbyt(), interactive: true },
            // Technology
            { obj: technology.createMonitor(), interactive: true },
            { obj: technology.createKeyboard(), interactive: false },
            { obj: technology.createMouse(), interactive: false },
            { obj: technology.createLaptop(), interactive: true },
            { obj: technology.createDigitalClock(), interactive: false },
            // Desk objects - coffee/lamp have animations but aren't clickable
            { obj: desk.createCoffeeMug(), interactive: false },
            { obj: desk.createNotebook(), interactive: true },
            { obj: desk.createDeskLamp(), interactive: false }
        ];

        objects.forEach(({ obj, interactive }) => this.addToScene(obj, interactive));

        return this.interactiveObjects;
    }

    /**
     * Finalize objects that need post-render setup (e.g., light targeting).
     * Call this after the first render when world matrices are computed.
     */
    finalizeObjects() {
        this.factories.wall.finalizeDiplomaLight();
    }

    /**
     * Kick off the deferred (post-reveal) texture loads -- diploma frame wood
     * grain and vinyl cover art (Phase 5.3). Call once, after the loading screen
     * has hidden.
     */
    loadDeferredTextures() {
        this.factories.wall.loadDeferredTextures();
    }

    /**
     * Get all created interactive objects.
     * @returns {THREE.Group[]} Array of interactive objects
     */
    getInteractiveObjects() {
        return this.interactiveObjects;
    }
}

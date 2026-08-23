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

/** @typedef {import('three/webgpu').Object3D} Object3D */

export class ObjectFactory {
    constructor(scene, lightingSystem = null) {
        this.scene = scene;
        this.interactiveObjects = [];

        // Initialize modular factories
        this.factories = {
            furniture: new FurnitureFactory(),
            technology: new TechnologyFactory(lightingSystem),
            shelf: new ShelfObjectFactory(),
            desk: new DeskObjectFactory(),
            wall: new WallObjectFactory()
        };
    }

    /**
     * Add object to scene and optionally register as interactive.
     * @param {Object3D} object - The object to add
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
            { obj: furniture.createCeiling(), interactive: false },
            { obj: furniture.createSideWalls(), interactive: false },
            { obj: furniture.createDesk(), interactive: false },
            { obj: furniture.createWallShelf(), interactive: false },
            // Wall objects
            { obj: wall.createWallDiploma(), interactive: true },
            { obj: wall.createVinylRecord(), interactive: true },
            // Shelf objects
            { obj: shelf.createShelfPlant(), interactive: true },
            { obj: shelf.createShelfBooks(), interactive: true },
            { obj: shelf.createTidbyt(), interactive: true },
            // Technology
            { obj: technology.createMonitor(), interactive: true },
            { obj: technology.createKeyboard(), interactive: true },
            { obj: technology.createMouse(), interactive: true },
            { obj: technology.createLaptop(), interactive: true },
            { obj: technology.createDigitalClock(), interactive: true },
            // Content-bearing desk objects are also available through the
            // semantic controls and therefore remain discoverable in the scene.
            { obj: desk.createCoffeeMug(), interactive: true },
            { obj: desk.createNotebook(), interactive: true },
            { obj: desk.createDeskLamp(), interactive: true }
        ];

        // Object creation includes geometry generation and 2D canvas drawing.
        // Yield between small batches so the boot screen can paint and animate
        // instead of waiting behind one long main-thread task.
        for (let i = 0; i < objects.length; i++) {
            const { obj, interactive } = objects[i];
            this.addToScene(obj, interactive);
            if ((i + 1) % 3 === 0) {
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }
        }

        return this.interactiveObjects;
    }

    /**
     * Kick off the deferred (post-reveal) texture loads -- diploma frame wood
     * grain and vinyl cover art. Call once, after the loading screen
     * has hidden.
     */
    loadDeferredTextures() {
        this.factories.wall.loadDeferredTextures();
    }

}

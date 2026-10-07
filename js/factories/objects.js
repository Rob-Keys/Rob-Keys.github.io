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
    constructor(scene, lightingSystem = null, loadingManager = undefined) {
        this.scene = scene;
        this.interactiveObjects = [];

        // Initialize modular factories
        this.factories = {
            furniture: new FurnitureFactory(loadingManager),
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

        // Only objects marked interactive below respond to pointer selection.
        const objects = [
            // Furniture (non-interactive)
            { create: () => furniture.createWall(), interactive: false },
            { create: () => furniture.createCeiling(), interactive: false },
            { create: () => furniture.createSideWalls(), interactive: false },
            { create: () => furniture.createDesk(), interactive: false },
            { create: () => furniture.createWallShelf(), interactive: false },
            // Wall objects
            { create: () => wall.createWallDiploma(), interactive: true },
            { create: () => wall.createVinylRecord(), interactive: false },
            // Shelf objects
            { create: () => shelf.createShelfPlant(), interactive: false },
            { create: () => shelf.createShelfBooks(), interactive: false },
            { create: () => shelf.createTidbyt(), interactive: true },
            // Technology
            { create: () => technology.createMonitor(), interactive: true },
            { create: () => technology.createMonitor(technology.origins.monitorRight), interactive: true },
            { create: () => technology.createMouse(), interactive: false },
            { create: () => technology.createLaptop(), interactive: true },
            { create: () => desk.createCoffeeMug(), interactive: false },
            { create: () => desk.createNotebook(), interactive: true },
            { create: () => desk.createDeskLamp(), interactive: false }
        ];

        // Object creation includes geometry generation and 2D canvas drawing.
        // Yield between small batches so the boot screen can paint and animate
        // instead of waiting behind one long main-thread task.
        for (let i = 0; i < objects.length; i++) {
            const { create, interactive } = objects[i];
            this.addToScene(create(), interactive);
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

    waitForAssets() {
        return this.factories.furniture.waitForTextures();
    }

}

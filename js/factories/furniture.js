// @ts-check
/**
 * Desk and Furniture creation
 * Handles desk, shelves, walls, and room structure
 * Uses progressive texture loading for fast initial render
 */

import { createSolidTexture, applyOrigin, createBeveledBox } from '../systems/utils.js';
import { OBJECT_ORIGINS } from '../config/config.js';

// Texture configuration for each material type
const TEXTURE_CONFIG = {
    wood: {
        basePath: 'assets/textures/wood_table_worn_',
        files: ['diff_4k_1k.webp', 'nor_gl_4k_1k.webp', 'rough_4k_1k.webp'],
        repeat: { x: 3, y: 2 },
        placeholder: { diffuse: [16, 10, 7], normal: [128, 128, 255], roughness: [200, 200, 200] }
    },
    wall: {
        basePath: 'assets/textures/plastered_wall_04_',
        files: ['diff_4k.webp', 'nor_gl_4k.webp', 'rough_4k.webp'],
        repeat: { x: 10, y: 4 },
        placeholder: { diffuse: [180, 180, 180], normal: [128, 128, 255], roughness: [242, 242, 242] }
    }
};

export class FurnitureFactory {
    constructor(scene) {
        this.scene = scene;

        // Use centralized origins from config
        this.origins = OBJECT_ORIGINS.furniture;

        this._textureCache = new Map();
        this._loadingPromises = new Map();

        // Texture state for each type
        this._textureState = {
            wood: { loaded: false, textures: null, pending: [] },
            wall: { loaded: false, textures: null, pending: [] }
        };

        // Create placeholder textures
        this._placeholders = {};
        for (const [type, config] of Object.entries(TEXTURE_CONFIG)) {
            const [dr, dg, db] = config.placeholder.diffuse;
            const [nr, ng, nb] = config.placeholder.normal;
            const [rr, rg, rb] = config.placeholder.roughness;
            this._placeholders[type] = {
                diffuse: createSolidTexture(dr, dg, db),
                normal: createSolidTexture(nr, ng, nb),
                roughness: createSolidTexture(rr, rg, rb)
            };
        }
    }

    _loadTexture(path) {
        if (this._textureCache.has(path)) {
            return Promise.resolve(this._textureCache.get(path));
        }
        if (this._loadingPromises.has(path)) {
            return this._loadingPromises.get(path);
        }

        const promise = new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(path, (texture) => {
                texture.encoding = THREE.sRGBEncoding;
                texture.flipY = false;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                this._textureCache.set(path, texture);
                this._loadingPromises.delete(path);
                resolve(texture);
            }, undefined, reject);
        });

        this._loadingPromises.set(path, promise);
        return promise;
    }

    _loadTexturesAsync(type) {
        const state = this._textureState[type];
        const config = TEXTURE_CONFIG[type];

        if (state.loaded || this._loadingPromises.has(type)) return;
        this._loadingPromises.set(type, Promise.resolve());

        requestAnimationFrame(() => setTimeout(() => {
            Promise.all(config.files.map(f => this._loadTexture(config.basePath + f)))
                .then(([diffuse, normal, roughness]) => {
                    [diffuse, normal, roughness].forEach(t => t.repeat.set(config.repeat.x, config.repeat.y));

                    state.textures = { diffuse, normal, roughness };
                    state.loaded = true;

                    state.pending.forEach(material => {
                        material.map = diffuse;
                        material.normalMap = normal;
                        if (material.userData.useRoughnessMap) material.roughnessMap = roughness;
                        material.needsUpdate = true;
                    });
                    state.pending = [];
                });
        }, 0));
    }

    /**
     * @param {string} type
     * @param {number} roughness
     * @param {number} metalness
     * @param {boolean} [useRoughnessMap]
     * @param {number | null} [color]
     */
    _createTexturedMaterial(type, roughness, metalness, useRoughnessMap = false, color = null) {
        const state = this._textureState[type];
        const textures = state.loaded ? state.textures : this._placeholders[type];

        const matProps = {
            map: textures.diffuse,
            normalMap: textures.normal,
            roughnessMap: useRoughnessMap ? textures.roughness : null,
            roughness,
            metalness
        };
        if (color !== null) matProps.color = color;

        const material = new THREE.MeshPhysicalMaterial({
            ...matProps,
            clearcoat: 0.4,
            clearcoatRoughness: 0.3
        });

        if (!state.loaded) {
            material.userData.useRoughnessMap = useRoughnessMap;
            state.pending.push(material);
            this._loadTexturesAsync(type);
        }

        return material;
    }

    createDesk() {
        const group = new THREE.Group();
        const legOffsets = [
            { x: -3.2, y: -0.625, z: -1.2 },
            { x: 3.2, y: -0.625, z: -1.2 },
            { x: -3.2, y: -0.625, z: 1.2 },
            { x: 3.2, y: -0.625, z: 1.2 }
        ];

        // Desk surface
        const desk = new THREE.Mesh(
            createBeveledBox(7, 0.08, 3, 0.006, 3),
            this._createTexturedMaterial('wood', 0.75, 0.0, true)
        );
        desk.position.set(0, 0.04, 0);
        desk.receiveShadow = true;
        desk.castShadow = true;
        group.add(desk);

        // Edge trim
        const edge = new THREE.Mesh(
            new THREE.BoxGeometry(6.52, 0.02, 2.52),
            this._createTexturedMaterial('wood', 0.7, 0.05)
        );
        edge.position.set(0, 0.08, 0);
        edge.castShadow = true;
        group.add(edge);

        // Legs — merged into a single draw call
        const legGeometry = createBeveledBox(0.1, 1.25, 0.1, 0.005, 2);
        const legMaterial = this._createTexturedMaterial('wood', 0.85, 0.02);
        const legGeometries = legOffsets.map(offset => {
            const g = legGeometry.clone();
            g.translate(offset.x, offset.y, offset.z);
            return g;
        });
        const mergedLegs = new THREE.Mesh(
            THREE.BufferGeometryUtils.mergeBufferGeometries(legGeometries),
            legMaterial
        );
        mergedLegs.castShadow = true;
        group.add(mergedLegs);

        applyOrigin(group, this.origins.desk, true); // Static object
        return group;
    }

    createWall() {
        const group = new THREE.Group();

        // Warm medium-gray tint keeps the bright plaster texture from blowing out.
        // clearcoat=0: plaster has no clear-coat specular; the default 0.4 catches every
        // light source and makes the wall appear blown-out white.
        // envMapIntensity=0.04: outdoor HDRI values are 3-8x above 1.0; even at 0.04
        // the HDRI still contributes meaningful fill without dominating a matte interior wall.
        const wallMat = this._createTexturedMaterial('wall', 0.95, 0.0, false, 0xf0e9d8);
        wallMat.clearcoat = 0.0;
        wallMat.clearcoatRoughness = 1.0;
        wallMat.envMapIntensity = 0.04;
        wallMat.needsUpdate = true;

        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(50, 8, 0.3),
            wallMat
        );
        wall.position.set(0, 3.5, -3.5);
        wall.receiveShadow = true;
        group.add(wall);

        const baseboard = new THREE.Mesh(
            new THREE.BoxGeometry(50, 0.5, 0.32),
            new THREE.MeshStandardMaterial({ color: 0x5c4a3d, roughness: 0.7, metalness: 0.0 })
        );
        baseboard.position.set(0, -0.25, -3.34);
        baseboard.receiveShadow = true;
        baseboard.castShadow = true;
        group.add(baseboard);

        applyOrigin(group, this.origins.wall, true); // Static object
        return group;
    }

    createCeiling() {
        // Ceilings are traditionally white or near-white with very low metalness.
        // The low envMapIntensity ensures the HDRI doesn't overbrighten it.
        const ceilingMat = new THREE.MeshStandardMaterial({
            color: 0xe8e4de,
            roughness: 0.98,
            metalness: 0.0,
            envMapIntensity: 0.05
        });
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(50, 22), ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, 7.5, -1.5);
        ceiling.receiveShadow = true;
        ceiling.matrixAutoUpdate = false;
        ceiling.updateMatrixWorld(true);
        return ceiling;
    }

    createSideWalls() {
        const group = new THREE.Group();
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0xf0e9d8,
            roughness: 0.95,
            metalness: 0.0,
            envMapIntensity: 0.10
        });
        const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3d, roughness: 0.7, metalness: 0.0 });

        // Left wall (window side — source of the directional light)
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 22), wallMat);
        leftWall.position.set(-8, 3.5, -1.5);
        leftWall.receiveShadow = true;
        leftWall.castShadow = true;
        group.add(leftWall);

        const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 22), baseboardMat);
        leftBaseboard.position.set(-7.85, -0.25, -1.5);
        group.add(leftBaseboard);

        // Right wall
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 22), wallMat);
        rightWall.position.set(8, 3.5, -1.5);
        rightWall.receiveShadow = true;
        rightWall.castShadow = true;
        group.add(rightWall);

        const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 22), baseboardMat);
        rightBaseboard.position.set(7.85, -0.25, -1.5);
        group.add(rightBaseboard);

        group.updateMatrixWorld(true);
        group.matrixAutoUpdate = false;
        group.traverse(child => { child.matrixAutoUpdate = false; });
        return group;
    }

    createWallShelf() {
        const group = new THREE.Group();
        const shelfMaterial = this._createTexturedMaterial('wood', 0.7, 0.05);
        const bracketMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.8 });
        const screwMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.2, metalness: 0.9 });

        // Main shelf
        const shelf = new THREE.Mesh(createBeveledBox(5, 0.15, 0.8, 0.006, 2), shelfMaterial);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        group.add(shelf);

        // Front trim
        const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(5.02, 0.18, 0.02), shelfMaterial);
        frontTrim.position.set(0, 0.02, 0.4);
        frontTrim.castShadow = true;
        group.add(frontTrim);

        // Brackets and screws — merged into single draw calls per material
        const bracketGeometries = [];
        const screwGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8);
        const screwGeometries = [];
        const scrollGeometry = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
        const sideBracketGeometry = new THREE.BoxGeometry(0.12, 0.35, 0.65);

        [-1.8, 1.8].forEach(x => {
            const bg = sideBracketGeometry.clone();
            bg.translate(x, -0.22, 0);
            bracketGeometries.push(bg);

            const sg = scrollGeometry.clone();
            sg.translate(x, -0.35, 0);
            bracketGeometries.push(sg);

            [-0.04, 0.04].forEach(dx => {
                const scg = screwGeometry.clone();
                scg.rotateX(Math.PI / 2);
                scg.translate(x + dx, -0.08, 0.3);
                screwGeometries.push(scg);
            });
        });

        const centerBracketGeo = new THREE.BoxGeometry(0.08, 0.25, 0.65);
        centerBracketGeo.translate(0, -0.15, 0);
        bracketGeometries.push(centerBracketGeo);

        const mergedBrackets = new THREE.Mesh(
            THREE.BufferGeometryUtils.mergeBufferGeometries(bracketGeometries),
            bracketMaterial
        );
        mergedBrackets.castShadow = true;
        group.add(mergedBrackets);

        const mergedScrews = new THREE.Mesh(
            THREE.BufferGeometryUtils.mergeBufferGeometries(screwGeometries),
            screwMaterial
        );
        mergedScrews.castShadow = true;
        group.add(mergedScrews);

        applyOrigin(group, this.origins.wallShelf, true); // Static object
        return group;
    }
}
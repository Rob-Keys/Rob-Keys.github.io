// @ts-check
/**
 * Wall-mounted objects creation
 * Handles diploma, and other wall-mounted items
 */

import * as THREE from 'three/webgpu';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { applyOrigin, createBeveledBox } from '../systems/utils.js';
import { OBJECT_ORIGINS } from '../config/config.js';

export class WallObjectFactory {
    constructor() {
        // Wall art sits behind the initial camera, so its image loads stay off the
        // shared loadingManager and start after the loading screen is gone.
        /** @type {{ material: THREE.MeshStandardMaterial, path: string, repeat?: { x: number, y: number } }[]} */
        this._deferredTextures = [];

        // Use centralized origins from config
        this.origins = OBJECT_ORIGINS.wall;
    }

    /**
     * Create wall diploma
     */
    createWallDiploma() {
        const group = new THREE.Group();
        const origin = this.origins.diploma;

        // Part offsets relative to diploma origin (origin is at frame center).
        const offsets = {
            cert: { x: 0, y: 0 }
        };

        // Wood texture for frame loads post-reveal (Phase 5.3) -- the diploma sits
        // behind the initial camera, so this shouldn't gate the loading screen.
        // The frame's base color already reads as wood until the map arrives.
        const frameGeometry = createBeveledBox(1.3, 1.0, 0.08, 0.006, 3);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B5A2B,
            roughness: 0.6,
            metalness: 0.1
        });
        this._deferredTextures.push({
            material: frameMaterial,
            path: 'assets/textures/wood_table_worn_diff_4k_1k.webp',
            repeat: { x: 2, y: 1 }
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.castShadow = true;
        frame.receiveShadow = true;
        group.add(frame);

        // The certificate is a local vector asset: it stays crisp at the close
        // zoom and avoids depending on a browser canvas upload during startup.
        const paperBacking = new THREE.Mesh(
            new THREE.BoxGeometry(1.14, 0.84, 0.016),
            new THREE.MeshStandardMaterial({ color: 0xe9dcc5, roughness: 0.92 })
        );
        paperBacking.position.z = 0.054;
        // The frame already provides the visible shadow silhouette; keeping the
        // flat paper out of the shadow-caster set saves shadow-map work.
        paperBacking.castShadow = false;
        paperBacking.receiveShadow = true;
        group.add(paperBacking);

        const certGeometry = new THREE.PlaneGeometry(1.1, 0.8);
        const certMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5f0e1,
            roughness: 0.88,
            metalness: 0.0,
            side: THREE.DoubleSide,
            envMapIntensity: 0.18
        });
        this._deferredTextures.push({ material: certMaterial, path: 'assets/images/diploma.svg' });
        const cert = new THREE.Mesh(certGeometry, certMaterial);
        cert.renderOrder = 1;
        cert.castShadow = false;
        cert.receiveShadow = true;
        cert.position.set(offsets.cert.x, offsets.cert.y, 0.064);
        group.add(cert);

        // Glass pane over the diploma. Keep a transparent physical approximation so
        // the material behaves consistently across WebGPU and WebGL2 backends.
        const glassGeometry = new THREE.PlaneGeometry(1.16, 0.86);
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.05,
            metalness: 0.0,
            transparent: true,
            opacity: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            depthWrite: false
        });
        const glass = new THREE.Mesh(glassGeometry, glassMaterial);
        glass.position.set(offsets.cert.x, offsets.cert.y, 0.074);
        glass.renderOrder = 2;
        group.add(glass);

        // Picture Light (Art Light)
        const lightGroup = new THREE.Group();
        const brassMaterial = new THREE.MeshStandardMaterial({
            color: 0xB8860B, // Dark goldenrod/brass
            roughness: 0.3,
            metalness: 0.8
        });

        // Picture light parts — merged into a single draw call
        const mountGeo = new THREE.BoxGeometry(0.15, 0.08, 0.04);
        mountGeo.translate(0, 0, -0.02);

        const armGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.25);
        /** @type {THREE.BufferGeometry[]} */
        const brassGeometries = [mountGeo];
        [-0.15, 0.15].forEach(x => {
            const ag = armGeometry.clone();
            ag.rotateX(Math.PI / 2);
            ag.translate(x, 0.05, 0.1);
            brassGeometries.push(ag);
        });

        const housingGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 16);
        housingGeo.rotateZ(Math.PI / 2);
        housingGeo.translate(0, 0.05, 0.22);
        brassGeometries.push(housingGeo);

        const mergedBrass = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(brassGeometries),
            brassMaterial
        );
        mergedBrass.castShadow = true;
        lightGroup.add(mergedBrass);

        // Position light group above the frame
        lightGroup.position.set(0, 0.55, 0);
        group.add(lightGroup);

        // The actual light source - a narrow SpotLight washing the diploma. This used
        // to be a RectAreaLight, the most expensive light type to evaluate per
        // fragment in a forward renderer; on a flat wall/frame at this distance the
        // wash reads nearly identically as a tight spot cone, at a fraction of the
        // cost. `target` is the cert mesh itself --
        // already in the scene graph as a child of this group -- so the spotlight
        // stays aimed correctly without any post-render finalization step.
        const artLight = new THREE.SpotLight(0xffeebb, 2.4, 1.8, Math.PI / 2.8, 0.9, 1);
        artLight.position.set(0, 0.55 + 0.05, 0.22);
        artLight.target = cert; // cert is already a child of `group`, added above
        group.add(artLight);

        applyOrigin(group, origin, true); // Static object
        group.userData.name = 'diploma';
        group.userData.label = 'diploma - Education';
        return group;
    }

    createVinylRecord() {
        const group = new THREE.Group();
        const origin = this.origins.vinyl;

        // Album cover size and spacing
        const coverSize = 0.35;
        const spacing = 0.36; // Space between covers (reduced for tighter grid)
        const coverDepth = 0.01;

        // Album cover geometry
        const coverGeometry = createBeveledBox(coverSize, coverSize, coverDepth, 0.004, 2);

        // Cover images load post-reveal (Phase 5.3) -- the vinyl wall is behind the
        // initial camera, so gating the loading screen on 4 album-art images is
        // wasted wait. A neutral placeholder color fills in until each arrives.
        const albumImages = [
            { path: 'assets/images/kendrick.webp', position: { x: -spacing/2, y: spacing/2 } }, // Top left
            { path: 'assets/images/kanye.webp', position: { x: spacing/2, y: spacing/2 } }, // Top right
            { path: 'assets/images/mt_joy.webp', position: { x: -spacing/2, y: -spacing/2 } }, // Bottom left
            { path: 'assets/images/olivia_dean.webp', position: { x: spacing/2, y: -spacing/2 } } // Bottom right
        ];

        // Sleeve edge/back material shared by every cover -- flat cardboard color, no
        // art texture. ExtrudeGeometry groups the front/back caps under material
        // index 0 and the extruded bevel + side walls under index 1; splitting the
        // two here keeps the album art off the bevel,
        // where its side UVs used to smear the artwork's edge pixels around the rim.
        const coverSideMaterial = new THREE.MeshStandardMaterial({
            color: 0x1c1c1c,
            roughness: 0.6,
            metalness: 0.0
        });

        // Create each album cover
        albumImages.forEach((album) => {
            const coverFrontMaterial = new THREE.MeshStandardMaterial({
                color: 0x2a2a2a,
                roughness: 0.2,
                metalness: 0.0
            });
            this._deferredTextures.push({ material: coverFrontMaterial, path: album.path });

            const cover = new THREE.Mesh(coverGeometry, [coverFrontMaterial, coverSideMaterial]);
            cover.position.set(album.position.x, album.position.y, coverDepth);
            cover.castShadow = true;
            cover.receiveShadow = true;
            group.add(cover);
        });

        group.scale.set(4, 4, 4); // Must set scale before freezing matrix
        applyOrigin(group, origin, true); // Static object
        group.userData.name = 'vinyl';
        group.userData.label = 'vinyl - Music & Creativity';
        return group;
    }

    /**
     * Load deferred wall-art images after the initial reveal. Textures pop in
     * individually as each request resolves without blocking the critical path.
     */
    loadDeferredTextures() {
        const textureLoader = new THREE.TextureLoader();
        for (const { material, path, repeat } of this._deferredTextures) {
            const texture = textureLoader.load(path);
            if (texture.colorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
            texture.colorSpace = THREE.SRGBColorSpace;
            if (repeat) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(repeat.x, repeat.y);
            }
            material.map = texture;
            material.needsUpdate = true;
        }
    }
}

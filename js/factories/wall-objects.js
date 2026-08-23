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
        this._deferredTexturesLoaded = false;

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

        // The wall display is a tight gallery grid of physical record sleeves.
        // Dimensions are kept in the factory's unscaled local space and enlarged
        // once at the root, so every small detail shares the same scene scale.
        const coverSize = 0.34;
        const spacing = 0.37;
        const coverDepth = 0.028;
        const printSize = 0.302;
        // The sleeve bevel projects past its nominal half-depth, so the printed
        // face sits just proud of that bevel rather than z-fighting with it.
        const printZ = 0.056;

        // A substantial rounded cardboard sleeve gives the display a visible edge
        // at an oblique camera angle and a soft, continuous shadow on the plaster.
        const coverGeometry = createBeveledBox(coverSize, coverSize, coverDepth, 0.006, 3);
        // Keep the image-bearing face planar. ExtrudeGeometry is ideal for the
        // sleeve silhouette, but its cap UV generator is not a reliable square
        // projection for artwork.
        const printGeometry = new THREE.PlaneGeometry(printSize, printSize);
        const paperEdgeGeometry = createBeveledBox(printSize + 0.006, printSize + 0.006, 0.0014, 0.001, 2);

        // Cover images load post-reveal (Phase 5.3) -- the vinyl wall is behind the
        // initial camera, so gating the loading screen on 4 album-art images is
        // wasted wait. A neutral placeholder color fills in until each arrives.
        const albumImages = [
            { path: 'assets/images/kendrick.webp', position: { x: -spacing/2, y: spacing/2 } }, // Top left
            { path: 'assets/images/kanye.webp', position: { x: spacing/2, y: spacing/2 } }, // Top right
            { path: 'assets/images/mt_joy.webp', position: { x: -spacing/2, y: -spacing/2 } }, // Bottom left
            { path: 'assets/images/olivia_dean.webp', position: { x: spacing/2, y: -spacing/2 } } // Bottom right
        ];

        // Sleeve edge/back material is shared by all four covers. The front print
        // is deliberately a separate mesh: ExtrudeGeometry's cap UVs are not
        // stable enough for album art, while Plane/box UVs stay crisp and square.
        const sleeveMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x171719,
            roughness: 0.82,
            metalness: 0.0,
            clearcoat: 0.06,
            clearcoatRoughness: 0.72,
            envMapIntensity: 0.28
        });
        const paperEdgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xb9b3a8,
            roughness: 0.86,
            metalness: 0.0
        });

        // Create each album cover. The tiny paper edge remains visible around the
        // art so the image reads as a printed insert rather than a lit decal.
        albumImages.forEach((album) => {
            const cover = new THREE.Mesh(coverGeometry, sleeveMaterial);
            cover.position.set(album.position.x, album.position.y, 0.028);
            cover.castShadow = true;
            cover.receiveShadow = true;
            group.add(cover);

            const paperEdge = new THREE.Mesh(paperEdgeGeometry, paperEdgeMaterial);
            paperEdge.position.set(album.position.x, album.position.y, printZ - 0.002);
            paperEdge.castShadow = false;
            paperEdge.receiveShadow = true;
            group.add(paperEdge);

            const coverArtMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                roughness: 0.2,
                metalness: 0.0
            });
            coverArtMaterial.clearcoat = 0.12;
            coverArtMaterial.clearcoatRoughness = 0.32;
            this._deferredTextures.push({ material: coverArtMaterial, path: album.path });

            const coverArt = new THREE.Mesh(printGeometry, coverArtMaterial);
            coverArt.position.set(album.position.x, album.position.y, printZ);
            coverArt.castShadow = false;
            coverArt.receiveShadow = true;
            coverArt.renderOrder = 1;
            group.add(coverArt);
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
        if (this._deferredTexturesLoaded) return;
        this._deferredTexturesLoaded = true;
        const textureLoader = new THREE.TextureLoader();
        for (const { material, path, repeat } of this._deferredTextures) {
            textureLoader.load(path, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = 8;
                if (repeat) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(repeat.x, repeat.y);
                }
                material.map = texture;
                material.needsUpdate = true;
            });
        }
    }
}

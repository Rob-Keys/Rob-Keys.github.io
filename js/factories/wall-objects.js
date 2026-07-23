// @ts-check
/**
 * Wall-mounted objects creation
 * Handles diploma, and other wall-mounted items
 */

import { applyOrigin, createBeveledBox } from '../systems/utils.js';
import { OBJECT_ORIGINS } from '../config/config.js';

export class WallObjectFactory {
    /**
     * @param {THREE.LoadingManager | null} [loadingManager]
     */
    constructor(scene, loadingManager = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.interactiveObjects = [];
        this._diploma = null; // Reference for post-init finalization

        // Deferred-texture targets (Phase 5.3): the diploma frame and the vinyl
        // covers are wall objects behind the initial camera, so their image loads
        // are kept off the shared loadingManager entirely and only start after the
        // loading screen is gone -- see loadDeferredTextures(), called post-reveal
        // from main.js.
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

        // Part offsets relative to diploma origin (origin is at frame center)
        // cert z must be > 0.04 (half of frame depth 0.08) to avoid z-fighting
        const offsets = {
            cert: { x: 0, y: 0, z: 0.045 }
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

        // diploma canvas -- higher resolution than the original 512x384 so the
        // finer rule work and seal detail hold up at the zoom-in distance
        // (Phase 5.3: match real UVA diploma proportions/layout).
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 768;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for diploma canvas');
        const scale = canvas.width / 512; // keep all the layout math below in the old 512-wide coordinate space

        // Fill with simple color initially
        ctx.fillStyle = '#f5f0e1';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);

        // UVA brand colors (navy + orange) in place of the generic ivy green/gold
        // used before -- this is the detail that reads as "a real UVA diploma"
        // rather than a generic collegiate template.
        const navy = '#232D4B';
        const orange = '#E57200';

        // Simple rotunda silhouette (dome + colonnade), drawn as line art rather
        // than a seal reproduction -- enough to read as "UVA" at this scale
        // without copying the university's actual seal artwork.
        const drawRotunda = (cx, cy, r) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.strokeStyle = navy;
            ctx.fillStyle = navy;
            ctx.lineWidth = Math.max(1, r * 0.05);

            // Dome
            ctx.beginPath();
            ctx.arc(0, -r * 0.15, r * 0.55, Math.PI, 0);
            ctx.stroke();
            // Base pediment
            ctx.beginPath();
            ctx.moveTo(-r * 0.6, -r * 0.15);
            ctx.lineTo(r * 0.6, -r * 0.15);
            ctx.lineTo(r * 0.6, r * 0.35);
            ctx.lineTo(-r * 0.6, r * 0.35);
            ctx.closePath();
            ctx.stroke();
            // Columns
            const columnCount = 5;
            for (let i = 0; i < columnCount; i++) {
                const x = -r * 0.45 + (i * (r * 0.9)) / (columnCount - 1);
                ctx.beginPath();
                ctx.moveTo(x, -r * 0.1);
                ctx.lineTo(x, r * 0.3);
                ctx.stroke();
            }
            // Finial
            ctx.beginPath();
            ctx.arc(0, -r * 0.72, r * 0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };

        // Defer heavy rendering
        requestAnimationFrame(() => setTimeout(() => {
            ctx.save();
            ctx.scale(scale, scale);

            // Parchment background with subtle texture
            const gradient = ctx.createLinearGradient(0, 0, 512, 384);
            gradient.addColorStop(0, '#faf6e8');
            gradient.addColorStop(0.5, '#f5f0e1');
            gradient.addColorStop(1, '#efe5d5');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 384);

            // Outer rule (orange) + inner rule (navy) -- Jeffersonian double-border
            const margin = 18;
            ctx.strokeStyle = orange;
            ctx.lineWidth = 3;
            ctx.strokeRect(margin, margin, 512 - margin * 2, 384 - margin * 2);

            ctx.strokeStyle = navy;
            ctx.lineWidth = 1;
            ctx.strokeRect(margin + 6, margin + 6, 512 - (margin * 2 + 12), 384 - (margin * 2 + 12));

            // Corner ornaments
            const cornerSize = 26;
            ctx.strokeStyle = navy;
            ctx.lineWidth = 1.5;
            const corners = [
                [margin + 6, margin + 6, 1, 1],
                [512 - margin - 6, margin + 6, -1, 1],
                [margin + 6, 384 - margin - 6, 1, -1],
                [512 - margin - 6, 384 - margin - 6, -1, -1]
            ];
            corners.forEach(([x, y, dx, dy]) => {
                ctx.beginPath();
                ctx.moveTo(x, y + cornerSize * dy);
                ctx.lineTo(x, y);
                ctx.lineTo(x + cornerSize * dx, y);
                ctx.stroke();
            });

            ctx.textAlign = 'center';

            // Rotunda mark
            drawRotunda(256, 48, 26);

            // University name
            ctx.font = 'bold 22px Georgia, serif';
            ctx.fillStyle = navy;
            ctx.fillText('UNIVERSITY OF VIRGINIA', 256, 100);

            ctx.font = 'italic 13px Georgia, serif';
            ctx.fillStyle = '#4a4a4a';
            ctx.fillText('Charlottesville, Virginia · Founded 1819', 256, 118);

            // Awarded text
            ctx.font = '13px Georgia, serif';
            ctx.fillStyle = '#1a1a2a';
            ctx.fillText('Know all by these presents that', 256, 150);

            // Name
            ctx.font = 'bold 30px Georgia, serif';
            ctx.fillStyle = orange;
            ctx.fillText('ROB KEYS', 256, 183);

            ctx.font = 'italic 13px Georgia, serif';
            ctx.fillStyle = '#1a1a2a';
            ctx.fillText('has satisfied the requirements and been admitted to the degree of', 256, 205);

            // Degree
            ctx.font = 'bold 19px Georgia, serif';
            ctx.fillStyle = navy;
            ctx.fillText('BACHELOR OF SCIENCE', 256, 232);
            ctx.font = '15px Georgia, serif';
            ctx.fillText('in Computer Science', 256, 251);

            ctx.font = 'italic 12px Georgia, serif';
            ctx.fillStyle = '#4a4a4a';
            ctx.fillText('School of Engineering and Applied Science', 256, 268);

            ctx.font = '11px Georgia, serif';
            ctx.fillStyle = '#1a1a2a';
            ctx.fillText('Graduated May 2026', 256, 288);

            // Signature lines
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 1;
            [[110, 340], [402, 340]].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.moveTo(x - 55, y);
                ctx.lineTo(x + 55, y);
                ctx.stroke();
            });
            ctx.font = '10px Georgia, serif';
            ctx.fillStyle = '#4a4a4a';
            ctx.fillText('Rector and Visitors', 110, 354);
            ctx.fillText('President', 402, 354);

            // Wax-style seal, bottom center
            const sealX = 256;
            const sealY = 335;
            const sealRadius = 22;

            ctx.beginPath();
            ctx.arc(sealX, sealY, sealRadius, 0, Math.PI * 2);
            ctx.fillStyle = orange;
            ctx.fill();
            ctx.strokeStyle = navy;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(sealX, sealY, sealRadius - 5, 0, Math.PI * 2);
            ctx.fillStyle = '#f5f0e1';
            ctx.fill();

            drawRotunda(sealX, sealY + 2, 14);

            ctx.restore();
            texture.needsUpdate = true;
        }, 0));

        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 4;

        // diploma surface
        const certGeometry = new THREE.PlaneGeometry(1.1, 0.8);
        const certMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            roughness: 0.7,
            metalness: 0.0,
            side: THREE.FrontSide
        });
        const cert = new THREE.Mesh(certGeometry, certMaterial);
        cert.castShadow = true;
        cert.receiveShadow = true;
        cert.position.set(offsets.cert.x, offsets.cert.y, offsets.cert.z);
        group.add(cert);

        // Glass pane over the diploma. r128 predates Three.js's transmission/refraction
        // shader chunk (transmission is a no-op on this revision — confirmed via
        // THREE.ShaderChunk.transmission_pars_fragment being undefined), so real
        // transmission glass isn't available here; alpha-blended + clearcoat is the
        // period-correct glass technique for this renderer.
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
        glass.position.set(offsets.cert.x, offsets.cert.y, offsets.cert.z + 0.008);
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
            THREE.BufferGeometryUtils.mergeBufferGeometries(brassGeometries),
            brassMaterial
        );
        mergedBrass.castShadow = true;
        lightGroup.add(mergedBrass);

        // Position light group above the frame
        lightGroup.position.set(0, 0.55, 0);
        group.add(lightGroup);

        // The actual light source - RectAreaLight for rectangular strip light effect
        // Position it at the housing location in world space relative to group
        // Width matches the diploma width, height is thin strip
        const artLight = new THREE.RectAreaLight(0xffeebb, 5.0, 1.1, 0.15);
        // Position at housing location (lightGroup.y + housing.y, lightGroup.z + housing.z)
        artLight.position.set(0, 0.55 + 0.05, 0.22);
        // Use lookAt to point at the diploma center
        artLight.lookAt(0, 0, 0.045);
        group.add(artLight);

        applyOrigin(group, origin, true); // Static object
        group.userData.name = 'diploma';
        group.userData.label = 'diploma - Education';
        group.userData.artLight = artLight;
        group.userData.lightTarget = cert; // Store target for light finalization
        this.interactiveObjects.push(group);
        this._diploma = group; // Store reference for finalization
        return group;
    }

    /**
     * Finalize diploma light direction after scene matrices are computed.
     * Must be called after the diploma is added to the scene and rendered once.
     */
    finalizeDiplomaLight() {
        const diploma = this._diploma;
        if (!diploma?.userData.artLight) return;

        diploma.updateMatrixWorld(true);
        if (diploma.userData.lightTarget) {
            const targetWorldPos = new THREE.Vector3();
            diploma.userData.lightTarget.getWorldPosition(targetWorldPos);
            diploma.userData.artLight.lookAt(targetWorldPos);
        }
        diploma.userData.artLight.rotation.x += 0.3;
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

        // Create each album cover
        albumImages.forEach((album) => {
            const coverMaterial = new THREE.MeshStandardMaterial({
                color: 0x2a2a2a,
                roughness: 0.2,
                metalness: 0.0
            });
            this._deferredTextures.push({ material: coverMaterial, path: album.path });

            const cover = new THREE.Mesh(coverGeometry, coverMaterial);
            cover.position.set(album.position.x, album.position.y, coverDepth);
            cover.castShadow = true;
            cover.receiveShadow = true;
            group.add(cover);
        });

        group.scale.set(4, 4, 4); // Must set scale before freezing matrix
        applyOrigin(group, origin, true); // Static object
        group.userData.name = 'vinyl';
        group.userData.label = 'vinyl - Music & Creativity';
        this.interactiveObjects.push(group);
        return group;
    }

    getInteractiveObjects() {
        return this.interactiveObjects;
    }

    /**
     * Load the diploma frame and vinyl cover images (Phase 5.3). Deliberately not
     * given `this.loadingManager`, and not called until after the loading screen
     * hides -- these are wall objects behind the initial camera, so their loads
     * shouldn't compete with the env map/floor textures for bandwidth on the
     * critical path. Textures pop in individually as each request resolves.
     */
    loadDeferredTextures() {
        const textureLoader = new THREE.TextureLoader();
        for (const { material, path, repeat } of this._deferredTextures) {
            const texture = textureLoader.load(path);
            if (texture.colorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
            else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
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
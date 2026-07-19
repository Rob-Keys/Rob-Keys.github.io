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

        // Load wood texture for frame
        const textureLoader = new THREE.TextureLoader(this.loadingManager || undefined);
        const woodTexture = textureLoader.load('assets/textures/wood_table_worn_diff_4k_1k.webp');
        woodTexture.colorSpace = THREE.SRGBColorSpace;
        woodTexture.wrapS = THREE.RepeatWrapping;
        woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(2, 1);

        // Frame with ornate border - Thicker and with wood texture
        const frameGeometry = createBeveledBox(1.3, 1.0, 0.08, 0.006, 3);
        const frameMaterial = new THREE.MeshStandardMaterial({
            map: woodTexture,
            color: 0x8B5A2B,
            roughness: 0.6,
            metalness: 0.1
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.castShadow = true;
        frame.receiveShadow = true;
        group.add(frame);

        // diploma canvas
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 384;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for diploma canvas');

        // Fill with simple color initially
        ctx.fillStyle = '#f5f0e1';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);

        // Defer heavy rendering
        requestAnimationFrame(() => setTimeout(() => {
            // Parchment background with subtle texture
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#faf6e8');
            gradient.addColorStop(0.5, '#f5f0e1');
            gradient.addColorStop(1, '#efe5d5');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Inner decorative border
            ctx.strokeStyle = '#c9a66b';
            ctx.lineWidth = 3;
            const margin = 20;
            ctx.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);

            ctx.strokeStyle = '#8B7355';
            ctx.lineWidth = 1;
            ctx.strokeRect(margin + 4, margin + 4, canvas.width - (margin * 2 + 8), canvas.height - (margin * 2 + 8));

            // Corner ornaments
            const cornerSize = 30;
            ctx.strokeStyle = '#8B7355';
            ctx.lineWidth = 2;
            const corners = [
                [margin, margin, 1, 1],
                [canvas.width - margin, margin, -1, 1],
                [margin, canvas.height - margin, 1, -1],
                [canvas.width - margin, canvas.height - margin, -1, -1]
            ];
            corners.forEach(([x, y, dx, dy]) => {
                ctx.beginPath();
                ctx.moveTo(x, y + cornerSize * dy);
                ctx.lineTo(x, y);
                ctx.lineTo(x + cornerSize * dx, y);
                ctx.stroke();
            });

            // Header text
            ctx.fillStyle = '#1a1a2a';
            ctx.font = 'bold 24px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('diploma OF', canvas.width / 2, 55);

            ctx.font = 'bold 32px Georgia, serif';
            ctx.fillStyle = '#2d4a22';
            ctx.fillText('GRADUATION', canvas.width / 2, 90);

            // University name
            ctx.font = 'bold 20px Georgia, serif';
            ctx.fillStyle = '#1a1a2a';
            ctx.fillText('University of Virginia', canvas.width / 2, 125);

            ctx.font = 'italic 16px Georgia, serif';
            ctx.fillText('Charlottesville, Virginia', canvas.width / 2, 145);

            // Awarded text
            ctx.font = '14px Georgia, serif';
            ctx.fillText('This certifies that', canvas.width / 2, 175);

            // Name
            ctx.font = 'bold 28px Georgia, serif';
            ctx.fillStyle = '#2d4a22';
            ctx.fillText('ROB KEYS', canvas.width / 2, 205);

            ctx.font = 'italic 14px Georgia, serif';
            ctx.fillStyle = '#1a1a2a';
            ctx.fillText('has been awarded the degree of', canvas.width / 2, 230);

            // Degree
            ctx.font = 'bold 18px Georgia, serif';
            ctx.fillStyle = '#1a1a2a';
            ctx.fillText('Bachelor of Science', canvas.width / 2, 255);
            ctx.fillText('in Computer Science', canvas.width / 2, 278);

            // UVA Seal - drawn on canvas
            const sealX = canvas.width / 2;
            const sealY = 330;
            const sealRadius = 25;

            // Outer ring
            ctx.beginPath();
            ctx.arc(sealX, sealY, sealRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#c9a66b';
            ctx.fill();
            ctx.strokeStyle = '#8B7355';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner circle
            ctx.beginPath();
            ctx.arc(sealX, sealY, sealRadius - 5, 0, Math.PI * 2);
            ctx.fillStyle = '#f5f0e1';
            ctx.fill();

            // "U" in the center
            ctx.font = 'bold 18px Georgia, serif';
            ctx.fillStyle = '#2d4a22';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('U', sealX - 6, sealY);
            ctx.fillText('V', sealX + 6, sealY);
            ctx.textBaseline = 'alphabetic';

            // Date
            ctx.font = '12px Georgia, serif';
            ctx.fillStyle = '#1a1a2a';
            ctx.textAlign = 'center';
            ctx.fillText('Graduated May 2026', canvas.width / 2, 375);

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
        
        // Load all 4 album cover images
        const textureLoader = new THREE.TextureLoader(this.loadingManager || undefined);
        const albumImages = [
            { path: 'assets/images/kendrick.webp', position: { x: -spacing/2, y: spacing/2 } }, // Top left
            { path: 'assets/images/kanye.webp', position: { x: spacing/2, y: spacing/2 } }, // Top right
            { path: 'assets/images/mt_joy.webp', position: { x: -spacing/2, y: -spacing/2 } }, // Bottom left
            { path: 'assets/images/olivia_dean.webp', position: { x: spacing/2, y: -spacing/2 } } // Bottom right
        ];

        // Create each album cover
        albumImages.forEach((album, _index) => {
            const coverTexture = textureLoader.load(album.path);
            coverTexture.colorSpace = THREE.SRGBColorSpace;
            
            const coverMaterial = new THREE.MeshStandardMaterial({
                map: coverTexture,
                roughness: 0.2,
                metalness: 0.0
            });
            
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
}
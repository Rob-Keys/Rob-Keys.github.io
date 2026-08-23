// @ts-check
/**
 * Shelf objects creation
 * Handles books, plants, and other items that sit on shelves
 */

import * as THREE from 'three/webgpu';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
    addContactShadow,
    applyOrigin,
    createBeveledBox,
    createCanvasTexture,
    createPaperGrainNormalTexture,
    createRoughnessVariationTexture
} from '../systems/utils.js';
import { OBJECT_ORIGINS } from '../config/config.js';

/**
 * Render a book spine label onto a canvas: title text along the spine,
 * a thin rule, and a small author line. Real spines use small, varied
 * typography rather than a single uniform font/size -- that uniformity is
 * the tell that separates props from real books (Phase 5.2).
 * @param {string} title
 * @param {string} author
 * @param {string} font - CSS font-family for the title.
 * @param {string} textColor
 * @returns {THREE.CanvasTexture}
 */
function createBookSpineTexture(title, author, font, textColor) {
    const width = 64;
    const height = 512;
    const { texture } = createCanvasTexture(width, height, (ctx) => {
        ctx.clearRect(0, 0, width, height);
        ctx.translate(width / 2, height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.translate(-height / 2, -width / 2);

        ctx.fillStyle = textColor;
        ctx.textBaseline = 'middle';

        ctx.font = `bold 26px ${font}`;
        ctx.fillText(title, 18, width * 0.38, height - 36);

        ctx.font = `italic 16px ${font}`;
        ctx.globalAlpha = 0.75;
        ctx.fillText(author, 18, width * 0.72, height - 36);
        ctx.globalAlpha = 1;
    });
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
}

export class ShelfObjectFactory {
    constructor() {
        // Use centralized origins from config
        this.origins = OBJECT_ORIGINS.shelf;
    }

    /**
     * Create simple books - solid color rectangles for performance
     */
    createShelfBooks() {
        const group = new THREE.Group();
        const origin = this.origins.books;

        // Book data: cover color, spine width/height, title/author, and a
        // distinct font per book -- uniform width/height/typography was the
        // biggest tell that these were props rather than a real shelf (Phase 5.2).
        const books = [
            { color: 0x8B0000, width: 0.115, height: 0.56, title: 'CLEAN CODE', author: 'R. Martin', font: 'Georgia, serif' },
            { color: 0x1e3a8a, width: 0.135, height: 0.62, title: 'THE PRAGMATIC PROGRAMMER', author: 'Hunt & Thomas', font: 'Arial, sans-serif' },
            { color: 0x1a472a, width: 0.095, height: 0.52, title: 'DESIGNING DATA-INTENSIVE APPS', author: 'M. Kleppmann', font: '"Courier New", monospace' },
            { color: 0x4a3c2a, width: 0.105, height: 0.58, title: 'STRUCTURE AND INTERPRETATION', author: 'Abelson & Sussman', font: 'Georgia, serif' },
            { color: 0x6b1f1f, width: 0.09,  height: 0.54, title: 'THE MYTHICAL MAN-MONTH', author: 'F. Brooks', font: 'Arial, sans-serif' },
            { color: 0x2a2a4a, width: 0.12,  height: 0.50, title: 'CRACKING THE CODING INTERVIEW', author: 'G. McDowell', font: '"Courier New", monospace' },
            { color: 0x3a5a3a, width: 0.10,  height: 0.57, title: 'REFACTORING', author: 'M. Fowler', font: 'Georgia, serif' }
        ];

        const bookDepth = 0.30;
        const bookGrainTexture = createPaperGrainNormalTexture();
        const bookGeometry = createBeveledBox(1, 1, 1, 0.018, 2);
        const bookMaterial = new THREE.MeshStandardMaterial({
            roughness: 0.72,
            normalMap: bookGrainTexture,
            normalScale: new THREE.Vector2(0.10, 0.10),
            vertexColors: true
        });
        const bookBodies = new THREE.InstancedMesh(bookGeometry, bookMaterial, books.length);
        bookBodies.castShadow = true;
        bookBodies.receiveShadow = true;

        // Deterministic per-book jitter (not Math.random) so lean/offset stays
        // stable across reloads instead of reshuffling the shelf every visit.
        const jitter = (seed) => {
            const x = Math.sin(seed * 12.9898) * 43758.5453;
            return x - Math.floor(x); // 0..1
        };

        let cursorX = -0.52;
        const bodyMatrix = new THREE.Matrix4();
        const bodyPosition = new THREE.Vector3();
        const bodyScale = new THREE.Vector3();
        const bodyQuaternion = new THREE.Quaternion();
        const bodyColor = new THREE.Color();
        const bookAxis = new THREE.Vector3(0, 0, 1);
        const bookTransforms = [];
        books.forEach((data, index) => {
            const lean = (jitter(index * 3.1) - 0.5) * 0.09; // slight random lean
            const depthOffset = (jitter(index * 5.7) - 0.5) * 0.03; // slight random depth stagger
            bodyPosition.set(cursorX + data.width / 2, data.height / 2, 0.15 + depthOffset);
            bodyQuaternion.setFromAxisAngle(bookAxis, lean);
            bodyScale.set(data.width, data.height, bookDepth);
            bodyMatrix.compose(bodyPosition, bodyQuaternion, bodyScale);
            bookBodies.setMatrixAt(index, bodyMatrix);
            bodyColor.setHex(data.color);
            bookBodies.setColorAt(index, bodyColor);
            bookTransforms.push({ position: bodyPosition.clone(), quaternion: bodyQuaternion.clone() });

            // Spine label -- a thin plane sitting just proud of the spine's
            // front cap so the title/author text never z-fights the cover.
            const spineTexture = createBookSpineTexture(data.title, data.author, data.font, '#f0e8d8');
            const spinePlane = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshStandardMaterial({
                    map: spineTexture,
                    transparent: true,
                    roughness: 0.6,
                    metalness: 0.0
                })
            );
            spinePlane.position.set(bodyPosition.x, bodyPosition.y, bodyPosition.z + bookDepth / 2 + 0.008);
            spinePlane.quaternion.copy(bodyQuaternion);
            spinePlane.scale.set(data.width * 0.86, data.height * 0.9, 1);
            spinePlane.castShadow = false;
            group.add(spinePlane);

            cursorX += data.width + 0.012;
        });
        bookBodies.instanceMatrix.needsUpdate = true;
        if (bookBodies.instanceColor) bookBodies.instanceColor.needsUpdate = true;
        group.add(bookBodies);

        // Exposed page block: a shared unit-cube geometry instanced once per
        // book, non-uniformly scaled per instance so every book's visible page
        // edge (top of the spine, opposite the cover) reuses one draw call.
        const pageGeometry = new THREE.BoxGeometry(1, 1, 1);
        const pageMaterial = new THREE.MeshStandardMaterial({
            color: 0xede4d0,
            roughness: 0.85,
            normalMap: bookGrainTexture,
            normalScale: new THREE.Vector2(0.08, 0.08)
        });
        const pageBlock = new THREE.InstancedMesh(pageGeometry, pageMaterial, books.length);
        pageBlock.castShadow = true;
        pageBlock.receiveShadow = true;

        const pageThickness = 0.018;
        const matrix = new THREE.Matrix4();
        const pagePosition = new THREE.Vector3();
        const pageScale = new THREE.Vector3();
        books.forEach((data, index) => {
            const transform = bookTransforms[index];
            pagePosition.copy(transform.position);
            pagePosition.y += data.height / 2 - pageThickness / 2;
            pageScale.set(data.width * 0.94, pageThickness, bookDepth * 0.9);
            matrix.compose(pagePosition, transform.quaternion, pageScale);
            pageBlock.setMatrixAt(index, matrix);
        });
        pageBlock.instanceMatrix.needsUpdate = true;
        group.add(pageBlock);

        addContactShadow(group, 1.0, 0.42, -0.005);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'books', label: 'Books - Knowledge Base' };
        return group;
    }

    createShelfPlant() {
        const group = new THREE.Group();
        const origin = this.origins.shelfPlant;

        // Deterministic per-leaf jitter (not Math.random) so the plant's shape stays
        // stable across reloads instead of reshuffling on every page load (P1-1,
        // matching the pattern already used for the books.
        const jitter = (seed) => {
            const x = Math.sin(seed * 12.9898) * 43758.5453;
            return x - Math.floor(x); // 0..1
        };

        // === MATERIALS ===
        const potMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xb9653f,
            roughness: 0.9,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0,
            clearcoat: 0.04,
            clearcoatRoughness: 0.9
        });
        const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xa65337, roughness: 0.82 });
        const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x2d1c11, roughness: 0.98 });
        const vineMaterial = new THREE.MeshStandardMaterial({ color: 0x3d6b3b, roughness: 0.72 });
        const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0x527b42, roughness: 0.68 });

        // A softly rounded profile makes the planter read as a hand-thrown pot,
        // while the separate saucer gives it a believable contact with the shelf.
        const potProfile = [
            new THREE.Vector2(0.14, 0.018),
            new THREE.Vector2(0.15, 0.035),
            new THREE.Vector2(0.17, 0.08),
            new THREE.Vector2(0.205, 0.235),
            new THREE.Vector2(0.202, 0.27),
            new THREE.Vector2(0.19, 0.285)
        ];
        const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile, 24), potMaterial);
        pot.castShadow = true;
        pot.receiveShadow = true;
        group.add(pot);

        const saucer = new THREE.Mesh(
            new THREE.CylinderGeometry(0.235, 0.205, 0.025, 24),
            rimMaterial
        );
        saucer.position.y = 0.012;
        saucer.castShadow = true;
        saucer.receiveShadow = true;
        group.add(saucer);

        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.198, 0.018, 8, 24), rimMaterial);
        rim.position.y = 0.275;
        rim.rotation.x = Math.PI / 2;
        rim.castShadow = true;
        group.add(rim);

        const soil = new THREE.Mesh(
            new THREE.SphereGeometry(0.185, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            soilMaterial
        );
        soil.scale.y = 0.22;
        soil.position.y = 0.278;
        soil.castShadow = true;
        group.add(soil);

        // A pothos leaf is attached at the notch, not at its centre. The shallow
        // folded surface catches highlights across the midrib and avoids the flat
        // paper-card appearance of a single plane.
        const createHeartLeaf = () => {
            const shape = new THREE.Shape();
            const w = 0.095;
            const h = 0.13;
            shape.moveTo(0, -h * 1.35);
            shape.bezierCurveTo(w * 0.42, -h * 0.95, w * 0.92, -h * 0.35, w * 0.82, h * 0.08);
            shape.bezierCurveTo(w * 0.75, h * 0.34, w * 0.32, h * 0.45, 0, 0);
            shape.bezierCurveTo(-w * 0.32, h * 0.45, -w * 0.75, h * 0.34, -w * 0.82, h * 0.08);
            shape.bezierCurveTo(-w * 0.92, -h * 0.35, -w * 0.42, -h * 0.95, 0, -h * 1.35);

            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: 0.006,
                bevelEnabled: true,
                bevelThickness: 0.0025,
                bevelSize: 0.0025,
                bevelSegments: 2,
                curveSegments: 4
            });
            geometry.translate(0, 0, -0.003);
            const positions = geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const edgeFold = Math.pow(Math.min(1, Math.abs(x) / w), 1.7) * 0.022;
                const tipDrop = Math.max(0, -y / (h * 1.35)) * 0.012;
                positions.setZ(i, positions.getZ(i) + 0.012 - edgeFold - tipDrop);
            }
            geometry.computeVertexNormals();
            return geometry;
        };

        const unitLeafGeometry = createHeartLeaf();
        const unitNodeGeometry = new THREE.SphereGeometry(0.011, 6, 4);
        unitNodeGeometry.scale(1, 1.35, 1);

        // Each stem has a different bend, height, and depth. The curves sag under
        // their own weight and the leaves fan toward the light, as a real trailing
        // pothos would rather than forming a repeated curtain.
        const vineConfigs = [
            { points: [[-0.10, 0.29, 0.02], [-0.18, 0.18, 0.16], [-0.28, -0.08, 0.36], [-0.22, -0.40, 0.47], [-0.34, -0.74, 0.43]], leafCount: 5 },
            { points: [[0.02, 0.29, 0.03], [0.12, 0.15, 0.20], [0.17, -0.12, 0.42], [0.10, -0.46, 0.54], [0.24, -0.91, 0.50]], leafCount: 6 },
            { points: [[-0.02, 0.29, 0.06], [0.00, 0.10, 0.28], [-0.08, -0.18, 0.47], [0.04, -0.52, 0.58], [-0.03, -1.08, 0.55]], leafCount: 6 },
            { points: [[0.09, 0.29, 0.00], [0.25, 0.16, 0.08], [0.34, -0.08, 0.27], [0.30, -0.36, 0.40], [0.47, -0.70, 0.35]], leafCount: 5 },
            { points: [[-0.12, 0.29, 0.00], [-0.28, 0.15, 0.06], [-0.45, -0.10, 0.18], [-0.56, -0.35, 0.29], [-0.65, -0.64, 0.24]], leafCount: 5 },
            { points: [[0.00, 0.29, -0.02], [-0.05, 0.43, 0.00], [-0.02, 0.55, 0.06]], leafCount: 3, isNewGrowth: true },
            { points: [[0.07, 0.29, 0.01], [0.16, 0.41, 0.06], [0.11, 0.53, 0.10]], leafCount: 2, isNewGrowth: true }
        ].map((config) => ({
            ...config,
            points: config.points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
        }));

        // Vines, petioles, and nodes are merged by material. Leaves remain two
        // instanced meshes, keeping the whole plant inexpensive to render.
        const vineGeometries = [];
        const nodeGeometries = [];
        const petioleGeometries = [];
        /** @type {THREE.Matrix4[]} */
        const veinInstances = [];
        /** @type {{ matrix: THREE.Matrix4, isNewGrowth: boolean, variation: number }[]} */
        const leafInstances = [];

        vineConfigs.forEach((config, vineIndex) => {
            const curve = new THREE.CatmullRomCurve3(config.points, false, 'catmullrom', 0.5);
            vineGeometries.push(new THREE.TubeGeometry(curve, 14, 0.008, 6, false));

            // Add leaves along vine
            for (let i = 0; i < config.leafCount; i++) {
                const t = (i + 0.5) / config.leafCount;
                const position = curve.getPointAt(t);
                const tangent = curve.getTangentAt(t);
                const seed = vineIndex * 100 + i; // stable per-leaf jitter seed

                const side = (i % 2) * 2 - 1;
                const up = new THREE.Vector3(0, 1, 0);
                const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
                const leafPos = position.clone();
                leafPos.add(right.multiplyScalar(side * (0.045 + jitter(seed * 2.1) * 0.018)));
                leafPos.y += (jitter(seed * 3.7) - 0.5) * 0.025;

                petioleGeometries.push(new THREE.TubeGeometry(
                    new THREE.LineCurve3(position, leafPos),
                    4,
                    0.0038,
                    5,
                    false
                ));

                const node = unitNodeGeometry.clone();
                node.translate(position.x, position.y, position.z);
                nodeGeometries.push(node);

                const isNewGrowth = config.isNewGrowth || t > 0.7;
                const leafScale = isNewGrowth
                    ? 0.58 + jitter(seed * 7.3) * 0.18
                    : 0.78 + jitter(seed * 7.3) * 0.30;

                // The leaf face stays mostly toward the room, with small natural
                // yaw/bank variation and a stronger downward pitch on long vines.
                const droopAngle = -0.18 - t * 0.35 + (jitter(seed * 23.1) - 0.5) * 0.16;
                const yAngle = Math.atan2(tangent.x, tangent.z) + side * 0.42 + (jitter(seed * 11.1) - 0.5) * 0.92;
                const twistAngle = (jitter(seed * 13.7) - 0.5) * 0.52;

                const quaternion = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(droopAngle, yAngle, twistAngle)
                );
                const matrix = new THREE.Matrix4().compose(
                    leafPos,
                    quaternion,
                    new THREE.Vector3(
                        leafScale * (0.86 + jitter(seed * 29.7) * 0.22),
                        leafScale,
                        leafScale
                    )
                );

                leafInstances.push({ matrix, isNewGrowth, variation: jitter(seed * 17.9) * 0.3 });
                const veinMatrix = new THREE.Matrix4().makeTranslation(0, -0.072, 0.022);
                veinInstances.push(matrix.clone().multiply(veinMatrix));
            }
        });

        const mergedVines = BufferGeometryUtils.mergeGeometries(vineGeometries.concat(petioleGeometries));
        const vine = new THREE.Mesh(
            mergedVines,
            vineMaterial
        );
        vine.castShadow = true;
        group.add(vine);

        const nodes = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(nodeGeometries),
            nodeMaterial
        );
        nodes.castShadow = true;
        group.add(nodes);

        const baseHue = 0.285;
        /**
         * @param {{ matrix: THREE.Matrix4, variation: number }[]} instances
         * @param {boolean} isNewGrowth
         */
        const createLeafInstancedMesh = (instances, isNewGrowth) => {
            if (instances.length === 0) return null;
            const material = new THREE.MeshPhysicalMaterial({
                roughness: isNewGrowth ? 0.5 : 0.64,
                metalness: 0.02,
                sheen: 0.16,
                sheenColor: isNewGrowth ? 0x9abc72 : 0x5f8b4e,
                sheenRoughness: 0.62,
                side: THREE.DoubleSide,
                vertexColors: true
            });
            const mesh = new THREE.InstancedMesh(unitLeafGeometry, material, instances.length);
            const color = new THREE.Color();
            instances.forEach((instance, i) => {
                mesh.setMatrixAt(i, instance.matrix);
                const saturation = isNewGrowth ? 0.48 : 0.46 + instance.variation * 0.16;
                const lightness = isNewGrowth ? 0.36 : 0.22 + instance.variation * 0.09;
                color.setHSL(baseHue, saturation, lightness);
                mesh.setColorAt(i, color);
            });
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        };

        const regularLeaves = createLeafInstancedMesh(leafInstances.filter((l) => !l.isNewGrowth), false);
        const newGrowthLeaves = createLeafInstancedMesh(leafInstances.filter((l) => l.isNewGrowth), true);
        if (regularLeaves) group.add(regularLeaves);
        if (newGrowthLeaves) group.add(newGrowthLeaves);

        const leafVeins = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.0032, 0.0012, 0.17, 5),
            new THREE.MeshStandardMaterial({ color: 0x2d5630, roughness: 0.8 }),
            veinInstances.length
        );
        veinInstances.forEach((matrix, index) => leafVeins.setMatrixAt(index, matrix));
        leafVeins.instanceMatrix.needsUpdate = true;
        leafVeins.castShadow = false;
        group.add(leafVeins);

        addContactShadow(group, 0.58, 0.44, -0.005);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'shelfPlant', label: 'Pothos - Work-Life Balance' };
        return group;
    }

    /**
     * Create a small Tidbyt-style LED matrix display on the shelf (Phase 5.5).
     * A beveled wood-tone box with an emissive coarse-pixel-grid canvas
     * texture on the bloom layer, so the LED matrix glows like the monitor
     * and lamp rather than reading as a flat colored plane.
     */
    createTidbyt() {
        const group = new THREE.Group();
        const origin = this.origins.tidbyt;

        const bodyWidth = 0.42;
        const bodyHeight = 0.26;
        const bodyDepth = 0.09;

        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a4632,
            roughness: 0.6,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.1
        });
        const body = new THREE.Mesh(createBeveledBox(bodyWidth, bodyHeight, bodyDepth, 0.004, 2), bodyMaterial);
        body.position.set(0, bodyHeight / 2, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Coarse LED-matrix canvas: a low-res dot grid upscaled with nearest-
        // neighbor sampling so each "pixel" reads as a distinct LED rather
        // than blurring into a smooth gradient.
        const gridWidth = 32;
        const gridHeight = 16;
        const { texture: matrixTexture } = createCanvasTexture(gridWidth, gridHeight, (ctx) => {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, gridWidth, gridHeight);

            // A simple readable glyph pattern: a smiling pixel face, cheap to
            // hand-place and instantly reads as "a tiny LED display" rather
            // than noise.
            const lit = [
                [10, 4], [11, 4], [20, 4], [21, 4],
                [10, 5], [11, 5], [20, 5], [21, 5],
                [8, 9], [9, 10], [10, 11], [11, 11], [12, 11], [13, 11],
                [14, 11], [15, 11], [16, 11], [17, 11], [18, 11], [19, 11],
                [20, 11], [21, 11], [22, 11], [23, 10], [24, 9]
            ];
            ctx.fillStyle = '#ff9d2e';
            lit.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
        });
        matrixTexture.magFilter = THREE.NearestFilter;
        matrixTexture.minFilter = THREE.NearestFilter;
        if (matrixTexture.colorSpace !== undefined) matrixTexture.colorSpace = THREE.SRGBColorSpace;

        const screenWidth = bodyWidth * 0.82;
        const screenHeight = bodyHeight * 0.68;
        const bezel = new THREE.Mesh(
            new THREE.BoxGeometry(screenWidth + 0.028, screenHeight + 0.028, 0.008),
            new THREE.MeshStandardMaterial({ color: 0x12100e, roughness: 0.42, metalness: 0.1 })
        );
        bezel.position.set(0, bodyHeight / 2, bodyDepth / 2 + 0.003);
        bezel.castShadow = false;
        group.add(bezel);

        const screenMaterial = new THREE.MeshStandardMaterial({
            map: matrixTexture,
            emissive: 0xffffff,
            emissiveMap: matrixTexture,
            emissiveIntensity: 2.0,
            roughness: 0.32,
            metalness: 0.0
        });
        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(screenWidth, screenHeight),
            screenMaterial
        );
        screen.position.set(0, bodyHeight / 2, bodyDepth / 2 + 0.009);
        screen.layers.enable(1); // Bloom layer -- LEDs should glow like the monitor/lamp
        group.add(screen);

        addContactShadow(group, bodyWidth * 1.1, bodyDepth * 2.2, -0.001);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'tidbyt', label: 'Tidbyt - Daily Dashboard' };
        return group;
    }
}

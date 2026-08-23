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
        const pageMaterial = new THREE.MeshStandardMaterial({ color: 0xede4d0, roughness: 0.85 });
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
            color: 0xc4713f,  // Terracotta orange
            roughness: 0.88,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.0,
            clearcoat: 0.05,
            clearcoatRoughness: 0.85
        });
        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0xb8623a,  // Slightly darker rim
            roughness: 0.75,
            metalness: 0.0
        });
        const soilMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d2817,
            roughness: 0.95,
            metalness: 0.0
        });
        const vineMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a7a4a,
            roughness: 0.55,
            metalness: 0.0
        });
        const nodeMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a7a4a,
            roughness: 0.5,
            metalness: 0.0
        });

        // === TERRACOTTA POT ===
        const potGeometry = new THREE.CylinderGeometry(0.21, 0.16, 0.28, 20);
        const pot = new THREE.Mesh(potGeometry, potMaterial);
        pot.position.y = 0.14;  // Half height, sitting on shelf
        pot.castShadow = true;
        pot.receiveShadow = true;
        group.add(pot);

        // Decorative rim at top of pot
        const rimGeometry = new THREE.TorusGeometry(0.21, 0.019, 8, 24);
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.position.y = 0.28;
        rim.rotation.x = Math.PI / 2;
        rim.castShadow = true;
        group.add(rim);

        // === MOUNDED SOIL ===
        const soilGeometry = new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        soilGeometry.scale(1, 0.25, 1);  // Flatten to mound shape
        const soil = new THREE.Mesh(soilGeometry, soilMaterial);
        soil.position.y = 0.28;  // At pot rim level
        soil.castShadow = true;
        group.add(soil);

        // === HEART-SHAPED LEAF GEOMETRY ===
        // Built once at unit scale and reused across every instance; per-leaf size
        // is applied via the instance matrix's uniform scale instead of baking a
        // unique geometry per leaf. The curvature below
        // is a function of local (unit-scale) coordinates, so a uniform post-scale
        // reproduces exactly what baking `scale` into w/h/curveFactor used to produce.
        const createHeartLeaf = () => {
            const shape = new THREE.Shape();
            const w = 0.07;  // Larger leaves
            const h = 0.09;

            // Heart/pothos leaf shape using bezier curves
            shape.moveTo(0, -h);  // Bottom tip (pointed end)

            // Right side curve
            shape.bezierCurveTo(
                w * 0.4, -h * 0.6,   // Control 1
                w * 0.9, -h * 0.1,   // Control 2
                w * 0.8, h * 0.3     // End point
            );

            // Right top lobe
            shape.bezierCurveTo(
                w * 0.7, h * 0.6,    // Control 1
                w * 0.3, h * 0.8,    // Control 2
                0, h * 0.6           // Top center (slight indent)
            );

            // Left top lobe
            shape.bezierCurveTo(
                -w * 0.3, h * 0.8,   // Control 1
                -w * 0.7, h * 0.6,   // Control 2
                -w * 0.8, h * 0.3    // End point
            );

            // Left side curve back to tip
            shape.bezierCurveTo(
                -w * 0.9, -h * 0.1,  // Control 1
                -w * 0.4, -h * 0.6,  // Control 2
                0, -h                // Back to bottom tip
            );

            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: 0.006,
                bevelEnabled: true,
                bevelThickness: 0.003,
                bevelSize: 0.003,
                bevelSegments: 2
            });

            // Apply natural curvature to leaf (droop from center vein)
            const positions = geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);

                // Curve downward from center vein (center line)
                const curveFactor = Math.pow(Math.abs(x) / (w * 0.8), 2) * 0.02;
                positions.setZ(i, positions.getZ(i) - curveFactor);

                // Slight lengthwise droop toward tip
                const lengthDroop = (y < 0) ? Math.abs(y / h) * 0.008 : 0;
                positions.setZ(i, positions.getZ(i) - lengthDroop);
            }
            geometry.computeVertexNormals();

            return geometry;
        };

        const unitLeafGeometry = createHeartLeaf();
        // One shared, reused sphere for every vine node -- cloned and translated
        // per node instead of being reconstructed from scratch each time, then
        // merged into a single mesh below.
        const unitNodeGeometry = new THREE.SphereGeometry(0.01, 6, 4);
        unitNodeGeometry.scale(1, 1.3, 1); // Slightly elongated

        // === VINE CONFIGURATIONS ===
        // Using CatmullRomCurve3 for natural, organic paths with multiple bends
        // Vines clustered close together, overlapping is fine
        const vineConfigs = [
            {
                // Vine 1: Trails forward-left with organic bends
                points: [
                    new THREE.Vector3(-0.04, 0.30, 0.10),
                    new THREE.Vector3(-0.08, 0.18, 0.30),
                    new THREE.Vector3(-0.12, -0.10, 0.42),
                    new THREE.Vector3(-0.08, -0.40, 0.46),
                    new THREE.Vector3(-0.14, -0.75, 0.44)
                ],
                leafCount: 5
            },
            {
                // Vine 2: Trails forward-right with S-curve
                points: [
                    new THREE.Vector3(0.04, 0.30, 0.10),
                    new THREE.Vector3(0.08, 0.15, 0.28),
                    new THREE.Vector3(0.12, -0.15, 0.40),
                    new THREE.Vector3(0.06, -0.45, 0.44),
                    new THREE.Vector3(0.14, -0.80, 0.42)
                ],
                leafCount: 6
            },
            {
                // Vine 3: Trails straight forward, longest with multiple bends
                points: [
                    new THREE.Vector3(0, 0.30, 0.12),
                    new THREE.Vector3(0.02, 0.12, 0.35),
                    new THREE.Vector3(-0.02, -0.20, 0.46),
                    new THREE.Vector3(0.04, -0.55, 0.48),
                    new THREE.Vector3(0, -0.95, 0.45)
                ],
                leafCount: 7
            },
            {
                // Vine 4: Another front vine, slightly left with wave
                points: [
                    new THREE.Vector3(-0.02, 0.30, 0.11),
                    new THREE.Vector3(-0.05, 0.10, 0.32),
                    new THREE.Vector3(-0.10, -0.25, 0.44),
                    new THREE.Vector3(-0.04, -0.55, 0.46),
                    new THREE.Vector3(-0.10, -0.85, 0.43)
                ],
                leafCount: 6
            },
            {
                // Vine 5: Trails off left side with organic curve
                points: [
                    new THREE.Vector3(-0.08, 0.30, 0.04),
                    new THREE.Vector3(-0.22, 0.18, 0.10),
                    new THREE.Vector3(-0.38, -0.05, 0.14),
                    new THREE.Vector3(-0.45, -0.35, 0.18),
                    new THREE.Vector3(-0.55, -0.70, 0.14)
                ],
                leafCount: 5
            },
            {
                // Vine 6: Another vine trailing left with different path
                points: [
                    new THREE.Vector3(-0.10, 0.30, 0.00),
                    new THREE.Vector3(-0.25, 0.12, 0.04),
                    new THREE.Vector3(-0.40, -0.18, 0.08),
                    new THREE.Vector3(-0.50, -0.50, 0.10),
                    new THREE.Vector3(-0.60, -0.85, 0.06)
                ],
                leafCount: 6
            },
            {
                // Vine 7: Front-left outer edge
                points: [
                    new THREE.Vector3(-0.06, 0.30, 0.09),
                    new THREE.Vector3(-0.14, 0.14, 0.28),
                    new THREE.Vector3(-0.18, -0.18, 0.40),
                    new THREE.Vector3(-0.12, -0.50, 0.44),
                    new THREE.Vector3(-0.20, -0.88, 0.40)
                ],
                leafCount: 6
            },
            {
                // Vine 8: Front-right outer edge
                points: [
                    new THREE.Vector3(0.06, 0.30, 0.09),
                    new THREE.Vector3(0.14, 0.12, 0.26),
                    new THREE.Vector3(0.18, -0.20, 0.38),
                    new THREE.Vector3(0.10, -0.52, 0.42),
                    new THREE.Vector3(0.18, -0.90, 0.38)
                ],
                leafCount: 5
            },
            {
                // Vine 9: Additional left-trailing vine
                points: [
                    new THREE.Vector3(-0.06, 0.30, 0.02),
                    new THREE.Vector3(-0.18, 0.20, 0.08),
                    new THREE.Vector3(-0.32, -0.02, 0.12),
                    new THREE.Vector3(-0.42, -0.38, 0.15),
                    new THREE.Vector3(-0.52, -0.78, 0.10)
                ],
                leafCount: 5
            },
            {
                // Vine 10: Short upright (stays near pot, new growth)
                points: [
                    new THREE.Vector3(-0.03, 0.30, 0.00),
                    new THREE.Vector3(-0.05, 0.38, 0.05),
                    new THREE.Vector3(-0.07, 0.32, 0.10)
                ],
                leafCount: 3,
                isNewGrowth: true
            },
            {
                // Vine 11: Another short upright on right
                points: [
                    new THREE.Vector3(0.03, 0.30, 0.02),
                    new THREE.Vector3(0.06, 0.40, 0.04),
                    new THREE.Vector3(0.08, 0.34, 0.08)
                ],
                leafCount: 2,
                isNewGrowth: true
            }
        ];

        // === BUILD VINE/NODE/LEAF DATA ===
        // 11 vine tubes and 56 node spheres are collected here and merged into two
        // draw calls below; the 56 leaves are collected as instance transforms for
        // two InstancedMeshes (regular vs. new-growth). This replaces what used to
        // be ~127 individual meshes/materials -- roughly half the scene's draw calls
        // -- with ~4.
        const vineGeometries = [];
        const nodeGeometries = [];
        /** @type {{ matrix: THREE.Matrix4, isNewGrowth: boolean, variation: number }[]} */
        const leafInstances = [];

        vineConfigs.forEach((config, vineIndex) => {
            // Use CatmullRomCurve3 for smooth organic curves through multiple points
            const curve = new THREE.CatmullRomCurve3(config.points, false, 'catmullrom', 0.5);

            // Create vine using TubeGeometry
            const vineGeometry = new THREE.TubeGeometry(curve, 16, 0.008, 6, false);

            // Taper the vine (thinner at end)
            const vinePositions = vineGeometry.attributes.position;
            const tubeSegments = 16;
            const radialSegments = 6;

            for (let i = 0; i < vinePositions.count; i++) {
                // Approximate t position along tube
                const segmentIndex = Math.floor(i / (radialSegments + 1));
                const t = segmentIndex / tubeSegments;

                // Taper factor (1.0 at start, 0.6 at end)
                const taper = 1.0 - t * 0.4;

                // Get current position relative to curve point
                const curvePoint = curve.getPointAt(Math.min(t, 1));
                const dx = vinePositions.getX(i) - curvePoint.x;
                const dy = vinePositions.getY(i) - curvePoint.y;
                const dz = vinePositions.getZ(i) - curvePoint.z;

                // Apply taper
                vinePositions.setX(i, curvePoint.x + dx * taper);
                vinePositions.setY(i, curvePoint.y + dy * taper);
                vinePositions.setZ(i, curvePoint.z + dz * taper);
            }
            vineGeometry.computeVertexNormals();
            vineGeometries.push(vineGeometry);

            // Add leaves along vine
            for (let i = 0; i < config.leafCount; i++) {
                const t = (i + 0.5) / config.leafCount;
                const position = curve.getPointAt(t);
                const tangent = curve.getTangentAt(t);
                const seed = vineIndex * 100 + i; // stable per-leaf jitter seed

                // Alternate sides for leaves
                const side = (i % 2) * 2 - 1;
                const up = new THREE.Vector3(0, 1, 0);
                const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

                // Offset leaf position slightly from vine
                const leafPos = position.clone();
                leafPos.add(right.multiplyScalar(side * 0.025));

                // Node at leaf attachment point -- translated clone, merged below
                const node = unitNodeGeometry.clone();
                node.translate(position.x, position.y, position.z);
                nodeGeometries.push(node);

                // Leaf scale: smaller at tips (newer growth)
                const isNewGrowth = config.isNewGrowth || t > 0.7;
                const leafScale = isNewGrowth
                    ? 0.6 + jitter(seed * 7.3) * 0.2
                    : 0.8 + jitter(seed * 7.3) * 0.3;

                // Leaf rotation: face outward, droop increases toward tip
                const droopAngle = -0.4 - t * 0.4;  // More droop at end
                const outwardAngle = side * Math.PI / 3 + (jitter(seed * 11.1) - 0.5) * 0.3;
                const twistAngle = (jitter(seed * 13.7) - 0.5) * 0.2;
                const yAngle = Math.atan2(tangent.x, tangent.z) + outwardAngle;

                const quaternion = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(droopAngle, yAngle, twistAngle)
                );
                const matrix = new THREE.Matrix4().compose(
                    leafPos,
                    quaternion,
                    new THREE.Vector3(leafScale, leafScale, leafScale)
                );

                leafInstances.push({ matrix, isNewGrowth, variation: jitter(seed * 17.9) * 0.3 });
            }
        });

        // One merged mesh for all 11 vine tubes (same material already)
        const vine = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(vineGeometries),
            vineMaterial
        );
        vine.castShadow = true;
        group.add(vine);

        // One merged mesh for all 56 vine nodes
        const nodes = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(nodeGeometries),
            nodeMaterial
        );
        nodes.castShadow = true;
        group.add(nodes);

        // Two InstancedMeshes (regular vs. new-growth leaves) -- per-instance color
        // via instanceColor carries the original HSL variation; per-leaf roughness
        // variation collapses to one value per growth tier since both tiers now
        // share a single material (per-instance roughness isn't supported).
        const baseHue = 0.33; // Green
        /**
         * @param {{ matrix: THREE.Matrix4, variation: number }[]} instances
         * @param {boolean} isNewGrowth
         */
        const createLeafInstancedMesh = (instances, isNewGrowth) => {
            if (instances.length === 0) return null;
            const material = new THREE.MeshStandardMaterial({
                roughness: isNewGrowth ? 0.52 : 0.68,
                metalness: isNewGrowth ? 0.08 : 0.05,
                side: THREE.DoubleSide,
                vertexColors: true
            });
            const mesh = new THREE.InstancedMesh(unitLeafGeometry, material, instances.length);
            const color = new THREE.Color();
            instances.forEach((instance, i) => {
                mesh.setMatrixAt(i, instance.matrix);
                const saturation = isNewGrowth ? 0.55 : 0.5 + instance.variation * 0.1;
                const lightness = isNewGrowth ? 0.32 : 0.26 + instance.variation * 0.05;
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

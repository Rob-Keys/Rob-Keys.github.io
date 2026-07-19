// @ts-check
/**
 * Shelf objects creation
 * Handles books, plants, and other items that sit on shelves
 */

import {
    applyOrigin,
    createBeveledBox,
    createPaperGrainNormalTexture,
    createRoughnessVariationTexture
} from '../systems/utils.js';
import { OBJECT_ORIGINS } from '../config/config.js';

export class ShelfObjectFactory {
    constructor(scene) {
        this.scene = scene;
        this.interactiveObjects = [];

        // Use centralized origins from config
        this.origins = OBJECT_ORIGINS.shelf;
    }

    /**
     * Create simple books - solid color rectangles for performance
     */
    createShelfBooks() {
        const group = new THREE.Group();
        const origin = this.origins.books;

        // Simple book data: color, width, offsetX
        const books = [
            { color: 0x8B0000, width: 0.06, offsetX: -0.9 },
            { color: 0x1e3a8a, width: 0.07, offsetX: -0.82 },
            { color: 0x1a472a, width: 0.05, offsetX: -0.73 }
        ];

        const bookHeight = 0.35;
        const bookDepth = 0.25;

        // Pre-create materials (reusable pattern - each book has different color so separate materials needed)
        const bookGrainTexture = createPaperGrainNormalTexture();
        const materials = books.map(data => new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: 0.7,
            normalMap: bookGrainTexture,
            normalScale: new THREE.Vector2(0.12, 0.12)
        }));

        books.forEach((data, index) => {
            const geometry = createBeveledBox(data.width, bookHeight, bookDepth, 0.004, 2);
            const book = new THREE.Mesh(geometry, materials[index]);
            book.position.set(data.offsetX, bookHeight / 2 + 0.08, 0.15);
            book.rotation.z = (index - 1) * 0.03;
            book.castShadow = true;
            book.receiveShadow = true;
            group.add(book);
        });

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'books', label: 'Books - Knowledge Base' };
        this.interactiveObjects.push(group);
        return group;
    }

    createShelfPlant() {
        const group = new THREE.Group();
        const origin = this.origins.shelfPlant;

        // === MATERIALS ===
        const potMaterial = new THREE.MeshStandardMaterial({
            color: 0xc4713f,  // Terracotta orange
            roughness: 0.8,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.0
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
        const potGeometry = new THREE.CylinderGeometry(0.22, 0.16, 0.26, 16);
        const pot = new THREE.Mesh(potGeometry, potMaterial);
        pot.position.y = 0.13;  // Half height, sitting on shelf
        pot.castShadow = true;
        pot.receiveShadow = true;
        group.add(pot);

        // Decorative rim at top of pot
        const rimGeometry = new THREE.TorusGeometry(0.22, 0.018, 8, 24);
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.position.y = 0.26;
        rim.rotation.x = Math.PI / 2;
        rim.castShadow = true;
        group.add(rim);

        // === MOUNDED SOIL ===
        const soilGeometry = new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        soilGeometry.scale(1, 0.25, 1);  // Flatten to mound shape
        const soil = new THREE.Mesh(soilGeometry, soilMaterial);
        soil.position.y = 0.26;  // At pot rim level
        soil.castShadow = true;
        group.add(soil);

        // === HEART-SHAPED LEAF GEOMETRY ===
        const createHeartLeaf = (scale = 1.0) => {
            const shape = new THREE.Shape();
            const w = 0.07 * scale;  // Larger leaves
            const h = 0.09 * scale;

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
                const curveFactor = Math.pow(Math.abs(x) / (w * 0.8), 2) * 0.02 * scale;
                positions.setZ(i, positions.getZ(i) - curveFactor);

                // Slight lengthwise droop toward tip
                const lengthDroop = (y < 0) ? Math.abs(y / h) * 0.008 * scale : 0;
                positions.setZ(i, positions.getZ(i) - lengthDroop);
            }
            geometry.computeVertexNormals();

            return geometry;
        };

        // Create leaf material with variation
        const createLeafMaterial = (isNewGrowth = false, variation = 0) => {
            const baseHue = 0.33;  // Green
            const saturation = isNewGrowth ? 0.55 : 0.5 + variation * 0.1;
            const lightness = isNewGrowth ? 0.32 : 0.26 + variation * 0.05;  // Darker green

            const color = new THREE.Color().setHSL(baseHue, saturation, lightness);

            return new THREE.MeshStandardMaterial({
                color: color,
                roughness: isNewGrowth ? 0.55 : 0.65 + variation * 0.1,
                metalness: isNewGrowth ? 0.08 : 0.05,
                side: THREE.DoubleSide
            });
        };

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

        // === CREATE VINES AND LEAVES ===
        vineConfigs.forEach((config, _vineIndex) => {
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

            const vine = new THREE.Mesh(vineGeometry, vineMaterial);
            vine.castShadow = true;
            group.add(vine);

            // Add leaves along vine
            for (let i = 0; i < config.leafCount; i++) {
                const t = (i + 0.5) / config.leafCount;
                const position = curve.getPointAt(t);
                const tangent = curve.getTangentAt(t);

                // Alternate sides for leaves
                const side = (i % 2) * 2 - 1;
                const up = new THREE.Vector3(0, 1, 0);
                const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

                // Offset leaf position slightly from vine
                const leafPos = position.clone();
                leafPos.add(right.multiplyScalar(side * 0.025));

                // Create node at leaf attachment point
                const nodeGeometry = new THREE.SphereGeometry(0.01, 6, 4);
                nodeGeometry.scale(1, 1.3, 1);  // Slightly elongated
                const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
                node.position.copy(position);
                node.castShadow = true;
                group.add(node);

                // Leaf scale: smaller at tips (newer growth)
                const isNewGrowth = config.isNewGrowth || t > 0.7;
                const leafScale = isNewGrowth ? 0.6 + Math.random() * 0.2 : 0.8 + Math.random() * 0.3;

                // Create leaf
                const leafGeometry = createHeartLeaf(leafScale);
                const leafMaterial = createLeafMaterial(isNewGrowth, Math.random() * 0.3);
                const leaf = new THREE.Mesh(leafGeometry, leafMaterial);

                leaf.position.copy(leafPos);

                // Leaf rotation: face outward, droop increases toward tip
                const droopAngle = -0.4 - t * 0.4;  // More droop at end
                const outwardAngle = side * Math.PI / 3 + (Math.random() - 0.5) * 0.3;
                const twistAngle = (Math.random() - 0.5) * 0.2;

                // Calculate rotation to align with vine tangent and face outward
                leaf.rotation.x = droopAngle;
                leaf.rotation.y = Math.atan2(tangent.x, tangent.z) + outwardAngle;
                leaf.rotation.z = twistAngle;

                leaf.castShadow = true;
                leaf.receiveShadow = true;
                group.add(leaf);
            }
        });

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'shelfPlant', label: 'Pothos - Work-Life Balance' };
        this.interactiveObjects.push(group);
        return group;
    }

    getInteractiveObjects() {
        return this.interactiveObjects;
    }
}
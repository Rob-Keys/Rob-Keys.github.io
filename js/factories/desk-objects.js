// @ts-check
/**
 * Desk objects creation
 * Handles coffee mugs, desk lamps, notebooks, and other items that sit on the desk
 */

import {
    applyOrigin,
    createBeveledBox,
    createPaperGrainNormalTexture,
    createRoughnessVariationTexture
} from '../systems/utils.js';
import { SHADOW_CONFIG, OBJECT_ORIGINS } from '../config/config.js';

export class DeskObjectFactory {
    constructor(scene) {
        this.scene = scene;
        this.interactiveObjects = [];

        // Use centralized origins from config
        this.origins = OBJECT_ORIGINS.desk;
    }

    /**
     * Create notebook for desk
     */
    createNotebook() {
        const group = new THREE.Group();
        const origin = this.origins.notebook;

        const offsets = {
            cover:   { x: 0,    y: -0.17, z: 0 },
            binding: { x: -0.42, y: -0.12, z: 0 }
        };

        const coverGeometry = createBeveledBox(0.9, 0.04, 1.2, 0.006, 2);
        const coverMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c3e50,
            roughness: 0.7,
            metalness: 0.1
        });
        const cover = new THREE.Mesh(coverGeometry, coverMaterial);
        cover.position.set(offsets.cover.x, offsets.cover.y, offsets.cover.z);
        cover.castShadow = true;
        cover.receiveShadow = true;
        group.add(cover);

        // Create canvas for handwritten text
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 700; // Approx aspect ratio of 0.54/0.74
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for notebook canvas');

        // Paper background
        ctx.fillStyle = '#f8f4e8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Blue lines
        ctx.strokeStyle = '#aaccff';
        ctx.lineWidth = 2;
        const lineHeight = 50;
        const topMargin = 80;
        
        for (let y = topMargin; y < canvas.height; y += lineHeight) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Red margin line
        ctx.strokeStyle = '#ffcccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(70, 0);
        ctx.lineTo(70, canvas.height);
        ctx.stroke();

        // Handwritten text
        ctx.font = 'bold 28px "Segoe Print", "Ink Free", "Bradley Hand", "Comic Sans MS", cursive';
        ctx.fillStyle = '#1a1a4a'; // Dark blue ink
        ctx.textBaseline = 'bottom';

        const textLines = [
            "Personal Projects:",
            "",
            "SweetHopeBakeryy - Bakery site for sister: written in PHP and then migrated to JS",
            "",
            "Tidbyt - Unique clock app for physical 'Tidbyt' pixel display, in custom language",
            "",
            "Variety - Contributed to OSS Linux wallpaper manager",
        ];

        let currentY = topMargin + lineHeight; 
        const textX = 85;
        const maxWidth = 380;

        textLines.forEach(text => {
            const words = text.split(' ');
            let line = '';
            
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line, textX, currentY - 10);
                    line = words[n] + ' ';
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, textX, currentY - 10);
            currentY += lineHeight;
        });

        const pageTexture = new THREE.CanvasTexture(canvas);
        if (pageTexture.colorSpace !== undefined) pageTexture.colorSpace = THREE.SRGBColorSpace;
        else if (THREE.sRGBEncoding !== undefined) pageTexture.encoding = THREE.sRGBEncoding;

        // Bottom 7 pages — merged into a single draw call (identical material)
        const paperGrainTexture = createPaperGrainNormalTexture();
        const plainPageMaterial = new THREE.MeshStandardMaterial({
            color: 0xf8f4e8,
            roughness: 0.95,
            metalness: 0.0,
            normalMap: paperGrainTexture,
            normalScale: new THREE.Vector2(0.15, 0.15)
        });
        const pageBaseGeometry = new THREE.BoxGeometry(0.81, 0.006, 1.11);
        const bottomPageGeometries = [];
        for (let i = 0; i < 7; i++) {
            const pg = pageBaseGeometry.clone();
            pg.translate(
                offsets.cover.x + 0.015,
                offsets.cover.y + 0.025 + (i * 0.006),
                offsets.cover.z
            );
            bottomPageGeometries.push(pg);
        }
        const mergedPages = new THREE.Mesh(
            THREE.BufferGeometryUtils.mergeBufferGeometries(bottomPageGeometries),
            plainPageMaterial
        );
        mergedPages.castShadow = true;
        mergedPages.receiveShadow = true;
        group.add(mergedPages);

        // Top page with text texture
        const topPageGeometry = new THREE.BoxGeometry(0.81, 0.006, 1.11);
        const textMat = new THREE.MeshStandardMaterial({
            map: pageTexture,
            roughness: 0.95,
            metalness: 0.0,
            color: 0xffffff,
            normalMap: paperGrainTexture,
            normalScale: new THREE.Vector2(0.15, 0.15)
        });
        const topPage = new THREE.Mesh(topPageGeometry, [
            plainPageMaterial, plainPageMaterial,
            textMat, plainPageMaterial,
            plainPageMaterial, plainPageMaterial
        ]);
        topPage.position.set(
            offsets.cover.x + 0.015,
            offsets.cover.y + 0.025 + (7 * 0.006),
            offsets.cover.z
        );
        topPage.castShadow = true;
        topPage.receiveShadow = true;
        group.add(topPage);

        const bindingGeometry = new THREE.BoxGeometry(0.06, 0.08, 1.17);
        const bindingMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.8,
            metalness: 0.0
        });
        const binding = new THREE.Mesh(bindingGeometry, bindingMaterial);
        binding.position.set(offsets.binding.x, offsets.binding.y, offsets.binding.z);
        binding.castShadow = true;
        binding.receiveShadow = true;
        group.add(binding);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'notebook', label: 'Notebook - Personal Projects' };
        this.interactiveObjects.push(group);
        return group;
    }

    createCoffeeMug() {
        const group = new THREE.Group();
        const origin = this.origins.coffee;

        const cupHeight = 0.8;
        const cupTopRadius = 0.2;
        const cupBottomRadius = 0.12;

        const offsets = {
            cup:    { x: 0, y: 0, z: 0 },
            sleeve: { x: 0, y: -0.02, z: 0 },
            lid:    { x: 0, y: cupHeight / 2 + 0.01, z: 0 }
        };

        const cupGeometry = new THREE.CylinderGeometry(cupTopRadius, cupBottomRadius, cupHeight, 32, 1, true);
        const cupMaterial = new THREE.MeshStandardMaterial({
            color: 0xfafafa,
            roughness: 0.85,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        const cup = new THREE.Mesh(cupGeometry, cupMaterial);
        cup.position.set(offsets.cup.x, offsets.cup.y, offsets.cup.z);
        cup.castShadow = true;
        cup.receiveShadow = true;
        group.add(cup);

        const sleeveHeight = cupHeight * 0.4;
        const sleeveTopRadius = cupBottomRadius + (cupTopRadius - cupBottomRadius) * 0.55 + 0.035;
        const sleeveBottomRadius = cupBottomRadius + (cupTopRadius - cupBottomRadius) * 0.15 + 0.025;

        const sleeveGeometry = new THREE.CylinderGeometry(
            sleeveTopRadius,
            sleeveBottomRadius,
            sleeveHeight,
            32,
            1,
            true
        );
        const sleeveMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B6914,
            roughness: 0.9,
            metalness: 0.0
        });
        const sleeve = new THREE.Mesh(sleeveGeometry, sleeveMaterial);
        sleeve.position.set(offsets.sleeve.x, offsets.sleeve.y + 0.15, offsets.sleeve.z);
        sleeve.castShadow = true;
        group.add(sleeve);

        // Thin coffee disk near top of cup
        const coffeeLevel = cupHeight / 2 - 0.08;
        const coffeeRadius = cupTopRadius - 0.015;

        const coffeeGeometry = new THREE.CylinderGeometry(coffeeRadius, coffeeRadius, 0.001, 32);
        const coffeeMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d2314,
            roughness: 0.05, // Very smooth liquid surface for realistic reflection
            metalness: 0.0,
            envMapIntensity: 0.6 // Reflect environment for liquid look
        });
        const coffee = new THREE.Mesh(coffeeGeometry, coffeeMaterial);
        coffee.position.set(offsets.cup.x, coffeeLevel, offsets.cup.z);
        group.add(coffee);

        // Corrugated texture lines on sleeve — merged into a single draw call
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0x6B4F0A,
            roughness: 0.95,
            metalness: 0.0
        });
        const lineGeometries = [];
        for (let i = 0; i < 12; i++) {
            const lineGeometry = new THREE.CylinderGeometry(
                sleeveTopRadius + 0.002,
                sleeveBottomRadius + 0.002,
                0.008,
                32,
                1,
                true
            );
            const lineY = offsets.sleeve.y - sleeveHeight / 2 + (i + 0.5) * (sleeveHeight / 12);
            lineGeometry.translate(offsets.sleeve.x, lineY, offsets.sleeve.z);
            lineGeometries.push(lineGeometry);
        }
        const mergedLines = new THREE.Mesh(
            THREE.BufferGeometryUtils.mergeBufferGeometries(lineGeometries),
            lineMaterial
        );
        mergedLines.castShadow = true;
        group.add(mergedLines);

        // Steam wisps rising from coffee surface
        const createSteamWisp = () => {
            // Elongated plane for wispy steam appearance
            const wispHeight = 0.04 + Math.random() * 0.06;
            const wispWidth = 0.015 + Math.random() * 0.02;
            const steamGeometry = new THREE.PlaneGeometry(wispWidth, wispHeight);
            const steamMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15 + Math.random() * 0.1,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const steam = new THREE.Mesh(steamGeometry, steamMaterial);

            // Start from coffee surface area
            const startX = offsets.cup.x + (Math.random() - 0.5) * 0.15;
            const startZ = offsets.cup.z + (Math.random() - 0.5) * 0.15;
            steam.position.set(
                startX,
                coffeeLevel + 0.02 + Math.random() * 0.1,
                startZ
            );

            // Random rotation for variety
            steam.rotation.y = Math.random() * Math.PI * 2;
            steam.rotation.z = (Math.random() - 0.5) * 0.3;

            steam.userData = {
                isSteam: true,
                initialOpacity: steam.material.opacity,
                velocity: {
                    y: 0.0015 + Math.random() * 0.002,
                    x: (Math.random() - 0.5) * 0.0006,
                    z: (Math.random() - 0.5) * 0.0006
                },
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                scaleGrowth: 1.005 + Math.random() * 0.005,
                lifetime: 100 + Math.random() * 100
            };
            return steam;
        };

        // Add initial steam particles
        for (let i = 0; i < 6; i++) {
            const steam = createSteamWisp();
            group.add(steam);
        }

        // Store steam animation function
        const animateSteamFunc = function() {
            const steamParticles = this.children.filter(child => child.userData.isSteam);

            steamParticles.forEach((steam) => {
                steam.position.y += steam.userData.velocity.y;
                steam.position.x += steam.userData.velocity.x;
                steam.position.z += steam.userData.velocity.z;

                steam.userData.lifetime--;
                if (steam.userData.lifetime < 25) {
                    steam.material.opacity = steam.userData.lifetime / 25 * 0.25;
                }

                if (steam.userData.lifetime <= 0) {
                    this.remove(steam);
                    const newSteam = createSteamWisp();
                    this.add(newSteam);
                }
            });
        };

        applyOrigin(group, origin);
        group.userData = { name: 'coffee', label: 'Starbucks - What Drives Me', animateSteam: animateSteamFunc };
        this.interactiveObjects.push(group);
        return group;
    }

    createDeskLamp() {
        const group = new THREE.Group();
        const origin = this.origins.lamp;

        // Shared materials
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.3,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.8,
        });

        const chromeMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.1,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.9
        });

        // Heavy circular base for stability
        const baseGeometry = new THREE.CylinderGeometry(0.28, 0.35, 0.08, 24);
        const base = new THREE.Mesh(baseGeometry, metalMaterial);
        base.position.set(0, -0.15, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Vertical stem rising from base center
        const stemHeight = 0.55;
        const stemGeometry = new THREE.CylinderGeometry(0.035, 0.04, stemHeight, 16);
        const stem = new THREE.Mesh(stemGeometry, chromeMaterial);
        stem.position.set(0, -0.11 + stemHeight / 2, 0);
        stem.castShadow = true;
        group.add(stem);

        // Pivot joint at top of stem
        const jointGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const joint = new THREE.Mesh(jointGeometry, chromeMaterial);
        const jointY = -0.11 + stemHeight;
        joint.position.set(0, jointY, 0);
        joint.castShadow = true;
        group.add(joint);

        // Angled neck extending toward the notebook
        const neckLength = 0.6;
        const neckAngleX = Math.PI / 4;  // 45° tilt forward (toward +z / notebook)
        const neckAngleZ = -Math.PI / 12; // slight tilt left (toward notebook x)

        const neckGroup = new THREE.Group();
        const neckGeometry = new THREE.CylinderGeometry(0.025, 0.03, neckLength, 12);
        neckGeometry.translate(0, neckLength / 2, 0);  // pivot from base
        const neck = new THREE.Mesh(neckGeometry, chromeMaterial);
        neck.castShadow = true;
        neckGroup.add(neck);

        neckGroup.position.set(0, jointY, 0);
        neckGroup.rotation.x = neckAngleX;
        neckGroup.rotation.z = neckAngleZ;
        group.add(neckGroup);

        // Calculate where the neck ends (for shade placement)
        const neckEndY = jointY + Math.cos(neckAngleX) * neckLength;
        const neckEndZ = Math.sin(neckAngleX) * neckLength;
        const neckEndX = -Math.sin(neckAngleZ) * Math.cos(neckAngleX) * neckLength;

        // Lamp head assembly positioned at neck end
        const headGroup = new THREE.Group();

        // Conical shade - wider at bottom where light exits
        // Cone tip is at top (y=+height/2), open base at bottom (y=-height/2)
        const shadeHeight = 0.22;
        const shadeRadius = 0.18;
        const shadeGeometry = new THREE.ConeGeometry(shadeRadius, shadeHeight, 24, 1, true);
        const shadeMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d4a2d,
            roughness: 0.4,
            metalness: 0.3,
            side: THREE.DoubleSide
        });
        const shade = new THREE.Mesh(shadeGeometry, shadeMaterial);
        shade.castShadow = true;
        headGroup.add(shade);

        // Inner reflective surface
        const innerShadeGeometry = new THREE.ConeGeometry(0.16, 0.20, 16, 1, true);
        const innerShadeMaterial = new THREE.MeshStandardMaterial({
            color: 0xeeeeee,
            roughness: 0.1,
            metalness: 0.8,
            side: THREE.BackSide
        });
        const innerShade = new THREE.Mesh(innerShadeGeometry, innerShadeMaterial);
        innerShade.castShadow = true;
        headGroup.add(innerShade);

        // Light bulb positioned inside the cone shade
        // Cone extends from y=-shadeHeight/2 (open base) to y=+shadeHeight/2 (tip)
        // Place bulb in the upper portion of the cone interior
        const bulbY = shadeHeight * 0.15; // Inside cone, toward the narrow end
        const bulbGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        const bulbMaterial = new THREE.MeshStandardMaterial({
            color: 0xfff8e0,
            emissive: 0xffaa44,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.95,
            roughness: 0.1,
            metalness: 0.0
        });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.set(0, bulbY, 0);
        bulb.castShadow = true;
        bulb.layers.enable(1); // Add to bloom layer
        headGroup.add(bulb);

        // Inner glow sphere for volumetric light effect
        const glowGeometry = new THREE.SphereGeometry(0.055, 12, 12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd88,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(0, bulbY, 0);
        glow.layers.enable(1); // Add to bloom layer
        headGroup.add(glow);

        // Position head at end of neck, shade opening faces forward and down toward desk
        headGroup.position.set(neckEndX, neckEndY, neckEndZ);
        headGroup.rotation.x = - Math.PI / 6;  // opening faces forward (+Z) and tilts down
        headGroup.rotation.z = neckAngleZ;
        group.add(headGroup);

        // Main SpotLight aimed at the notebook for focused illumination
        // Warm color temperature (2700K-ish) for realistic incandescent light
        // Target the center of the notebook page (offset from origin to account for page center)
        const notebookRelative = {
            x: this.origins.notebook.x - origin.x + 0.5,  // Offset toward page center X
            y: this.origins.notebook.y - origin.y,
            z: this.origins.notebook.z - origin.z // Offset toward page center Z
        };

        // SpotLight aimed at the notebook - warm incandescent color
        // Wider angle (PI/2.5 ~72°) with softer penumbra to cover entire notebook page
        const spotLight = new THREE.SpotLight(0xffddaa, 0.8, 6, Math.PI / 2.5, 0.6, 2); // decay: 2 for physical falloff
        spotLight.position.set(neckEndX, neckEndY - 0.05, neckEndZ);
        spotLight.target.position.set(notebookRelative.x, notebookRelative.y, notebookRelative.z);
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = SHADOW_CONFIG.lamp.mapSize;
        spotLight.shadow.mapSize.height = SHADOW_CONFIG.lamp.mapSize;
        spotLight.shadow.camera.near = 0.05;
        spotLight.shadow.camera.far = 8;
        spotLight.shadow.bias = SHADOW_CONFIG.lamp.bias;
        spotLight.shadow.normalBias = SHADOW_CONFIG.lamp.normalBias;
        spotLight.shadow.radius = SHADOW_CONFIG.lamp.radius; // Softer shadow edges
        group.add(spotLight);
        group.add(spotLight.target);

        // Point light for warm ambient glow around the lamp - steep decay
        // Increased distance for better ambient light spread
        const warmFillLight = new THREE.PointLight(0xffcc88, 0.6, 1.5, 2);
        warmFillLight.position.set(neckEndX, neckEndY, neckEndZ);
        group.add(warmFillLight);

        // Switch on the base
        const switchGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8);
        const switchMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.2,
            metalness: 0.8
        });
        const lampSwitch = new THREE.Mesh(switchGeometry, switchMaterial);
        lampSwitch.position.set(0.18, -0.12, 0);
        lampSwitch.castShadow = true;
        group.add(lampSwitch);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'lamp', label: 'Desk Lamp - Resume', deskLampLight: spotLight, warmFillLight: warmFillLight };
        this.interactiveObjects.push(group);
        return group;
    }

    getInteractiveObjects() {
        return this.interactiveObjects;
    }
}
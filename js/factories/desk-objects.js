// @ts-check
/**
 * Desk objects creation
 * Handles coffee mugs, desk lamps, notebooks, and other items that sit on the desk
 */

import * as THREE from 'three/webgpu';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
    applyOrigin,
    createBeveledBox,
    createPaperGrainNormalTexture,
    createRoughnessVariationTexture,
    addContactShadow
} from '../systems/utils.js';
import { OBJECT_ORIGINS } from '../config/config.js';

export class DeskObjectFactory {
    constructor() {
        // Use centralized origins from config
        this.origins = OBJECT_ORIGINS.desk;
    }

    /**
     * Create notebook for desk
     */
    createNotebook() {
        const group = new THREE.Group();
        const origin = this.origins.notebook;

        // The notebook is an open spread rather than a single closed cover. Keeping
        // the dimensions here makes the physical proportions easy to tune as one unit.
        const pageWidth = 0.78;
        const pageDepth = 1.08;
        const gutter = 0.055;
        const pageCenters = [-((pageWidth + gutter) / 2), (pageWidth + gutter) / 2];
        const coverWidth = pageWidth + 0.09;
        const coverY = -0.17;
        const pageThickness = 0.005;
        const pageCount = 8;
        const pageStep = 0.004;
        const pageY = coverY + 0.026;
        const topPageY = pageY + pageCount * pageStep;

        const coverMaterial = new THREE.MeshStandardMaterial({
            color: 0x263849,
            roughness: 0.76,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.04
        });
        const paperGrainTexture = createPaperGrainNormalTexture();
        const plainPageMaterial = new THREE.MeshStandardMaterial({
            color: 0xf4efe2,
            roughness: 0.96,
            metalness: 0.0,
            normalMap: paperGrainTexture,
            normalScale: new THREE.Vector2(0.12, 0.12)
        });
        const spineMaterial = new THREE.MeshStandardMaterial({
            color: 0x17222a,
            roughness: 0.86,
            metalness: 0.02
        });

        // Subtle paper lines and blue-black ink keep the pages legible at close zoom
        // without turning the notebook into a flat UI card.
        const createPageTexture = (side) => {
            const canvas = document.createElement('canvas');
            canvas.width = 900;
            canvas.height = 1240;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get 2D context for notebook page');

            const paper = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            paper.addColorStop(0, '#faf6ea');
            paper.addColorStop(0.55, '#f3eddf');
            paper.addColorStop(1, '#e9e0cf');
            ctx.fillStyle = paper;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const topMargin = 150;
            const lineHeight = 78;
            ctx.strokeStyle = 'rgba(137, 171, 190, 0.46)';
            ctx.lineWidth = 2;
            for (let y = topMargin; y < canvas.height - 24; y += lineHeight) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(190, 111, 111, 0.44)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(112, 0);
            ctx.lineTo(112, canvas.height);
            ctx.stroke();

            // The fold-side shading is deliberately painted into the paper texture,
            // while the actual gutter remains real geometry and casts a shadow.
            const foldX = side === 'left' ? canvas.width - 42 : 42;
            const foldGradient = ctx.createLinearGradient(foldX - 38, 0, foldX + 38, 0);
            foldGradient.addColorStop(0, 'rgba(85, 67, 48, 0)');
            foldGradient.addColorStop(0.5, 'rgba(85, 67, 48, 0.10)');
            foldGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = foldGradient;
            ctx.fillRect(foldX - 38, 0, 76, canvas.height);

            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#202f43';
            ctx.font = 'italic 34px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
            ctx.fillText(side === 'left' ? 'notes / ideas' : 'personal projects', 145, 113);

            ctx.strokeStyle = 'rgba(32, 47, 67, 0.72)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(145, 126);
            ctx.lineTo(side === 'left' ? 360 : 480, 126);
            ctx.stroke();

            ctx.fillStyle = '#1d2b3c';
            ctx.font = '34px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';

            const drawWrapped = (text, x, y, maxWidth, step) => {
                const words = text.split(' ');
                let line = '';
                let currentY = y;
                for (const word of words) {
                    const candidate = line ? `${line} ${word}` : word;
                    if (ctx.measureText(candidate).width > maxWidth && line) {
                        ctx.fillText(line, x, currentY);
                        currentY += step;
                        line = word;
                    } else {
                        line = candidate;
                    }
                }
                if (line) {
                    ctx.fillText(line, x, currentY);
                    currentY += step;
                }
                return currentY;
            };

            const writeSection = (label, body, y) => {
                ctx.font = 'bold 36px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
                ctx.fillText(label, 145, y);
                ctx.font = '34px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
                return drawWrapped(body, 145, y + 54, 660, 62) + 34;
            };

            let currentY = 224;
            if (side === 'left') {
                currentY = writeSection('SweetHope Bakery', 'helped my sister move the bakery site from PHP to JS — keep the warm, homemade feeling in every tiny detail.', currentY);
                currentY = writeSection('little experiments', 'build the small version first, then make it feel good. that is usually where the best ideas hide.', currentY);
                writeSection('next up', 'a gentler project page, with less noise and more room for the work to speak.', currentY);
            } else {
                currentY = writeSection('Tidbyt', 'a unique clock app for the physical pixel display, written in its custom language.', currentY);
                currentY = writeSection('Variety', 'contributed to an open-source Linux wallpaper manager. learned a lot about making useful tools feel simple.', currentY);
                writeSection('remember', 'ship the thoughtful version.', currentY);
            }

            // A few imperfect marks make the page feel handled, not typeset.
            ctx.strokeStyle = 'rgba(29, 43, 60, 0.58)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(150, 1085);
            ctx.lineTo(174, 1108);
            ctx.lineTo(218, 1062);
            ctx.stroke();
            ctx.font = 'italic 27px "Segoe Print", "Bradley Hand", cursive';
            ctx.fillText(side === 'left' ? 'keep making things' : '— rk', 600, 1138);

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 4;
            return texture;
        };

        const pageTextures = [createPageTexture('left'), createPageTexture('right')];

        // Separate cover boards make the spread feel like a real bound book. The
        // center cloth strip sits below the pages and remains visible in the gutter.
        const coverGeometry = createBeveledBox(coverWidth, 0.04, pageDepth + 0.08, 0.012, 3);
        pageCenters.forEach((x) => {
            const cover = new THREE.Mesh(coverGeometry, coverMaterial);
            cover.position.set(x, coverY, 0);
            cover.castShadow = true;
            cover.receiveShadow = true;
            group.add(cover);
        });

        const spine = new THREE.Mesh(
            createBeveledBox(gutter + 0.035, 0.052, pageDepth + 0.06, 0.014, 3),
            spineMaterial
        );
        spine.position.set(0, coverY + 0.018, 0);
        spine.castShadow = true;
        spine.receiveShadow = true;
        group.add(spine);

        const pageGeometry = new THREE.BoxGeometry(pageWidth, pageThickness, pageDepth);
        /** @type {THREE.BufferGeometry[][]} */
        const stackGeometries = [[], []];
        for (let i = 0; i < pageCount; i++) {
            pageCenters.forEach((x, sideIndex) => {
                const page = pageGeometry.clone();
                page.translate(x, pageY + (i * pageStep), 0);
                stackGeometries[sideIndex].push(page);
            });
        }
        stackGeometries.forEach((geometries) => {
            const pageStack = new THREE.Mesh(
                BufferGeometryUtils.mergeGeometries(geometries),
                plainPageMaterial
            );
            pageStack.castShadow = true;
            pageStack.receiveShadow = true;
            group.add(pageStack);
        });

        pageCenters.forEach((x, sideIndex) => {
            const textMaterial = new THREE.MeshStandardMaterial({
                map: pageTextures[sideIndex],
                roughness: 0.96,
                metalness: 0.0,
                color: 0xffffff,
                normalMap: paperGrainTexture,
                normalScale: new THREE.Vector2(0.12, 0.12)
            });
            const topPage = new THREE.Mesh(pageGeometry, [
                plainPageMaterial, plainPageMaterial,
                textMaterial, plainPageMaterial,
                plainPageMaterial, plainPageMaterial
            ]);
            topPage.position.set(x, topPageY, 0);
            topPage.castShadow = true;
            topPage.receiveShadow = true;
            group.add(topPage);
        });

        // A slightly darker page block at each outer edge makes the individual
        // sheets read in profile when the camera is near the desk surface.
        const pageEdgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xd8cfbe,
            roughness: 0.98,
            metalness: 0.0,
            normalMap: paperGrainTexture,
            normalScale: new THREE.Vector2(0.08, 0.08)
        });
        const pageBlockHeight = (topPageY - pageY) + pageThickness;
        pageCenters.forEach((x) => {
            const outerEdge = x + Math.sign(x) * (pageWidth / 2 - 0.004);
            const pageBlock = new THREE.Mesh(
                new THREE.BoxGeometry(0.008, pageBlockHeight, pageDepth * 0.94),
                pageEdgeMaterial
            );
            pageBlock.position.set(outerEdge, pageY + (pageBlockHeight / 2) - 0.002, 0);
            pageBlock.castShadow = true;
            pageBlock.receiveShadow = true;
            group.add(pageBlock);
        });

        // Paper-colored inner edges hide the hard box seam while preserving a dark
        // cloth reveal in the center, like a notebook opened on a desk.
        const gutterShadow = new THREE.Mesh(
            new THREE.BoxGeometry(gutter * 0.72, 0.008, pageDepth * 0.94),
            new THREE.MeshStandardMaterial({ color: 0x7c6d5b, roughness: 0.95 })
        );
        gutterShadow.position.set(0, topPageY + 0.004, 0);
        gutterShadow.castShadow = true;
        group.add(gutterShadow);

        // Contact shadow for realistic grounding (Phase 3.1)
        addContactShadow(group, 1.9, 1.35, -0.19);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'notebook', label: 'Notebook - Personal Projects' };
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
        const cupMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xfafafa,
            roughness: 0.62,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.0,
            clearcoat: 0.18,
            clearcoatRoughness: 0.18,
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

        // Liquid surface: MeshPhysicalMaterial with a near-mirror clearcoat
        // (Phase 5.6) -- a flat diffuse disc never sold coffee's meniscus
        // reflection the way a thin clearcoat layer over a dark base does.
        const coffeeGeometry = new THREE.CylinderGeometry(coffeeRadius, coffeeRadius, 0.001, 32);
        const coffeeMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x2a150c,
            roughness: 0.35,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            envMapIntensity: 0.6 // Reflect environment for liquid look
        });
        const coffee = new THREE.Mesh(coffeeGeometry, coffeeMaterial);
        coffee.position.set(offsets.cup.x, coffeeLevel, offsets.cup.z);
        group.add(coffee);

        // A very shallow torus catches a highlight around the cup wall and
        // gives the liquid an irregular-looking meniscus without simulating
        // fluid or adding transparent geometry.
        const meniscus = new THREE.Mesh(
            new THREE.TorusGeometry(coffeeRadius * 0.88, 0.008, 8, 24),
            coffeeMaterial
        );
        meniscus.rotation.x = Math.PI / 2;
        meniscus.position.set(offsets.cup.x, coffeeLevel + 0.004, offsets.cup.z);
        group.add(meniscus);

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
            BufferGeometryUtils.mergeGeometries(lineGeometries),
            lineMaterial
        );
        mergedLines.castShadow = true;
        group.add(mergedLines);

        // Steam wisps rising from coffee surface. Pooled:
        // a fixed-size unit plane is shared by every wisp, with per-wisp width/height
        // baked into `scale` instead of unique geometry, so expiry can reset a wisp in
        // place -- no per-expiry geometry/material allocation, and nothing to leak.
        const steamGeometry = new THREE.PlaneGeometry(1, 1);
        const resetWisp = (steam) => {
            const wispHeight = 0.04 + Math.random() * 0.06;
            const wispWidth = 0.015 + Math.random() * 0.02;
            steam.scale.set(wispWidth, wispHeight, 1);

            const startX = offsets.cup.x + (Math.random() - 0.5) * 0.15;
            const startZ = offsets.cup.z + (Math.random() - 0.5) * 0.15;
            steam.position.set(
                startX,
                coffeeLevel + 0.02 + Math.random() * 0.1,
                startZ
            );

            steam.rotation.y = Math.random() * Math.PI * 2;
            steam.rotation.z = (Math.random() - 0.5) * 0.3;

            const opacity = 0.15 + Math.random() * 0.1;
            steam.material.opacity = opacity;

            steam.userData.velocity.y = 0.0015 + Math.random() * 0.002;
            steam.userData.velocity.x = (Math.random() - 0.5) * 0.0006;
            steam.userData.velocity.z = (Math.random() - 0.5) * 0.0006;
            steam.userData.rotationSpeed = (Math.random() - 0.5) * 0.02;
            steam.userData.scaleGrowth = 1.005 + Math.random() * 0.005;
            steam.userData.lifetime = 100 + Math.random() * 100;
        };

        const createSteamWisp = () => {
            const steamMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const steam = new THREE.Mesh(steamGeometry, steamMaterial);
            steam.userData = { isSteam: true, velocity: { x: 0, y: 0, z: 0 } };
            resetWisp(steam);
            return steam;
        };

        // Add initial steam particles and cache the pool -- avoids filtering
        // `children` every animation tick to find them.
        const steamParticles = [];
        for (let i = 0; i < 6; i++) {
            const steam = createSteamWisp();
            group.add(steam);
            steamParticles.push(steam);
        }

        // Store steam animation function
        const animateSteamFunc = function() {
            steamParticles.forEach((steam) => {
                steam.position.y += steam.userData.velocity.y;
                steam.position.x += steam.userData.velocity.x;
                steam.position.z += steam.userData.velocity.z;

                steam.userData.lifetime--;
                if (steam.userData.lifetime < 25) {
                    steam.material.opacity = steam.userData.lifetime / 25 * 0.25;
                }

                if (steam.userData.lifetime <= 0) {
                    resetWisp(steam);
                }
            });
        };

        // Contact shadow for realistic grounding (Phase 3.1)
        addContactShadow(group, 0.35, 0.35, -0.4);

        applyOrigin(group, origin);
        group.userData = { name: 'coffee', label: 'Starbucks - What Drives Me', animateSteam: animateSteamFunc };
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

        // The lamp's actual illumination -- a shadow-casting SpotLight plus a warm
        // PointLight fill -- lives in LightingSystem.setupLights() (`deskLamp`,
        // `lampShadeGlow`, `deskBounce`). This physical lamp used to carry its own
        // second shadow-casting spotlight and fill light on top of that trio: five
        // lights and two 1024 shadow maps modeling one lamp, and the quality-tier
        // toggle (scene.js applyQualityTier) only ever reached lighting.js's
        // `deskLamp`, so this duplicate kept casting a shadow even at low tier
        // Deleted here; lighting.js's `deskLamp`
        // target/angle was widened to cover the notebook page this used to aim at.

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

        // Contact shadow for realistic grounding (Phase 3.1)
        addContactShadow(group, 0.6, 0.6, -0.19);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'lamp', label: 'Desk Lamp - Resume' };
        return group;
    }
}

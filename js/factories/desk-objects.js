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
        const cupTopRadius = 0.205;
        const cupBottomRadius = 0.125;
        const wallThickness = 0.018;
        const bottomY = -cupHeight / 2;
        const topY = cupHeight / 2;

        // A lathed profile gives the paper cup a real wall thickness and an open
        // mouth. The shallow return across the base closes the shell without a
        // second hidden cap mesh.
        const cupProfile = [
            new THREE.Vector2(cupBottomRadius - 0.018, bottomY),
            new THREE.Vector2(cupBottomRadius, bottomY + 0.026),
            new THREE.Vector2(cupTopRadius, topY - 0.026),
            new THREE.Vector2(cupTopRadius + 0.002, topY),
            new THREE.Vector2(cupTopRadius - wallThickness, topY),
            new THREE.Vector2(cupTopRadius - wallThickness - 0.004, topY - 0.022),
            new THREE.Vector2(cupBottomRadius + 0.008, bottomY + 0.066),
            new THREE.Vector2(cupBottomRadius - 0.006, bottomY + 0.042)
        ];
        const cupGeometry = new THREE.LatheGeometry(cupProfile, 48);
        const cupMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf4f0e7,
            roughness: 0.48,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.0,
            clearcoat: 0.08,
            clearcoatRoughness: 0.3,
            side: THREE.DoubleSide
        });
        const cup = new THREE.Mesh(cupGeometry, cupMaterial);
        cup.castShadow = true;
        cup.receiveShadow = true;
        group.add(cup);

        const radiusAt = (y) => cupBottomRadius + ((y - bottomY) / cupHeight) * (cupTopRadius - cupBottomRadius);
        const sleeveHeight = 0.34;
        const sleeveY = -0.02;
        const sleeveTopRadius = radiusAt(sleeveY + sleeveHeight / 2) + 0.014;
        const sleeveBottomRadius = radiusAt(sleeveY - sleeveHeight / 2) + 0.014;

        const sleeveGeometry = new THREE.CylinderGeometry(
            sleeveTopRadius,
            sleeveBottomRadius,
            sleeveHeight,
            48,
            1,
            true
        );
        // Gently scallop the sleeve profile into vertical corrugations. This is
        // one mesh/draw call and reads as folded cardboard in grazing light.
        const sleevePositions = sleeveGeometry.getAttribute('position');
        for (let i = 0; i < sleevePositions.count; i++) {
            const x = sleevePositions.getX(i);
            const z = sleevePositions.getZ(i);
            const radius = Math.hypot(x, z);
            if (radius === 0) continue;
            const angle = Math.atan2(z, x);
            const corrugation = 1 + 0.03 * Math.sin(angle * 24);
            sleevePositions.setX(i, (x / radius) * radius * corrugation);
            sleevePositions.setZ(i, (z / radius) * radius * corrugation);
        }
        sleevePositions.needsUpdate = true;
        sleeveGeometry.computeVertexNormals();
        const sleeveMaterial = new THREE.MeshStandardMaterial({
            color: 0x946335,
            roughness: 0.9,
            metalness: 0.0
        });
        const sleeve = new THREE.Mesh(sleeveGeometry, sleeveMaterial);
        sleeve.position.y = sleeveY;
        sleeve.castShadow = true;
        group.add(sleeve);

        // Rolled paper lip: the highlight makes the rim read as a folded edge
        // instead of a mathematically sharp cylinder.
        const rimMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf7f3ea,
            roughness: 0.4,
            clearcoat: 0.12,
            clearcoatRoughness: 0.24
        });
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(cupTopRadius - wallThickness / 2, 0.011, 10, 48),
            rimMaterial
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = topY - 0.004;
        rim.castShadow = true;
        group.add(rim);

        const coffeeLevel = topY - 0.076;
        const coffeeRadius = cupTopRadius - wallThickness - 0.008;
        const coffeeProfile = [
            new THREE.Vector2(0, coffeeLevel + 0.008),
            new THREE.Vector2(coffeeRadius * 0.25, coffeeLevel + 0.010),
            new THREE.Vector2(coffeeRadius * 0.72, coffeeLevel + 0.008),
            new THREE.Vector2(coffeeRadius * 0.95, coffeeLevel + 0.003),
            new THREE.Vector2(coffeeRadius, coffeeLevel - 0.001)
        ];
        // A very shallow domed surface avoids the dead-flat look of a disc while
        // keeping the liquid fully opaque and inexpensive to render.
        const coffeeGeometry = new THREE.LatheGeometry(coffeeProfile, 40);
        const coffeeMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c1006,
            roughness: 0.28,
            metalness: 0.0
        });
        const coffee = new THREE.Mesh(coffeeGeometry, coffeeMaterial);
        coffee.castShadow = true;
        group.add(coffee);

        // The thin caramel ring is the coffee's meniscus/crema catching the warm
        // desk light at the edge of the dark liquid.
        const cremaMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x8c4b24,
            roughness: 0.3,
            clearcoat: 0.48,
            clearcoatRoughness: 0.08
        });
        const meniscus = new THREE.Mesh(
            new THREE.TorusGeometry(coffeeRadius * 0.89, 0.006, 8, 40),
            cremaMaterial
        );
        meniscus.rotation.x = Math.PI / 2;
        meniscus.position.y = coffeeLevel + 0.002;
        group.add(meniscus);

        const sleeveEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0x754522, roughness: 0.98 });
        const sleeveEdgeGeometries = [];
        for (const y of [sleeveY - sleeveHeight / 2 + 0.006, sleeveY + sleeveHeight / 2 - 0.006]) {
            const edgeGeometry = new THREE.TorusGeometry(radiusAt(y) + 0.015, 0.005, 6, 48);
            edgeGeometry.rotateX(Math.PI / 2);
            edgeGeometry.translate(0, y, 0);
            sleeveEdgeGeometries.push(edgeGeometry);
        }
        const sleeveEdges = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(sleeveEdgeGeometries),
            sleeveEdgeMaterial
        );
        sleeveEdges.castShadow = true;
        group.add(sleeveEdges);

        // Steam wisps use small static tubes instead of billboards, so their
        // silhouettes stay believable while the camera moves around the cup.
        const resetWisp = (steam) => {
            const wispScale = 0.72 + Math.random() * 0.46;
            steam.scale.set(wispScale, wispScale, wispScale);

            const startX = (Math.random() - 0.5) * 0.12;
            const startZ = (Math.random() - 0.5) * 0.12;
            steam.position.set(
                startX,
                coffeeLevel + 0.02 + Math.random() * 0.06,
                startZ
            );

            steam.rotation.y = Math.random() * Math.PI * 2;
            steam.rotation.x = (Math.random() - 0.5) * 0.16;

            const opacity = 0.07 + Math.random() * 0.07;
            steam.material.opacity = opacity;

            steam.userData.velocity.y = 0.0008 + Math.random() * 0.0012;
            steam.userData.velocity.x = (Math.random() - 0.5) * 0.00045;
            steam.userData.velocity.z = (Math.random() - 0.5) * 0.00045;
            steam.userData.rotationSpeed = (Math.random() - 0.5) * 0.014;
            steam.userData.scaleGrowth = 1.003 + Math.random() * 0.003;
            steam.userData.lifetime = 140 + Math.random() * 100;
        };

        const createSteamWisp = () => {
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0.018, 0.09, 0.008),
                new THREE.Vector3(-0.016, 0.18, -0.006),
                new THREE.Vector3(0.012, 0.28, 0.004)
            ]);
            const steamGeometry = new THREE.TubeGeometry(curve, 14, 0.0035, 4, false);
            const steamMaterial = new THREE.MeshBasicMaterial({
                color: 0xf4eee4,
                transparent: true,
                depthWrite: false,
                depthTest: true
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

                steam.rotation.y += steam.userData.rotationSpeed;
                steam.scale.multiplyScalar(steam.userData.scaleGrowth);

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

        // This is a compact, articulated task lamp: the proportions, joints, shade
        // thickness, reflector, bulb, switch, and trailing cable all describe one
        // coherent physical object. The light itself is kept in LightingSystem so
        // the scene still pays for only one shadow-casting lamp light.
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x252a29,
            roughness: 0.26,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.86,
        });

        const chromeMaterial = new THREE.MeshStandardMaterial({
            color: 0x9a9d99,
            roughness: 0.16,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.9
        });

        const rubberMaterial = new THREE.MeshStandardMaterial({
            color: 0x111211,
            roughness: 0.88,
            metalness: 0.02
        });

        const createRodBetween = (start, end, radius, material, segments = 12) => {
            const direction = new THREE.Vector3().subVectors(end, start);
            const rod = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius * 1.08, direction.length(), segments),
                material
            );
            rod.position.copy(start).add(end).multiplyScalar(0.5);
            rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
            rod.castShadow = true;
            rod.receiveShadow = true;
            return rod;
        };

        // Weighted base with a slightly splayed underside and a small rubber foot.
        const baseGeometry = new THREE.CylinderGeometry(0.33, 0.39, 0.10, 32);
        const base = new THREE.Mesh(baseGeometry, metalMaterial);
        base.position.set(0, -0.14, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const baseTop = new THREE.Mesh(
            new THREE.CylinderGeometry(0.27, 0.30, 0.025, 32),
            chromeMaterial
        );
        baseTop.position.y = -0.075;
        baseTop.castShadow = true;
        group.add(baseTop);

        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.018, 32), rubberMaterial);
        foot.position.y = -0.195;
        foot.castShadow = true;
        group.add(foot);

        // Vertical post and the first pivot.
        const stemHeight = 0.56;
        const stemGeometry = new THREE.CylinderGeometry(0.041, 0.052, stemHeight, 16);
        const stem = new THREE.Mesh(stemGeometry, chromeMaterial);
        stem.position.set(0, -0.055 + stemHeight / 2, 0);
        stem.castShadow = true;
        group.add(stem);

        const jointGeometry = new THREE.SphereGeometry(0.066, 18, 12);
        const joint = new THREE.Mesh(jointGeometry, chromeMaterial);
        const jointY = -0.055 + stemHeight;
        joint.position.set(0, jointY, 0);
        joint.castShadow = true;
        group.add(joint);

        // Two-piece arm with a real elbow. The second member is shorter and more
        // nearly horizontal, which avoids the toy-like single diagonal rod.
        const elbow = new THREE.Vector3(0.06, 0.78, 0.31);
        const headPivot = new THREE.Vector3(0.20, 0.93, 0.57);
        group.add(createRodBetween(new THREE.Vector3(0, jointY, 0), elbow, 0.031, chromeMaterial));
        group.add(createRodBetween(elbow, headPivot, 0.029, chromeMaterial));

        const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), chromeMaterial);
        elbowJoint.position.copy(elbow);
        elbowJoint.castShadow = true;
        group.add(elbowJoint);

        const headJoint = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), chromeMaterial);
        headJoint.position.copy(headPivot);
        headJoint.castShadow = true;
        group.add(headJoint);

        // Lamp head assembly positioned at neck end
        const headGroup = new THREE.Group();

        // Enamelled bell shade. A separate inner cone and rolled rim provide the
        // visual thickness that the old single-sided cone was missing.
        const shadeHeight = 0.27;
        const shadeRadius = 0.225;
        const shadeMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x30483d,
            roughness: 0.29,
            metalness: 0.18,
            clearcoat: 0.42,
            clearcoatRoughness: 0.18,
            side: THREE.DoubleSide
        });
        const shade = new THREE.Mesh(
            new THREE.ConeGeometry(shadeRadius, shadeHeight, 32, 1, true),
            shadeMaterial
        );
        shade.castShadow = true;
        shade.receiveShadow = true;
        headGroup.add(shade);

        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(shadeRadius * 0.965, 0.022, 8, 32),
            shadeMaterial
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = -shadeHeight / 2;
        rim.castShadow = true;
        headGroup.add(rim);

        // Warm, slightly matte reflector so the bulb reads as a real lamp rather
        // than a bright floating sphere.
        const innerShadeGeometry = new THREE.ConeGeometry(0.198, 0.245, 32, 1, true);
        const innerShadeMaterial = new THREE.MeshStandardMaterial({
            color: 0xd9c39b,
            roughness: 0.23,
            metalness: 0.55,
            side: THREE.BackSide
        });
        const innerShade = new THREE.Mesh(innerShadeGeometry, innerShadeMaterial);
        innerShade.position.y = 0.004;
        innerShade.receiveShadow = true;
        headGroup.add(innerShade);

        // Ceramic socket and a frosted globe mounted in the narrow end.
        const socket = new THREE.Mesh(
            new THREE.CylinderGeometry(0.048, 0.058, 0.075, 16),
            rubberMaterial
        );
        socket.position.y = shadeHeight * 0.42;
        socket.castShadow = true;
        headGroup.add(socket);

        const bulbY = shadeHeight * 0.13;
        const bulbGeometry = new THREE.SphereGeometry(0.065, 20, 14);
        const bulbMaterial = new THREE.MeshStandardMaterial({
            color: 0xfff4cf,
            emissive: 0xff9b32,
            emissiveIntensity: 1.45,
            transparent: true,
            opacity: 0.92,
            roughness: 0.24,
            metalness: 0.0
        });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.set(0, bulbY, 0);
        bulb.layers.enable(1); // Add to bloom layer
        headGroup.add(bulb);

        // Small emissive core adds a restrained glow without a second shadow map.
        const glowGeometry = new THREE.SphereGeometry(0.082, 16, 12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffb84d,
            transparent: true,
            opacity: 0.17,
            depthWrite: false
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(0, bulbY, 0);
        glow.layers.enable(1);
        headGroup.add(glow);

        // The open face points toward the notebook: down, forward, and just left.
        headGroup.position.copy(headPivot);
        headGroup.rotation.x = -0.68;
        headGroup.rotation.z = -0.36;
        group.add(headGroup);

        // A thin rubber power lead trails behind the base and rests just above the
        // desktop, giving the silhouette a believable end point.
        const cableCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.18, -0.188, -0.12),
            new THREE.Vector3(-0.28, -0.184, -0.22),
            new THREE.Vector3(-0.24, -0.18, -0.38),
            new THREE.Vector3(-0.16, -0.176, -0.49)
        ]);
        const cable = new THREE.Mesh(
            new THREE.TubeGeometry(cableCurve, 12, 0.012, 6, false),
            rubberMaterial
        );
        cable.castShadow = true;
        group.add(cable);

        // Raised rocker switch, placed where a hand can actually reach it.
        const switchMaterial = new THREE.MeshStandardMaterial({
            color: 0xbcc2b8,
            roughness: 0.32,
            metalness: 0.58
        });
        const lampSwitch = new THREE.Mesh(
            createBeveledBox(0.075, 0.024, 0.052, 0.008, 2),
            switchMaterial
        );
        lampSwitch.position.set(0.16, -0.052, 0.02);
        lampSwitch.rotation.z = -0.16;
        lampSwitch.castShadow = true;
        group.add(lampSwitch);

        // Contact shadow for realistic grounding (Phase 3.1)
        addContactShadow(group, 0.6, 0.6, -0.19);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'lamp', label: 'Desk Lamp - Resume' };
        return group;
    }
}

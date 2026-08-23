// @ts-check
/**
 * Technology objects creation
 * Handles monitor, keyboard, mouse, laptop, and other tech items
 */

import * as THREE from 'three/webgpu';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
    applyOrigin,
    createBeveledBox,
    createKeycapGeometry,
    createRoughnessVariationTexture,
    createScreenSmudgeTexture,
    addContactShadow
} from '../systems/utils.js';
import { applyKeycapLegends } from './keycap-legends.js';
import { LIGHTING_CONFIG, OBJECT_ORIGINS } from '../config/config.js';
import { MonitorRenderer } from './monitor-renderer.js';

export class TechnologyFactory {
    constructor(lightingSystem = null) {
        this.lightingSystem = lightingSystem;
        // Use centralized origins from config
        this.origins = OBJECT_ORIGINS.technology;

        // Renders the initial screen content: the monitor
        // used to hand-draw a chrome-less static page here, then swap to MonitorRenderer's
        // full browser-window rendering on the first scroll tick, visibly changing the
        // screen's design. Using the same renderer for the initial frame means there's
        // one content source and no first-scroll swap.
        this.monitorRenderer = new MonitorRenderer();
    }

    /**
     * Create realistic computer monitor with detailed design
     * All part positions are relative to the monitor origin defined in this.origins.monitor
     */
    createMonitor() {
        const group = new THREE.Group();
        const origin = this.origins.monitor;

        // Part offsets relative to monitor origin (origin is at base center)
        // Screen faces forward (+Z), stand/arm is behind (-Z)
        const offsets = {
            screen:      { x: 0,    y: 1.35, z: 0.05   },  // Screen in front (moved forward to prevent z-fighting)
            bezel:       { x: 0,    y: 1.35, z: 0      },  // Bezel behind screen
            innerBezel:  { x: 0,    y: 1.35, z: -0.02  },
            led:         { x: 1.3,  y: 1.25, z: 0.02   },  // LED on front
            arm:         { x: 0,    y: 0.65, z: -0.08  },  // Arm behind screen
            upperJoint:  { x: 0,    y: 0.95, z: -0.08  },
            lowerJoint:  { x: 0,    y: 0.35, z: -0.08  },
            base:        { x: 0,    y: -0.09, z: -0.08 },  // Base behind screen
            basePlate:   { x: 0,    y: -0.14, z: -0.08 },
            logo:        { x: 0,    y: -0.07, z: 0.02  }   // Logo on front
        };

        // Render the same browser-window content used for scrolling before the
        // monitor enters the scene. This removes the first-frame/first-scroll design
        // swap and leaves MonitorRenderer as the single content source (P2-4).
        const texture = new THREE.CanvasTexture(this.monitorRenderer.createMonitorCanvas(0));

        // Canvas pixels represent display colors, so keep the texture in sRGB.
        texture.colorSpace = THREE.SRGBColorSpace;
        
        texture.anisotropy = 16;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        // Main LCD screen with moderate emissive glow
        const screenGeometry = new THREE.BoxGeometry(3.2, 1.4, 0.05);
        const frontScreenMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0xaabbcc,
            emissiveMap: texture,
            emissiveIntensity: 1.15,
            roughness: 0.15, // Lower roughness for realistic screen reflection
            roughnessMap: createScreenSmudgeTexture(), // faint fingerprint/smudge catches env light when the screen is dark
            metalness: 0.0,
            envMapIntensity: LIGHTING_CONFIG.environment.screen
        });

        const sideScreenMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.5,
            metalness: 0.5
        });

        // Apply texture only to the front face (index 4) to prevent edge aliasing
        const screenMaterials = [
            sideScreenMaterial, // +x
            sideScreenMaterial, // -x
            sideScreenMaterial, // +y
            sideScreenMaterial, // -y
            frontScreenMaterial, // +z (Front)
            sideScreenMaterial  // -z
        ];

        const screen = new THREE.Mesh(screenGeometry, screenMaterials);
        screen.position.set(offsets.screen.x, offsets.screen.y, offsets.screen.z);
        screen.castShadow = false;
        screen.receiveShadow = false; // Disable receiving shadows to prevent acne/artifacts
        screen.userData = { isScreen: true };
        screen.layers.enable(1); // Add to bloom layer
        group.add(screen);

        // Dynamic screen glare overlay - responds to actual light positions
        const glareGeometry = new THREE.PlaneGeometry(3.18, 1.38);
        let glareMaterial;

        if (this.lightingSystem) {
            // Use dynamic glare shader from lighting system
            glareMaterial = this.lightingSystem.createGlareMaterial({
                glareIntensity: 0.35,
                glareSharpness: 6.0,
                fresnelPower: 2.5
            });
        } else {
            // Fallback to simple material if lighting system not available
            glareMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.05,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
        }

        const glareOverlay = new THREE.Mesh(glareGeometry, glareMaterial);
        glareOverlay.position.set(offsets.screen.x, offsets.screen.y, offsets.screen.z + 0.03);
        glareOverlay.renderOrder = 1;

        // Store material reference for camera updates
        if (this.lightingSystem) {
            glareOverlay.userData.glareMaterial = glareMaterial;
        }
        group.add(glareOverlay);

        // A point-based screen bounce keeps the same cool desk illumination
        // without requiring WebGPU's optional LTC lookup textures.
        const screenLight = new THREE.PointLight(0xd0e0ff, 0.85, 4.5, 2);
        screenLight.position.set(offsets.screen.x, offsets.screen.y, offsets.screen.z + 0.05);
        group.add(screenLight);

        // Store light reference for external access
        group.userData.screenLight = screenLight;

        // Screen bezel (realistic thickness)
        const bezelGeometry = createBeveledBox(3.4, 1.6, 0.12, 0.006, 3);
        const bezelMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x1a1a1a,
            roughness: 0.3,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.0,
            clearcoat: 0.2,
            clearcoatRoughness: 0.55
        });
        const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
        bezel.position.set(offsets.bezel.x, offsets.bezel.y, offsets.bezel.z);
        bezel.castShadow = true;
        bezel.receiveShadow = true;
        group.add(bezel);

        // Inner bezel for screen
        const innerBezelGeometry = createBeveledBox(3.25, 1.45, 0.08, 0.005, 3);
        const innerBezelMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            roughness: 0.1,
            metalness: 0.9
        });
        const innerBezel = new THREE.Mesh(innerBezelGeometry, innerBezelMaterial);
        innerBezel.position.set(offsets.innerBezel.x, offsets.innerBezel.y, offsets.innerBezel.z);
        innerBezel.castShadow = true;
        innerBezel.receiveShadow = true;
        group.add(innerBezel);

        // Power LED indicator
        const ledGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const ledMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.8
        });
        const led = new THREE.Mesh(ledGeometry, ledMaterial);
        led.position.set(offsets.led.x, offsets.led.y, offsets.led.z);
        led.layers.enable(1); // Add to bloom layer
        group.add(led);

        // Control buttons — merged into a single draw call
        const buttonGeometry = new THREE.BoxGeometry(0.08, 0.03, 0.02);
        const buttonMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.2,
            metalness: 0.8
        });
        const buttonGeometries = [];
        for (let i = 0; i < 3; i++) {
            const bg = buttonGeometry.clone();
            bg.translate(offsets.led.x - 0.15, offsets.led.y + 0.1 + (i * 0.05), offsets.led.z);
            buttonGeometries.push(bg);
        }
        const mergedButtons = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(buttonGeometries),
            buttonMaterial
        );
        mergedButtons.castShadow = true;
        group.add(mergedButtons);

        // Monitor arm with articulated joints
        const armGeometry = new THREE.CylinderGeometry(0.06, 0.08, 2, 16);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.4,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.7
        });
        const arm = new THREE.Mesh(armGeometry, armMaterial);
        arm.position.set(offsets.arm.x, offsets.arm.y, offsets.arm.z);
        arm.castShadow = true;
        arm.receiveShadow = true;
        group.add(arm);

        // Joint spheres — merged into a single draw call
        const jointGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const jointMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            roughness: 0.2,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.8
        });
        const upperJointGeo = jointGeometry.clone();
        upperJointGeo.translate(offsets.upperJoint.x, offsets.upperJoint.y, offsets.upperJoint.z);
        const lowerJointGeo = jointGeometry.clone();
        lowerJointGeo.translate(offsets.lowerJoint.x, offsets.lowerJoint.y, offsets.lowerJoint.z);
        const mergedJoints = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries([upperJointGeo, lowerJointGeo]),
            jointMaterial
        );
        mergedJoints.castShadow = true;
        mergedJoints.receiveShadow = true;
        group.add(mergedJoints);

        // V-shaped base with rubber feet
        const baseGeometry = new THREE.CylinderGeometry(0.25, 0.35, 0.12, 24);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.4,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.6
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(offsets.base.x, offsets.base.y, offsets.base.z);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Base plate detail
        const basePlateGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.02, 24);
        const basePlateMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.3,
            metalness: 0.9
        });
        const basePlate = new THREE.Mesh(basePlateGeometry, basePlateMaterial);
        basePlate.position.set(offsets.basePlate.x, offsets.basePlate.y, offsets.basePlate.z);
        basePlate.castShadow = true;
        basePlate.receiveShadow = true;
        group.add(basePlate);

        // Rubber feet — merged into a single draw call
        const footGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
        const footMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.9,
            metalness: 0.0
        });
        const footOffsets = [
            { x: -0.15, y: 0, z: -0.1 },
            { x:  0.15, y: 0, z: -0.1 },
            { x: -0.15, y: 0, z:  0.1 },
            { x:  0.15, y: 0, z:  0.1 }
        ];
        const footGeometries = footOffsets.map(footOff => {
            const fg = footGeometry.clone();
            fg.translate(
                offsets.basePlate.x + footOff.x,
                offsets.basePlate.y + footOff.y,
                offsets.basePlate.z + footOff.z
            );
            return fg;
        });
        const mergedFeet = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(footGeometries),
            footMaterial
        );
        mergedFeet.castShadow = true;
        group.add(mergedFeet);

        // Logo (subtle brand indicator)
        const logoGeometry = new THREE.BoxGeometry(0.1, 0.01, 0.05);
        const logoMaterial = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            roughness: 0.2,
            metalness: 0.8
        });
        const logo = new THREE.Mesh(logoGeometry, logoMaterial);
        logo.position.set(offsets.logo.x, offsets.logo.y, offsets.logo.z);
        logo.castShadow = true;
        group.add(logo);

        applyOrigin(group, origin, true); // Static object
        group.userData.name = 'monitor';
        group.userData.label = 'Monitor - About Me';
        return group;
    }

    /**
     * Create mechanical keyboard using InstancedMesh for performance
     * Batches all keycaps into a single draw call
     */
    createKeyboard() {
        const group = new THREE.Group();
        const origin = this.origins.keyboard;

        const offsets = {
            base:      { x: 0, y: -0.165, z: 0     },
            case:      { x: 0, y: -0.08,  z: 0     },
            wristRest: { x: 0, y: -0.16,  z: -0.45 },
            keys:      { x: 0, y: -0.08,  z: 0     },
            leds:      { x: 0, y: -0.04,  z: -0.35 },
            port:      { x: 0, y: -0.17,  z: 0.41  }
        };

        // Shared materials
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            roughness: 0.55,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.5
        });
        const darkMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x2a2a2a,
            roughness: 0.7,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.3,
            clearcoat: 0.15,
            clearcoatRoughness: 0.55
        });

        // Keyboard base
        const baseGeometry = createBeveledBox(2.1, 0.05, 0.85, 0.006, 2);
        const base = new THREE.Mesh(baseGeometry, metalMaterial);
        base.position.set(offsets.base.x, offsets.base.y, offsets.base.z);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Keyboard case
        const caseGeometry = createBeveledBox(2.0, 0.12, 0.8, 0.008, 2);
        const keyboardCase = new THREE.Mesh(caseGeometry, darkMaterial);
        keyboardCase.position.set(offsets.case.x, offsets.case.y, offsets.case.z);
        keyboardCase.rotation.x = -Math.PI / 36;
        keyboardCase.castShadow = true;
        keyboardCase.receiveShadow = true;
        group.add(keyboardCase);

        // Wrist rest
        const wristRestGeometry = new THREE.BoxGeometry(2.1, 0.03, 0.15);
        const wristRest = new THREE.Mesh(wristRestGeometry, darkMaterial);
        wristRest.position.set(offsets.wristRest.x, offsets.wristRest.y, offsets.wristRest.z);
        wristRest.castShadow = true;
        wristRest.receiveShadow = true;
        group.add(wristRest);

        // Keyboard layout - collect all key positions first
        const layout = [
            { row: 0, keys: ['ESC', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'], special: { 'ESC': 0.9, 'F1': 0.6, 'F2': 0.6, 'F3': 0.6, 'F4': 0.6, 'F5': 0.6, 'F6': 0.6, 'F7': 0.6, 'F8': 0.6, 'F9': 0.6, 'F10': 0.6, 'F11': 0.6, 'F12': 0.6 } },
            { row: 1, keys: ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'BACK'], special: { 'BACK': 1.2 } },
            { row: 2, keys: ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'], special: { 'TAB': 0.8, '\\': 0.8 } },
            { row: 3, keys: ['CAPS', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'ENTER'], special: { 'CAPS': 1.0, 'ENTER': 1.4 } },
            { row: 4, keys: ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'SHIFT'], special: { 'SHIFT': 1.6 } }
        ];

        const keySpacing = 0.11;
        const rowOffset = -0.8;
        const colOffset = 0.32;

        // Collect all key transforms
        const keyTransforms = [];

        layout.forEach((rowData, rowIndex) => {
            let currentX = -rowOffset + 0.15;
            rowData.keys.forEach((key) => {
                const width = (rowData.special[key] || 1.0) * keySpacing;
                const keyZ = offsets.keys.z + colOffset - rowIndex * keySpacing;
                const slopeOffset = Math.sin(Math.PI / 36) * keyZ;

                keyTransforms.push({
                    x: offsets.keys.x + currentX - width/2,
                    y: offsets.keys.y + slopeOffset + 0.08,
                    z: keyZ,
                    scaleX: width * 0.9,
                    scaleZ: keySpacing * 0.9,
                    label: key
                });

                currentX -= width + 0.005;
            });
        });

        // Add spacebar (blank — the label is what a real spacebar shows)
        const spacebarZ = offsets.keys.z + colOffset - 5 * keySpacing;
        const spacebarSlopeOffset = Math.sin(Math.PI / 36) * spacebarZ;
        keyTransforms.push({
            x: offsets.keys.x + 0.05,
            y: offsets.keys.y + spacebarSlopeOffset + 0.08,
            z: spacebarZ,
            scaleX: 1.5,
            scaleZ: keySpacing * 0.9,
            label: ''
        });

        // Add arrow keys. The user sits on the group's -Z side, so their right
        // runs along -X: the more negative X of the two side keys is the right arrow.
        const arrowKeys = [
            { x: -0.5,  z: colOffset - 5 * keySpacing, label: '↓' },
            { x: -0.5,  z: colOffset - 4 * keySpacing, label: '↑' },
            { x: -0.39, z: colOffset - 5 * keySpacing, label: '←' },
            { x: -0.61, z: colOffset - 5 * keySpacing, label: '→' }
        ];

        arrowKeys.forEach(arrow => {
            const arrowZ = offsets.keys.z + arrow.z + 0.12;
            const arrowSlopeOffset = Math.sin(Math.PI / 36) * arrowZ;
            keyTransforms.push({
                x: offsets.keys.x + arrow.x - 0.27,
                y: offsets.keys.y + arrowSlopeOffset + 0.08,
                z: arrowZ,
                scaleX: keySpacing * 0.9,
                scaleZ: keySpacing * 0.9,
                label: arrow.label
            });
        });

        // Create instanced mesh for all keycaps (single draw call).
        // Unit footprint with draft-angle taper and a shallow top dish; per-key
        // width/depth is applied via the instance matrix's non-uniform X/Z scale.
        // Cloned because the legend pass below adds a per-instance attribute, and
        // createKeycapGeometry hands out cached geometries shared by dimension key.
        const keycapGeometry = createKeycapGeometry(1, 1, 0.04, 0.82, 0.14, 2).clone();
        const keycapMaterial = new THREE.MeshStandardMaterial({
            color: 0xf0f0f0,
            roughness: 0.85,
            metalness: 0.0
        });

        const keycapInstances = new THREE.InstancedMesh(
            keycapGeometry,
            keycapMaterial,
            keyTransforms.length
        );

        const matrix = new THREE.Matrix4();
        const rotation = new THREE.Euler(-Math.PI / 36, 0, 0);
        const quaternion = new THREE.Quaternion().setFromEuler(rotation);

        keyTransforms.forEach((transform, i) => {
            matrix.compose(
                new THREE.Vector3(transform.x, transform.y, transform.z),
                quaternion,
                new THREE.Vector3(transform.scaleX, 1, transform.scaleZ)
            );
            keycapInstances.setMatrixAt(i, matrix);
        });

        keycapInstances.instanceMatrix.needsUpdate = true;
        keycapInstances.castShadow = true;
        keycapInstances.receiveShadow = true;

        // Legends are printed via a shared atlas sampled per instance, so the
        // keyboard still renders in one draw call.
        applyKeycapLegends(keycapInstances, keyTransforms.map((transform) => ({
            label: transform.label,
            aspect: transform.scaleX / transform.scaleZ
        })));

        group.add(keycapInstances);

        // Single LED indicator strip
        const ledGeometry = new THREE.BoxGeometry(0.12, 0.01, 0.03);
        const ledMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.8
        });
        const led = new THREE.Mesh(ledGeometry, ledMaterial);
        led.position.set(offsets.leds.x - 0.86, offsets.leds.y, offsets.leds.z);
        led.layers.enable(1); // Add to bloom layer
        group.add(led);

        // USB-C port
        const portGeometry = new THREE.BoxGeometry(0.05, 0.02, 0.02);
        const port = new THREE.Mesh(portGeometry, metalMaterial);
        port.position.set(offsets.port.x, offsets.port.y, offsets.port.z);
        group.add(port);

        // Contact shadow for realistic grounding (Phase 3.1)
        addContactShadow(group, 2.3, 1.0, -0.19);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'keyboard', label: 'Keyboard - My Skills' };
        return group;
    }

    createMouse() {
        const group = new THREE.Group();
        const origin = this.origins.mouse;

        const bodyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x2a2a2a,
            roughness: 0.3,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.1,
            clearcoat: 0.25,
            clearcoatRoughness: 0.5
        });

        // Ergonomic shell (Phase 5.1): a domed cross-section revolved into an
        // axisymmetric blob, elongated into an oval footprint, then tapered
        // narrower toward the front (buttons/wheel) and fuller toward the back
        // (palm rest). A uniform-radius cylinder reads as an obvious CG capsule;
        // real mice are widest under the palm and pinch toward the fingertips.
        const mouseHalfLength = 0.12;
        const mouseRadius = 0.09;
        const bodyHeight = 0.16;
        const domeProfile = [];
        const profileSegments = 8;
        for (let i = 0; i <= profileSegments; i++) {
            const t = i / profileSegments; // 0 = base rim, 1 = crown
            const angle = (t * Math.PI) / 2;
            domeProfile.push(new THREE.Vector2(
                Math.max(mouseRadius * Math.cos(angle), 0.001),
                bodyHeight * Math.sin(angle)
            ));
        }
        const bodyGeometry = new THREE.LatheGeometry(domeProfile, 20);
        bodyGeometry.scale(1, 1, mouseHalfLength / mouseRadius);

        const bodyPos = bodyGeometry.attributes.position;
        for (let i = 0; i < bodyPos.count; i++) {
            const x = bodyPos.getX(i);
            const z = bodyPos.getZ(i);
            const tFront = THREE.MathUtils.clamp(z / mouseHalfLength, -1, 1); // -1 palm, +1 front tip
            const widthScale = THREE.MathUtils.lerp(1.08, 0.55, Math.pow(Math.max(tFront, 0), 1.6));
            bodyPos.setX(i, x * widthScale);
        }
        bodyPos.needsUpdate = true;
        bodyGeometry.computeVertexNormals();

        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.set(0, -0.2, 0); // rests on the flat bottom plate below
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Flat bottom
        const bottomGeometry = new THREE.BoxGeometry(0.16, 0.02, 0.24);
        const bottom = new THREE.Mesh(bottomGeometry, bodyMaterial);
        bottom.position.set(0, -0.2, 0);
        bottom.castShadow = true;
        bottom.receiveShadow = true;
        group.add(bottom);

        // Recessed scroll-wheel channel: a slightly wider dark ring sunk just
        // below the shell surface so the wheel itself reads as sitting in a
        // cavity rather than floating on top of the dome.
        const wheelWellGeometry = new THREE.CylinderGeometry(0.024, 0.024, 0.006, 16);
        const wheelWellMaterial = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.9 });
        const wheelWell = new THREE.Mesh(wheelWellGeometry, wheelWellMaterial);
        wheelWell.position.set(0, -0.065, 0.04);
        wheelWell.rotation.z = Math.PI / 2;
        wheelWell.receiveShadow = true;
        group.add(wheelWell);

        // Scroll wheel
        const wheelGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.025, 8);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.6
        });
        const scrollWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        scrollWheel.position.set(0, -0.06, 0.04);
        scrollWheel.rotation.z = Math.PI / 2;
        scrollWheel.castShadow = true;
        group.add(scrollWheel);

        // Button seam: real mice split the top shell between left/right
        // buttons from the front tip back to just past the scroll wheel.
        const seamGeometry = new THREE.BoxGeometry(0.003, 0.008, 0.14);
        const seam = new THREE.Mesh(seamGeometry, new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.9 }));
        seam.position.set(0, -0.045, 0.03);
        seam.castShadow = true;
        group.add(seam);

        // Contact shadow for realistic grounding (Phase 3.1)
        addContactShadow(group, 0.25, 0.35, -0.21);

        applyOrigin(group, origin, true); // Static object
        group.userData = { name: 'mouse', label: 'Mouse - Navigation & Tools' };
        return group;
    }

    createLaptop() {
        const group = new THREE.Group();
        const origin = this.origins.laptop;

        const metalMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x2a2a2a,
            roughness: 0.4,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.8,
            clearcoat: 0.5,
            clearcoatRoughness: 0.2
        });

        // Base (bottom half with keyboard)
        const baseGeometry = createBeveledBox(1.4, 0.05, 0.9, 0.006, 2);
        const base = new THREE.Mesh(baseGeometry, metalMaterial);
        base.position.set(0, 0.025, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Keyboard keys — merged into a single draw call via geometry merge
        const keyMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.9,
            metalness: 0.0
        });

        const keySize = 0.08;
        const keyGap = 0.09;
        const keysStartX = -0.58;
        const keysStartZ = -0.32;

        const laptopKeyGeometries = [];
        const laptopKeyGeometry = new THREE.BoxGeometry(keySize, 0.02, keySize);

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 14; col++) {
                const kg = laptopKeyGeometry.clone();
                kg.translate(keysStartX + col * keyGap, 0.06, keysStartZ + row * keyGap);
                laptopKeyGeometries.push(kg);
            }
        }

        const spaceGeo = new THREE.BoxGeometry(0.5, 0.02, keySize);
        spaceGeo.translate(0, 0.06, keysStartZ + 5 * keyGap);
        laptopKeyGeometries.push(spaceGeo);

        const mergedLaptopKeys = new THREE.Mesh(
            BufferGeometryUtils.mergeGeometries(laptopKeyGeometries),
            keyMaterial
        );
        mergedLaptopKeys.castShadow = true;
        mergedLaptopKeys.receiveShadow = true;
        group.add(mergedLaptopKeys);

        // Screen lid (hinged at the back)
        const screenLid = new THREE.Group();

        // Screen bezel/frame
        const lidGeometry = createBeveledBox(1.4, 0.9, 0.04, 0.005, 2);
        const lid = new THREE.Mesh(lidGeometry, metalMaterial);
        lid.position.set(0, 0.45, 0);
        lid.castShadow = true;
        screenLid.add(lid);

        // Create screen display content: a code-editor mock (Phase 5.4) rather
        // than a plain text window -- a screen showing real-looking code is a
        // much stronger realism cue for a software engineer's laptop, and it
        // reads clearly at the shallow lid angle where a text-heavy window
        // would blur into noise.
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 768;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for keyboard canvas');

        // Fill with simple color initially
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);

        // Defer heavy rendering
        requestAnimationFrame(() => setTimeout(() => {
            // Editor background
            ctx.fillStyle = '#1e1e2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Title bar
            ctx.fillStyle = '#181825';
            ctx.fillRect(0, 0, canvas.width, 44);
            ['#ff5f57', '#ffbd2e', '#28ca42'].forEach((color, i) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(28 + i * 24, 22, 7, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.font = '15px "Courier New", monospace';
            ctx.fillStyle = '#9399b2';
            ctx.textAlign = 'center';
            ctx.fillText('experience.ts — laptop', canvas.width / 2, 27);

            // Line-number gutter
            const gutterWidth = 56;
            ctx.fillStyle = '#181825';
            ctx.fillRect(0, 44, gutterWidth, canvas.height - 44);

            // Syntax-highlighted lines: a small TS snippet describing the role
            const lines = [
                { text: 'interface Role {', color: '#cdd6f4' },
                { text: '  company: string;', color: '#89b4fa' },
                { text: '  title: string;', color: '#89b4fa' },
                { text: '  start: Date;', color: '#89b4fa' },
                { text: '}', color: '#cdd6f4' },
                { text: '', color: '#cdd6f4' },
                { text: 'const nextRole: Role = {', color: '#cdd6f4' },
                { text: '  company: "Amazon Web Services",', color: '#a6e3a1' },
                { text: '  title: "Software Development Engineer",', color: '#a6e3a1' },
                { text: '  start: new Date("2026-06-01"),', color: '#a6e3a1' },
                { text: '};', color: '#cdd6f4' },
                { text: '', color: '#cdd6f4' },
                { text: '// AWS — SDE Intern, Summer 2025, Seattle WA', color: '#6c7086' },
                { text: 'console.log(`Welcome, ${nextRole.title}`);', color: '#f9e2af' }
            ];

            ctx.textAlign = 'left';
            ctx.font = '20px "Courier New", monospace';
            const lineHeight = 34;
            let y = 44 + 30;
            lines.forEach((line, i) => {
                ctx.fillStyle = '#585b70';
                ctx.fillText(String(i + 1), 16, y);
                ctx.fillStyle = line.color;
                ctx.fillText(line.text, gutterWidth + 20, y);
                y += lineHeight;
            });

            texture.needsUpdate = true;
        }, 0));

        // Canvas pixels represent display colors, so keep the texture in sRGB.
        texture.colorSpace = THREE.SRGBColorSpace;

        // Display screen on the lid with moderate emissive glow
        const screenGeometry = new THREE.PlaneGeometry(1.3, 0.8);
        const screenMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0x60799b,
            emissiveMap: texture,
            emissiveIntensity: 1,
            roughness: 0.05,
            roughnessMap: createScreenSmudgeTexture(),
            metalness: 0.0,
            envMapIntensity: LIGHTING_CONFIG.environment.screen
        });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        screen.position.set(0, 0.45, 0.025);
        screen.layers.enable(1); // Add to bloom layer
        screenLid.add(screen);

        // Dynamic glare overlay for laptop screen
        const laptopGlareGeometry = new THREE.PlaneGeometry(1.28, 0.78);
        let laptopGlareMaterial;

        if (this.lightingSystem) {
            laptopGlareMaterial = this.lightingSystem.createGlareMaterial({
                glareIntensity: 0.25, // Less intense than monitor
                glareSharpness: 5.0,
                fresnelPower: 2.0
            });
        } else {
            laptopGlareMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.03,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
        }

        const laptopGlareOverlay = new THREE.Mesh(laptopGlareGeometry, laptopGlareMaterial);
        laptopGlareOverlay.position.set(0, 0.45, 0.03);
        laptopGlareOverlay.renderOrder = 1;
        if (this.lightingSystem) {
            laptopGlareOverlay.userData.glareMaterial = laptopGlareMaterial;
        }
        screenLid.add(laptopGlareOverlay);

        // The laptop screen used to also carry a RectAreaLight for even rectangular
        // illumination -- deleted: the screen's emissive
        // material plus bloom already sell the glow, and the bounce PointLight below
        // provides the soft keyboard/desk fill a RectAreaLight would have added, at a
        // fraction of the per-fragment cost.

        // Faint cool bounce light from the laptop screen onto nearby desk
        // surfaces (Phase 3.3 TODO, closed out here). Built as a child of
        // screenLid so its position tracks the tilted screen correctly, then
        // handed off to addEmissiveLight (which parents lights to the scene
        // root) using its computed world position -- reading its *local*
        // position after that reparent would silently drop the screenLid/group
        // tilt and offset.
        const laptopBounceLight = this.lightingSystem ? new THREE.PointLight(0x8fb8ff, 0.05, 2, 2) : null;
        if (laptopBounceLight) {
            laptopBounceLight.position.set(0, 0.45, 0.1);
            screenLid.add(laptopBounceLight);
        }

        // Position screen lid at the back edge of the base, tilted open
        screenLid.position.set(0, 0.05, -0.45);
        screenLid.rotation.x = -Math.PI / 6;  // Open at ~30 degrees from vertical
        group.add(screenLid);

        // Contact shadow for realistic grounding (Phase 3.1)
        addContactShadow(group, 1.6, 1.1, 0);

        applyOrigin(group, origin, true); // Static object

        if (laptopBounceLight && this.lightingSystem) {
            const worldPos = new THREE.Vector3();
            laptopBounceLight.getWorldPosition(worldPos);
            screenLid.remove(laptopBounceLight);
            laptopBounceLight.position.copy(worldPos);
            laptopBounceLight.matrixAutoUpdate = false;
            laptopBounceLight.updateMatrix();
            this.lightingSystem.addEmissiveLight(laptopBounceLight);
        }

        group.userData = { name: 'laptop', label: 'Laptop - Work Experience' };
        return group;
    }

    createDigitalClock() {
        const group = new THREE.Group();
        const origin = this.origins.clock;

        // Clock body - sleek rectangular box
        const bodyGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.1);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.2,
            metalness: 0.5
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.08; // Sit on desk surface
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // LED Screen
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for clock canvas');

        const texture = new THREE.CanvasTexture(canvas);
        if (texture.colorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
        texture.colorSpace = THREE.SRGBColorSpace;

        const screenGeometry = new THREE.PlaneGeometry(0.6, 0.3);
        const screenMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff
        });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        screen.position.set(0, 0.15, 0.051); // Slightly in front of body
        group.add(screen);

        // Time update function
        let lastMinuteKey = -1;
        const timeFormatter = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' });
        
        /** @returns {boolean} True when the clock face was actually redrawn. */
        const updateTime = () => {
            const nowMs = Date.now();
            const minuteKey = Math.floor(nowMs / 60000);

            if (minuteKey === lastMinuteKey) return false;
            lastMinuteKey = minuteKey;
            const timeString = timeFormatter.format(new Date(minuteKey * 60000));

            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 100px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(timeString, canvas.width / 2, canvas.height / 2 + 5);

            texture.needsUpdate = true;
            return true;
        };

        updateTime();

        applyOrigin(group, origin);
        group.userData = { name: 'clock', label: 'Digital Clock', updateTime };
        return group;
    }
}

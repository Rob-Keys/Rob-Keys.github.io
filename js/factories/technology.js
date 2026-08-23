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
        const frontScreenMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            emissive: 0xaabbcc,
            emissiveMap: texture,
            emissiveIntensity: 1.15,
            roughness: 0.15, // Lower roughness for realistic screen reflection
            roughnessMap: createScreenSmudgeTexture(), // faint fingerprint/smudge catches env light when the screen is dark
            metalness: 0.0,
            clearcoat: 0.45,
            clearcoatRoughness: 0.08,
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

        // A soft, texture-backed contact card grounds the stand without another
        // shadow map or a second light source.
        addContactShadow(group, 1.0, 0.9, -0.21);

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
            metalness: 0.0,
            vertexColors: true
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
            // Tiny height/color differences keep the key field from reading as a
            // perfectly manufactured grid. The spacebar gets a restrained warm
            // gray tint to suggest handling wear while remaining one draw call.
            const heightScale = 0.96 + ((i * 17) % 7) * 0.012;
            matrix.compose(
                new THREE.Vector3(transform.x, transform.y, transform.z),
                quaternion,
                new THREE.Vector3(transform.scaleX, heightScale, transform.scaleZ)
            );
            keycapInstances.setMatrixAt(i, matrix);
            keycapInstances.setColorAt(i, new THREE.Color(
                transform.label === '' ? 0xd8d5cc : 0xf0f0ee
            ));
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

        // Apple-style unibody aluminum is bright enough to show its form in the
        // warm room, but still carries the cool, satin reflection of anodized metal.
        const aluminumMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xb9bec4,
            roughness: 0.32,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.92,
            clearcoat: 0.22,
            clearcoatRoughness: 0.28
        });
        const darkAluminumMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x30343a,
            roughness: 0.48,
            metalness: 0.72,
            clearcoat: 0.18,
            clearcoatRoughness: 0.4
        });
        const blackGlassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x05070b,
            roughness: 0.2,
            metalness: 0.08,
            clearcoat: 0.7,
            clearcoatRoughness: 0.08
        });

        // The base is a shallow, rounded unibody shell with a raised keyboard deck.
        const base = new THREE.Mesh(createBeveledBox(1.74, 0.052, 1.08, 0.014, 3), aluminumMaterial);
        base.position.y = 0.026;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const deck = new THREE.Mesh(createBeveledBox(1.69, 0.016, 1.02, 0.011, 3), aluminumMaterial);
        deck.position.y = 0.058;
        deck.castShadow = true;
        deck.receiveShadow = true;
        group.add(deck);

        // Black keyboard well. The narrow aluminum border around it is a key
        // MacBook cue and prevents the keyboard from reading as a floating grid.
        const keyboardWell = new THREE.Mesh(
            createBeveledBox(1.41, 0.008, 0.50, 0.012, 3),
            new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.72, metalness: 0.16 })
        );
        keyboardWell.position.set(0, 0.069, -0.18);
        keyboardWell.castShadow = true;
        keyboardWell.receiveShadow = true;
        group.add(keyboardWell);

        // Rounded keycaps are instanced: the keyboard gets a proper silhouette and
        // highlight at one draw call instead of dozens of independent meshes.
        const keyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x292d33,
            roughness: 0.68,
            metalness: 0.12,
            clearcoat: 0.08,
            clearcoatRoughness: 0.32
        });
        const keyGeometry = createKeycapGeometry(0.078, 0.068, 0.012, 0.84, 0.009, 2);
        const keyRows = [
            { count: 14, start: -0.585, z: -0.385, step: 0.088 },
            { count: 13, start: -0.54, z: -0.305, step: 0.093 },
            { count: 13, start: -0.54, z: -0.225, step: 0.093 },
            { count: 12, start: -0.49, z: -0.145, step: 0.098 },
            { count: 11, start: -0.43, z: -0.065, step: 0.105 }
        ];
        const keyCount = keyRows.reduce((total, row) => total + row.count, 0) + 1;
        const keys = new THREE.InstancedMesh(keyGeometry, keyMaterial, keyCount);
        const keyTransform = new THREE.Object3D();
        let keyIndex = 0;
        keyRows.forEach((row) => {
            for (let column = 0; column < row.count; column++) {
                keyTransform.position.set(row.start + column * row.step, 0.078, row.z);
                keyTransform.rotation.set(0, 0, 0);
                keyTransform.scale.set(1, 1, 1);
                keyTransform.updateMatrix();
                keys.setMatrixAt(keyIndex++, keyTransform.matrix);
            }
        });
        // A wider space bar fills the final row without needing a second material.
        keyTransform.position.set(0, 0.078, 0.015);
        keyTransform.scale.set(5.4, 1, 1);
        keyTransform.updateMatrix();
        keys.setMatrixAt(keyIndex, keyTransform.matrix);
        keys.instanceMatrix.needsUpdate = true;
        keys.castShadow = true;
        keys.receiveShadow = true;
        group.add(keys);

        const trackpad = new THREE.Mesh(
            createBeveledBox(0.74, 0.006, 0.36, 0.014, 3),
            new THREE.MeshPhysicalMaterial({
                color: 0x9299a1,
                roughness: 0.18,
                metalness: 0.26,
                clearcoat: 0.72,
                clearcoatRoughness: 0.1
            })
        );
        trackpad.position.set(0, 0.069, 0.32);
        trackpad.castShadow = true;
        trackpad.receiveShadow = true;
        group.add(trackpad);

        // Two short hinge barrels make the lid feel mechanically attached.
        const hingeGeometry = new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12);
        const hingeGeometries = [-0.43, 0.43].map((x) => {
            const geometry = hingeGeometry.clone();
            geometry.rotateZ(Math.PI / 2);
            geometry.translate(x, 0.076, -0.505);
            return geometry;
        });
        const hinges = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(hingeGeometries), darkAluminumMaterial);
        hinges.castShadow = true;
        group.add(hinges);

        // Screen lid (hinged at the rear edge of the base).
        const screenLid = new THREE.Group();
        const lid = new THREE.Mesh(createBeveledBox(1.74, 1.0, 0.028, 0.014, 3), aluminumMaterial);
        lid.position.y = 0.49;
        lid.castShadow = true;
        lid.receiveShadow = true;
        screenLid.add(lid);

        const glassBorder = new THREE.Mesh(
            createBeveledBox(1.62, 0.89, 0.012, 0.012, 3),
            blackGlassMaterial
        );
        glassBorder.position.set(0, 0.49, 0.022);
        screenLid.add(glassBorder);

        const canvas = document.createElement('canvas');
        canvas.width = 1440;
        canvas.height = 900;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for laptop terminal');

        // Draw the complete terminal before creating the texture. This removes the
        // dark first-frame flash and keeps the visual source compact and reusable.
        ctx.fillStyle = '#0b0f14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#20262f';
        ctx.fillRect(0, 0, canvas.width, 62);
        ['#ff5f57', '#febc2e', '#28c840'].forEach((color, index) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(34 + index * 27, 31, 9, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#aeb7c4';
        ctx.font = '24px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('zsh — 80×24', canvas.width / 2, 39);
        ctx.textAlign = 'left';
        ctx.font = '28px Menlo, Monaco, "Courier New", monospace';
        const terminalLines = [
            ['Last login: Fri Aug 23 09:41:12 on ttys001', '#7e8a9a'],
            ['rob@macbook-pro ~ % cd ~/projects/portfolio', '#d7e0ea'],
            ['rob@macbook-pro portfolio % npm run dev', '#8cc8ff'],
            ['', '#d7e0ea'],
            ['  VITE v8.2.2  ready in 182 ms', '#8ee6a1'],
            ['  ➜  Local:   http://localhost:5173/', '#b5d8ff'],
            ['  ➜  Network: use --host to expose', '#8d99a8'],
            ['', '#d7e0ea'],
            ['rob@macbook-pro portfolio % git status', '#d7e0ea'],
            ['On branch main', '#a7b3c2'],
            ['nothing to commit, working tree clean', '#8ee6a1'],
            ['', '#d7e0ea'],
            ['rob@macbook-pro portfolio % _', '#d7e0ea']
        ];
        terminalLines.forEach(([line, color], index) => {
            ctx.fillStyle = color;
            ctx.fillText(line, 54, 118 + index * 54);
        });
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;

        // The display pixels are deliberately unlit. A real LCD emits its image
        // independently of the room, while the separate glass/glow layers below
        // provide reflections and light spill without washing out the terminal.
        const screenMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.82), screenMaterial);
        screen.position.set(0, 0.49, 0.065);
        screen.layers.enable(1);
        screenLid.add(screen);

        // Tiny camera dot inside the top bezel anchors the scale of the display.
        const cameraDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.009, 10, 8),
            new THREE.MeshPhysicalMaterial({ color: 0x090b0f, roughness: 0.18, metalness: 0.75 })
        );
        cameraDot.position.set(0, 0.885, 0.07);
        screenLid.add(cameraDot);

        let laptopGlareMaterial;
        if (this.lightingSystem) {
            laptopGlareMaterial = this.lightingSystem.createGlareMaterial({
                glareIntensity: 0.045,
                glareSharpness: 7.0,
                fresnelPower: 2.6
            });
        } else {
            laptopGlareMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.012,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
        }
        const laptopGlareOverlay = new THREE.Mesh(new THREE.PlaneGeometry(1.53, 0.80), laptopGlareMaterial);
        laptopGlareOverlay.position.set(0, 0.49, 0.071);
        laptopGlareOverlay.renderOrder = 1;
        if (this.lightingSystem) laptopGlareOverlay.userData.glareMaterial = laptopGlareMaterial;
        screenLid.add(laptopGlareOverlay);

        const laptopBounceLight = this.lightingSystem ? new THREE.PointLight(0x9cc6ff, 0.28, 2.8, 2) : null;
        if (laptopBounceLight) {
            laptopBounceLight.position.set(0, 0.45, 0.12);
            screenLid.add(laptopBounceLight);
        }

        screenLid.position.set(0, 0.076, -0.505);
        screenLid.rotation.x = -Math.PI / 6;
        group.add(screenLid);

        addContactShadow(group, 1.8, 1.2, 0);

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
        const bodyGeometry = createBeveledBox(0.8, 0.4, 0.1, 0.012, 2);
        const bodyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            roughness: 0.28,
            roughnessMap: createRoughnessVariationTexture(),
            metalness: 0.45,
            clearcoat: 0.25,
            clearcoatRoughness: 0.2
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
        const screenMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            color: 0xffffff,
            emissive: 0xff2300,
            emissiveMap: texture,
            emissiveIntensity: 0.55,
            roughness: 0.25,
            clearcoat: 0.35,
            clearcoatRoughness: 0.12,
            metalness: 0.0
        });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        screen.position.set(0, 0.15, 0.051); // Slightly in front of body
        group.add(screen);

        addContactShadow(group, 0.82, 0.28, -0.13);

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

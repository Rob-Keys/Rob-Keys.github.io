// @ts-check
/**
 * Interaction handling.
 * Manages user interactions, raycasting, camera zoom, and UI panels.
 */

import * as THREE from 'three/webgpu';
import { gsap } from 'gsap';
import { PORTFOLIO_CONFIG, ZOOM_CONFIG, INTERACTION_CONFIG } from '../config/config.js';
import { MonitorRenderer } from '../factories/monitor-renderer.js';

export class InteractionManager {
    /**
     * @param {THREE.Camera} camera
     * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
     * @param {THREE.Object3D[]} interactiveObjects
     * @param {THREE.Scene} scene
     * @param {() => void} [requestRender] - Notifies the render-on-demand loop
     *   that user input occurred.
     * @param {MonitorRenderer} [monitorRenderer] - Shared monitor renderer used to
     *   avoid retaining duplicate offscreen content canvases.
     * @param {import('./accessibility.js').SemanticPortfolioController} [semanticPortfolio]
     */
    constructor(camera, controls, interactiveObjects, scene, requestRender = () => {}, monitorRenderer = new MonitorRenderer(), semanticPortfolio = undefined) {
        this.camera = camera;
        this.controls = controls;
        this.interactiveObjects = interactiveObjects;
        this.scene = scene;
        this.requestRender = requestRender;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.currentZoomedObject = null;
        this.originalCameraPosition = { x: 0, y: 3, z: 5 };
        this.originalControlsTarget = { x: 0, y: 0, z: 0 };

        this.monitorScrollOffset = 0;
        this.monitorMesh = null;
        this.hoveredObject = null;
        this.lastTouchTime = 0;
        this.touchStartPosition = new THREE.Vector2();

        // Hint glow state -- outlines appear after 5s without clicking an object
        /** @type {THREE.Group | null} */ this.hintOutlineGroup = null;
        /** @type {THREE.MeshBasicMaterial | null} */ this.hintOutlineMaterial = null;
        this.hintActive = false;
        this.hintTimer = null;
        this.HINT_DELAY = INTERACTION_CONFIG.hintDelay;

        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.semanticPortfolio = semanticPortfolio;

        // Monitor renderer for canvas content
        this.monitorRenderer = monitorRenderer;

        this.initEventListeners();
        this.semanticPortfolio?.setActivationHandler((name, control) => this.activateObjectByName(name, control));
        this.semanticPortfolio?.setCloseHandler(() => {
            if (this.currentZoomedObject) this.resetCamera();
        });
    }

    /**
     * Initialize all event listeners
     */
    initEventListeners() {
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('click', (e) => this.onMouseClick(e));
        window.addEventListener('wheel', (e) => this.onMouseWheel(e));
        
        // Add touch listeners for better mobile support
        window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

        // Keep the original camera shortcut when no semantic detail is open.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !e.defaultPrevented && this.currentZoomedObject) {
                this.resetCamera();
            }
        });

    }

    /** @param {string} name @param {HTMLElement} [control] */
    activateObjectByName(name, control) {
        const object = this.interactiveObjects.find(item => item.userData?.name === name) || null;
        if (object) this.activateObject(object, control);
        else this.semanticPortfolio?.openDetails(name, control);
    }

    /** @param {THREE.Object3D} object @param {HTMLElement} [control] */
    activateObject(object, control = undefined) {
        this.hideHint();
        this.startHintTimer();

        if (this.currentZoomedObject && object === this.currentZoomedObject) {
            this.resetCamera();
        } else {
            this.zoomToObject(object);
        }

        this.semanticPortfolio?.openDetails(object.userData.name, control);
    }

    onTouchStart(event) {
        if (event.target instanceof Element && !document.getElementById('canvas-container')?.contains(event.target)) return;
        if (event.touches.length > 0) {
            this.touchStartPosition.set(event.touches[0].clientX, event.touches[0].clientY);
        }
    }

    onTouchEnd(event) {
        if (event.target instanceof Element && !document.getElementById('canvas-container')?.contains(event.target)) return;
        if (event.changedTouches.length > 0) {
            const touch = event.changedTouches[0];
            const dx = touch.clientX - this.touchStartPosition.x;
            const dy = touch.clientY - this.touchStartPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If movement is small (tap), trigger click
            if (distance < 10) {
                this.lastTouchTime = Date.now();
                
                // Trigger click logic with touch coordinates
                this.onMouseClick({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => {},
                    type: 'touch' // Mark as touch event
                });
            }
        }
    }

    /**
     * Handle mouse movement for hover effects
     */
    onMouseMove(event) {
        // Update mouse position
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update cursor affordance on interactive objects (only when not zoomed).
        // A hover-triggered light used to live here (see git history) but its
        // `visible` flag was never flipped back to true after creation, so it never
        // actually illuminated anything — it just forced a full post-processing
        // re-render on every mousemove for zero visual effect (P0-4,
        // The cursor swap is the only surviving affordance,
        // and requestRender only fires on the object identity actually changing.
        if (!this.currentZoomedObject) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

            /** @type {THREE.Object3D | null} */
            let object = null;
            if (intersects.length > 0) {
                object = intersects[0].object;
                while (object && !this.interactiveObjects.includes(object)) {
                    object = object.parent;
                }
            }

            document.body.style.cursor = object ? 'pointer' : 'default';

            if (this.hoveredObject !== object) {
                this.hoveredObject = object;
                this.requestRender();
            }
        }
    }

    /**
     * Handle mouse clicks on objects
     */
    onMouseClick(event) {
        const canvasContainer = document.getElementById('canvas-container');
        if (event.type === 'click' && event.target instanceof Element && !canvasContainer?.contains(event.target)) return;

        // Ignore native click events if we just handled a touch tap
        if (event.type === 'click' && Date.now() - this.lastTouchTime < 500) return;

        // Update mouse coordinates explicitly for touch devices
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

        if (intersects.length > 0) {
            // Find root object
            /** @type {THREE.Object3D | null} */
            let clickedObject = intersects[0].object;
            while (clickedObject && !this.interactiveObjects.includes(clickedObject)) {
                clickedObject = clickedObject.parent;
            }

            if (clickedObject) {
                this.activateObject(clickedObject);
            }


        } else {
            // Clicked on empty space - zoom out if currently zoomed
            if (this.currentZoomedObject) {
                this.resetCamera();
            }
        }
    }

    /**
     * Zoom camera to focus on an object
     */
    zoomToObject(object) {
        this.currentZoomedObject = object;
        this.controls.enabled = false;

        // Store original camera position
        this.originalCameraPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };
        this.originalControlsTarget = {
            x: this.controls.target.x,
            y: this.controls.target.y,
            z: this.controls.target.z
        };

        // Calculate zoom position based on object type
        const objectPosition = new THREE.Vector3();
        object.getWorldPosition(objectPosition);

        const objectName = object.userData.name;

        // Get zoom config for this object type, falling back to default
        const zoomSettings = ZOOM_CONFIG[objectName] || ZOOM_CONFIG.default;
        const zoomDistance = zoomSettings.distance;
        const yOffset = zoomSettings.yOffset;
        const targetYOffset = zoomSettings.targetYOffset || 0;



        // Store monitor reference for scroll functionality
        if (objectName === 'monitor') {
            this.monitorMesh = object;
        }

        let offsetX = 0;
        let offsetZ = zoomDistance;

        if (zoomSettings.useRotation) {
            const rotationY = object.rotation.y;
            offsetX = Math.sin(rotationY) * zoomDistance;
            offsetZ = Math.cos(rotationY) * zoomDistance;
        }

        const zoomPosition = {
            x: objectPosition.x + offsetX,
            y: objectPosition.y + yOffset,
            z: objectPosition.z + offsetZ
        };

        const duration = this.reducedMotion ? 0 : PORTFOLIO_CONFIG.animation.zoomDuration;
        const ease = PORTFOLIO_CONFIG.animation.zoomEase;

        // Animate camera
        gsap.to(this.camera.position, {
            x: zoomPosition.x,
            y: zoomPosition.y,
            z: zoomPosition.z,
            duration: duration,
            ease: ease,
            onUpdate: () => this.requestRender()
        });

        gsap.to(this.controls.target, {
            x: objectPosition.x,
            y: objectPosition.y + targetYOffset,
            z: objectPosition.z,
            duration: duration,
            ease: ease
        });


    }

    /**
     * Reset camera to original position
     */
    resetCamera() {
        if (this.currentZoomedObject) {
            const duration = this.reducedMotion ? 0 : PORTFOLIO_CONFIG.animation.zoomDuration;
            const ease = PORTFOLIO_CONFIG.animation.zoomEase;

            // Animate camera back to original position
            gsap.to(this.camera.position, {
                x: this.originalCameraPosition.x,
                y: this.originalCameraPosition.y,
                z: this.originalCameraPosition.z,
                duration: duration,
                ease: ease,
                onUpdate: () => this.requestRender()
            });

            gsap.to(this.controls.target, {
                x: this.originalControlsTarget.x,
                y: this.originalControlsTarget.y,
                z: this.originalControlsTarget.z,
                duration: duration,
                ease: ease,
                onComplete: () => {
                    this.controls.enabled = true;
                    this.currentZoomedObject = null;
                    this.startHintTimer();
                }
            });
        }
    }

    /**
     * Handle mouse wheel for scrolling monitor content
     */
    onMouseWheel(event) {
        if (event.target instanceof Element && !document.getElementById('canvas-container')?.contains(event.target)) return;

        let shouldScroll = false;

        if (this.currentZoomedObject && this.currentZoomedObject.userData.name === 'monitor') {
            shouldScroll = true;
        } else if (!this.currentZoomedObject) {
            // Check if hovering over monitor when not zoomed
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

            if (intersects.length > 0) {
                /** @type {THREE.Object3D | null} */
                let object = intersects[0].object;
                while (object && !this.interactiveObjects.includes(object)) {
                    object = object.parent;
                }

                if (object && object.userData.name === 'monitor') {
                    shouldScroll = true;
                    this.monitorMesh = object;
                }
            }
        }

        if (shouldScroll) {
            event.preventDefault();

            // Update scroll offset
            this.monitorScrollOffset += event.deltaY * 0.5;
            this.monitorScrollOffset = Math.max(0, Math.min(this.monitorScrollOffset, 2000));

            // Update monitor texture
            this.updateMonitorTexture();
            this.requestRender();
        }
    }

    /**
     * Update monitor texture with scrollable content
     */
    updateMonitorTexture() {
        if (!this.monitorMesh) return;

        // Find the screen mesh within the monitor group (more robust search)
        const screenMesh = this.monitorMesh.children.find(child =>
            child instanceof THREE.Mesh && child.userData && child.userData.isScreen
        ) || this.monitorMesh.children.find(child =>
            child instanceof THREE.Mesh && child.material && child.material.map
        );

        if (screenMesh) {
            const canvas = this.createMonitorCanvas(this.monitorScrollOffset);

            // Handle multi-material mesh (texture is on index 4: Front)
            let targetMaterial = screenMesh.material;
            if (Array.isArray(screenMesh.material)) {
                targetMaterial = screenMesh.material[4];
            }

            // Reuse existing texture if possible to prevent memory churn
            if (targetMaterial.map && targetMaterial.map.isCanvasTexture) {
                targetMaterial.map.image = canvas;
                targetMaterial.map.needsUpdate = true;
            } else {
                const texture = new THREE.CanvasTexture(canvas);
                texture.anisotropy = 16;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;
                if (texture.colorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
                texture.colorSpace = THREE.SRGBColorSpace;
                targetMaterial.map = texture;
                targetMaterial.emissiveMap = texture;
                targetMaterial.needsUpdate = true;
            }
        }
    }

    /**
     * Create canvas for monitor with scrollable content
     * Delegates to MonitorRenderer for actual rendering
     */
    createMonitorCanvas(scrollOffset) {
        return this.monitorRenderer.createMonitorCanvas(scrollOffset);
    }

    /**
     * Build the hint-glow geometry for every interactive object: a slightly inflated
     * clone of each mesh, backface-only, sharing one flat-color material. Front faces of
     * the real object occlude the inner backfaces of the clone, leaving only a silhouette
     * edge visible around it -- the classic "inflated hull" outline technique. This draws
     * as ordinary geometry in the normal scene pass (no extra scene re-renders, no
     * depth/mask buffers), replacing the old OutlinePass -- which dimmed the whole scene
     * via those internal buffers even after its overlay-material fix (see the closed-out
     * CLAUDE.md TODO). Geometry is shared by reference with the source meshes; only new
     * Mesh wrapper objects are created, and instanced meshes (keycaps) are skipped since
     * a single non-instanced draw can't reproduce their per-instance transforms.
     * @param {THREE.Object3D[]} interactiveObjects
     */
    initHintOutline(interactiveObjects) {
        this.hintOutlineMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            toneMapped: false
        });

        this.hintOutlineGroup = new THREE.Group();
        this.hintOutlineGroup.visible = false;

        const outlineMaterial = /** @type {THREE.MeshBasicMaterial} */ (this.hintOutlineMaterial);
        const INFLATE_SCALE = 1.03;
        for (const object of interactiveObjects) {
            object.updateMatrixWorld(true);
            object.traverse((child) => {
                if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh) return;

                const outlineMesh = new THREE.Mesh(child.geometry, outlineMaterial);
                child.updateMatrixWorld(true);
                outlineMesh.matrix.copy(child.matrixWorld);
                outlineMesh.matrix.decompose(outlineMesh.position, outlineMesh.quaternion, outlineMesh.scale);
                outlineMesh.scale.multiplyScalar(INFLATE_SCALE);
                outlineMesh.matrixAutoUpdate = false;
                outlineMesh.updateMatrix();
                /** @type {THREE.Group} */ (this.hintOutlineGroup).add(outlineMesh);
            });
        }

        if (this.scene) this.scene.add(this.hintOutlineGroup);
        this.startHintTimer();
    }

    /**
     * Start or restart the hint timer
     */
    startHintTimer() {
        if (this.reducedMotion) return;
        if (this.hintTimer) {
            clearTimeout(this.hintTimer);
        }
        this.hintTimer = setTimeout(() => this.showHint(), this.HINT_DELAY);
    }

    /**
     * Fade in the hint outlines on interactive objects
     */
    showHint() {
        if (!this.hintOutlineGroup || !this.hintOutlineMaterial || this.currentZoomedObject) return;

        this.hintActive = true;
        this.hintOutlineMaterial.opacity = 0;
        this.hintOutlineGroup.visible = true;

        gsap.to(this.hintOutlineMaterial, {
            opacity: 0.6,
            duration: 2.0,
            ease: 'power1.out',
            onUpdate: () => this.requestRender()
        });
    }

    /**
     * Fade out the hint outlines after the user clicks an object
     */
    hideHint() {
        if (!this.hintOutlineGroup || !this.hintOutlineMaterial || !this.hintActive) return;

        gsap.to(this.hintOutlineMaterial, {
            opacity: 0,
            duration: 1.0,
            ease: 'power1.in',
            onUpdate: () => this.requestRender(),
            onComplete: () => {
                /** @type {THREE.Group} */ (this.hintOutlineGroup).visible = false;
                this.hintActive = false;
            }
        });
    }

    /**
     * Check if currently zoomed on an object
     */
    isZoomed() {
        return this.currentZoomedObject !== null;
    }
}

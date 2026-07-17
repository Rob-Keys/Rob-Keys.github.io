// @ts-check
/**
 * Scene setup and initialization.
 * Handles Three.js scene, camera, renderer, and lighting setup.
 */

import { PORTFOLIO_CONFIG, LIGHTING_CONFIG, OBJECT_ORIGINS } from '../config/config.js';
import { LightingSystem } from '../systems/lighting.js';

const BLOOM_LAYER = 1;

export class SceneManager {
    constructor() {
        /** @type {THREE.Scene | null} */ this.scene = null;
        /** @type {THREE.PerspectiveCamera | null} */ this.camera = null;
        /** @type {THREE.WebGLRenderer | null} */ this.renderer = null;
        /** @type {import('three').OrbitControls | null} */ this.controls = null;
        /** @type {import('three').EffectComposer | null} */ this.composer = null;
        /** @type {import('three').EffectComposer | null} */ this.bloomComposer = null;
        /** @type {import('../systems/lighting.js').LightingSystem | null} */ this.lightingSystem = null;
        /** @type {import('three').OutlinePass | null} */ this.outlinePass = null;
        /** @type {import('three').SSAOPass | null} */ this.ssaoPass = null;
        /** @type {import('three').UnrealBloomPass | null} */ this.bloomPass = null;
        /** @type {THREE.MeshBasicMaterial | null} */ this.darkMaterial = null;
        /** @type {unknown} */ this.lights = null;
        this.origins = OBJECT_ORIGINS.scene;
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();

        // Initialize the unified lighting system
        this.lightingSystem = new LightingSystem(this.renderer, this.scene);
        this.lightingSystem.init();

        // Expose lights reference for backward compatibility
        this.lights = this.lightingSystem.lights;

        this.setupPostProcessing();
        this.createFloor();

        window.addEventListener('resize', () => this.onWindowResize());

        return { scene: this.scene, camera: this.camera, renderer: this.renderer, controls: this.controls };
    }

    /**
     * Create the Three.js scene
     */
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(PORTFOLIO_CONFIG.scene.backgroundColor);
        
        // Enhanced fog for more realistic atmospheric depth
        this.scene.fog = new THREE.FogExp2(
            PORTFOLIO_CONFIG.scene.fogColor,
            0.02 // Exponential fog for more natural depth falloff
        );
    }

    /**
     * Create and configure the camera
     */
    createCamera() {
        const { fov, near, far, initialPosition } = PORTFOLIO_CONFIG.camera;

        this.camera = new THREE.PerspectiveCamera(
            fov,
            window.innerWidth / window.innerHeight,
            near,
            far
        );

        this.camera.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );
    }

    /**
     * Create and configure the WebGL renderer for ultra-realistic output
     */
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true, // Enable antialiasing for smooth edges
            powerPreference: 'high-performance',
            stencil: false,
            alpha: false,
            logarithmicDepthBuffer: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // High quality shadow mapping
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // ACESFilmic tone mapping for cinematic look
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // 0.88: ceiling spot decay changed from 1.5→2 (physically correct inverse-square),
        // and intensities were raised to compensate; exposure bumped slightly to balance
        // the net scene brightness after all lighting changes.
        this.renderer.toneMappingExposure = 0.84;

        // Enable physically correct light units
        if (this.renderer.physicallyCorrectLights !== undefined) {
            this.renderer.physicallyCorrectLights = true;
        }

        // Output encoding for correct color representation
        // r128 uses outputEncoding with THREE.sRGBEncoding
        if (THREE.sRGBEncoding !== undefined) {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }

        const container = document.getElementById('canvas-container');
        if (!container) throw new Error('canvas-container element not found');
        container.appendChild(this.renderer.domElement);
    }

    /**
     * Create orbit controls for camera manipulation
     */
    createControls() {
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);
        const renderer = /** @type {THREE.WebGLRenderer} */ (this.renderer);
        this.controls = new THREE.OrbitControls(camera, renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = PORTFOLIO_CONFIG.controls.dampingFactor;
        this.controls.minDistance = PORTFOLIO_CONFIG.controls.minDistance;
        this.controls.maxDistance = PORTFOLIO_CONFIG.controls.maxDistance;
        this.controls.maxPolarAngle = PORTFOLIO_CONFIG.controls.maxPolarAngle;

        this.controls.enableRotate = true;
        this.controls.enablePan = true;
        this.controls.enableZoom = false;

        this.controls.target.set(0, 2, 0);
    }

    /**
     * Set up post-processing effects (bloom for emissive surfaces)
     */
    setupPostProcessing() {
        if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass) {
            console.warn('Post-processing not available, using standard rendering');
            return;
        }
        // Narrow nullable fields — setupPostProcessing is called from init() after create* methods
        const renderer = /** @type {THREE.WebGLRenderer} */ (this.renderer);
        const scene = /** @type {THREE.Scene} */ (this.scene);
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);

        // Shared dark material for material swapping during bloom pass
        this.darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        // Bloom composer — renders ONLY emissive objects (screens, LEDs, lamp bulb) so
        // that bloom is confined to genuine light sources. Everything else is swapped to
        // black in render(), so only bright emissives survive the threshold. Its output
        // is composited additively over the full scene by the combine pass below — the
        // result never goes straight to screen.
        this.bloomComposer = new THREE.EffectComposer(renderer);
        this.bloomComposer.renderToScreen = false;
        const bloomRenderPass = new THREE.RenderPass(scene, camera);
        this.bloomComposer.addPass(bloomRenderPass);

        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.62,  // Strength — a soft, physically-plausible glow around emissive sources
            0.60,  // Radius — wide, gentle falloff like real lens/atmospheric scatter
            0.0    // Threshold 0: the emissive-only pass is already black everywhere else
        );
        this.bloomComposer.addPass(bloomPass);
        this.bloomPass = bloomPass;

        // Final composer — full scene, then additively composite the emissive-only bloom.
        this.composer = new THREE.EffectComposer(renderer);
        const renderPass = new THREE.RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        // SSAO — darkens crevices and contact points (object bases, corners) that the
        // real-time shadow maps alone don't catch, since those only account for one
        // directional occluder rather than ambient occlusion from all directions.
        if (THREE.SSAOPass) {
            const ssaoPass = new THREE.SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
            ssaoPass.kernelRadius = 0.5;
            ssaoPass.minDistance = 0.001;
            ssaoPass.maxDistance = 0.1;
            this.composer.addPass(ssaoPass);
            this.ssaoPass = ssaoPass;
        }

        // Combine pass: base scene color + isolated bloom texture (additive).
        // This is the compositing step that the previous full-scene bloom was missing —
        // it restricts glow to actual light sources instead of washing out lit diffuse
        // surfaces (keyboard, album art, notebook, desktop).
        const combinePass = new THREE.ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: this.bloomComposer.renderTarget2.texture }
                },
                vertexShader: [
                    'varying vec2 vUv;',
                    'void main() {',
                    '    vUv = uv;',
                    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                    '}'
                ].join('\n'),
                fragmentShader: [
                    'uniform sampler2D baseTexture;',
                    'uniform sampler2D bloomTexture;',
                    'varying vec2 vUv;',
                    'void main() {',
                    '    vec4 base = texture2D(baseTexture, vUv);',
                    '    vec4 bloom = texture2D(bloomTexture, vUv);',
                    '    gl_FragColor = base + bloom;',
                    '}'
                ].join('\n'),
                defines: {}
            }),
            'baseTexture'
        );
        combinePass.needsSwap = true;
        this.composer.addPass(combinePass);

        // Add outline pass for hint glow on interactive objects (to final composer)
        if (THREE.OutlinePass) {
            const outlinePass = new THREE.OutlinePass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                scene,
                camera
            );
            outlinePass.visibleEdgeColor.set(0xff3333);
            outlinePass.hiddenEdgeColor.set(0xff3333);
            outlinePass.edgeStrength = 2.0;
            outlinePass.edgeGlow = 0.3;
            outlinePass.edgeThickness = 1.0;
            outlinePass.pulsePeriod = 3.0;
            outlinePass.enabled = false;

            // Replace overlay material to avoid dimming
            outlinePass.overlayMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    'maskTexture': { value: null },
                    'edgeTexture1': { value: null },
                    'edgeTexture2': { value: null },
                    'patternTexture': { value: null },
                    'edgeStrength': { value: 1.0 },
                    'edgeGlow': { value: 1.0 },
                    'usePatternTexture': { value: 0.0 }
                },
                vertexShader: [
                    'varying vec2 vUv;',
                    'void main() {',
                    '    vUv = uv;',
                    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                    '}'
                ].join('\n'),
                fragmentShader: [
                    'varying vec2 vUv;',
                    'uniform sampler2D edgeTexture1;',
                    'uniform sampler2D edgeTexture2;',
                    'uniform float edgeStrength;',
                    'uniform float edgeGlow;',
                    'void main() {',
                    '    vec4 edge = texture2D(edgeTexture1, vUv)',
                    '             + texture2D(edgeTexture2, vUv) * edgeGlow;',
                    '    gl_FragColor = edgeStrength * edge;',
                    '}'
                ].join('\n'),
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                transparent: true
            });

            this.composer.addPass(outlinePass);
            this.outlinePass = outlinePass;
        }
    }

    /**
     * Get the outline pass for hint glow
     */
    getOutlinePass() {
        return this.outlinePass || null;
    }

    /**
     * Add a light source for screen emission (called by technology factories)
     * @param {THREE.Light} light - The light to add
     */
    addEmissiveLight(light) {
        if (this.lightingSystem) this.lightingSystem.addEmissiveLight(light);
    }

    /**
     * Create the floor plane
     */
    createFloor() {
        const origin = this.origins.floor;

        // Part offsets relative to floor origin
        const offsets = {
            floor: { x: 0, y: 0, z: 0 }
        };

        const textureLoader = new THREE.TextureLoader();
        const floorNormal = textureLoader.load('assets/textures/floor_nor.webp');
        const floorRoughness = textureLoader.load('assets/textures/floor_rough.webp');

        for (const tex of [floorNormal, floorRoughness]) {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(8, 8);
        }

        const floorGeometry = new THREE.PlaneGeometry(50, 50);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x7F8076,
            roughness: 0.85,
            metalness: 0.1,
            normalMap: floorNormal,
            roughnessMap: floorRoughness,
            envMapIntensity: LIGHTING_CONFIG.environment.floor
        });

        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        // Apply origin position plus offset for final floor placement
        floor.position.set(
            origin.x + offsets.floor.x,
            origin.y + offsets.floor.y,
            origin.z + offsets.floor.z
        );
        floor.rotation.set(origin.rotationX, origin.rotationY, origin.rotationZ);
        floor.receiveShadow = true;

        // Freeze floor matrix for performance (static object)
        floor.updateMatrixWorld(true);
        floor.matrixAutoUpdate = false;

        if (this.scene) this.scene.add(floor);
    }

    /**
     * Handle window resize events
     */
    onWindowResize() {
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);
        const renderer = /** @type {THREE.WebGLRenderer} */ (this.renderer);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Update composer sizes if available
        if (this.bloomComposer) {
            this.bloomComposer.setSize(window.innerWidth, window.innerHeight);
        }
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
        if (this.ssaoPass) {
            this.ssaoPass.setSize(window.innerWidth, window.innerHeight);
        }
        if (this.outlinePass) {
            this.outlinePass.setSize(window.innerWidth, window.innerHeight);
        }
    }

    /**
     * Render the scene with selective bloom via two-pass rendering.
     * Called every frame after init() — all fields are guaranteed non-null.
     */
    render() {
        // Fields are assigned by init() before animate() starts; narrow for type checker
        const controls = /** @type {import('three').OrbitControls} */ (this.controls);
        const scene = /** @type {THREE.Scene} */ (this.scene);
        const renderer = /** @type {THREE.WebGLRenderer} */ (this.renderer);
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);

        controls.update();

        if (this.composer && this.bloomComposer) {
            // Pass 1: Render bloom-only by blacking out everything that isn't an emissive
            // light source. Non-bloom meshes are swapped to a flat-black material, and the
            // background/fog are removed so the pass sees pure black around the emitters —
            // this keeps the isolated glow clean and prevents fog from tinting it.
            const savedBackground = scene.background;
            const savedFog = scene.fog;
            scene.background = null;
            scene.fog = null;
            scene.traverse(obj => {
                // Bitmask check: layer N has bit N set. layers.test() takes a Layers object, not a number.
                if (obj.isMesh && !(obj.layers.mask & (1 << BLOOM_LAYER))) {
                    obj._savedMaterial = obj.material;
                    obj.material = /** @type {THREE.MeshBasicMaterial} */ (this.darkMaterial);
                }
            });
            this.bloomComposer.render();

            // Restore materials, background, and fog for Pass 2
            scene.traverse(obj => {
                if (obj._savedMaterial) {
                    obj.material = obj._savedMaterial;
                    delete obj._savedMaterial;
                }
            });
            scene.background = savedBackground;
            scene.fog = savedFog;

            // Pass 2: Render normal scene, then the combine pass adds the isolated bloom on top
            this.composer.render();
        } else if (this.composer) {
            this.composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }
}

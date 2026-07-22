// @ts-check
/**
 * Scene setup and initialization.
 * Handles Three.js scene, camera, renderer, and lighting setup.
 */

import { PORTFOLIO_CONFIG, LIGHTING_CONFIG, OBJECT_ORIGINS } from '../config/config.js';
import { LightingSystem } from '../systems/lighting.js';
import { createDustParticles } from '../systems/utils.js';

const BLOOM_LAYER = 1;

export class SceneManager {
    constructor() {
        /** @type {THREE.Scene | null} */ this.scene = null;
        /** @type {THREE.PerspectiveCamera | null} */ this.camera = null;
        /** @type {THREE.Points | null} */ this.dustCloud = null;
        this._dustCloudBaseY = 0;
        /** @type {THREE.WebGLRenderer | null} */ this.renderer = null;
        /** @type {import('three').OrbitControls | null} */ this.controls = null;
        /** @type {import('three').EffectComposer | null} */ this.composer = null;
        /** @type {import('three').EffectComposer | null} */ this.bloomComposer = null;
        /** @type {import('../systems/lighting.js').LightingSystem | null} */ this.lightingSystem = null;
        /** @type {import('three').OutlinePass | null} */ this.outlinePass = null;
        /** @type {import('three').SSAOPass | null} */ this.ssaoPass = null;
        /** @type {import('three').UnrealBloomPass | null} */ this.bloomPass = null;
        /** @type {import('three').ShaderPass | null} */ this.fxaaPass = null;
        /** @type {import('three').ShaderPass | null} */ this.grainVignettePass = null;
        /** @type {unknown} */ this.lights = null;
        /** @type {Promise<void> | null} */ this.postFXReady = null;
        this.origins = OBJECT_ORIGINS.scene;

        // Shared across every loader that feeds a visible material (env map, floor,
        // diploma frame, vinyl covers) so the loading screen can stay up until all of
        // them have actually resolved, instead of hiding as soon as init() returns.
        // The resolve handler is wired up now, before any loader.load() call exists —
        // attaching it later risks a race where loads (especially fast local ones)
        // finish and fire onLoad before anything is listening.
        this.loadingManager = new THREE.LoadingManager();
        /** @type {Promise<void>} */
        this._assetsReady = new Promise((resolve) => {
            this.loadingManager.onLoad = () => resolve();
        });
        this.loadingManager.onError = (url) => console.warn(`Asset failed to load: ${url}`);
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();

        // Initialize the unified lighting system
        this.lightingSystem = new LightingSystem(this.renderer, this.scene, this.loadingManager);
        this.lightingSystem.init();

        // Expose lights reference for backward compatibility
        this.lights = this.lightingSystem.lights;

        this.createFloor();
        this.createDustParticlesEffect();

        // Bloom/SSAO/outline aren't needed for the first frame: render() already
        // falls back to a plain renderer.render() while composer/bloomComposer are
        // null, so loading this bundle async keeps it off the critical path.
        this.postFXReady = this.loadPostProcessing();

        window.addEventListener('resize', () => this.onWindowResize());

        return { scene: this.scene, camera: this.camera, renderer: this.renderer, controls: this.controls };
    }

    /**
     * Fetches the post-processing bundle (Pass/EffectComposer/UnrealBloomPass/
     * SSAOPass/OutlinePass) and runs setupPostProcessing() once it's parsed. Kept as
     * a separate lazy-loaded script (rather than bundled with vendor-core.js) so the
     * initial scene can paint before it arrives. BufferGeometryUtils stays in
     * vendor-core.js since the object factories call it synchronously while building
     * the scene, well before this bundle would otherwise be ready.
     * @returns {Promise<void>}
     */
    loadPostProcessing() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'js/vendor/vendor-postfx.js';
            script.onload = () => {
                this.setupPostProcessing();
                resolve();
            };
            script.onerror = () => {
                console.warn('vendor-postfx.js failed to load; continuing without bloom/SSAO/outline');
                resolve();
            };
            document.head.appendChild(script);
        });
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
     * Device pixel ratio to render at, capped below native resolution since every
     * full-screen post-processing pass pays for pixel count quadratically.
     * @returns {number}
     */
    getMaxPixelRatio() {
        const isMobile = window.innerWidth < 768;
        const cap = isMobile
            ? PORTFOLIO_CONFIG.rendering.maxPixelRatioMobile
            : PORTFOLIO_CONFIG.rendering.maxPixelRatioDesktop;
        return Math.min(window.devicePixelRatio, cap);
    }

    /**
     * Create and configure the WebGL renderer for ultra-realistic output
     */
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            // Antialiasing is wasted here: the composer renders everything into
            // non-AA render targets, so canvas MSAA never touches the final pixels.
            antialias: false,
            powerPreference: 'high-performance',
            stencil: false,
            alpha: false,
            logarithmicDepthBuffer: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.getMaxPixelRatio());

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

        // Bloom composer — renders ONLY emissive objects (screens, LEDs, lamp bulb) so
        // that bloom is confined to genuine light sources. The camera's layer mask is
        // switched to BLOOM_LAYER for this pass in render(), so everything else is
        // skipped entirely rather than drawn and blacked out. Its output is composited
        // additively over the full scene by the combine pass below — the result never
        // goes straight to screen.
        // Bloom is a blur by nature, so rendering its composer at half resolution and
        // letting the combine pass upsample it is free — no visible quality loss.
        const scale = PORTFOLIO_CONFIG.rendering.postProcessResolutionScale;
        const bloomWidth = Math.round(window.innerWidth * scale);
        const bloomHeight = Math.round(window.innerHeight * scale);

        this.bloomComposer = new THREE.EffectComposer(renderer);
        this.bloomComposer.renderToScreen = false;
        this.bloomComposer.setSize(bloomWidth, bloomHeight);
        const bloomRenderPass = new THREE.RenderPass(scene, camera);
        this.bloomComposer.addPass(bloomRenderPass);

        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(bloomWidth, bloomHeight),
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
            // Half-resolution SSAO is the standard trade -- low-frequency ambient
            // occlusion barely changes at half the sample density.
            const ssaoPass = new THREE.SSAOPass(scene, camera, bloomWidth, bloomHeight);
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

        // FXAA — last geometry-aliasing fix in the chain. Cheap (single-tap edge
        // blend) at the 1.5x pixel ratio cap, and removes the crawling edges that
        // the composer path never gets from canvas MSAA (antialias: false above,
        // since canvas MSAA can't touch pixels produced by later composer passes).
        if (THREE.FXAAShader) {
            const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
            const pixelRatio = renderer.getPixelRatio();
            const fxaaResolution = /** @type {THREE.Vector2} */ (fxaaPass.uniforms['resolution'].value);
            fxaaResolution.set(
                1 / (window.innerWidth * pixelRatio),
                1 / (window.innerHeight * pixelRatio)
            );
            this.composer.addPass(fxaaPass);
            this.fxaaPass = fxaaPass;
        }

        // Film grain + vignette — final grade pass (Phase 4.2). Runs after FXAA so
        // the grain isn't itself smoothed away by the edge blend. Kept as one
        // combined ShaderPass rather than two to avoid an extra full-screen sample.
        const grainVignettePass = new THREE.ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: null },
                    time: { value: 0 },
                    grainAmplitude: { value: PORTFOLIO_CONFIG.rendering.filmGrainAmplitude },
                    vignetteIntensity: { value: PORTFOLIO_CONFIG.rendering.vignetteIntensity }
                },
                vertexShader: [
                    'varying vec2 vUv;',
                    'void main() {',
                    '    vUv = uv;',
                    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                    '}'
                ].join('\n'),
                fragmentShader: [
                    'uniform sampler2D tDiffuse;',
                    'uniform float time;',
                    'uniform float grainAmplitude;',
                    'uniform float vignetteIntensity;',
                    'varying vec2 vUv;',
                    '',
                    'float noise(vec2 p) {',
                    '    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);',
                    '}',
                    '',
                    'void main() {',
                    '    vec4 color = texture2D(tDiffuse, vUv);',
                    '',
                    '    float grain = (noise(vUv * vec2(1000.0, 1000.0) + time) - 0.5) * grainAmplitude;',
                    '    color.rgb += grain;',
                    '',
                    '    vec2 centered = vUv - 0.5;',
                    '    float vignette = 1.0 - vignetteIntensity * dot(centered, centered) * 2.0;',
                    '    color.rgb *= vignette;',
                    '',
                    '    gl_FragColor = color;',
                    '}'
                ].join('\n')
            }),
            'tDiffuse'
        );
        this.composer.addPass(grainVignettePass);
        this.grainVignettePass = grainVignettePass;
    }

    /**
     * Get the outline pass for hint glow
     */
    getOutlinePass() {
        return this.outlinePass || null;
    }

    /**
     * Resolves once every texture registered on `loadingManager` (env map, floor,
     * diploma frame, vinyl covers) has finished loading — success or failure. Three's
     * loaders call `itemEnd` on both paths, so this can't hang on a single 404.
     * @returns {Promise<void>}
     */
    waitForAssets() {
        return this._assetsReady;
    }

    /**
     * Stop re-rendering shadow maps every frame. Nothing that casts a shadow
     * moves in this scene, so the maps only need to be populated once. Call
     * after the first render so all shadow casters have already been drawn.
     * If a future change animates a shadow-casting object, set
     * `renderer.shadowMap.needsUpdate = true` for that single frame instead
     * of re-enabling `autoUpdate`.
     */
    freezeShadowMap() {
        if (this.renderer) this.renderer.shadowMap.autoUpdate = false;
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

        const textureLoader = new THREE.TextureLoader(this.loadingManager);
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
     * Create dust particles in light cones (Phase 3.5).
     * Disabled on mobile to preserve performance.
     */
    createDustParticlesEffect() {
        // Skip dust on mobile (screen width < 768)
        if (window.innerWidth < 768) return;

        if (!PORTFOLIO_CONFIG.rendering.enableDustParticles) return;
        if (!this.scene) return;

        // Dust cloud in lamp/window light cone
        const dustCloud = createDustParticles(
            PORTFOLIO_CONFIG.rendering.dustParticleCount,
            1.5
        );
        dustCloud.position.set(0.5, 2.0, -1.0);
        this.scene.add(dustCloud);

        this.dustCloud = dustCloud;
        this._dustCloudBaseY = dustCloud.position.y;
    }

    /**
     * Drift the dust cloud slowly within the light cone (Phase 3.5). Cheap by
     * design: a whole-cloud rotation plus a single sine-driven Y offset, not a
     * per-particle buffer rewrite, so the cost is one matrix update regardless
     * of particle count.
     */
    updateDustParticles() {
        if (!this.dustCloud) return;

        const t = performance.now() * 0.001;
        this.dustCloud.rotation.y = t * 0.02;
        this.dustCloud.position.y = this._dustCloudBaseY + Math.sin(t * 0.15) * 0.1;
    }

    /**
     * Handle window resize events
     */
    onWindowResize() {
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);
        const renderer = /** @type {THREE.WebGLRenderer} */ (this.renderer);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(this.getMaxPixelRatio());
        renderer.setSize(window.innerWidth, window.innerHeight);

        const scale = PORTFOLIO_CONFIG.rendering.postProcessResolutionScale;
        const halfWidth = Math.round(window.innerWidth * scale);
        const halfHeight = Math.round(window.innerHeight * scale);

        // Update composer sizes if available
        if (this.bloomComposer) {
            this.bloomComposer.setSize(halfWidth, halfHeight);
        }
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
        if (this.ssaoPass) {
            this.ssaoPass.setSize(halfWidth, halfHeight);
        }
        if (this.outlinePass) {
            this.outlinePass.setSize(window.innerWidth, window.innerHeight);
        }
        if (this.fxaaPass) {
            const pixelRatio = renderer.getPixelRatio();
            const fxaaResolution = /** @type {THREE.Vector2} */ (this.fxaaPass.uniforms['resolution'].value);
            fxaaResolution.set(
                1 / (window.innerWidth * pixelRatio),
                1 / (window.innerHeight * pixelRatio)
            );
        }
    }

    /**
     * Advance the film grain animation (Phase 4.2). Called once per frame from
     * the main animation loop, mirroring updateDustParticles.
     */
    updateFilmGrain() {
        if (!this.grainVignettePass) return;
        this.grainVignettePass.uniforms['time'].value = performance.now() * 0.001;
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
            // Pass 1: Render bloom-only. Restricting the camera's layer mask to
            // BLOOM_LAYER means non-emissive objects are never submitted to the GPU for
            // this pass, instead of being drawn and blacked out. Background/fog are
            // cleared so the pass sees pure black around the emitters.
            const savedBackground = scene.background;
            const savedFog = scene.fog;
            scene.background = null;
            scene.fog = null;

            camera.layers.set(BLOOM_LAYER);
            this.bloomComposer.render();

            // Restore the default layer mask and background/fog for Pass 2
            camera.layers.set(0);
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

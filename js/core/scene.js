// @ts-check
/**
 * Scene setup and initialization.
 * Handles Three.js scene, camera, renderer, and lighting setup.
 */

import { PORTFOLIO_CONFIG, QUALITY_TIERS, LIGHTING_CONFIG, OBJECT_ORIGINS } from '../config/config.js';
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
        /** @type {import('three').UnrealBloomPass | null} */ this.bloomPass = null;
        /** @type {import('three').ShaderPass | null} */ this.fxaaPass = null;
        /** @type {import('three').ShaderPass | null} */ this.gradePass = null;
        /** @type {unknown} */ this.lights = null;
        /** @type {Promise<void> | null} */ this.postFXReady = null;
        this.origins = OBJECT_ORIGINS.scene;

        // Adaptive quality (Phase 6). 'high' is PORTFOLIO_CONFIG.rendering as-is;
        // applyQualityTier() merges a QUALITY_TIERS entry on top and re-applies the
        // affected runtime state. Kept as a plain (unfrozen) merged copy so it can
        // be replaced wholesale on a tier change without fighting Object.freeze.
        /** @type {'high' | 'medium' | 'low'} */
        this.qualityTier = 'high';
        /** @type {import('../config/config.js').RenderingConfig} */
        this._renderingConfig = PORTFOLIO_CONFIG.rendering;

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
     * Fetches the post-processing bundle (Pass/EffectComposer/UnrealBloomPass) and
     * runs setupPostProcessing() once it's parsed. Kept as a separate lazy-loaded
     * script (rather than bundled with vendor-core.js) so the initial scene can
     * paint before it arrives. BufferGeometryUtils stays in vendor-core.js since
     * the object factories call it synchronously while building the scene, well
     * before this bundle would otherwise be ready. SSAOPass/OutlinePass/SimplexNoise
     * were stripped from the bundle entirely (Phase 5.1, PERFORMANCE_PLAN.md) since
     * neither pass has been instantiated since Phase 2/4.
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
            ? this._renderingConfig.maxPixelRatioMobile
            : this._renderingConfig.maxPixelRatioDesktop;
        return Math.min(window.devicePixelRatio, cap);
    }

    /**
     * Step the session down to a lower adaptive-quality tier (Phase 6). Called by
     * the startup tier detection in main.js after averaging real render() cost
     * over a sample window; never called to step back up, since a slow first few
     * seconds usually means a slow device, not a transient hiccup. A no-op if
     * already at `tierName` or beyond it, so it's safe to call from a loop that
     * only ever asks to go one step lower than the current tier.
     * @param {'medium' | 'low'} tierName
     */
    applyQualityTier(tierName) {
        if (tierName === this.qualityTier) return;
        const overrides = QUALITY_TIERS[tierName];
        this.qualityTier = tierName;
        this._renderingConfig = { ...PORTFOLIO_CONFIG.rendering, ...overrides };

        const renderer = /** @type {THREE.WebGLRenderer} */ (this.renderer);
        renderer.setPixelRatio(this.getMaxPixelRatio());

        if (this.bloomComposer) {
            const scale = this._renderingConfig.postProcessResolutionScale;
            this.bloomComposer.setSize(
                Math.round(window.innerWidth * scale),
                Math.round(window.innerHeight * scale)
            );
        }

        if (this.dustCloud) this.dustCloud.visible = this._renderingConfig.enableDustParticles;

        if (this.gradePass) {
            this.gradePass.uniforms['grainAmplitude'].value = this._renderingConfig.filmGrainAmplitude;
        }

        // Toggling castShadow changes each material's shadow-sampling shader defines,
        // forcing a one-time recompile on the next render -- an acceptable trade for
        // a session already confirmed to be running slow. The fitted main directional
        // light isn't touched here; it's the "single shadow map" every tier keeps.
        const lights = /** @type {{ deskLamp?: THREE.Light, fill?: THREE.Light } | null} */ (this.lights);
        if (lights?.deskLamp) lights.deskLamp.castShadow = this._renderingConfig.lampShadowEnabled;
        if (lights?.fill) lights.fill.castShadow = this._renderingConfig.ceilingShadowEnabled;
        if (renderer.shadowMap.autoUpdate === false) renderer.shadowMap.needsUpdate = true;
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

        // The composer chain issues several internal renderer.render() calls per
        // frame (bloom pass, scene pass, each ShaderPass), and info.autoReset
        // (default true) clears the counters after every single one — so reading
        // renderer.info after a normal render() call only shows the last internal
        // pass, not the frame's real total. Disable autoReset and clear it exactly
        // once per frame ourselves (see `render()`) so the Phase 0 profiler and
        // any future draw-call auditing reflect the whole frame.
        this.renderer.info.autoReset = false;

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
        const scale = this._renderingConfig.postProcessResolutionScale;
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

        // SSAOPass was removed (Phase 2): it cost two extra full-scene renders plus a
        // large-kernel blur every frame for a subtle, static effect. The scene doesn't
        // move, so the same darkening at contact points is baked into materials instead —
        // see `addContactShadow()` in js/systems/utils.js, applied per-object in the
        // factories (desk-objects.js, technology.js, shelf-objects.js).

        // OutlinePass was removed here (Phase 4.2): its internal depth/mask buffer
        // re-renders dimmed the whole scene even with the overlay-material fix applied
        // (see the CLAUDE.md TODO this closes out). The hint-glow highlight on
        // interactive objects is now a real inflated-backface mesh drawn in the normal
        // scene pass above — see `InteractionManager.initHintOutline()` in
        // js/core/interactions.js — so there's no separate outline pass at all anymore.

        // FXAA runs on the raw scene render, before bloom is added. Bloom is inherently
        // blurred (half-res, upsampled) so it doesn't reintroduce hard edges for FXAA to
        // have caught — this lets FXAA sit before the merged grade pass below instead of
        // needing its own pass in between combine and grain (Phase 4.1).
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

        // Grade pass (Phase 4.1): combine (add isolated bloom), grain, and vignette
        // merged into one ShaderPass instead of three separate full-screen swaps. Grain
        // still lands after FXAA (this pass runs after the FXAA pass above), so the edge
        // blend can't smooth away its per-pixel randomness — the same ordering guarantee
        // the previous three-pass chain had, just without the extra render target swaps.
        const gradePass = new THREE.ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
                    time: { value: 0 },
                    grainAmplitude: { value: this._renderingConfig.filmGrainAmplitude },
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
                    'uniform sampler2D baseTexture;',
                    'uniform sampler2D bloomTexture;',
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
                    '    vec4 base = texture2D(baseTexture, vUv);',
                    '    vec4 bloom = texture2D(bloomTexture, vUv);',
                    '    vec4 color = base + bloom;',
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
                ].join('\n'),
                defines: {}
            }),
            'baseTexture'
        );
        this.composer.addPass(gradePass);
        this.gradePass = gradePass;
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

        const scale = this._renderingConfig.postProcessResolutionScale;
        const halfWidth = Math.round(window.innerWidth * scale);
        const halfHeight = Math.round(window.innerHeight * scale);

        // Update composer sizes if available
        if (this.bloomComposer) {
            this.bloomComposer.setSize(halfWidth, halfHeight);
        }
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
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
     * Advance the film grain animation. Called once per frame from the main
     * animation loop, mirroring updateDustParticles.
     */
    updateFilmGrain() {
        if (!this.gradePass) return;
        this.gradePass.uniforms['time'].value = performance.now() * 0.001;
    }

    /**
     * Render the scene with selective bloom via two-pass rendering.
     * Called once per rendered frame after init() — all fields are guaranteed non-null.
     * @param {boolean} [bloomDirty] - Whether the bloom-layer pass needs to be
     *   re-rendered this frame (camera moved, or bloom-layer content changed).
     *   When false, the bloom composer's render target is left untouched and the
     *   combine pass reuses last frame's bloom texture — safe because nothing
     *   that feeds it changed, and the target is a persistent GPU resource.
     */
    render(bloomDirty = true) {
        // Fields are assigned by init() before animate() starts; narrow for type checker
        const controls = /** @type {import('three').OrbitControls} */ (this.controls);
        const scene = /** @type {THREE.Scene} */ (this.scene);
        const renderer = /** @type {THREE.WebGLRenderer} */ (this.renderer);
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);

        renderer.info.reset();
        controls.update();

        if (this.composer && this.bloomComposer) {
            if (bloomDirty) {
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
            }

            // Pass 2: Render normal scene, then the combine pass adds the isolated bloom on top
            this.composer.render();
        } else if (this.composer) {
            this.composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }
}

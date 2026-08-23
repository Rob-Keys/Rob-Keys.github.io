// @ts-check
/**
 * Scene setup and renderer lifecycle.
 *
 * Renderer-dependent work is deliberately kept here. Object factories build
 * scene objects, while this class owns backend and rendering lifecycle state.
 */

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PORTFOLIO_CONFIG, QUALITY_TIERS, LIGHTING_CONFIG, OBJECT_ORIGINS } from '../config/config.js';
import { LightingSystem } from '../systems/lighting.js';
import { createDustParticles, isMobileDevice } from '../systems/utils.js';
import { WebGPUPostProcessing } from './postprocessing-webgpu.js';

export class SceneManager {
    /**
     * @param {((status: string) => void) | null} [onLoadingStatus]
     */
    constructor(onLoadingStatus = null) {
        this.onLoadingStatus = onLoadingStatus;
        /** @type {THREE.Scene | null} */ this.scene = null;
        /** @type {THREE.PerspectiveCamera | null} */ this.camera = null;
        /** @type {THREE.Points | null} */ this.dustCloud = null;
        this._dustCloudBaseY = 0;
        /** @type {THREE.Renderer | null} */ this.renderer = null;
        /** @type {OrbitControls | null} */ this.controls = null;
        /** @type {WebGPUPostProcessing | null} */ this.postProcessing = null;
        /** @type {import('../systems/lighting.js').LightingSystem | null} */ this.lightingSystem = null;
        /** @type {unknown} */ this.lights = null;
        this.origins = OBJECT_ORIGINS.scene;

        /** @type {'high' | 'medium' | 'low'} */
        this.qualityTier = 'high';
        /** @type {import('../config/config.js').RenderingConfig} */
        this._renderingConfig = PORTFOLIO_CONFIG.rendering;

        this.loadingManager = new THREE.LoadingManager();
        this.loadingManager.onStart = () => {
            this.onLoadingStatus?.('Importing assets');
        };
        this.loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
            this.onLoadingStatus?.(`Importing assets · ${itemsLoaded} of ${itemsTotal}`);
        };
        /** @type {Promise<void>} */
        this._assetsReady = new Promise((resolve, reject) => {
            this.loadingManager.onLoad = () => {
                this.onLoadingStatus?.('Assets imported');
                resolve();
            };
            this.loadingManager.onError = (url) => {
                this.onLoadingStatus?.('Could not import an asset');
                reject(new Error(`Required portfolio asset failed to load: ${url}`));
            };
        });
    }

    async init() {
        this.createScene();
        this.createCamera();
        await this.initRenderer();
        this.createControls();

        const lightingSystem = new LightingSystem(this.renderer, this.scene, this.loadingManager);
        this.lightingSystem = lightingSystem;
        lightingSystem.init();
        this.lights = lightingSystem.lights;

        this.createFloor();
        this.createDustParticlesEffect();
        this.postProcessing = new WebGPUPostProcessing(
            /** @type {THREE.Renderer} */ (this.renderer),
            /** @type {THREE.Scene} */ (this.scene),
            /** @type {THREE.PerspectiveCamera} */ (this.camera),
            this._renderingConfig
        );

        window.addEventListener('resize', () => this.onWindowResize());
        return { scene: this.scene, camera: this.camera, renderer: this.renderer, controls: this.controls };
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(PORTFOLIO_CONFIG.scene.backgroundColor);
        this.scene.fog = new THREE.FogExp2(PORTFOLIO_CONFIG.scene.fogColor, 0.02);
    }

    createCamera() {
        const { fov, near, far, initialPosition } = PORTFOLIO_CONFIG.camera;
        this.camera = new THREE.PerspectiveCamera(
            fov,
            window.innerWidth / window.innerHeight,
            near,
            far
        );
        this.camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
    }

    getMaxPixelRatio() {
        const cap = isMobileDevice()
            ? this._renderingConfig.maxPixelRatioMobile
            : this._renderingConfig.maxPixelRatioDesktop;
        return Math.min(window.devicePixelRatio, cap);
    }

    /** @param {'medium' | 'low'} tierName */
    applyQualityTier(tierName) {
        if (tierName === this.qualityTier) return;
        this.qualityTier = tierName;
        this._renderingConfig = { ...PORTFOLIO_CONFIG.rendering, ...QUALITY_TIERS[tierName] };

        const renderer = /** @type {THREE.Renderer} */ (this.renderer);
        renderer.setPixelRatio(this.getMaxPixelRatio());
        renderer.setSize(window.innerWidth, window.innerHeight);
        this.postProcessing?.setResolutionScale(this._renderingConfig.postProcessResolutionScale);
        this.postProcessing?.setGrainAmplitude(this._renderingConfig.filmGrainAmplitude);
        this.postProcessing?.setBloomEnabled(this._renderingConfig.enableBloom);
        this.lightingSystem?.setSimpleGlare(this._renderingConfig.simpleGlare);
        if (this.dustCloud) this.dustCloud.visible = this._renderingConfig.enableDustParticles;

        const lights = /** @type {{ deskLamp?: THREE.Light, fill?: THREE.Light } | null} */ (this.lights);
        if (lights?.deskLamp) lights.deskLamp.castShadow = this._renderingConfig.lampShadowEnabled;
        if (lights?.fill) lights.fill.castShadow = this._renderingConfig.ceilingShadowEnabled;
        if (renderer.shadowMap.autoUpdate === false) renderer.shadowMap.needsUpdate = true;
    }

    /**
     * Initialize WebGPU first. WebGPURenderer has an explicit WebGL2 backend
     * fallback, but retrying it explicitly also covers device-init failures.
     */
    async initRenderer() {
        const options = {
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            alpha: false,
            depth: true,
            logarithmicDepthBuffer: false
        };

        let renderer = new THREE.WebGPURenderer(options);
        try {
            await renderer.init();
        } catch (webgpuError) {
            console.warn('WebGPU initialization failed; retrying with the WebGL2 backend.', webgpuError);
            renderer = new THREE.WebGPURenderer({ ...options, forceWebGL: true });
            await renderer.init();
        }

        this.renderer = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(this.getMaxPixelRatio());
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.84;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const container = document.getElementById('canvas-container');
        if (!container) throw new Error('canvas-container element not found');
        container.appendChild(renderer.domElement);
    }

    createControls() {
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);
        const renderer = /** @type {THREE.Renderer} */ (this.renderer);
        this.controls = new OrbitControls(camera, renderer.domElement);
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

    waitForAssets() {
        return this._assetsReady;
    }

    freezeShadowMap() {
        if (this.renderer) this.renderer.shadowMap.autoUpdate = false;
    }

    createFloor() {
        const origin = this.origins.floor;
        const textureLoader = new THREE.TextureLoader(this.loadingManager);
        const floorNormal = textureLoader.load('assets/textures/floor_nor.webp');
        const floorRoughness = textureLoader.load('assets/textures/floor_rough.webp');
        // WebGPURenderer does not expose a stable `getMaxAnisotropy()` during
        // backend initialization. Three clamps this requested value at upload,
        // so use the plan's portable cap rather than probing an unready backend.
        const maxAnisotropy = 8;

        for (const texture of [floorNormal, floorRoughness]) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(8, 8);
            texture.anisotropy = maxAnisotropy;
        }

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshStandardMaterial({
                color: 0x7F8076,
                roughness: 0.85,
                metalness: 0.1,
                normalMap: floorNormal,
                roughnessMap: floorRoughness,
                envMapIntensity: LIGHTING_CONFIG.environment.floor
            })
        );
        floor.position.set(origin.x, origin.y, origin.z);
        floor.rotation.set(origin.rotationX, origin.rotationY, origin.rotationZ);
        floor.receiveShadow = true;
        floor.userData.excludeFromShadowFit = true;
        floor.updateMatrixWorld(true);
        floor.matrixAutoUpdate = false;
        this.scene?.add(floor);
    }

    createDustParticlesEffect() {
        if (isMobileDevice() || !PORTFOLIO_CONFIG.rendering.enableDustParticles || !this.scene) return;
        const dustCloud = createDustParticles(PORTFOLIO_CONFIG.rendering.dustParticleCount, 1.5);
        dustCloud.position.set(0.5, 2.0, -1.0);
        this.scene.add(dustCloud);
        this.dustCloud = dustCloud;
        this._dustCloudBaseY = dustCloud.position.y;
    }

    updateDustParticles() {
        if (!this.dustCloud) return;
        const time = performance.now() * 0.001;
        this.dustCloud.rotation.y = time * 0.02;
        this.dustCloud.position.y = this._dustCloudBaseY + Math.sin(time * 0.15) * 0.1;
    }

    onWindowResize() {
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);
        const renderer = /** @type {THREE.Renderer} */ (this.renderer);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(this.getMaxPixelRatio());
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const controls = /** @type {OrbitControls} */ (this.controls);
        const scene = /** @type {THREE.Scene} */ (this.scene);
        const renderer = /** @type {THREE.Renderer} */ (this.renderer);
        const camera = /** @type {THREE.PerspectiveCamera} */ (this.camera);
        controls.update();
        if (this.postProcessing) this.postProcessing.render();
        else renderer.render(scene, camera);
    }
}

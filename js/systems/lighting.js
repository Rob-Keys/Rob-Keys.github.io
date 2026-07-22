// @ts-check
/**
 * Unified Lighting System
 * Handles all lighting concerns: environment maps, lights, shadows, glare, and day/night cycle
 */

import { SHADOW_CONFIG, LIGHTING_CONFIG } from '../config/config.js';

export class LightingSystem {
    /**
     * @param {THREE.LoadingManager | null} [loadingManager]
     */
    constructor(renderer, scene, loadingManager = null) {
        this.renderer = renderer;
        this.scene = scene;
        this.loadingManager = loadingManager;

        /** @type {{
         *   ambient: THREE.AmbientLight | null,
         *   hemisphere: THREE.HemisphereLight | null,
         *   main: THREE.DirectionalLight | null,
         *   fill: THREE.SpotLight | null,
         *   fill2: THREE.SpotLight | null,
         *   rim: THREE.PointLight | null,
         *   deskLamp: THREE.SpotLight | null
         * }} */
        this.lights = {
            ambient: null,
            hemisphere: null,
            main: null,
            fill: null,
            fill2: null,
            rim: null,
            deskLamp: null
        };

        /** @type {THREE.Texture | null} */ this.envMap = null;
        /** @type {THREE.Light[]} */ this.emissiveLights = [];

        // Glare materials that need camera updates
        this.glareMaterials = [];

        // Day/night cycle cached colors (avoid GC)
        this._startColor = new THREE.Color();
        this._endColor = new THREE.Color();
        this._nightAmbientColor = new THREE.Color(0x0a0e1a);
        this._dayAmbientColor = new THREE.Color(0x1a150d);
        this._nightSkyColor = new THREE.Color(0x050810);
        this._daySkyColor = new THREE.Color(0x8ab4d8);

        // Throttle updateDayNightCycle to ~1 Hz — the sun position changes over
        // minutes, not frames, so recomputing it every frame is wasted work.
        this._lastDayNightUpdate = 0;

        // Directional (window) light keyframes only.
        // Interior ceiling/desk lights are constant — only window sunlight changes.
        // Colors are calibrated to real color temperature of sunlight at each hour:
        //   ~1800K sunrise/sunset (#FF6A0A) → ~3500K morning golden (#FFB660) →
        //   ~5500K midday neutral (#FFF4E8) → moonlight ~8000K is not simulated here;
        //   at night the directional is simply off (intensity 0).
        this.dayNightKeyframes = [
            { hour: 0,  color: 0x05070f, intensity: 0.000 }, // Deep night — no sun
            { hour: 4,  color: 0x080a18, intensity: 0.000 }, // Pre-dawn — still dark
            { hour: 5,  color: 0x1a0c22, intensity: 0.005 }, // Astronomical dawn
            { hour: 5.5,color: 0x8b2010, intensity: 0.020 }, // Civil dawn — deep red horizon
            { hour: 6,  color: 0xff5018, intensity: 0.065 }, // Sunrise — 1800K deep orange
            { hour: 6.5,color: 0xff7830, intensity: 0.130 }, // Early sunrise — 2000K orange
            { hour: 7,  color: 0xffaa50, intensity: 0.240 }, // Low sun — 2500K golden
            { hour: 8,  color: 0xffc870, intensity: 0.380 }, // Morning — 3000K warm gold
            { hour: 9,  color: 0xffd898, intensity: 0.490 }, // Mid morning — 3500K
            { hour: 10, color: 0xffe8b8, intensity: 0.580 }, // Late morning — 4500K
            { hour: 11, color: 0xfff0d8, intensity: 0.650 }, // Near noon — 5000K
            { hour: 12, color: 0xfff4e8, intensity: 0.700 }, // Solar noon — 5500K peak
            { hour: 13, color: 0xfff8f0, intensity: 0.680 }, // Slightly past noon
            { hour: 14, color: 0xfff4e0, intensity: 0.640 }, // Afternoon — warming
            { hour: 15, color: 0xffe8c0, intensity: 0.580 }, // Mid afternoon — 4500K
            { hour: 16, color: 0xffcc90, intensity: 0.460 }, // Late afternoon — 3200K golden
            { hour: 17, color: 0xffaa58, intensity: 0.290 }, // Pre-sunset — 2500K
            { hour: 17.5,color: 0xff7828, intensity: 0.120 }, // Sunset — 2000K deep orange
            { hour: 18, color: 0xff4810, intensity: 0.045 }, // Post-sunset — 1800K red
            { hour: 18.5,color: 0x3a1008, intensity: 0.008 }, // Dusk — nearly gone
            { hour: 19, color: 0x100508, intensity: 0.001 }, // Civil dusk
            { hour: 20, color: 0x05070f, intensity: 0.000 }, // Night
            { hour: 24, color: 0x05070f, intensity: 0.000 }  // Midnight loop
        ];
    }

    /**
     * Initialize the lighting system
     */
    init() {
        if (THREE.RectAreaLightUniformsLib) {
            THREE.RectAreaLightUniformsLib.init();
        }

        this.createEnvironmentMap();
        this.setupLights();
    }

    /**
     * Create environment map from HDRI for realistic reflections only.
     * The HDRI drives material reflections/IBL; direct scene illumination
     * comes from discrete lights so we can control it precisely.
     */
    createEnvironmentMap() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        const loader = new THREE.RGBELoader(this.loadingManager || undefined);
        loader.load('assets/textures/env.hdr', (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            this.scene.environment = envMap;
            this.envMap = envMap;
            texture.dispose();
            pmremGenerator.dispose();
        });
    }

    /**
     * Set up all scene lights modeled after a real home-office interior at 9–10 AM:
     *   - Near-zero ambient (prevents pure-black, nothing more)
     *   - Cool hemisphere (daylight sky bounce through window)
     *   - Directional window light that follows day/night cycle (morning angle from upper-left)
     *   - Front fill directional (soft lift on faces the ceiling spots rake past)
     *   - Two warm overhead SpotLights at reduced intensity (ceiling can't out-compete natural light)
     *   - Focused desk lamp SpotLight (warm 2700K amber — the hero accent light) plus its
     *     small shade-glow and desk-bounce PointLights
     *   - Strong monitor bounce (visible blue screen glow on keyboard/desk)
     *
     * Phase 3 consolidation: the wide-radius GI-approximation fills that used to sit
     * alongside these (backWallWash, roomFill, roomBounce, ceilingBounce, a static
     * laptopBounce duplicate) were removed — a forward renderer charges full per-fragment
     * cost for a light regardless of how dim or short-range it is. Their contribution now
     * lives in the ambient/hemisphere day-night floors and a baked wall emissive tint.
     */
    setupLights() {
        const isMobile = window.innerWidth < 768;
        const shadowMapSize = isMobile ?
            SHADOW_CONFIG.mobile.mapSize :
            SHADOW_CONFIG.main.mapSize;

        // Ambient: slightly higher to simulate the irreducible bounce in any enclosed room.
        // Color is a neutral very-slightly-warm grey — tuned during day/night update to
        // shift cool-blue at night (moonlit scatter) and warm at midday (reflected sunlight).
        const ambientLight = new THREE.AmbientLight(0x0f0e1a, 0.20);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;

        // Hemisphere: sky (top) vs ground (bottom) bounce.
        // Top is clear-sky blue (5500K diffuse dome), bottom is very dark warm (wood floor).
        // Intensity is tuned per-frame in updateDayNightCycle.
        const hemisphereLight = new THREE.HemisphereLight(
            0x8ab4d8, // Sky — clear morning blue (~10000K overcast) desaturated toward white
            0x1c1108, // Ground — very dark warm (floor absorbs most light)
            0.32
        );
        this.scene.add(hemisphereLight);
        this.lights.hemisphere = hemisphereLight;

        // Window/sun directional light.
        // Position (-6, 9, 4): upper-left-back of scene → rakes across the desk at ~56° from horizontal.
        // This angle produces characteristic long desk shadows in morning light.
        // Intensity 0.30 at 9 AM — daylight keyframes scale this per-frame.
        const mainLight = new THREE.DirectionalLight(0xffcf98, 0.30);
        mainLight.position.set(-6, 9, 4);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = shadowMapSize;
        mainLight.shadow.mapSize.height = shadowMapSize;
        mainLight.shadow.camera.near = SHADOW_CONFIG.main.near;
        mainLight.shadow.camera.far = 30;
        mainLight.shadow.camera.left = -10;
        mainLight.shadow.camera.right = 10;
        mainLight.shadow.camera.top = 8;
        mainLight.shadow.camera.bottom = -3;
        mainLight.shadow.bias = SHADOW_CONFIG.main.bias;
        mainLight.shadow.normalBias = SHADOW_CONFIG.main.normalBias;
        mainLight.shadow.radius = SHADOW_CONFIG.main.radius;
        this.scene.add(mainLight);
        this.lights.main = mainLight;

        // Front fill directional — soft warm fill from the viewer side onto the desk and
        // the front faces of objects the ceiling spots rake past. Aimed at scene origin.
        // Intensity raised slightly (0.10 → 0.14, Phase 3.1) to help cover the front-face
        // fill that roomBounce used to provide before its removal below.
        const wallFill = new THREE.DirectionalLight(0xfff4ee, 0.14);
        wallFill.position.set(0, 4, 8);
        this.scene.add(wallFill);

        // Phase 3.1: backWallWash, roomFill, roomBounce, ceilingBounce, and the static
        // laptopBounce point lights were removed here. They were dim, wide-radius fills
        // approximating GI that a forward renderer still charges full per-fragment cost
        // for regardless of intensity or range. Their contribution is folded into the
        // wallFill bump above, the day/night ambient/hemisphere floors below, and a baked
        // emissive tint on the back wall material (see furniture.js createWall()).
        // laptopBounce specifically duplicated the correctly-positioned emissive light
        // technology.js already registers via addEmissiveLight() for the laptop screen.

        // Ceiling SpotLight 1 — primary overhead fixture (3000K warm-white LED).
        // Cone angle π/4 (~45°) is closer to a real surface-mounted LED downlight than the
        // previous π/3.5 (~51°). Penumbra 0.45 gives a soft edge without looking like a projector.
        // Casts shadows so desk objects produce realistic contact shadows on the desktop.
        // Decay 2 = inverse-square (physically correct). Base intensity (LIGHTING_CONFIG.ceiling)
        // raised slightly over the previous 28 to help compensate for the fills removed above.
        const ceilingMain = new THREE.SpotLight(0xffcba0, LIGHTING_CONFIG.ceiling.mainIntensity, 18, Math.PI / 4, 0.45, 2);
        ceilingMain.position.set(-0.8, 5.8, -0.2);
        ceilingMain.target.position.set(-0.4, 0.0, -1.0);
        ceilingMain.castShadow = true;
        // Tight room, close-range fixture — 1024 loses no visible resolution over 2048 (Phase 3.3).
        ceilingMain.shadow.mapSize.width = SHADOW_CONFIG.ceiling.mapSize;
        ceilingMain.shadow.mapSize.height = SHADOW_CONFIG.ceiling.mapSize;
        ceilingMain.shadow.bias = -0.0003;
        ceilingMain.shadow.normalBias = 0.02;
        ceilingMain.shadow.radius = 3;
        this.scene.add(ceilingMain);
        this.scene.add(ceilingMain.target);
        this.lights.fill = ceilingMain;

        // Ceiling SpotLight 2 — secondary overhead, slightly cooler 3500K.
        // Offset right to balance coverage and give the right side of the desk its own fill.
        const ceilingFill = new THREE.SpotLight(0xffd8b8, LIGHTING_CONFIG.ceiling.fillIntensity, 18, Math.PI / 4, 0.50, 2);
        ceilingFill.position.set(0.8, 5.8, 0.4);
        ceilingFill.target.position.set(0.6, 0.0, -0.8);
        this.scene.add(ceilingFill);
        this.scene.add(ceilingFill.target);
        this.lights.fill2 = ceilingFill;

        // Desk lamp SpotLight — 2700K incandescent-equivalent warm amber.
        // 2700K accurate hex: #FFA740. Tight cone (π/11 ≈ 16°) with soft penumbra 0.20.
        // This is the hero accent light — its warm color against the cool monitor is the
        // most visible "photographic realism" cue in the scene.
        const deskLamp = new THREE.SpotLight(0xffa740, 8.0, 6, Math.PI / 11, 0.20, 2);
        deskLamp.position.set(2.5, 3.5, -1.1);
        deskLamp.target.position.set(1.4, 0.94, 0.1);
        deskLamp.castShadow = true;
        deskLamp.shadow.mapSize.width = SHADOW_CONFIG.lamp.mapSize;
        deskLamp.shadow.mapSize.height = SHADOW_CONFIG.lamp.mapSize;
        deskLamp.shadow.bias = SHADOW_CONFIG.lamp.bias;
        deskLamp.shadow.normalBias = SHADOW_CONFIG.lamp.normalBias;
        deskLamp.shadow.radius = SHADOW_CONFIG.lamp.radius;
        this.scene.add(deskLamp);
        this.scene.add(deskLamp.target);
        this.lights.deskLamp = deskLamp;

        // Lamp shade upward glow — warm amber light escaping through the top of the shade.
        // Also simulates the lamp warming the ceiling directly above it.
        const lampShadeGlow = new THREE.PointLight(0xffb840, 1.2, 5, 2);
        lampShadeGlow.position.set(2.5, 3.6, -1.1);
        this.scene.add(lampShadeGlow);

        // Desk bounce — soft warm PointLight just above desk surface under the lamp cone.
        // Simulates light bouncing off the wood desktop and illuminating the undersides of
        // the keyboard, mouse, and base of the monitor. Very local (distance 2).
        const deskBounce = new THREE.PointLight(0xffcf90, 0.6, 2.5, 2);
        deskBounce.position.set(1.6, 1.05, 0.0);
        this.scene.add(deskBounce);

        // Monitor bounce — 6500K daylight-balanced screen glow.
        // Monitors typically emit 200–400 cd/m² at 6500K. The blue-white color is far cooler
        // than the lamp and that contrast is what makes the scene read as real.
        // Positioned just in front of the monitor, aimed back toward keyboard and wrists.
        const monitorBounce = new THREE.PointLight(0xc8ddff, 0.65, 5, 2);
        monitorBounce.position.set(0, 1.8, 0.4);
        this.scene.add(monitorBounce);
        this.lights.rim = monitorBounce;
    }

    /**
     * Register an emissive light source (called by object factories)
     * @param {THREE.Light} light - The light to register
     */
    addEmissiveLight(light) {
        this.emissiveLights.push(light);
        this.scene.add(light);
    }

    /**
     * Create a dynamic glare material for screen surfaces
     * @param {Object} options - Configuration options
     * @returns {THREE.ShaderMaterial} The glare material
     */
    createGlareMaterial(options = {}) {
        const glareIntensity = options.glareIntensity ?? 0.35;
        const glareSharpness = options.glareSharpness ?? 6.0;
        const fresnelPower = options.fresnelPower ?? 2.5;

        const uniforms = {
            // Light source positions (up to 4)
            uLightPositions: { value: [
                new THREE.Vector3(-6, 9, 4),         // Window directional
                new THREE.Vector3(2.5, 3.5, -1.1),  // Desk lamp (2700K)
                new THREE.Vector3(-0.8, 5.8, -0.2), // Ceiling main (3000K)
                new THREE.Vector3(0, 1.8, 0.4)       // Monitor bounce (6500K)
            ]},
            uLightColors: { value: [
                new THREE.Color(0xffd898),  // Window — 3500K morning golden
                new THREE.Color(0xffa740),  // Lamp — 2700K warm amber
                new THREE.Color(0xffcba0),  // Ceiling — 3000K warm white
                new THREE.Color(0xc8ddff)   // Monitor — 6500K cool daylight
            ]},
            uLightIntensities: { value: new Float32Array([0.20, 0.55, 0.35, 0.12]) },
            uCameraPosition: { value: new THREE.Vector3() },
            uGlareIntensity: { value: glareIntensity },
            uGlareSharpness: { value: glareSharpness },
            uFresnelPower: { value: fresnelPower }
        };

        const vertexShader = `
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;

            void main() {
                vUv = uv;
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const fragmentShader = `
            uniform vec3 uLightPositions[4];
            uniform vec3 uLightColors[4];
            uniform float uLightIntensities[4];
            uniform vec3 uCameraPosition;
            uniform float uGlareIntensity;
            uniform float uGlareSharpness;
            uniform float uFresnelPower;

            varying vec2 vUv;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;

            void main() {
                vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
                vec3 normal = normalize(vWorldNormal);

                // Fresnel effect (edge glow - screens appear brighter at grazing angles)
                float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);

                // Accumulate glare from each light source
                vec3 glareColor = vec3(0.0);

                for (int i = 0; i < 4; i++) {
                    if (uLightIntensities[i] > 0.0) {
                        vec3 lightDir = normalize(uLightPositions[i] - vWorldPosition);

                        // Blinn-Phong specular highlight
                        vec3 halfDir = normalize(lightDir + viewDir);
                        float spec = pow(max(dot(normal, halfDir), 0.0), uGlareSharpness * 10.0);

                        // Distance-based attenuation
                        float dist = length(uLightPositions[i] - vWorldPosition);
                        float attenuation = 1.0 / (1.0 + 0.05 * dist + 0.01 * dist * dist);

                        glareColor += uLightColors[i] * spec * uLightIntensities[i] * attenuation;
                    }
                }

                // Combine glare highlights with fresnel edge glow
                float alpha = length(glareColor) * uGlareIntensity + fresnel * 0.08;
                alpha = clamp(alpha, 0.0, 0.7);

                // Add subtle fresnel tint
                vec3 finalColor = glareColor + vec3(0.9, 0.95, 1.0) * fresnel * 0.05;

                gl_FragColor = vec4(finalColor, alpha);
            }
        `;

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide
        });

        // Track this material for camera updates
        this.glareMaterials.push(material);

        return material;
    }

    /**
     * Update a glare material's light position (e.g., for dynamic lamp position)
     * @param {THREE.ShaderMaterial} material - The glare material
     * @param {number} lightIndex - Which light slot to update (0-3)
     * @param {THREE.Vector3} position - New light position
     */
    updateGlareLightPosition(material, lightIndex, position) {
        if (material.uniforms.uLightPositions) {
            material.uniforms.uLightPositions.value[lightIndex].copy(position);
        }
    }

    /**
     * Update all glare materials with current camera position
     * @param {THREE.Camera} camera - The scene camera
     */
    updateGlare(camera) {
        for (const material of this.glareMaterials) {
            material.uniforms.uCameraPosition.value.copy(camera.position);
        }
    }

    /**
     * Update day/night cycle based on real time.
     * Only the window directional light follows the sun; indoor ceiling and
     * desk lights are constant (they're always on in a home office).
     * @returns {boolean} True when the lighting actually changed this call
     *   (throttled to ~1 Hz internally) — used by the render loop to know
     *   whether a frame needs to be drawn to reflect the change.
     */
    updateDayNightCycle() {
        if (!this.lights.main) return false;

        const nowMs = performance.now();
        if (nowMs - this._lastDayNightUpdate < 1000) return false;
        this._lastDayNightUpdate = nowMs;

        const now = new Date();
        const hour = now.getHours() + now.getMinutes() / 60;

        // Find current time interval
        let startFrame = this.dayNightKeyframes[0];
        let endFrame = this.dayNightKeyframes[this.dayNightKeyframes.length - 1];

        for (let i = 0; i < this.dayNightKeyframes.length - 1; i++) {
            if (hour >= this.dayNightKeyframes[i].hour && hour < this.dayNightKeyframes[i + 1].hour) {
                startFrame = this.dayNightKeyframes[i];
                endFrame = this.dayNightKeyframes[i + 1];
                break;
            }
        }

        const t = (hour - startFrame.hour) / (endFrame.hour - startFrame.hour);

        // Interpolate window light color
        this._startColor.setHex(startFrame.color);
        this._endColor.setHex(endFrame.color);
        this.lights.main.color.copy(this._startColor).lerp(this._endColor, t);

        // Interpolate window light intensity
        this.lights.main.intensity = startFrame.intensity + (endFrame.intensity - startFrame.intensity) * t;

        const mainIntensity = this.lights.main.intensity;
        // 0–1 day fraction: 0 = pure night, 1 = solar noon peak
        const dayFraction = Math.min(mainIntensity / 0.70, 1.0);
        const nightFraction = 1.0 - dayFraction;

        // Ambient: at night shifts to cool moonlit blue, during day to warm scattered light.
        // The color shift is as important as the intensity for realism — a dark room at night
        // has a distinctly cold blue cast from sky glow, not the warm tone of an interior.
        if (this.lights.ambient) {
            // Interpolate color: night blue (#0a0e1a) → day warm (#1a150d)
            this.lights.ambient.color.copy(this._nightAmbientColor).lerp(this._dayAmbientColor, dayFraction);
            // Night floor: 0.25, Day peak: 0.32. Raised slightly over the pre-Phase-3
            // 0.22/0.28 floor to help cover the wide-radius fill lights removed from
            // setupLights() (backWallWash, roomFill, roomBounce, ceilingBounce).
            this.lights.ambient.intensity = 0.25 + dayFraction * 0.07;
        }

        // Hemisphere: sky color shifts cool-blue at night (star/moonlit sky) → bright blue at noon.
        if (this.lights.hemisphere) {
            if (this.lights.hemisphere.color) {
                this.lights.hemisphere.color.copy(this._nightSkyColor).lerp(this._daySkyColor, dayFraction);
            }
            // Night: 0.05, Day peak: 0.43 (raised from 0.04/0.38, same reason as ambient above).
            this.lights.hemisphere.intensity = 0.05 + dayFraction * 0.38;
        }

        // Ceiling lights: slight night boost so the room doesn't go pitch black.
        // Real behavior: ceiling fixtures are always on; their apparent contribution grows
        // relative to the scene only when sunlight fades.
        // Night boost: ceiling lights brighten slightly at night since they're the only source.
        const nightBoost = Math.max(0, nightFraction - 0.2) * 0.5;
        if (this.lights.fill) {
            this.lights.fill.intensity = LIGHTING_CONFIG.ceiling.mainIntensity + nightBoost * LIGHTING_CONFIG.ceiling.mainNightBoost;
        }
        if (this.lights.fill2) {
            this.lights.fill2.intensity = LIGHTING_CONFIG.ceiling.fillIntensity + nightBoost * LIGHTING_CONFIG.ceiling.fillNightBoost;
        }

        // Update glare light intensities to match current window light
        for (const material of this.glareMaterials) {
            material.uniforms.uLightIntensities.value[0] = mainIntensity * 0.5;
        }

        return true;
    }

    /**
     * Main update method - call each frame
     * @param {THREE.Camera} camera - The scene camera
     * @returns {boolean} True when the day/night cycle actually changed lighting
     *   this call — see `updateDayNightCycle`.
     */
    update(camera) {
        const dayNightChanged = this.updateDayNightCycle();
        this.updateGlare(camera);
        return dayNightChanged;
    }

    /**
     * Get the environment map for use in materials.
     * @returns {THREE.Texture | null} The environment map, or null if not yet loaded.
     */
    getEnvironmentMap() {
        return this.envMap;
    }

    /**
     * Fit the main directional light's shadow camera frustum to the actual scene bounds,
     * replacing hand-tuned constants that risk clipping or wasting shadow-map resolution
     * as scene content changes. Call once after all objects have been added to the scene.
     * @param {THREE.Scene} scene
     * @param {number} [margin] - Extra world-space padding added to the fitted frustum.
     */
    fitMainShadowToScene(scene, margin = 0.5) {
        const mainLight = this.lights.main;
        if (!mainLight) return;

        const sceneBox = new THREE.Box3().setFromObject(scene);
        if (sceneBox.isEmpty()) return;

        // Build the light's view matrix (position -> target, using the shadow camera's own
        // up vector) without mutating the real shadow camera until the frustum is computed.
        const shadowCamera = mainLight.shadow.camera;
        const target = mainLight.target.position;
        const viewMatrix = new THREE.Matrix4().lookAt(mainLight.position, target, shadowCamera.up);
        viewMatrix.setPosition(mainLight.position);
        const viewMatrixInverse = viewMatrix.clone().invert();

        // Project the world-space scene bounds into light view space to find the tightest
        // orthographic frustum that still contains everything the light needs to shadow.
        const boxInLightSpace = sceneBox.clone().applyMatrix4(viewMatrixInverse);

        shadowCamera.left = boxInLightSpace.min.x - margin;
        shadowCamera.right = boxInLightSpace.max.x + margin;
        shadowCamera.top = boxInLightSpace.max.y + margin;
        shadowCamera.bottom = boxInLightSpace.min.y - margin;
        // Camera looks down -Z in its own space, so the near/far distances are the negated z range.
        shadowCamera.near = Math.max(0.1, -boxInLightSpace.max.z - margin);
        shadowCamera.far = -boxInLightSpace.min.z + margin;
        shadowCamera.updateProjectionMatrix();
    }
}

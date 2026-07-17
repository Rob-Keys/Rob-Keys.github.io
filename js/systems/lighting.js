// @ts-check
/**
 * Unified Lighting System
 * Handles all lighting concerns: environment maps, lights, shadows, glare, and day/night cycle
 */

import { SHADOW_CONFIG } from '../config/config.js';

export class LightingSystem {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;

        /** @type {{
         *   ambient: THREE.AmbientLight | null,
         *   hemisphere: THREE.HemisphereLight | null,
         *   main: THREE.DirectionalLight | null,
         *   fill: THREE.SpotLight | null,
         *   fill2: THREE.SpotLight | null,
         *   rim: THREE.PointLight | null,
         *   deskLamp: THREE.SpotLight | null,
         *   roomBounce: THREE.PointLight | null
         * }} */
        this.lights = {
            ambient: null,
            hemisphere: null,
            main: null,
            fill: null,
            fill2: null,
            rim: null,
            deskLamp: null,
            roomBounce: null
        };

        /** @type {THREE.Texture | null} */ this.envMap = null;
        /** @type {THREE.Light[]} */ this.emissiveLights = [];

        // Glare materials that need camera updates
        this.glareMaterials = [];

        // Day/night cycle cached colors (avoid GC)
        this._startColor = new THREE.Color();
        this._endColor = new THREE.Color();

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
        const loader = new THREE.RGBELoader();
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
     *   - Two warm overhead SpotLights at reduced intensity (ceiling can't out-compete natural light)
     *   - Focused desk lamp SpotLight (warm 2700K amber — the hero accent light)
     *   - Strong monitor bounce (visible blue screen glow on keyboard/desk)
     *   - Laptop screen bounce (cool fill from left side)
     *   - Minimal room bounce (don't fill shadows that add depth)
     *   - Ceiling ambient bounce (subtle reflected warmth from ceiling)
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
        // Very low intensity — only lifts the deepest fronts without flattening form.
        const wallFill = new THREE.DirectionalLight(0xfff4ee, 0.10);
        wallFill.position.set(0, 4, 8);
        this.scene.add(wallFill);

        // Back-wall wash — a wide, dim PointLight placed just in front of the back wall to
        // lift it out of pure black, so the scene reads as an enclosed room. Positioned high
        // and behind the shelf line; distance-limited so it never spills onto the desk.
        const backWallWash = new THREE.PointLight(0xffe9d6, 2.2, 9, 2);
        backWallWash.position.set(0, 4.2, -2.9);
        this.scene.add(backWallWash);

        // Ceiling SpotLight 1 — primary overhead fixture (3000K warm-white LED).
        // Cone angle π/4 (~45°) is closer to a real surface-mounted LED downlight than the
        // previous π/3.5 (~51°). Penumbra 0.45 gives a soft edge without looking like a projector.
        // Casts shadows so desk objects produce realistic contact shadows on the desktop.
        // Decay 2 = inverse-square (physically correct). Intensity raised to 28 to compensate:
        // at desk distance (~5.8 units) illuminance = 28/5.8² ≈ 0.83, matching the old system's 0.72.
        const ceilingMain = new THREE.SpotLight(0xffcba0, 28.0, 18, Math.PI / 4, 0.45, 2);
        ceilingMain.position.set(-0.8, 5.8, -0.2);
        ceilingMain.target.position.set(-0.4, 0.0, -1.0);
        ceilingMain.castShadow = true;
        ceilingMain.shadow.mapSize.width = isMobile ? 1024 : 2048;
        ceilingMain.shadow.mapSize.height = isMobile ? 1024 : 2048;
        ceilingMain.shadow.bias = -0.0003;
        ceilingMain.shadow.normalBias = 0.02;
        ceilingMain.shadow.radius = 3;
        this.scene.add(ceilingMain);
        this.scene.add(ceilingMain.target);
        this.lights.fill = ceilingMain;

        // Ceiling SpotLight 2 — secondary overhead, slightly cooler 3500K.
        // Offset right to balance coverage and give the right side of the desk its own fill.
        const ceilingFill = new THREE.SpotLight(0xffd8b8, 18.0, 18, Math.PI / 4, 0.50, 2);
        ceilingFill.position.set(0.8, 5.8, 0.4);
        ceilingFill.target.position.set(0.6, 0.0, -0.8);
        this.scene.add(ceilingFill);
        this.scene.add(ceilingFill.target);
        this.lights.fill2 = ceilingFill;

        // Room fill PointLight — indirect ceiling bounce.
        // Represents multi-bounce illumination that a real room accumulates from overhead
        // fixtures scattering off ceiling, walls, and furniture. Kept dim (3.0) because the
        // ceiling spots already provide significant direct light; this only fills the gaps.
        const roomFill = new THREE.PointLight(0xfff0e8, 6.0, 22, 2);
        roomFill.position.set(0, 5.8, 2.0);
        this.scene.add(roomFill);

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

        // Laptop screen bounce — cooler fill from the laptop on the left.
        const laptopBounce = new THREE.PointLight(0xd0e4ff, 0.30, 3, 2);
        laptopBounce.position.set(-2.4, 1.5, 0.6);
        this.scene.add(laptopBounce);

        // Room bounce — fills front-faces of objects that ceiling spots can't reach.
        // Positioned behind the camera, aimed at the scene. Kept very dim (0.7) — only
        // fills the deepest shadows, not bright enough to compete with ceiling fixtures.
        const roomBounce = new THREE.PointLight(0xfff4ee, 0.7, 20, 2);
        roomBounce.position.set(0, 3.0, 6.5);
        this.scene.add(roomBounce);
        this.lights.roomBounce = roomBounce;

        // Ceiling bounce — indirect fill from the ceiling surface itself.
        // Simulates ceiling-reflected light coming downward into the scene.
        const ceilingBounce = new THREE.PointLight(0xffe8d8, 0.5, 24, 2);
        ceilingBounce.position.set(0, 7.0, 0);
        this.scene.add(ceilingBounce);
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
     */
    updateDayNightCycle() {
        if (!this.lights.main) return;

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
            const nightColor = new THREE.Color(0x0a0e1a);
            const dayColor = new THREE.Color(0x1a150d);
            this.lights.ambient.color.copy(nightColor).lerp(dayColor, dayFraction);
            // Night floor: 0.22 (room lights keep some ambient even without sun)
            // Day peak: 0.28
            this.lights.ambient.intensity = 0.22 + dayFraction * 0.06;
        }

        // Hemisphere: sky color shifts cool-blue at night (star/moonlit sky) → bright blue at noon.
        if (this.lights.hemisphere) {
            const nightSky = new THREE.Color(0x050810);
            const daySky = new THREE.Color(0x8ab4d8);
            if (this.lights.hemisphere.color) {
                this.lights.hemisphere.color.copy(nightSky).lerp(daySky, dayFraction);
            }
            // Night: 0.04 (barely lit sky), Day peak: 0.38
            this.lights.hemisphere.intensity = 0.04 + dayFraction * 0.34;
        }

        // Ceiling lights: slight night boost so the room doesn't go pitch black.
        // Real behavior: ceiling fixtures are always on; their apparent contribution grows
        // relative to the scene only when sunlight fades.
        // Night boost: ceiling lights brighten slightly at night since they're the only source.
        const nightBoost = Math.max(0, nightFraction - 0.2) * 0.5;
        if (this.lights.fill) {
            this.lights.fill.intensity = 28.0 + nightBoost * 10.0;
        }
        if (this.lights.fill2) {
            this.lights.fill2.intensity = 18.0 + nightBoost * 7.0;
        }

        // Update glare light intensities to match current window light
        for (const material of this.glareMaterials) {
            material.uniforms.uLightIntensities.value[0] = mainIntensity * 0.5;
        }
    }

    /**
     * Main update method - call each frame
     * @param {THREE.Camera} camera - The scene camera
     */
    update(camera) {
        this.updateDayNightCycle();
        this.updateGlare(camera);
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

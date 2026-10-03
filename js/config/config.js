// @ts-check
/**
 * Configuration file for portfolio settings.
 * Contains technical configuration: shadows, lighting, zoom, and scene settings.
 * Monitor copy is rendered from the small canvas-specific source in content.js.
 */

/**
 * @typedef {{ x: number, y: number, z: number, rotationX: number, rotationY: number, rotationZ: number }} Origin
 * @typedef {{ distance: number, yOffset: number, targetYOffset: number, useRotation?: boolean }} ZoomSettings
 */

// shadow.radius fields were removed here: the renderer
// uses THREE.PCFSoftShadowMap; keep the value centralized for backend parity
// that ignores shadow.radius entirely. Every radius value that used to live here was
// dead config nobody could actually tune.
export const SHADOW_CONFIG = Object.freeze({
    main: Object.freeze({
        mapSize: 2048,
        near: 0.5,
        far: 25,
        bias: -0.0001,
        normalBias: 0.02
    }),
    mobile: Object.freeze({
        mapSize: 1024
    }),
    // Tight cone, small coverage area -- 1024 wastes no visible resolution
    // versus the 2048 used previously (Phase 3.3).
    lamp: Object.freeze({
        mapSize: 1024,
        bias: -0.0002,
        normalBias: 0.02
    }),
    ceiling: Object.freeze({
        mapSize: 1024
    })
});

export const LIGHTING_CONFIG = Object.freeze({
    // Ceiling overhead SpotLights (warm ~3000K / cooler ~3500K). Base intensities
    // plus the night-boost added as these become the room's only light source
    // (see updateDayNightCycle in lighting.js). Centralized here so retuning after
    // a lighting change stays in one place (Phase 3.4).
    ceiling: Object.freeze({
        mainIntensity: 30.0,
        mainNightBoost: 10.0,
        fillIntensity: 19.0,
        fillNightBoost: 7.0
    }),
    // Environment map intensity for materials
    environment: Object.freeze({
        default: 0.5,
        metal: 1.0,
        screen: 0.3,
        floor: 0.15
    })
});

/**
 * Zoom distances for each interactive object type.
 * Smaller values = closer zoom.
 * @type {Readonly<Record<string, ZoomSettings>>}
 */
export const ZOOM_CONFIG = Object.freeze({
    monitor:  Object.freeze({ distance: 2,   yOffset: 1.35, targetYOffset: 1.35 }),
    diploma:  Object.freeze({ distance: 1.2, yOffset: 0,    targetYOffset: 0 }),
    laptop:   Object.freeze({ distance: 0.8, yOffset: 1,    targetYOffset: 0.6, useRotation: true }),
    coffee:   Object.freeze({ distance: 1.05, yOffset: 0.86, targetYOffset: 0.08 }),
    notebook: Object.freeze({ distance: 0.1, yOffset: 1,    targetYOffset: 0,   useRotation: true }),
    lamp:     Object.freeze({ distance: 1.8, yOffset: 0.25, targetYOffset: 0.43 }),
    default:  Object.freeze({ distance: 1.5, yOffset: 0,    targetYOffset: 0 })
});

/**
 * Object origin positions and rotations.
 * Centralized positioning data for all 3D objects in the scene.
 * Change these values to reposition entire objects.
 */
export const OBJECT_ORIGINS = Object.freeze({
    scene: Object.freeze({
        floor: Object.freeze({ x: 0, y: -0.5, z: 0, rotationX: -Math.PI / 2, rotationY: 0, rotationZ: 0 })
    }),
    furniture: Object.freeze({
        desk:      Object.freeze({ x: 0, y: 0.75, z: -0.3, rotationX: 0, rotationY: 0, rotationZ: 0 }),
        wall:      Object.freeze({ x: 0, y: 0,    z: 1.5,  rotationX: 0, rotationY: 0, rotationZ: 0 }),
        wallShelf: Object.freeze({ x: 0, y: 3.5,  z: -1.7, rotationX: 0, rotationY: 0, rotationZ: 0 })
    }),
    technology: Object.freeze({
        monitor:  Object.freeze({ x: -1.72, y: 1,    z: -1.1, rotationX: 0, rotationY: Math.PI / 24,  rotationZ: 0 }),
        monitorRight: Object.freeze({ x: 1.72, y: 1,  z: -1.1, rotationX: 0, rotationY: -Math.PI / 24, rotationZ: 0 }),
        keyboard: Object.freeze({ x: 0,    y: 0.94, z: 0.1,  rotationX: 0, rotationY: Math.PI,        rotationZ: 0 }),
        mouse:    Object.freeze({ x: -0.15, y: 1.0525, z: -0.05, rotationX: 0, rotationY: Math.PI / 4, rotationZ: 0 }),
        // The unibody base starts at local y=0; match it to the desktop's top
        // surface so the laptop reads as resting on the wood instead of hovering.
        laptop:   Object.freeze({ x: -1.72, y: 0.80, z: 0.45, rotationX: 0, rotationY: Math.PI / 4, rotationZ: 0 }),
        clock:    Object.freeze({ x: 1,    y: 0.83, z: -1,   rotationX: 0, rotationY: -Math.PI / 9,  rotationZ: 0 })
    }),
    desk: Object.freeze({
        notebook: Object.freeze({ x: 1.1,  y: 1, z: 0.55, rotationX: 0, rotationY: -Math.PI / 6, rotationZ: 0 }),
        // The cup is modeled from its base up, so its root sits at desktop height.
        coffee:   Object.freeze({ x: 2.65, y: 1.19, z: 0.95, rotationX: 0, rotationY: 0,            rotationZ: 0 }),
        lamp:     Object.freeze({ x: 2.8,  y: 1, z: -0.35, rotationX: 0, rotationY: 0,             rotationZ: 0 })
    }),
    shelf: Object.freeze({
        // The shelf is 0.15 units thick and centered at y=3.5. Object roots
        // sit on its top surface, not at its center, so every prop shares the
        // same physically meaningful ground plane.
        books:      Object.freeze({ x: -0.1, y: 3.575, z: -1.7, rotationX: 0, rotationY: 0, rotationZ: 0 }),
        // Pull the planter toward the shelf's front edge so the pot sits in front
        // of the 0.02-unit front trim instead of disappearing behind it.
        shelfPlant: Object.freeze({ x: -2.1, y: 3.575, z: -1.72, rotationX: 0, rotationY: 0, rotationZ: 0 }),
        tidbyt:     Object.freeze({ x: 1.8,  y: 3.575, z: -1.65, rotationX: 0, rotationY: 0, rotationZ: 0 })
    }),
    wall: Object.freeze({
        diploma: Object.freeze({ x: 3.7,  y: 4.05, z: -1.8, rotationX: 0, rotationY: 0, rotationZ: 0 }),
        vinyl:   Object.freeze({ x: -4.3, y: 3.5, z: -1.9, rotationX: 0, rotationY: 0, rotationZ: 0 })
    })
});

export const PORTFOLIO_CONFIG = Object.freeze({
    scene: Object.freeze({
        backgroundColor: 0x1a1614,
        fogColor: 0x1a1614
    }),
    rendering: Object.freeze({
        // Capped below the display's native devicePixelRatio -- every full-screen
        // post-processing pass (bloom, combine, outline) pays for pixel count
        // quadratically on Retina displays, so this is a deliberate sharpness/perf trade.
        maxPixelRatioDesktop: 1.5,
        maxPixelRatioMobile: 1.0,
        // Bloom is inherently blurred, so rendering it at a fraction of canvas
        // resolution and letting the combine pass upsample it is free.
        postProcessResolutionScale: 0.5,
        enableBloom: true,
        simpleGlare: false,
        // Phase 3 features
        enableContactShadows: true,
        enableDustParticles: true,
        dustParticleCount: 300,
        filmGrainAmplitude: 0.015,
        vignetteIntensity: 0.15,
        // Phase 6: whether the ceiling main spot and desk lamp cast shadows. The
        // fitted main directional light always casts one regardless of tier.
        lampShadowEnabled: true,
        ceilingShadowEnabled: true
    }),
    camera: Object.freeze({
        fov: 75,
        near: 0.05,
        far: 50,
        initialPosition: Object.freeze({ x: 0, y: 2.5, z: 3 })
    }),
    controls: Object.freeze({
        dampingFactor: 0.05,
        minDistance: 0.1,
        maxDistance: 10,
        maxPolarAngle: Math.PI / 2,
        enableRotate: true,
        enablePan: true,
        enableZoom: false
    }),
    animation: Object.freeze({
        zoomDuration: 1.5,
        zoomEase: 'power2.inOut'
    })
});

/**
 * @typedef {{
 *   maxPixelRatioDesktop: number, maxPixelRatioMobile: number,
 *   postProcessResolutionScale: number, enableBloom: boolean, simpleGlare: boolean,
 *   enableContactShadows: boolean,
 *   enableDustParticles: boolean, dustParticleCount: number,
 *   filmGrainAmplitude: number, vignetteIntensity: number,
 *   lampShadowEnabled: boolean, ceilingShadowEnabled: boolean
 * }} RenderingConfig
 * @typedef {Partial<RenderingConfig>} RenderingTierOverrides
 */

/**
 * Adaptive quality tiers (Phase 6). `PORTFOLIO_CONFIG.rendering` above is the
 * High tier baseline; these are the overrides applied on top of it when
 * `SceneManager.applyQualityTier()` steps a session down after a slow start
 * (see the startup tier detection in `js/core/main.js`). Contact shadows and
 * vignette aren't touched by any tier -- both are cheap regardless of device.
 * @type {Readonly<Record<'medium' | 'low', RenderingTierOverrides>>}
 */
export const QUALITY_TIERS = Object.freeze({
    medium: Object.freeze({
        maxPixelRatioDesktop: 1.25,
        maxPixelRatioMobile: 1.0,
        enableContactShadows: false,
        enableDustParticles: false,
        filmGrainAmplitude: 0,
        lampShadowEnabled: false
    }),
    low: Object.freeze({
        maxPixelRatioDesktop: 1.0,
        maxPixelRatioMobile: 1.0,
        postProcessResolutionScale: 0.25,
        enableBloom: false,
        simpleGlare: true,
        enableContactShadows: false,
        enableDustParticles: false,
        filmGrainAmplitude: 0,
        lampShadowEnabled: false,
        ceilingShadowEnabled: false
    })
});

// @ts-check
/**
 * Configuration file for portfolio settings.
 * Contains technical configuration: shadows, lighting, materials, colors, zoom, and scene settings.
 * For content data (text displayed in the portfolio), see content.js.
 */

// Re-export content data for backward compatibility
export { CONTENT_DATA, SHARED_CONTENT } from './content.js';

/**
 * @typedef {{ x: number, y: number, z: number, rotationX: number, rotationY: number, rotationZ: number }} Origin
 * @typedef {{ color?: number, roughness?: number, metalness?: number, clearcoat?: number, clearcoatRoughness?: number, emissiveIntensity?: number }} MaterialPreset
 * @typedef {{ distance: number, yOffset: number, targetYOffset: number, useRotation?: boolean }} ZoomSettings
 */

export const SHADOW_CONFIG = Object.freeze({
    main: Object.freeze({
        mapSize: 4096,
        near: 0.5,
        far: 25,
        bias: -0.0001,
        normalBias: 0.02,
        radius: 2
    }),
    mobile: Object.freeze({
        mapSize: 2048
    }),
    lamp: Object.freeze({
        mapSize: 2048,
        bias: -0.0002,
        normalBias: 0.02,
        radius: 4
    })
});

export const LIGHTING_CONFIG = Object.freeze({
    // Ceiling overhead light (PointLight, warm white ~3000K)
    fill: Object.freeze({
        intensity: 0.35,
        distance: 10,
        decay: 2
    }),
    // Monitor bounce fill (PointLight, cool blue-white ~6500K)
    rim: Object.freeze({
        intensity: 0.12,
        distance: 7,
        decay: 2
    }),
    // Environment map intensity for materials
    environment: Object.freeze({
        default: 0.5,
        metal: 1.0,
        screen: 0.3,
        floor: 0.15
    })
});

/** @type {Readonly<Record<string, MaterialPreset>>} */
export const MATERIALS = Object.freeze({
    // Metal finishes
    darkMetal:    Object.freeze({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.9 }),
    brushedMetal: Object.freeze({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.8 }),

    // Plastics
    darkPlastic: Object.freeze({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.1 }),

    // Glass
    screenGlass: Object.freeze({ roughness: 0.05, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05 }),

    // Wood
    darkWood: Object.freeze({ color: 0x4a3c2a, roughness: 0.5, metalness: 0.2 }),

    // Pottery
    terracotta: Object.freeze({ color: 0xd4a574, roughness: 0.7, metalness: 0.0 })
});

export const COLORS = Object.freeze({
    // UI and lighting
    background: 0x1a1614,
    fog: 0x1a1614,

    // LED indicator colors
    ledGreen: 0x00ff00,
    ledRed:   0xff0000,
    ledBlue:  0x00aaff,

    // Accent colors
    gold:      0xffd700,
    warmLight: 0xffffcc,

    // Paper and fabric
    paper:     0xf8f8f0,
    parchment: 0xf5f0e1
});

/**
 * Zoom distances for each interactive object type.
 * Smaller values = closer zoom.
 * @type {Readonly<Record<string, ZoomSettings>>}
 */
export const ZOOM_CONFIG = Object.freeze({
    monitor:  Object.freeze({ distance: 2,   yOffset: 1.35, targetYOffset: 1.35 }),
    laptop:   Object.freeze({ distance: 0.8, yOffset: 1,    targetYOffset: 0.6, useRotation: true }),
    notebook: Object.freeze({ distance: 0.1, yOffset: 1,    targetYOffset: 0,   useRotation: true }),
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
        monitor:  Object.freeze({ x: 0,    y: 1,    z: -1.1, rotationX: 0, rotationY: 0,              rotationZ: 0 }),
        keyboard: Object.freeze({ x: 0,    y: 0.94, z: 0.1,  rotationX: 0, rotationY: Math.PI,        rotationZ: 0 }),
        mouse:    Object.freeze({ x: 1.3,  y: 1,    z: 0,    rotationX: 0, rotationY: 0,              rotationZ: 0 }),
        laptop:   Object.freeze({ x: -2.4, y: 0.85, z: 0.2,  rotationX: 0, rotationY: Math.PI / 4,   rotationZ: 0 }),
        clock:    Object.freeze({ x: 1,    y: 0.83, z: -1,   rotationX: 0, rotationY: -Math.PI / 9,  rotationZ: 0 })
    }),
    desk: Object.freeze({
        notebook: Object.freeze({ x: 2.2,  y: 1, z: 0.4,  rotationX: 0, rotationY: -Math.PI / 6, rotationZ: 0 }),
        coffee:   Object.freeze({ x: -1.8, y: 1, z: -0.8, rotationX: 0, rotationY: 0,             rotationZ: 0 }),
        lamp:     Object.freeze({ x: 2.5,  y: 1, z: -1.1, rotationX: 0, rotationY: 0,             rotationZ: 0 })
    }),
    shelf: Object.freeze({
        books:      Object.freeze({ x: 0,    y: 3.5, z: -1.7, rotationX: 0, rotationY: 0, rotationZ: 0 }),
        shelfPlant: Object.freeze({ x: -2.0, y: 3.5, z: -1.6, rotationX: 0, rotationY: 0, rotationZ: 0 })
    }),
    wall: Object.freeze({
        diploma: Object.freeze({ x: 3.7,  y: 3,   z: -1.8, rotationX: 0, rotationY: 0, rotationZ: 0 }),
        vinyl:   Object.freeze({ x: -4.3, y: 3.5, z: -1.9, rotationX: 0, rotationY: 0, rotationZ: 0 })
    })
});

export const PORTFOLIO_CONFIG = Object.freeze({
    scene: Object.freeze({
        backgroundColor: 0x1a1614,
        fogColor: 0x1a1614,
        fogNear: 10,
        fogFar: 50
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
        zoomDistance: 2,
        zoomEase: 'power2.inOut'
    })
});

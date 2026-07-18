/**
 * Type declarations for Three.js add-ons loaded via CDN and attached to the global THREE object.
 * These are not part of @types/three@0.128.0 (which only covers core), so we declare them here.
 *
 * Also declares runtime-dynamic properties on core Three.js types,
 * and the global gsap object.
 */

import type {
    Camera, Color, DataTexture, LoadingManager, Material, Object3D,
    Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderer,
    WebGLRenderTarget,
} from 'three';

declare module 'three' {
    // ---- CDN add-ons --------------------------------------------------------

    class OrbitControls {
        constructor(camera: Camera, domElement: HTMLElement);
        enableDamping: boolean;
        dampingFactor: number;
        minDistance: number;
        maxDistance: number;
        maxPolarAngle: number;
        enableRotate: boolean;
        enablePan: boolean;
        enableZoom: boolean;
        enabled: boolean;
        target: Vector3;
        update(): void;
    }

    class EffectComposer {
        constructor(renderer: WebGLRenderer);
        renderToScreen: boolean;
        /** Final ping-pong render target holding the composed output. */
        renderTarget2: WebGLRenderTarget;
        addPass(pass: object): void;
        render(): void;
        setSize(width: number, height: number): void;
    }

    class RenderPass {
        constructor(scene: Scene, camera: Camera);
    }

    class ShaderPass {
        constructor(shader: object, textureID?: string);
        needsSwap: boolean;
        uniforms: Record<string, { value: unknown }>;
    }

    class UnrealBloomPass {
        renderToScreen: boolean;
        strength: number;
        radius: number;
        threshold: number;
        constructor(resolution: Vector2, strength: number, radius: number, threshold: number);
    }

    class OutlinePass {
        enabled: boolean;
        visibleEdgeColor: Color;
        hiddenEdgeColor: Color;
        edgeStrength: number;
        edgeGlow: number;
        edgeThickness: number;
        pulsePeriod: number;
        selectedObjects: Object3D[];
        overlayMaterial: ShaderMaterial;
        constructor(resolution: Vector2, scene: Scene, camera: Camera);
        setSize(width: number, height: number): void;
    }

    class SSAOPass {
        static readonly OUTPUT: { Default: number };
        kernelRadius: number;
        minDistance: number;
        maxDistance: number;
        output: number;
        constructor(scene: Scene, camera: Camera, width: number, height: number);
        setSize(width: number, height: number): void;
    }

    class RGBELoader {
        constructor(manager?: LoadingManager);
        load(
            url: string,
            onLoad: (texture: DataTexture) => void,
            onProgress?: (event: ProgressEvent) => void,
            onError?: (event: ErrorEvent) => void
        ): DataTexture;
    }

    const RectAreaLightUniformsLib: { init(): void };

    // r128 uses numeric encoding constants; newer Three.js uses string color spaces.
    // We declare the string form here so r128 compat-guard code doesn't produce type errors.
    const SRGBColorSpace: string;

    // ---- Runtime-dynamic properties on core types ---------------------------

    interface Object3D {
        /** Stashed original material during selective bloom render pass. */
        _savedMaterial?: Material | Material[];
        /** True on Mesh instances; used for runtime type narrowing in traversal. */
        isMesh?: boolean;
        /** Present on Mesh; declared here for Object3D traversal code that checks isMesh first. */
        material?: Material | Material[];
    }

    interface Texture {
        /** String color space — newer Three.js API, paired with numeric encoding in r128. */
        colorSpace?: string;
    }
}

// ---- Global declarations ---------------------------------------------------

declare global {
    const gsap: {
        to(target: object, vars: Record<string, unknown>): object;
        from(target: object, vars: Record<string, unknown>): object;
        timeline(vars?: Record<string, unknown>): object;
    };

    interface Window {
        Portfolio3D: unknown;
        _portfolio: unknown;
    }
}

export {};

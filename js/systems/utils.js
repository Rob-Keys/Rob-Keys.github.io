// @ts-check
/**
 * Shared utilities for 3D scene object creation.
 */

import { PORTFOLIO_CONFIG } from '../config/config.js';

// Contact shadow planes sit slightly below the object's true resting point
// so they never share a Z-depth with the desk surface they're drawn over.
const CONTACT_SHADOW_EPSILON = 0.01;

/**
 * Assert a condition at runtime. Throws in both dev and prod — use for
 * invariants that must always hold (bad input from a factory, missing config).
 * @param {boolean} condition
 * @param {string} message
 * @returns {asserts condition}
 */
export function assert(condition, message) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

/**
 * Apply origin position and rotation to a group.
 * @param {THREE.Group} group
 * @param {{ x: number, y: number, z: number, rotationX: number, rotationY: number, rotationZ: number }} origin
 * @param {boolean} [isStatic] - If true, freezes matrix updates for performance.
 */
export function applyOrigin(group, origin, isStatic = false) {
    group.position.set(origin.x, origin.y, origin.z);
    group.rotation.set(origin.rotationX, origin.rotationY, origin.rotationZ);

    if (isStatic) {
        group.updateMatrixWorld(true);
        group.matrixAutoUpdate = false;
        group.traverse((child) => {
            child.matrixAutoUpdate = false;
        });
    }
}

/**
 * Create a mesh with a standard material.
 * @param {THREE.BufferGeometry} geometry
 * @param {import('../config/config.js').MaterialPreset} materialProps
 * @param {{ x: number, y: number, z: number } | null} [position]
 * @param {boolean} [castShadow]
 * @returns {THREE.Mesh}
 */
export function createMesh(geometry, materialProps, position = null, castShadow = true) {
    const material = new THREE.MeshStandardMaterial(materialProps);
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = castShadow;
    return mesh;
}

/**
 * Create a canvas texture with the given dimensions and a render callback.
 * @param {number} width
 * @param {number} height
 * @param {(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void} renderFn
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, texture: THREE.CanvasTexture }}
 */
export function createCanvasTexture(width, height, renderFn) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    assert(ctx !== null, 'Failed to get 2D canvas context');
    renderFn(ctx, canvas);
    const texture = new THREE.CanvasTexture(canvas);
    if (texture.colorSpace !== undefined) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }
    return { canvas, ctx, texture };
}

/**
 * Wrap text onto a canvas context across multiple lines.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @returns {number} Y position after the last line.
 */
export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (const word of words) {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth && line !== '') {
            ctx.fillText(line, x, currentY);
            line = word + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
}

const _roundedRectShapeCache = new Map();

/**
 * Build (and cache) a rounded-rectangle Shape centered at the origin.
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @returns {THREE.Shape}
 */
function _roundedRectShape(width, height, radius) {
    const key = `${width}|${height}|${radius}`;
    const cached = _roundedRectShapeCache.get(key);
    if (cached) return cached;

    const w = width / 2;
    const h = height / 2;
    const r = Math.max(0, Math.min(radius, w, h));

    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    shape.closePath();

    _roundedRectShapeCache.set(key, shape);
    return shape;
}

const _beveledBoxCache = new Map();

/**
 * Create (and cache by dimension key) a box geometry with rounded edges,
 * built from a rounded-rect profile extruded and beveled on all 12 edges.
 * Drop-in replacement for `new THREE.BoxGeometry(width, height, depth)`.
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @param {number} [bevelRadius] - Scene-scale edge radius (~0.005 for a 4-unit-wide desk).
 * @param {number} [segments] - Bevel/curve tessellation; 2-3 is enough for small objects.
 * @returns {THREE.BufferGeometry}
 */
export function createBeveledBox(width, height, depth, bevelRadius = 0.005, segments = 2) {
    const key = `${width}|${height}|${depth}|${bevelRadius}|${segments}`;
    const cached = _beveledBoxCache.get(key);
    if (cached) return cached;

    const maxRadius = Math.min(width, height, depth) / 2 - 0.0001;
    const radius = Math.max(0, Math.min(bevelRadius, maxRadius));

    const shape = _roundedRectShape(width, height, radius);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        steps: 1,
        depth,
        bevelEnabled: radius > 0,
        bevelThickness: radius,
        bevelSize: radius,
        bevelOffset: 0,
        bevelSegments: segments,
        curveSegments: segments
    });
    geometry.translate(0, 0, -depth / 2);

    _beveledBoxCache.set(key, geometry);
    return geometry;
}

const _keycapGeometryCache = new Map();

/**
 * Create (and cache) a tapered keycap geometry: a rounded-rect base narrowing
 * to a smaller rounded-rect top (draft angle) with a slightly dished top face.
 * Built as a unit footprint (1x1) so instances can non-uniformly scale X/Z per
 * key width while sharing one geometry/draw call.
 * @param {number} width
 * @param {number} depth
 * @param {number} height
 * @param {number} [topScale] - Top footprint as a fraction of the base (draft angle).
 * @param {number} [bevelRadius] - Corner radius in the unit footprint's own units.
 * @param {number} [segments] - Corner tessellation.
 * @returns {THREE.BufferGeometry}
 */
export function createKeycapGeometry(width, depth, height, topScale = 0.82, bevelRadius = 0.12, segments = 2) {
    const key = `${width}|${depth}|${height}|${topScale}|${bevelRadius}|${segments}`;
    const cached = _keycapGeometryCache.get(key);
    if (cached) return cached;

    const bottomRadius = Math.max(0, Math.min(bevelRadius, width / 2 - 0.0001, depth / 2 - 0.0001));
    const topWidth = width * topScale;
    const topDepth = depth * topScale;
    const topRadius = Math.max(0, Math.min(bottomRadius * topScale, topWidth / 2 - 0.0001, topDepth / 2 - 0.0001));

    const bottomShape = _roundedRectShape(width, depth, bottomRadius);
    const topShape = _roundedRectShape(topWidth, topDepth, topRadius);

    const divisions = Math.max(8, segments * 4);
    const bottomPts = bottomShape.getSpacedPoints(divisions);
    const topPts = topShape.getSpacedPoints(divisions);

    const halfH = height / 2;
    const dishDepth = height * 0.12;
    const positions = [];
    const uvs = [];

    // Side walls (draft-angle taper from base to top)
    for (let i = 0; i < divisions; i++) {
        const b0 = bottomPts[i];
        const b1 = bottomPts[(i + 1) % divisions];
        const t0 = topPts[i];
        const t1 = topPts[(i + 1) % divisions];

        positions.push(
            b0.x, -halfH, b0.y,  b1.x, -halfH, b1.y,  t1.x, halfH, t1.y,
            b0.x, -halfH, b0.y,  t1.x, halfH, t1.y,   t0.x, halfH, t0.y
        );
        const u0 = i / divisions, u1 = (i + 1) / divisions;
        uvs.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    }

    // Bottom cap (flat fan)
    for (let i = 0; i < divisions; i++) {
        const b0 = bottomPts[i];
        const b1 = bottomPts[(i + 1) % divisions];
        positions.push(0, -halfH, 0, b1.x, -halfH, b1.y, b0.x, -halfH, b0.y);
        uvs.push(0.5, 0.5, 0, 0, 0, 0);
    }

    // Top cap (fan pulled down slightly at center for a shallow dish)
    for (let i = 0; i < divisions; i++) {
        const t0 = topPts[i];
        const t1 = topPts[(i + 1) % divisions];
        positions.push(0, halfH - dishDepth, 0, t0.x, halfH, t0.y, t1.x, halfH, t1.y);
        uvs.push(0.5, 0.5, 0, 0, 1, 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();

    _keycapGeometryCache.set(key, geometry);
    return geometry;
}

/**
 * Create a 1×1 solid-color data texture (used for shader pre-compilation).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {THREE.DataTexture}
 */
export function createSolidTexture(r, g, b) {
    const data = new Uint8Array([r, g, b, 255]);
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    // @ts-ignore — r128 uses numeric encoding constants; newer Three.js uses colorSpace strings
    texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    return texture;
}

/** @type {THREE.CanvasTexture | null} */
let _roughnessVariationTexture = null;

/**
 * Shared low-frequency roughness-variation texture for plastics and metals
 * across the whole scene. One instance is generated and reused everywhere;
 * per-material look comes from varying the base `roughness` value, not this
 * map. Tileable via repeat wrapping so it reads as subtle wear rather than a
 * visible seam.
 * @returns {THREE.CanvasTexture}
 */
export function createRoughnessVariationTexture() {
    if (_roughnessVariationTexture) return _roughnessVariationTexture;

    const size = 256;
    const { texture } = createCanvasTexture(size, size, (ctx) => {
        // Mid-gray base (roughnessMap only modulates the material's roughness value).
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, size, size);

        // Low-frequency blotches: large soft-edged circles at random gray levels,
        // reads as smudges/wear rather than uniform noise at typical viewing distance.
        const blotchCount = 40;
        for (let i = 0; i < blotchCount; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = 20 + Math.random() * 60;
            const gray = 100 + Math.random() * 110;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(${gray}, ${gray}, ${gray}, 0.35)`);
            gradient.addColorStop(1, 'rgba(128, 128, 128, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
    });

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // This is a grayscale data map, not a color image — no sRGB decode.
    if (texture.colorSpace !== undefined) {
        texture.colorSpace = THREE.NoColorSpace;
    }

    _roughnessVariationTexture = texture;
    return texture;
}

/** @type {THREE.CanvasTexture | null} */
let _screenSmudgeTexture = null;

/**
 * Shared fingerprint/smudge texture for screen glass (monitor + laptop).
 * A handful of faint radial smears; used as a roughnessMap so the smudges
 * only become visible where they catch reflected light, matching how real
 * screen grime behaves.
 * @returns {THREE.CanvasTexture}
 */
export function createScreenSmudgeTexture() {
    if (_screenSmudgeTexture) return _screenSmudgeTexture;

    const size = 256;
    const { texture } = createCanvasTexture(size, size, (ctx) => {
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, size, size);

        const smearCount = 5;
        for (let i = 0; i < smearCount; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = 15 + Math.random() * 35;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(120, 120, 120, 0.25)');
            gradient.addColorStop(0.7, 'rgba(150, 150, 150, 0.1)');
            gradient.addColorStop(1, 'rgba(224, 224, 224, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
    });

    if (texture.colorSpace !== undefined) {
        texture.colorSpace = THREE.NoColorSpace;
    }

    _screenSmudgeTexture = texture;
    return texture;
}

/** @type {THREE.CanvasTexture | null} */
let _paperGrainNormalTexture = null;

/**
 * Shared fine-grain paper normal texture (notebook pages, book covers).
 * Flat normal-map blue (128, 128, 255) perturbed with small per-texel bumps;
 * meant to be used with a small `normalScale` so it reads as paper tooth
 * rather than a visible pattern.
 * @returns {THREE.CanvasTexture}
 */
export function createPaperGrainNormalTexture() {
    if (_paperGrainNormalTexture) return _paperGrainNormalTexture;

    const size = 128;
    const { texture } = createCanvasTexture(size, size, (ctx) => {
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const nx = 128 + (Math.random() - 0.5) * 20;
            const ny = 128 + (Math.random() - 0.5) * 20;
            data[i] = nx;
            data[i + 1] = ny;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
    });

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (texture.colorSpace !== undefined) {
        texture.colorSpace = THREE.NoColorSpace;
    }

    _paperGrainNormalTexture = texture;
    return texture;
}

/** @type {THREE.CanvasTexture | null} */
let _contactShadowTexture = null;

/**
 * Shared radial-gradient contact shadow texture (dark at center, fades to transparent).
 * Used on planes beneath desk objects to ground them realistically.
 * @returns {THREE.CanvasTexture}
 */
export function createContactShadowTexture() {
    if (_contactShadowTexture) return _contactShadowTexture;

    const size = 128;
    const { texture } = createCanvasTexture(size, size, (ctx) => {
        const centerX = size / 2;
        const centerY = size / 2;
        const maxRadius = size / 2;

        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    });

    if (texture.colorSpace !== undefined) {
        texture.colorSpace = THREE.NoColorSpace;
    }

    _contactShadowTexture = texture;
    return texture;
}

/**
 * Create a contact shadow plane beneath an object (Phase 3.1).
 * Returns a mesh ready to add to the scene; position it under your object.
 * @param {number} width - Contact shadow width
 * @param {number} depth - Contact shadow depth
 * @returns {THREE.Mesh}
 */
export function createContactShadowPlane(width, depth) {
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        color: 0x000000,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.renderOrder = 0;
    return plane;
}

/**
 * Add a contact shadow plane beneath an object, honoring
 * `PORTFOLIO_CONFIG.rendering.enableContactShadows` (Phase 3.1). No-ops when
 * the flag is off so the feature can actually be disabled for low-end/mobile
 * perf tuning instead of always paying the extra draw call.
 * @param {THREE.Object3D} group - Parent to attach the shadow plane to.
 * @param {number} width - Contact shadow width.
 * @param {number} depth - Contact shadow depth.
 * @param {number} groundY - Local Y of the object's resting point (its lowest
 *   vertex in the parent's local space); the plane is placed a hair below it.
 */
export function addContactShadow(group, width, depth, groundY) {
    if (!PORTFOLIO_CONFIG.rendering.enableContactShadows) return;

    const plane = createContactShadowPlane(width, depth);
    plane.position.set(0, groundY - CONTACT_SHADOW_EPSILON, 0);
    plane.rotation.x = -Math.PI / 2;
    group.add(plane);
}

/**
 * Create a dev-only frame profiler, active behind `?perf=1`. Draws a rolling
 * frame-time average plus renderer.info counters to a small corner canvas —
 * exempt from the no-HTML-overlay rule since it's a debug view, not portfolio
 * content (see CLAUDE.md Phase 0 baseline measurement).
 * @param {THREE.WebGLRenderer} renderer
 * @returns {() => void} Call once per rendered frame to refresh the readout.
 */
export function createPerfMonitor(renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 260;
    canvas.height = 80;
    Object.assign(canvas.style, {
        position: 'fixed',
        top: '8px',
        left: '8px',
        zIndex: '9999',
        background: 'rgba(0, 0, 0, 0.65)',
        pointerEvents: 'none'
    });
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    assert(ctx !== null, 'Failed to get 2D context for perf monitor canvas');

    const MAX_SAMPLES = 60;
    /** @type {number[]} */
    const frameTimes = [];
    let lastTime = performance.now();

    return function updatePerfMonitor() {
        const now = performance.now();
        frameTimes.push(now - lastTime);
        lastTime = now;
        if (frameTimes.length > MAX_SAMPLES) frameTimes.shift();

        const avgMs = frameTimes.reduce((sum, t) => sum + t, 0) / frameTimes.length;
        const info = renderer.info;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        ctx.fillText(`frame: ${avgMs.toFixed(2)} ms (${(1000 / avgMs).toFixed(0)} fps)`, 8, 16);
        ctx.fillText(`draw calls: ${info.render.calls}`, 8, 32);
        ctx.fillText(`triangles: ${info.render.triangles}`, 8, 48);
        ctx.fillText(`programs: ${info.programs?.length ?? 0}`, 8, 64);
    };
}

/**
 * Create a dust particles cloud (Phase 3.5).
 * Sparse additive points that drift slowly inside light cones.
 * @param {number} count - Number of dust particles (200-400 recommended)
 * @param {number} scale - Size of the particle cloud
 * @returns {THREE.Points}
 */
export function createDustParticles(count = 300, scale = 2.0) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        positions.push(
            (Math.random() - 0.5) * scale,
            (Math.random() - 0.5) * scale,
            (Math.random() - 0.5) * scale
        );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.02,
        transparent: true,
        opacity: 0.1,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    return new THREE.Points(geometry, material);
}

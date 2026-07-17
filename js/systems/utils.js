// @ts-check
/**
 * Shared utilities for 3D scene object creation.
 */

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

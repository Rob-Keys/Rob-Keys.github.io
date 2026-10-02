// @ts-check
/**
 * Keycap legends for the instanced keyboard.
 *
 * Every keycap is one instance of a single InstancedMesh, so legends can't be
 * separate meshes or per-key materials without giving up that single draw call.
 * Instead each key's legend is baked into one cell of a shared atlas, every
 * instance carries the UV offset of its own cell, and a TSL node material
 * composites that cell over the keycap's top face.
 */

import * as THREE from 'three/webgpu';
import { attribute, materialColor, mix, texture as sampleTexture, uv } from 'three/tsl';
import { assert, createCanvasTexture } from '../systems/utils.js';

/** Atlas cell edge in pixels; one cell holds one key's legend. */
const CELL_SIZE = 64;
/** Cells per atlas row. A power of two keeps the atlas power-of-two wide. */
const CELL_COLUMNS = 8;
/**
 * Largest share of a cell a legend may cover. The remaining border is
 * transparent, so mip filtering can never bleed a neighbouring key's legend in.
 */
const LEGEND_MAX_FILL = 0.6;
const LEGEND_FONT_STACK = 'Arial, Helvetica, sans-serif';
/** Legends are printed on the cap, not lit separately — a dark warm gray. */
const LEGEND_COLOR = 0x2f2c2a;
/** Keycaps are read at grazing angles when the camera zooms to the keyboard. */
const LEGEND_ANISOTROPY = 8;

/**
 * @typedef {{ label: string, aspect: number }} KeycapLegend
 * `label` is the printed text (empty for a blank key such as the spacebar).
 * `aspect` is the key's width/depth ratio, used to pre-compress the text so a
 * wide key doesn't stretch it.
 */

/**
 * Starting font size for a legend, as a fraction of the cell. Longer labels
 * start smaller so `ENTER` isn't squeezed to a smear by the width fit below.
 * @param {string} label
 * @returns {number}
 */
function _baseFontSize(label) {
    if (label.length <= 1) return CELL_SIZE * 0.46;
    if (label.length <= 3) return CELL_SIZE * 0.32;
    return CELL_SIZE * 0.24;
}

/**
 * Draw one legend centered in its atlas cell, pre-compressed by the key's
 * aspect ratio so it comes out undistorted once the cell is stretched across
 * the key's top face.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} label
 * @param {number} aspect
 * @param {number} cellX - Cell's left edge in canvas pixels.
 * @param {number} cellY - Cell's top edge in canvas pixels.
 */
function _drawLegend(ctx, label, aspect, cellX, cellY) {
    let fontSize = _baseFontSize(label);
    ctx.font = `600 ${fontSize}px ${LEGEND_FONT_STACK}`;

    const maxWidth = CELL_SIZE * LEGEND_MAX_FILL;
    const drawnWidth = ctx.measureText(label).width / aspect;
    if (drawnWidth > maxWidth) {
        fontSize *= maxWidth / drawnWidth;
        ctx.font = `600 ${fontSize}px ${LEGEND_FONT_STACK}`;
    }

    ctx.save();
    ctx.translate(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2);
    ctx.scale(1 / aspect, 1);
    ctx.fillText(label, 0, 0);
    ctx.restore();
}

/**
 * @param {number} value
 * @returns {number}
 */
function _nextPowerOfTwo(value) {
    return Math.pow(2, Math.ceil(Math.log2(Math.max(1, value))));
}

/**
 * Bake a legend atlas for an instanced set of keycaps, give each instance the
 * UV offset of its own cell, and patch the keycap material to print the legend
 * on the top face. Adds no draw calls and no extra geometry.
 *
 * The mesh's geometry must not be shared with anything else — this adds an
 * instanced attribute to it — and must carry the `legendMask` attribute that
 * `createKeycapGeometry` writes.
 *
 * @param {THREE.InstancedMesh} keycaps
 * @param {KeycapLegend[]} legends - One entry per instance, in instance order.
 */
export function applyKeycapLegends(keycaps, legends) {
    assert(legends.length === keycaps.count, 'one legend entry per keycap instance');
    assert(
        keycaps.geometry.getAttribute('legendMask') !== undefined,
        'keycap geometry must carry a legendMask attribute'
    );

    const rows = _nextPowerOfTwo(Math.ceil(legends.length / CELL_COLUMNS));
    const atlasWidth = CELL_COLUMNS * CELL_SIZE;
    const atlasHeight = rows * CELL_SIZE;
    const offsets = new Float32Array(legends.length * 2);

    const { texture } = createCanvasTexture(atlasWidth, atlasHeight, (ctx) => {
        // Only the alpha channel is sampled; the printed color is a uniform.
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        legends.forEach(({ label, aspect }, i) => {
            const column = i % CELL_COLUMNS;
            const row = Math.floor(i / CELL_COLUMNS);

            // v is measured from the canvas bottom: CanvasTexture flips Y on upload.
            offsets[i * 2] = (column * CELL_SIZE) / atlasWidth;
            offsets[i * 2 + 1] = 1 - ((row + 1) * CELL_SIZE) / atlasHeight;

            if (label) _drawLegend(ctx, label, aspect, column * CELL_SIZE, row * CELL_SIZE);
        });
    });

    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = LEGEND_ANISOTROPY;

    keycaps.geometry.setAttribute(
        'instanceLegendOffset',
        new THREE.InstancedBufferAttribute(offsets, 2)
    );

    const previousMaterial = keycaps.material;
    const material = new THREE.MeshStandardNodeMaterial();
    material.color.set(0xf0f0f0);
    material.roughness = 0.85;
    material.metalness = 0;
    material.vertexColors = true;
    const offset = attribute('instanceLegendOffset', 'vec2');
    const mask = attribute('legendMask', 'float');
    const cellScale = new THREE.Vector2(CELL_SIZE / atlasWidth, CELL_SIZE / atlasHeight);
    const legendAlpha = sampleTexture(texture, uv().mul(cellScale).add(offset)).a.mul(mask);
    material.colorNode = mix(materialColor.rgb, new THREE.Color(LEGEND_COLOR), legendAlpha);
    keycaps.material = material;
    previousMaterial.dispose();
    material.needsUpdate = true;
}

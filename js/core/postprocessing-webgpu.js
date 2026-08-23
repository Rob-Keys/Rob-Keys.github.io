// @ts-check
/**
 * TSL render graph for the WebGPU renderer.
 *
 * The scene pass writes both the normal color and the material emissive output
 * in one MRT render. Bloom consumes only that emissive attachment, then the
 * final grade combines bloom, grain, and vignette in the same node graph.
 */

import * as THREE from 'three/webgpu';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
    emissive,
    fract,
    float,
    mrt,
    output,
    pass,
    sin,
    time,
    uv,
    uniform,
    vec2,
    vec4
} from 'three/tsl';

export class WebGPUPostProcessing {
    /**
     * @param {THREE.Renderer} renderer
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {import('../config/config.js').RenderingConfig} renderingConfig
     */
    constructor(renderer, scene, camera, renderingConfig) {
        this.pipeline = new THREE.RenderPipeline(renderer);
        this.grainAmplitude = uniform(renderingConfig.filmGrainAmplitude);
        this.vignetteIntensity = uniform(renderingConfig.vignetteIntensity);

        const scenePass = pass(scene, camera);
        scenePass.setMRT(mrt({ output, emissive }));

        const sceneColor = scenePass.getTextureNode('output');
        const emissiveColor = scenePass.getTextureNode('emissive');
        const bloomNode = bloom(
            emissiveColor,
            0.62,
            0.60,
            0.0
        );
        bloomNode.setResolutionScale(renderingConfig.postProcessResolutionScale);
        this.bloomNode = bloomNode;

        const colorWithBloom = sceneColor.add(bloomNode);
        const centeredUv = uv().sub(0.5);
        const grainNoise = fract(
            sin(uv().mul(1000).add(time).dot(vec2(12.9898, 78.233)))
                .mul(43758.5453)
        ).sub(0.5).mul(this.grainAmplitude);
        const vignette = float(1).sub(
            this.vignetteIntensity.mul(centeredUv.dot(centeredUv)).mul(2)
        );

        this.pipeline.outputNode = vec4(
            colorWithBloom.rgb.add(grainNoise).mul(vignette),
            colorWithBloom.a
        );
        this.pipeline.needsUpdate = true;
    }

    /** @param {number} scale */
    setResolutionScale(scale) {
        this.bloomNode.setResolutionScale(scale);
        this.pipeline.needsUpdate = true;
    }

    /** @param {number} amplitude */
    setGrainAmplitude(amplitude) {
        this.grainAmplitude.value = amplitude;
    }

    render() {
        this.pipeline.render();
    }

    dispose() {
        this.pipeline.dispose();
    }
}

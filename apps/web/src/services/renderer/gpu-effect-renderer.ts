/**
 * WebGPU multi-pass effect renderer.
 * Replaces the WebGL1 path when a GPU device is available.
 */

import {
	getOrCreatePipeline,
	uploadTextureFromSource,
	createUniformBuffer,
	createRenderTarget,
	createBindGroup,
	renderFullscreenPass,
	readTextureToCanvas,
} from "./gpu-utils";

export interface GPUEffectPass {
	shaderModule: string;
	uniforms: Record<string, number | number[]>;
}

export interface GPUApplyEffectParams {
	device: GPUDevice;
	source: CanvasImageSource;
	width: number;
	height: number;
	passes: GPUEffectPass[];
}

/**
 * Pack uniform values into a Float32Array following WGSL struct layout.
 * Each value is aligned to 4 bytes. vec2 aligned to 8, vec3/vec4 to 16.
 * For simplicity, we pack all values sequentially as f32 with vec4 alignment
 * per field (matching the WGSL structs that use vec4f and f32 fields).
 */
function packUniforms(uniforms: Record<string, number | number[]>): Float32Array {
	const values: number[] = [];

	for (const value of Object.values(uniforms)) {
		if (typeof value === "number") {
			values.push(value);
		} else if (Array.isArray(value)) {
			// Align vec2 to 2-float boundary, vec3/vec4 to 4-float boundary
			if (value.length >= 3) {
				while (values.length % 4 !== 0) values.push(0);
			} else if (value.length === 2) {
				while (values.length % 2 !== 0) values.push(0);
			}
			values.push(...value);
			// Pad vec3 to vec4
			if (value.length === 3) values.push(0);
		}
	}

	return new Float32Array(values);
}

/**
 * Apply a multi-pass GPU effect chain to the source image.
 * Returns an OffscreenCanvas/HTMLCanvasElement with the result.
 */
export function applyGPUEffect({
	device,
	source,
	width,
	height,
	passes,
}: GPUApplyEffectParams): OffscreenCanvas | HTMLCanvasElement {
	// Upload source image to GPU
	let inputTexture = uploadTextureFromSource({ device, source, width, height });

	const texturesToDestroy: GPUTexture[] = [inputTexture];
	const buffersToDestroy: GPUBuffer[] = [];

	try {
		const encoder = device.createCommandEncoder();

		for (let i = 0; i < passes.length; i++) {
			const pass = passes[i];

			// Get or create cached pipeline for this shader
			const pipeline = getOrCreatePipeline({
				device,
				fragmentWGSL: pass.shaderModule,
			});

			// Create uniform buffer from pass parameters
			const uniformData = packUniforms(pass.uniforms);
			const uniformBuffer = createUniformBuffer({ device, data: uniformData });
			buffersToDestroy.push(uniformBuffer);

			// Create output render target
			const outputTexture = createRenderTarget({ device, width, height });
			texturesToDestroy.push(outputTexture);

			// Create bind group
			const bindGroup = createBindGroup({
				device,
				pipeline,
				texture: inputTexture,
				uniformBuffer,
			});

			// Execute render pass
			renderFullscreenPass({
				device,
				encoder,
				pipeline,
				bindGroup,
				target: outputTexture.createView(),
			});

			// Chain: output becomes input for next pass
			inputTexture = outputTexture;
		}

		// Submit all passes
		device.queue.submit([encoder.finish()]);

		// Read final texture to canvas
		const result = readTextureToCanvas({
			device,
			texture: inputTexture,
			width,
			height,
		});

		return result;
	} finally {
		// Cleanup GPU resources
		for (const tex of texturesToDestroy) {
			tex.destroy();
		}
		for (const buf of buffersToDestroy) {
			buf.destroy();
		}
	}
}

import { createOffscreenCanvas } from "./canvas-utils";
import { applyMultiPassEffect } from "./webgl-utils";
import type { EffectPassData } from "./webgl-utils";
import { getGPUDeviceSync } from "./gpu-device";
import { applyGPUEffect } from "./gpu-effect-renderer";
import type { GPUEffectPass } from "./gpu-effect-renderer";

export interface ApplyEffectParams {
	source: CanvasImageSource;
	width: number;
	height: number;
	passes: EffectPassData[];
	/** Optional WebGPU passes — used when GPU device is available */
	gpuPasses?: GPUEffectPass[];
}

let gl: WebGLRenderingContext | null = null;
let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
const programCache = new Map<string, WebGLProgram>();

function getOrCreateCanvas({
	width,
	height,
}: {
	width: number;
	height: number;
}): OffscreenCanvas | HTMLCanvasElement {
	if (!canvas) {
		canvas = createOffscreenCanvas({ width, height });
		gl = canvas.getContext("webgl", {
			premultipliedAlpha: false,
		}) as WebGLRenderingContext | null;
		if (!gl) {
			throw new Error("WebGL not supported");
		}
	}
	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
	return canvas;
}

/**
 * Unified effect renderer facade.
 * Delegates to WebGPU when available and gpuPasses are provided,
 * falls back to WebGL1 otherwise.
 */
function applyEffect({
	source,
	width,
	height,
	passes,
	gpuPasses,
}: ApplyEffectParams): OffscreenCanvas | HTMLCanvasElement {
	// Try WebGPU path first
	const gpuDevice = getGPUDeviceSync();
	if (gpuDevice && gpuPasses && gpuPasses.length > 0) {
		try {
			return applyGPUEffect({
				device: gpuDevice,
				source,
				width,
				height,
				passes: gpuPasses,
			});
		} catch (err) {
			// WebGPU failed — fall through to WebGL1
			console.warn("[webgl-effect-renderer] WebGPU pass failed, falling back to WebGL1:", err);
		}
	}

	// WebGL1 fallback path (original implementation, unchanged)
	const targetCanvas = getOrCreateCanvas({ width, height });
	const context = gl;
	if (!context) {
		throw new Error("WebGL context not initialized");
	}

	applyMultiPassEffect({
		context,
		source,
		width,
		height,
		passes,
		programCache,
	});

	const outputCanvas = createOffscreenCanvas({ width, height });
	const outputCtx = outputCanvas.getContext("2d") as
		| CanvasRenderingContext2D
		| OffscreenCanvasRenderingContext2D
		| null;
	if (outputCtx) {
		outputCtx.drawImage(targetCanvas, 0, 0, width, height);
	}
	return outputCanvas;
}

export const webglEffectRenderer = {
	applyEffect,
};

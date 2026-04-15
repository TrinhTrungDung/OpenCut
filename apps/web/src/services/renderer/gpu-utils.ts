/**
 * WebGPU utility helpers: pipeline creation, texture upload, uniform buffers,
 * bind groups, fullscreen pass execution, and readback to canvas.
 */

import vertexWGSL from "@/lib/effects/effect.vert.wgsl";

// Fullscreen quad vertices (same positions as WebGL path)
const QUAD_VERTICES = new Float32Array([
	-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
]);

/** Cache render pipelines by fragment shader source to avoid recompilation */
const pipelineCache = new Map<string, GPURenderPipeline>();

/** Shared vertex buffer (created once per device) */
let vertexBuffer: GPUBuffer | null = null;
let vertexBufferDevice: GPUDevice | null = null;

function getVertexBuffer(device: GPUDevice): GPUBuffer {
	if (vertexBuffer && vertexBufferDevice === device) return vertexBuffer;
	vertexBuffer = device.createBuffer({
		size: QUAD_VERTICES.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(vertexBuffer, 0, QUAD_VERTICES);
	vertexBufferDevice = device;
	return vertexBuffer;
}

/** Shared linear-clamp sampler */
let sharedSampler: GPUSampler | null = null;
let samplerDevice: GPUDevice | null = null;

function getSampler(device: GPUDevice): GPUSampler {
	if (sharedSampler && samplerDevice === device) return sharedSampler;
	sharedSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
		addressModeU: "clamp-to-edge",
		addressModeV: "clamp-to-edge",
	});
	samplerDevice = device;
	return sharedSampler;
}

/**
 * Get or create a cached render pipeline for the given fragment WGSL.
 */
export function getOrCreatePipeline({
	device,
	fragmentWGSL,
}: {
	device: GPUDevice;
	fragmentWGSL: string;
}): GPURenderPipeline {
	const cached = pipelineCache.get(fragmentWGSL);
	if (cached) return cached;

	const vertexModule = device.createShaderModule({ code: vertexWGSL });
	const fragmentModule = device.createShaderModule({ code: fragmentWGSL });

	const pipeline = device.createRenderPipeline({
		layout: "auto",
		vertex: {
			module: vertexModule,
			entryPoint: "main",
			buffers: [
				{
					arrayStride: 2 * 4, // 2 floats * 4 bytes
					attributes: [
						{ shaderLocation: 0, offset: 0, format: "float32x2" as GPUVertexFormat },
					],
				},
			],
		},
		fragment: {
			module: fragmentModule,
			entryPoint: "main",
			targets: [{ format: "rgba8unorm" as GPUTextureFormat }],
		},
		primitive: { topology: "triangle-list" },
	});

	pipelineCache.set(fragmentWGSL, pipeline);
	return pipeline;
}

/**
 * Upload a CanvasImageSource to a GPUTexture via copyExternalImageToTexture.
 */
export function uploadTextureFromSource({
	device,
	source,
	width,
	height,
}: {
	device: GPUDevice;
	source: CanvasImageSource;
	width: number;
	height: number;
}): GPUTexture {
	const texture = device.createTexture({
		size: { width, height },
		format: "rgba8unorm",
		usage:
			GPUTextureUsage.TEXTURE_BINDING |
			GPUTextureUsage.COPY_DST |
			GPUTextureUsage.RENDER_ATTACHMENT,
	});

	// Use copyExternalImageToTexture for efficient upload
	device.queue.copyExternalImageToTexture(
		{ source: source as ImageBitmap | HTMLCanvasElement | OffscreenCanvas },
		{ texture, premultipliedAlpha: false },
		{ width, height },
	);

	return texture;
}

/**
 * Create a uniform buffer from a Float32Array of values.
 */
export function createUniformBuffer({
	device,
	data,
}: {
	device: GPUDevice;
	data: Float32Array;
}): GPUBuffer {
	// Align to 16 bytes (WebGPU requirement for uniform buffers)
	const alignedSize = Math.ceil(data.byteLength / 16) * 16;
	const buffer = device.createBuffer({
		size: Math.max(alignedSize, 16),
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(buffer, 0, data);
	return buffer;
}

/**
 * Create a render target texture for intermediate passes.
 */
export function createRenderTarget({
	device,
	width,
	height,
}: {
	device: GPUDevice;
	width: number;
	height: number;
}): GPUTexture {
	return device.createTexture({
		size: { width, height },
		format: "rgba8unorm",
		usage:
			GPUTextureUsage.TEXTURE_BINDING |
			GPUTextureUsage.RENDER_ATTACHMENT |
			GPUTextureUsage.COPY_SRC,
	});
}

/**
 * Create a bind group for a render pass (texture + sampler + uniform buffer).
 */
export function createBindGroup({
	device,
	pipeline,
	texture,
	uniformBuffer,
}: {
	device: GPUDevice;
	pipeline: GPURenderPipeline;
	texture: GPUTexture;
	uniformBuffer: GPUBuffer;
}): GPUBindGroup {
	return device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: texture.createView() },
			{ binding: 1, resource: getSampler(device) },
			{ binding: 2, resource: { buffer: uniformBuffer } },
		],
	});
}

/**
 * Execute a single fullscreen render pass.
 */
export function renderFullscreenPass({
	device,
	encoder,
	pipeline,
	bindGroup,
	target,
}: {
	device: GPUDevice;
	encoder: GPUCommandEncoder;
	pipeline: GPURenderPipeline;
	bindGroup: GPUBindGroup;
	target: GPUTextureView;
}): void {
	const passEncoder = encoder.beginRenderPass({
		colorAttachments: [
			{
				view: target,
				clearValue: { r: 0, g: 0, b: 0, a: 0 },
				loadOp: "clear" as GPULoadOp,
				storeOp: "store" as GPUStoreOp,
			},
		],
	});
	passEncoder.setPipeline(pipeline);
	passEncoder.setBindGroup(0, bindGroup);
	passEncoder.setVertexBuffer(0, getVertexBuffer(device));
	passEncoder.draw(6);
	passEncoder.end();
}

/**
 * Read a GPU texture back to an OffscreenCanvas/HTMLCanvasElement via staging buffer.
 */
export function readTextureToCanvas({
	device,
	texture,
	width,
	height,
}: {
	device: GPUDevice;
	texture: GPUTexture;
	width: number;
	height: number;
}): OffscreenCanvas | HTMLCanvasElement {
	// Use a 2D canvas to draw the GPU output
	// We read pixels via a staging buffer, then put them on a canvas
	const bytesPerRow = Math.ceil((width * 4) / 256) * 256; // align to 256
	const bufferSize = bytesPerRow * height;

	const stagingBuffer = device.createBuffer({
		size: bufferSize,
		usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
	});

	const encoder = device.createCommandEncoder();
	encoder.copyTextureToBuffer(
		{ texture },
		{ buffer: stagingBuffer, bytesPerRow, rowsPerImage: height },
		{ width, height },
	);
	device.queue.submit([encoder.finish()]);

	// For synchronous output, use a WebGPU canvas context instead
	// This avoids the async mapAsync path
	let outputCanvas: OffscreenCanvas | HTMLCanvasElement;
	try {
		outputCanvas = new OffscreenCanvas(width, height);
	} catch {
		outputCanvas = document.createElement("canvas");
		outputCanvas.width = width;
		outputCanvas.height = height;
	}

	// Configure the canvas with a WebGPU context for direct rendering
	const gpuCtx = outputCanvas.getContext("webgpu") as GPUCanvasContext | null;
	if (gpuCtx) {
		gpuCtx.configure({
			device,
			format: "rgba8unorm",
			alphaMode: "premultiplied",
		});
		const copyEncoder = device.createCommandEncoder();
		copyEncoder.copyTextureToTexture(
			{ texture },
			{ texture: gpuCtx.getCurrentTexture() },
			{ width, height },
		);
		device.queue.submit([copyEncoder.finish()]);
	}

	// Clean up staging buffer (not used when we have gpuCtx)
	stagingBuffer.destroy();

	return outputCanvas;
}

import { createOffscreenCanvas } from "./canvas-utils";
import { QUAD_POSITIONS, compileProgram } from "./webgl-utils";

function createTextureFromSource({
	context,
	source,
	textureUnit,
}: {
	context: WebGLRenderingContext;
	source: CanvasImageSource;
	textureUnit: number;
}): WebGLTexture {
	const texture = context.createTexture();
	if (!texture) {
		throw new Error("Failed to create WebGL texture");
	}
	context.activeTexture(context.TEXTURE0 + textureUnit);
	context.bindTexture(context.TEXTURE_2D, texture);
	context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, 1);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_WRAP_S,
		context.CLAMP_TO_EDGE,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_WRAP_T,
		context.CLAMP_TO_EDGE,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_MIN_FILTER,
		context.LINEAR,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_MAG_FILTER,
		context.LINEAR,
	);
	context.texImage2D(
		context.TEXTURE_2D,
		0,
		context.RGBA,
		context.RGBA,
		context.UNSIGNED_BYTE,
		source as TexImageSource,
	);
	return texture;
}

class TransitionRendererService {
	private gl: WebGLRenderingContext | null = null;
	private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
	private programCache = new Map<string, WebGLProgram>();

	private getOrCreateCanvas({
		width,
		height,
	}: {
		width: number;
		height: number;
	}): OffscreenCanvas | HTMLCanvasElement {
		if (!this.canvas) {
			this.canvas = createOffscreenCanvas({ width, height });
			this.gl = this.canvas.getContext("webgl", {
				premultipliedAlpha: false,
			}) as WebGLRenderingContext | null;
			if (!this.gl) {
				throw new Error("WebGL not supported for transition renderer");
			}
		}
		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
		}
		return this.canvas;
	}

	renderTransition({
		fromSource,
		toSource,
		width,
		height,
		progress,
		fragmentShader,
	}: {
		fromSource: CanvasImageSource;
		toSource: CanvasImageSource;
		width: number;
		height: number;
		progress: number;
		fragmentShader: string;
	}): OffscreenCanvas | HTMLCanvasElement {
		const targetCanvas = this.getOrCreateCanvas({ width, height });
		const gl = this.gl;
		if (!gl) {
			throw new Error("WebGL context not initialized");
		}

		const program = compileProgram({
			context: gl,
			fragmentShaderSource: fragmentShader,
			programCache: this.programCache,
		});

		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook
		gl.useProgram(program);

		// Bind from texture to TEXTURE0
		const fromTexture = createTextureFromSource({
			context: gl,
			source: fromSource,
			textureUnit: 0,
		});

		// Bind to texture to TEXTURE1
		const toTexture = createTextureFromSource({
			context: gl,
			source: toSource,
			textureUnit: 1,
		});

		// Set sampler uniforms
		const uFromLoc = gl.getUniformLocation(program, "u_from");
		const uToLoc = gl.getUniformLocation(program, "u_to");
		const progressLoc = gl.getUniformLocation(program, "progress");
		const ratioLoc = gl.getUniformLocation(program, "ratio");

		if (uFromLoc) gl.uniform1i(uFromLoc, 0);
		if (uToLoc) gl.uniform1i(uToLoc, 1);
		if (progressLoc) gl.uniform1f(progressLoc, progress);
		if (ratioLoc) gl.uniform1f(ratioLoc, width / height);

		// Set up vertex buffer and draw
		const positionLocation = gl.getAttribLocation(program, "a_position");
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		gl.viewport(0, 0, width, height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Copy result to output canvas
		const outputCanvas = createOffscreenCanvas({ width, height });
		const outputCtx = outputCanvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (outputCtx) {
			outputCtx.drawImage(targetCanvas, 0, 0, width, height);
		}

		// Cleanup textures
		gl.deleteTexture(fromTexture);
		gl.deleteTexture(toTexture);
		gl.deleteBuffer(buffer);
		gl.bindTexture(gl.TEXTURE_2D, null);

		return outputCanvas;
	}
}

export const transitionRenderer = new TransitionRendererService();

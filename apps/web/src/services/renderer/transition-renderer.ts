import { createOffscreenCanvas } from "./canvas-utils";
import { QUAD_POSITIONS, compileProgram } from "./webgl-utils";

/**
 * WebGL transition renderer with persistent resources.
 * Reuses vertex buffer, textures, and output canvas across frames.
 */
class TransitionRendererService {
	private gl: WebGLRenderingContext | null = null;
	private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
	private programCache = new Map<string, WebGLProgram>();
	private uniformCache = new Map<
		WebGLProgram,
		Map<string, WebGLUniformLocation | null>
	>();

	// Persistent GPU resources — created once, reused every frame
	private vertexBuffer: WebGLBuffer | null = null;
	private fromTexture: WebGLTexture | null = null;
	private toTexture: WebGLTexture | null = null;

	// Reusable output canvas — avoids allocation per frame
	private outputCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
	private outputCtx:
		| CanvasRenderingContext2D
		| OffscreenCanvasRenderingContext2D
		| null = null;
	private outputWidth = 0;
	private outputHeight = 0;

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

	private getUniformLocation(
		program: WebGLProgram,
		name: string,
	): WebGLUniformLocation | null {
		let programUniforms = this.uniformCache.get(program);
		if (!programUniforms) {
			programUniforms = new Map();
			this.uniformCache.set(program, programUniforms);
		}
		if (programUniforms.has(name)) {
			return programUniforms.get(name) ?? null;
		}
		const gl = this.gl;
		if (!gl) return null;
		const location = gl.getUniformLocation(program, name);
		programUniforms.set(name, location);
		return location;
	}

	private getOrCreateVertexBuffer(): WebGLBuffer {
		const gl = this.gl;
		if (!gl) throw new Error("WebGL context not initialized");
		if (this.vertexBuffer) return this.vertexBuffer;

		const buffer = gl.createBuffer();
		if (!buffer) throw new Error("Failed to create vertex buffer");
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW);
		this.vertexBuffer = buffer;
		return buffer;
	}

	private getOrCreateTexture(
		slot: "from" | "to",
		textureUnit: number,
	): WebGLTexture {
		const gl = this.gl;
		if (!gl) throw new Error("WebGL context not initialized");

		const existing = slot === "from" ? this.fromTexture : this.toTexture;
		if (existing) return existing;

		const texture = gl.createTexture();
		if (!texture) throw new Error("Failed to create WebGL texture");

		gl.activeTexture(gl.TEXTURE0 + textureUnit);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		if (slot === "from") {
			this.fromTexture = texture;
		} else {
			this.toTexture = texture;
		}
		return texture;
	}

	private uploadTexture(
		source: CanvasImageSource,
		textureUnit: number,
		slot: "from" | "to",
	): void {
		const gl = this.gl;
		if (!gl) return;

		const texture = this.getOrCreateTexture(slot, textureUnit);
		gl.activeTexture(gl.TEXTURE0 + textureUnit);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			source as TexImageSource,
		);
	}

	private getOutputCanvas(
		width: number,
		height: number,
	): {
		canvas: OffscreenCanvas | HTMLCanvasElement;
		ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	} {
		if (
			this.outputCanvas &&
			this.outputCtx &&
			this.outputWidth === width &&
			this.outputHeight === height
		) {
			return { canvas: this.outputCanvas, ctx: this.outputCtx };
		}

		this.outputCanvas = createOffscreenCanvas({ width, height });
		this.outputCtx = this.outputCanvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!this.outputCtx) {
			throw new Error("Failed to create output canvas context");
		}
		this.outputWidth = width;
		this.outputHeight = height;
		return { canvas: this.outputCanvas, ctx: this.outputCtx };
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
		this.getOrCreateCanvas({ width, height });
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

		// Upload source textures to persistent texture objects
		this.uploadTexture(fromSource, 0, "from");
		this.uploadTexture(toSource, 1, "to");

		// Set uniforms via cached locations
		const uFromLoc = this.getUniformLocation(program, "u_from");
		const uToLoc = this.getUniformLocation(program, "u_to");
		const progressLoc = this.getUniformLocation(program, "progress");
		const ratioLoc = this.getUniformLocation(program, "ratio");

		if (uFromLoc) gl.uniform1i(uFromLoc, 0);
		if (uToLoc) gl.uniform1i(uToLoc, 1);
		if (progressLoc) gl.uniform1f(progressLoc, progress);
		if (ratioLoc) gl.uniform1f(ratioLoc, width / height);

		// Reuse cached vertex buffer
		const buffer = this.getOrCreateVertexBuffer();
		const positionLocation = gl.getAttribLocation(program, "a_position");
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		gl.viewport(0, 0, width, height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Copy to reusable output canvas
		const { canvas: outputCanvas, ctx: outputCtx } = this.getOutputCanvas(
			width,
			height,
		);
		outputCtx.clearRect(0, 0, width, height);
		const sourceCanvas = this.canvas;
		if (sourceCanvas) {
			outputCtx.drawImage(sourceCanvas, 0, 0, width, height);
		}

		return outputCanvas;
	}
}

export const transitionRenderer = new TransitionRendererService();

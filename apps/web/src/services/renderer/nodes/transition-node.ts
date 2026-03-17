import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { VisualNode } from "./visual-node";
import { transitionRenderer } from "../transition-renderer";
import { resolveTransitionProgress } from "@/lib/transitions";
import type { TransitionInstance } from "@/types/transitions";
import { getTransition } from "@/lib/transitions";

export interface TransitionNodeParams {
	transition: TransitionInstance;
	elementAEnd: number;
	nodeA: VisualNode;
	nodeB: VisualNode;
}

/**
 * Renders a WebGL transition between two visual nodes during
 * the overlap window. Outside the transition window, both nodes
 * render normally through the standard pipeline.
 */
export class TransitionNode extends BaseNode<TransitionNodeParams> {
	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		const { transition, elementAEnd, nodeA, nodeB } = this.params;

		const progress = resolveTransitionProgress({
			transition,
			elementAEnd,
			time,
		});

		// Outside the transition window, render both nodes normally
		if (progress === null) {
			await nodeA.render({ renderer, time });
			await nodeB.render({ renderer, time });
			return;
		}

		// During the transition: render each node to separate canvases,
		// then blend them using the WebGL transition renderer.
		const { width, height } = renderer;

		const tempRendererA = createTempRenderer({ width, height, fps: renderer.fps });
		const tempRendererB = createTempRenderer({ width, height, fps: renderer.fps });

		await nodeA.render({ renderer: tempRendererA, time });
		await nodeB.render({ renderer: tempRendererB, time });

		const definition = getTransition({ transitionType: transition.type });
		const resultCanvas = transitionRenderer.renderTransition({
			fromSource: tempRendererA.canvas,
			toSource: tempRendererB.canvas,
			width,
			height,
			progress,
			fragmentShader: definition.fragmentShader,
		});

		renderer.context.drawImage(resultCanvas, 0, 0, width, height);
	}
}

function createTempRenderer({
	width,
	height,
	fps,
}: {
	width: number;
	height: number;
	fps: number;
}): CanvasRenderer {
	// Inline creation to avoid circular imports with CanvasRenderer class
	// We just need a canvas + context with the same interface
	let canvas: OffscreenCanvas | HTMLCanvasElement;
	try {
		canvas = new OffscreenCanvas(width, height);
	} catch {
		canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
	}
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Failed to create temp canvas context");
	}
	// Fill with black (same as CanvasRenderer.clear)
	(context as CanvasRenderingContext2D).fillStyle = "black";
	(context as CanvasRenderingContext2D).fillRect(0, 0, width, height);

	return {
		canvas,
		context: context as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
		width,
		height,
		fps,
	} as CanvasRenderer;
}

import type { EffectParamValues } from "@/types/effects";

// biome-ignore lint/suspicious/noExplicitAny: MediaPipe SelfieSegmentation has no typed exports
type MediaPipeSegmenter = any;
// biome-ignore lint/suspicious/noExplicitAny: MediaPipe results callback is untyped
type MediaPipeResults = any;

let segmenter: MediaPipeSegmenter = null;
let segmentationMask: CanvasImageSource | null = null;
let processingCanvas: HTMLCanvasElement | null = null;
let processingCtx: CanvasRenderingContext2D | null = null;
let outputCanvas: HTMLCanvasElement | null = null;
let outputCtx: CanvasRenderingContext2D | null = null;
let initPromise: Promise<MediaPipeSegmenter> | null = null;

function getProcessingCanvas(
	width: number,
	height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
	if (!processingCanvas || !processingCtx) {
		processingCanvas = document.createElement("canvas");
		processingCanvas.style.display = "none";
		const ctx = processingCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		if (!ctx) throw new Error("Failed to create 2d context");
		processingCtx = ctx;
	}
	if (
		processingCanvas.width !== width ||
		processingCanvas.height !== height
	) {
		processingCanvas.width = width;
		processingCanvas.height = height;
	}
	return [processingCanvas, processingCtx];
}

function getOutputCanvas(
	width: number,
	height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
	if (!outputCanvas || !outputCtx) {
		outputCanvas = document.createElement("canvas");
		outputCanvas.style.display = "none";
		const ctx = outputCanvas.getContext("2d");
		if (!ctx) throw new Error("Failed to create 2d context");
		outputCtx = ctx;
	}
	if (outputCanvas.width !== width || outputCanvas.height !== height) {
		outputCanvas.width = width;
		outputCanvas.height = height;
	}
	return [outputCanvas, outputCtx];
}

async function getSegmenter(): Promise<MediaPipeSegmenter> {
	if (segmenter) return segmenter;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const { SelfieSegmentation } = await import(
			"@mediapipe/selfie_segmentation"
		);
		const instance = new SelfieSegmentation({
			locateFile: (file: string) =>
				`https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
		});
		instance.setOptions({ modelSelection: 1 });
		instance.onResults((results: MediaPipeResults) => {
			segmentationMask = results.segmentationMask;
		});

		// Send a tiny dummy frame to initialize the model
		const dummyCanvas = document.createElement("canvas");
		dummyCanvas.width = 2;
		dummyCanvas.height = 2;
		const dummyCtx = dummyCanvas.getContext("2d");
		if (dummyCtx) {
			dummyCtx.fillStyle = "#000";
			dummyCtx.fillRect(0, 0, 2, 2);
		}
		await instance.send({ image: dummyCanvas });

		segmenter = instance;
		return instance;
	})();

	return initPromise;
}

export async function processBackgroundRemoval(params: {
	source: CanvasImageSource;
	width: number;
	height: number;
	effectParams: EffectParamValues;
}): Promise<CanvasImageSource> {
	const { source, width, height, effectParams } = params;
	const threshold =
		typeof effectParams.threshold === "number"
			? effectParams.threshold
			: 0.7;
	const edgeBlur =
		typeof effectParams.edgeBlur === "number"
			? effectParams.edgeBlur
			: 3;

	let seg: MediaPipeSegmenter;
	try {
		seg = await getSegmenter();
	} catch {
		// MediaPipe failed to load — return source unchanged
		return source;
	}

	// Draw source onto processing canvas (MediaPipe needs HTMLCanvasElement)
	const [procCanvas, procCtx] = getProcessingCanvas(width, height);
	procCtx.clearRect(0, 0, width, height);
	procCtx.drawImage(source, 0, 0, width, height);

	// Run segmentation
	segmentationMask = null;
	await seg.send({ image: procCanvas });

	if (!segmentationMask) {
		return source;
	}

	// Composite: use mask to keep only foreground
	const [outCanvas, outCtx] = getOutputCanvas(width, height);
	outCtx.clearRect(0, 0, width, height);

	// Apply edge blur to mask via filter for feathered edges
	outCtx.save();
	if (edgeBlur > 0) {
		outCtx.filter = `blur(${edgeBlur}px)`;
	}
	outCtx.drawImage(segmentationMask, 0, 0, width, height);
	outCtx.restore();

	// Use mask as alpha: draw original only where mask is white (person).
	// The segmentation mask is white for person, black for background.
	// "source-in" keeps original pixels only where mask exists.
	outCtx.globalCompositeOperation = "source-in";

	// Threshold controls segmentation confidence cutoff.
	// MediaPipe mask is already soft; threshold param is exposed for future
	// pixel-level thresholding if needed. Currently the model handles it.
	void threshold;

	outCtx.drawImage(source, 0, 0, width, height);
	outCtx.globalCompositeOperation = "source-over";

	return outCanvas;
}

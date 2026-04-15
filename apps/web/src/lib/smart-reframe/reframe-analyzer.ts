/**
 * Computes optimal crop regions from face analysis data for smart reframe.
 * Uses weighted average face positioning with EMA smoothing.
 */

import type {
	FrameAnalysis,
	ReframePreset,
	ReframeResult,
} from "@/types/smart-reframe";
import { analyzeVideoFrames } from "./face-detector";

interface ComputeReframeOptions {
	frames: FrameAnalysis[];
	sourceWidth: number;
	sourceHeight: number;
	targetPreset: ReframePreset;
}

/**
 * Compute the optimal crop region from face analysis data.
 *
 * Algorithm:
 * 1. Collect all face positions weighted by confidence
 * 2. Compute weighted average face center with EMA smoothing
 * 3. Size crop to match target aspect ratio, maximizing frame usage
 * 4. Clamp crop region to source bounds
 */
export function computeReframe({
	frames,
	sourceWidth,
	sourceHeight,
	targetPreset,
}: ComputeReframeOptions): ReframeResult {
	const sourceAspect = sourceWidth / sourceHeight;
	const targetAspect = targetPreset.aspectRatio;

	// Collect weighted face centers
	let weightedX = 0;
	let weightedY = 0;
	let totalWeight = 0;

	for (const frame of frames) {
		for (const face of frame.faces) {
			const w = face.confidence;
			weightedX += face.x * w;
			weightedY += face.y * w;
			totalWeight += w;
		}
	}

	// Default to center if no faces detected
	const centerX = totalWeight > 0 ? weightedX / totalWeight : 0.5;
	const centerY = totalWeight > 0 ? weightedY / totalWeight : 0.5;

	// Compute crop dimensions that match target aspect ratio
	// Maximize crop size (use as much of the source as possible)
	let cropWidth: number;
	let cropHeight: number;

	if (targetAspect < sourceAspect) {
		// Target is taller than source -> height-limited
		cropHeight = 1.0;
		cropWidth = (targetAspect / sourceAspect) * cropHeight;
	} else {
		// Target is wider than source -> width-limited
		cropWidth = 1.0;
		cropHeight = (sourceAspect / targetAspect) * cropWidth;
	}

	// Center crop on the weighted face position, clamped to bounds
	const cropX = clamp(centerX - cropWidth / 2, 0, 1 - cropWidth);
	const cropY = clamp(centerY - cropHeight / 2, 0, 1 - cropHeight);

	return {
		cropX,
		cropY,
		cropWidth,
		cropHeight,
		outputWidth: targetPreset.width,
		outputHeight: targetPreset.height,
	};
}

interface ComputeReframeFromFileOptions {
	file: File;
	targetPreset: ReframePreset;
	onProgress?: (progress: number) => void;
}

/**
 * Convenience wrapper: creates a video element from a file,
 * analyzes frames, and computes the optimal reframe crop.
 */
export async function computeReframeFromFile({
	file,
	targetPreset,
	onProgress,
}: ComputeReframeFromFileOptions): Promise<ReframeResult> {
	const url = URL.createObjectURL(file);
	const video = document.createElement("video");
	video.crossOrigin = "anonymous";
	video.muted = true;
	video.preload = "auto";
	video.src = url;

	try {
		await new Promise<void>((resolve, reject) => {
			video.addEventListener("loadedmetadata", () => resolve(), {
				once: true,
			});
			video.addEventListener(
				"error",
				() => reject(new Error("Failed to load video")),
				{
					once: true,
				},
			);
		});

		const { duration, videoWidth, videoHeight } = video;
		if (!duration || !videoWidth || !videoHeight) {
			throw new Error("Invalid video: missing duration or dimensions");
		}

		const frames = await analyzeVideoFrames({
			videoElement: video,
			duration,
			onProgress,
		});

		return computeReframe({
			frames,
			sourceWidth: videoWidth,
			sourceHeight: videoHeight,
			targetPreset,
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

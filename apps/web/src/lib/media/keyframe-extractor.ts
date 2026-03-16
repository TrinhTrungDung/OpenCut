/**
 * Keyframe extraction and grid composition utilities for AI video analysis.
 * Extracts evenly-spaced frames from a video and composes them into a grid image.
 */

interface ExtractKeyframesOptions {
	videoUrl: string;
	count?: number;
	thumbnailWidth?: number;
}

interface ComposeGridOptions {
	images: string[];
	cols?: number;
}

/** Extract N keyframes from a video URL as base64 JPEG strings */
export async function extractKeyframes({
	videoUrl,
	count = 16,
	thumbnailWidth = 320,
}: ExtractKeyframesOptions): Promise<string[]> {
	const video = document.createElement("video");
	video.crossOrigin = "anonymous";
	video.muted = true;
	video.preload = "auto";

	try {
		video.src = videoUrl;
		await waitForEvent(video, "loadedmetadata");

		const { duration, videoWidth, videoHeight } = video;
		if (!duration || !videoWidth || !videoHeight) {
			throw new Error("Invalid video: missing duration or dimensions");
		}

		const aspectRatio = videoHeight / videoWidth;
		const thumbHeight = Math.round(thumbnailWidth * aspectRatio);

		const canvas = document.createElement("canvas");
		canvas.width = thumbnailWidth;
		canvas.height = thumbHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get canvas 2d context");

		const frameCount = Math.min(count, Math.floor(duration));
		const interval = duration / (frameCount + 1);
		const frames: string[] = [];

		for (let i = 1; i <= frameCount; i++) {
			const time = interval * i;
			video.currentTime = Math.min(time, duration - 0.1);
			await waitForEvent(video, "seeked");

			ctx.drawImage(video, 0, 0, thumbnailWidth, thumbHeight);
			frames.push(canvas.toDataURL("image/jpeg", 0.7));
		}

		return frames;
	} finally {
		video.src = "";
		video.load();
	}
}

/** Compose keyframe images into a single grid image */
export async function composeKeyframeGrid({
	images,
	cols = 4,
}: ComposeGridOptions): Promise<string> {
	if (images.length === 0) throw new Error("No images to compose");

	const first = await loadImage(images[0]);
	const thumbW = first.width;
	const thumbH = first.height;
	const rows = Math.ceil(images.length / cols);

	const canvas = document.createElement("canvas");
	canvas.width = thumbW * cols;
	canvas.height = thumbH * rows;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Failed to get canvas 2d context");

	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	for (let i = 0; i < images.length; i++) {
		const img = i === 0 ? first : await loadImage(images[i]);
		const col = i % cols;
		const row = Math.floor(i / cols);
		ctx.drawImage(img, col * thumbW, row * thumbH, thumbW, thumbH);
	}

	return canvas.toDataURL("image/jpeg", 0.8);
}

function waitForEvent(
	el: HTMLElement | HTMLVideoElement,
	event: string,
	timeoutMs = 10_000,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			el.removeEventListener(event, handler);
			el.removeEventListener("error", errorHandler);
			reject(new Error(`Timeout waiting for "${event}" after ${timeoutMs}ms`));
		}, timeoutMs);

		const handler = () => {
			clearTimeout(timer);
			el.removeEventListener("error", errorHandler);
			resolve();
		};

		const errorHandler = () => {
			clearTimeout(timer);
			el.removeEventListener(event, handler);
			reject(new Error(`Video error while waiting for "${event}"`));
		};

		el.addEventListener(event, handler, { once: true });
		el.addEventListener("error", errorHandler, { once: true });
	});
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
}

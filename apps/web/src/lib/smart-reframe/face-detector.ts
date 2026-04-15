/**
 * Lazy-loaded MediaPipe Face Detection for smart reframe.
 * Detects faces in video frames and analyzes face positions across video duration.
 */

import type { FacePosition, FrameAnalysis } from "@/types/smart-reframe";

// biome-ignore lint/suspicious/noExplicitAny: MediaPipe types not available
let detectorInstance: any = null;
let initPromise: Promise<void> | null = null;

/** Lazily initialize the MediaPipe Face Detection model */
async function initFaceDetector(): Promise<void> {
	if (detectorInstance) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const { FaceDetection } = await import("@mediapipe/face_detection");
		detectorInstance = new FaceDetection({
			locateFile: (file: string) =>
				`https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
		});
		detectorInstance.setOptions({
			model: "short",
			minDetectionConfidence: 0.5,
		});

		// MediaPipe requires an initial onResults callback before send()
		await new Promise<void>((resolve) => {
			detectorInstance.onResults(() => {
				resolve();
			});
			// Send a blank frame to trigger initialization
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			detectorInstance.send({ image: canvas });
		});
	})();

	return initPromise;
}

interface DetectFacesOptions {
	videoElement: HTMLVideoElement;
	time: number;
}

/** Seek video to a specific time and detect faces in that frame */
export async function detectFaces({
	videoElement,
	time,
}: DetectFacesOptions): Promise<FacePosition[]> {
	await initFaceDetector();

	// Seek to the target time
	await seekVideo(videoElement, time);

	// Capture frame to canvas for MediaPipe
	const canvas = document.createElement("canvas");
	canvas.width = videoElement.videoWidth;
	canvas.height = videoElement.videoHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Failed to get canvas 2d context");
	ctx.drawImage(videoElement, 0, 0);

	// Run face detection
	const faces = await new Promise<FacePosition[]>((resolve) => {
		detectorInstance.onResults(
			// biome-ignore lint/suspicious/noExplicitAny: MediaPipe result types
			(results: any) => {
				if (!results.detections || results.detections.length === 0) {
					resolve([]);
					return;
				}
				const detected: FacePosition[] = results.detections.map(
					// biome-ignore lint/suspicious/noExplicitAny: MediaPipe detection type
					(d: any) => {
						const bb = d.boundingBox;
						return {
							x: bb.xCenter,
							y: bb.yCenter,
							width: bb.width,
							height: bb.height,
							confidence: d.score?.[0] ?? 0,
						};
					},
				);
				resolve(detected);
			},
		);
		detectorInstance.send({ image: canvas });
	});

	return faces;
}

interface AnalyzeVideoFramesOptions {
	videoElement: HTMLVideoElement;
	duration: number;
	sampleInterval?: number;
	onProgress?: (progress: number) => void;
}

/**
 * Analyze face positions at regular intervals across a video.
 * Returns frame-by-frame face analysis data for reframe computation.
 */
export async function analyzeVideoFrames({
	videoElement,
	duration,
	sampleInterval = 0.5,
	onProgress,
}: AnalyzeVideoFramesOptions): Promise<FrameAnalysis[]> {
	await initFaceDetector();

	const frames: FrameAnalysis[] = [];
	const totalSamples = Math.max(1, Math.floor(duration / sampleInterval));

	for (let i = 0; i < totalSamples; i++) {
		const time = i * sampleInterval;
		try {
			const faces = await detectFaces({ videoElement, time });
			frames.push({ time, faces });
		} catch {
			// Skip frames that fail detection
			frames.push({ time, faces: [] });
		}
		onProgress?.((i + 1) / totalSamples);
	}

	return frames;
}

/** Helper: seek a video element to a specific time and wait */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
	return new Promise((resolve, reject) => {
		if (Math.abs(video.currentTime - time) < 0.01) {
			resolve();
			return;
		}

		const onSeeked = () => {
			video.removeEventListener("seeked", onSeeked);
			video.removeEventListener("error", onError);
			resolve();
		};
		const onError = () => {
			video.removeEventListener("seeked", onSeeked);
			video.removeEventListener("error", onError);
			reject(new Error(`Failed to seek video to ${time}s`));
		};

		video.addEventListener("seeked", onSeeked);
		video.addEventListener("error", onError);
		video.currentTime = time;
	});
}

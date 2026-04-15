/**
 * Rolling FPS probe using requestVideoFrameCallback. Attaches to a live
 * <video> element and logs frame-presentation intervals. Used to measure
 * playback pacing — target is <35ms inter-frame delta at 30fps sources.
 *
 * Not available in Firefox; falls back to no-op if unsupported.
 */

import { isPerfEnabled, perfLog } from "./perf-marks";

const ROLLING_WINDOW = 30; // last N frames

export function attachRvfcProbe(video: HTMLVideoElement, label: string): () => void {
	if (!isPerfEnabled()) return () => {};
	if (typeof video.requestVideoFrameCallback !== "function") return () => {};

	let lastPresentation: number | null = null;
	const deltas: number[] = [];
	let handle = 0;
	let cancelled = false;

	const tick: VideoFrameRequestCallback = (_now, metadata) => {
		if (cancelled) return;
		if (lastPresentation !== null) {
			const delta = metadata.presentationTime - lastPresentation;
			deltas.push(delta);
			if (deltas.length > ROLLING_WINDOW) deltas.shift();
			if (deltas.length === ROLLING_WINDOW) {
				const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
				const fps = 1000 / avg;
				perfLog(`${label} rVFC fps`, fps, "");
				perfLog(`${label} rVFC delta`, avg, "ms");
			}
		}
		lastPresentation = metadata.presentationTime;
		handle = video.requestVideoFrameCallback(tick);
	};

	handle = video.requestVideoFrameCallback(tick);

	return () => {
		cancelled = true;
		if (handle) {
			video.cancelVideoFrameCallback(handle);
		}
	};
}

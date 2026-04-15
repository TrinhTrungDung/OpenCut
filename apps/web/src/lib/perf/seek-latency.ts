/**
 * Measures scrub-to-frame latency: time between user pointer input on the
 * timeline and the resulting `video-seeked` event on the preview <video>.
 *
 * Today this is our worst perceived-perf signal: with default GOP=250 proxies,
 * backward scrubs can take 200-500ms. Baseline before intra-only proxies ship.
 */

import { isPerfEnabled, perfLog } from "./perf-marks";

const START_MARK = "scrub:start";
let seekedHandler: ((e: Event) => void) | null = null;
let pending = false;
let startTime = 0;

/** Call on pointerdown/pointermove when initiating a scrub seek. */
export function markScrubStart(): void {
	if (!isPerfEnabled()) return;
	pending = true;
	startTime = performance.now();
	try {
		performance.mark(START_MARK);
	} catch {}
}

/**
 * Begin listening for the matching `video-seeked` window event dispatched by
 * video-element-pool.ts. Safe to call multiple times — idempotent.
 */
export function attachSeekLatencyProbe(): void {
	if (!isPerfEnabled()) return;
	if (seekedHandler) return;
	seekedHandler = () => {
		if (!pending) return;
		const duration = performance.now() - startTime;
		pending = false;
		perfLog("scrub-to-frame", duration, "ms");
	};
	window.addEventListener("video-seeked", seekedHandler);
}

export function detachSeekLatencyProbe(): void {
	if (seekedHandler) {
		window.removeEventListener("video-seeked", seekedHandler);
		seekedHandler = null;
	}
	pending = false;
}

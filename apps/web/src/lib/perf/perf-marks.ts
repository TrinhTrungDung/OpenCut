/**
 * Thin wrapper over the User Timing API (performance.mark / performance.measure).
 * All perf instrumentation no-ops in production builds unless
 * `NEXT_PUBLIC_ENABLE_PERF=1` is set. In dev, also gated by `?perf=1` query flag
 * so local sessions aren't spammed unless explicitly requested.
 */

const IS_PROD = process.env.NODE_ENV === "production";
const ENV_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PERF === "1";

let cachedEnabled: boolean | null = null;

export function isPerfEnabled(): boolean {
	if (cachedEnabled !== null) return cachedEnabled;
	if (typeof window === "undefined") {
		cachedEnabled = false;
		return false;
	}
	if (IS_PROD) {
		cachedEnabled = ENV_ENABLED;
		return cachedEnabled;
	}
	const qs = new URLSearchParams(window.location.search);
	cachedEnabled = ENV_ENABLED || qs.get("perf") === "1";
	return cachedEnabled;
}

export function perfMark(name: string): void {
	if (!isPerfEnabled()) return;
	try {
		performance.mark(name);
	} catch {
		// marks silently drop if the buffer fills — acceptable
	}
}

export function perfMeasure(
	name: string,
	startMark: string,
	endMark?: string,
): number | null {
	if (!isPerfEnabled()) return null;
	try {
		const measure = performance.measure(name, startMark, endMark);
		return measure.duration;
	} catch {
		return null;
	}
}

export function perfClear(nameOrPrefix?: string): void {
	if (!isPerfEnabled()) return;
	if (nameOrPrefix) {
		performance.clearMarks(nameOrPrefix);
		performance.clearMeasures(nameOrPrefix);
	} else {
		performance.clearMarks();
		performance.clearMeasures();
	}
}

/** Log a labelled numeric sample (ms, MB/s, fps…) to console in dev-friendly format. */
export function perfLog(label: string, value: number, unit: string): void {
	if (!isPerfEnabled()) return;
	// biome-ignore lint/suspicious/noConsole: dev-only instrumentation
	console.log(`[perf] ${label}: ${value.toFixed(2)}${unit}`);
}

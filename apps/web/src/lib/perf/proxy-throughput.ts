/**
 * Measures proxy generation throughput (MB/s = file bytes / wall-clock seconds).
 * Baseline for comparing single-thread FFmpeg vs future Worker core-mt.
 */

import { isPerfEnabled, perfLog } from "./perf-marks";

export interface ProxyThroughputSample {
	filename: string;
	sourceBytes: number;
	durationMs: number;
	mbPerSec: number;
}

/**
 * Wrap an async proxy-generation operation and log throughput.
 * Returns the operation's result unchanged.
 */
export async function measureProxyThroughput<T>(
	file: File,
	operation: () => Promise<T>,
): Promise<T> {
	if (!isPerfEnabled()) return operation();
	const start = performance.now();
	try {
		const result = await operation();
		const duration = performance.now() - start;
		const mb = file.size / (1024 * 1024);
		const mbPerSec = mb / (duration / 1000);
		perfLog(`proxy ${file.name}`, mbPerSec, " MB/s");
		return result;
	} catch (err) {
		const duration = performance.now() - start;
		perfLog(`proxy ${file.name} (failed)`, duration, "ms");
		throw err;
	}
}

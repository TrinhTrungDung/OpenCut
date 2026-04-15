/**
 * Performance instrumentation — baseline metrics for the perf roadmap.
 * All probes no-op unless `NEXT_PUBLIC_ENABLE_PERF=1` or `?perf=1` query is set.
 */

export { isPerfEnabled, perfMark, perfMeasure, perfClear, perfLog } from "./perf-marks";
export { markScrubStart, attachSeekLatencyProbe, detachSeekLatencyProbe } from "./seek-latency";
export { attachRvfcProbe } from "./rvfc-fps";
export { measureProxyThroughput, type ProxyThroughputSample } from "./proxy-throughput";

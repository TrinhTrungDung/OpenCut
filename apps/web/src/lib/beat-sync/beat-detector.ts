/**
 * Pure math beat detection on raw audio samples.
 *
 * Algorithm overview:
 * 1. Compute energy envelope via windowed RMS (root-mean-square).
 * 2. Normalize the envelope to [0, 1].
 * 3. Apply an adaptive threshold (local average energy * sensitivity).
 * 4. Pick peaks above threshold with a minimum inter-peak gap derived from maxBpm.
 * 5. Estimate BPM from the median inter-peak interval.
 * 6. Score confidence from how consistent the intervals are.
 *
 * No external packages -- pure Float32Array math.
 */

import type {
	BeatDetectionOptions,
	BeatDetectionResult,
	BeatMarker,
} from "@/types/beat-sync";

/** Number of samples per RMS window (~23 ms at 44.1 kHz). */
const RMS_WINDOW_SIZE = 1024;

/** Number of windows to average for the adaptive threshold. */
const ADAPTIVE_WINDOW_HALF = 16;

/**
 * Detect beats in mono audio sample data.
 *
 * @param samples  - Mono Float32Array from decodeAudioToFloat32
 * @param sampleRate - Sample rate of the audio
 * @param options  - Optional tuning knobs
 * @returns BeatDetectionResult with bpm, beat markers, and confidence
 */
export function detectBeats({
	samples,
	sampleRate,
	options = {},
}: {
	samples: Float32Array;
	sampleRate: number;
	options?: BeatDetectionOptions;
}): BeatDetectionResult {
	const minBpm = options.minBpm ?? 60;
	const maxBpm = options.maxBpm ?? 200;
	const sensitivity = Math.max(0, Math.min(1, options.sensitivity ?? 0.5));

	// --- Step 1: Compute energy envelope via windowed RMS ---
	const hopSize = RMS_WINDOW_SIZE;
	const numFrames = Math.floor(samples.length / hopSize);

	if (numFrames < 2) {
		return { bpm: 0, beats: [], confidence: 0 };
	}

	const envelope = new Float32Array(numFrames);
	for (let i = 0; i < numFrames; i++) {
		const offset = i * hopSize;
		let sumSq = 0;
		const end = Math.min(offset + RMS_WINDOW_SIZE, samples.length);
		for (let j = offset; j < end; j++) {
			sumSq += samples[j] * samples[j];
		}
		envelope[i] = Math.sqrt(sumSq / (end - offset));
	}

	// --- Step 2: Normalize envelope to [0, 1] ---
	let maxEnergy = 0;
	for (let i = 0; i < numFrames; i++) {
		if (envelope[i] > maxEnergy) maxEnergy = envelope[i];
	}

	if (maxEnergy > 0) {
		for (let i = 0; i < numFrames; i++) {
			envelope[i] /= maxEnergy;
		}
	}

	// --- Step 3: Adaptive threshold ---
	// For each frame, threshold = localAverage * sensitivityMultiplier.
	// Higher sensitivity => lower multiplier => more beats detected.
	const sensitivityMultiplier = 1.0 + (1.0 - sensitivity) * 1.5; // range [1.0, 2.5]
	const threshold = new Float32Array(numFrames);
	for (let i = 0; i < numFrames; i++) {
		const lo = Math.max(0, i - ADAPTIVE_WINDOW_HALF);
		const hi = Math.min(numFrames, i + ADAPTIVE_WINDOW_HALF + 1);
		let sum = 0;
		for (let j = lo; j < hi; j++) {
			sum += envelope[j];
		}
		threshold[i] = (sum / (hi - lo)) * sensitivityMultiplier;
	}

	// --- Step 4: Peak picking with minimum inter-peak distance ---
	// Minimum gap between beats derived from maxBpm.
	const secondsPerFrame = hopSize / sampleRate;
	const minGapSeconds = 60 / maxBpm;
	const minGapFrames = Math.max(1, Math.floor(minGapSeconds / secondsPerFrame));

	const beats: BeatMarker[] = [];
	let lastBeatFrame = -minGapFrames; // allow first beat at frame 0

	for (let i = 1; i < numFrames - 1; i++) {
		const isAboveThreshold = envelope[i] > threshold[i];
		const isLocalPeak =
			envelope[i] > envelope[i - 1] && envelope[i] >= envelope[i + 1];
		const isFarEnough = i - lastBeatFrame >= minGapFrames;

		if (isAboveThreshold && isLocalPeak && isFarEnough) {
			beats.push({
				time: i * secondsPerFrame,
				strength: envelope[i],
			});
			lastBeatFrame = i;
		}
	}

	if (beats.length < 2) {
		return { bpm: 0, beats, confidence: 0 };
	}

	// --- Step 5: Estimate BPM from median inter-beat interval ---
	const intervals: number[] = [];
	for (let i = 1; i < beats.length; i++) {
		const interval = beats[i].time - beats[i - 1].time;
		// Only consider intervals within the plausible BPM range
		const bpmFromInterval = 60 / interval;
		if (bpmFromInterval >= minBpm && bpmFromInterval <= maxBpm) {
			intervals.push(interval);
		}
	}

	if (intervals.length === 0) {
		return { bpm: 0, beats, confidence: 0 };
	}

	intervals.sort((a, b) => a - b);
	const medianInterval = intervals[Math.floor(intervals.length / 2)];
	const bpm = Math.round(60 / medianInterval);

	// --- Step 6: Confidence from interval consistency ---
	// Measured as 1 - (standard deviation / mean) of the intervals.
	const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
	const variance =
		intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
	const stdDev = Math.sqrt(variance);
	const cv = mean > 0 ? stdDev / mean : 1; // coefficient of variation
	const confidence = Math.max(0, Math.min(1, 1 - cv));

	return { bpm, beats, confidence };
}

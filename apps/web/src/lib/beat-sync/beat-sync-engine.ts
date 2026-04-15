/**
 * Higher-level engine that orchestrates beat detection and bookmark generation.
 *
 * - Decodes an audio Blob to mono Float32Array via existing utility.
 * - Runs the pure-math beat detector.
 * - Converts beat markers into timeline Bookmark objects.
 */

import type { BeatDetectionOptions, BeatDetectionResult, BeatMarker } from "@/types/beat-sync";
import type { Bookmark } from "@/types/timeline";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { detectBeats } from "./beat-detector";

/** Default color for beat bookmarks (warm orange). */
const BEAT_BOOKMARK_COLOR = "#ff6b35";

/** Visual duration of a beat bookmark on the timeline (seconds). */
const BEAT_BOOKMARK_DURATION = 0.05;

/**
 * Decode an audio blob and run beat detection.
 *
 * @param audioBlob - Raw audio file (any format the browser can decode)
 * @param options   - BPM range and sensitivity knobs
 * @returns Full beat detection result (bpm, beats, confidence)
 */
export async function analyzeBeatSync({
	audioBlob,
	options,
}: {
	audioBlob: Blob;
	options?: BeatDetectionOptions;
}): Promise<BeatDetectionResult> {
	const { samples, sampleRate } = await decodeAudioToFloat32({ audioBlob });
	return detectBeats({ samples, sampleRate, options });
}

/**
 * Convert an array of BeatMarker positions into timeline Bookmark objects
 * suitable for display on the timeline ruler.
 *
 * @param beats - Beat markers from detection result
 * @returns Bookmark array ready for scene.bookmarks
 */
export function generateBeatMarkers({
	beats,
}: {
	beats: BeatMarker[];
}): Bookmark[] {
	return beats.map((beat) => ({
		time: beat.time,
		note: "Beat",
		color: BEAT_BOOKMARK_COLOR,
		duration: BEAT_BOOKMARK_DURATION,
	}));
}

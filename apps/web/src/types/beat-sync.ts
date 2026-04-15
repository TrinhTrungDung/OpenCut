/** Beat detection and sync types for auto-editing to music */

export interface BeatMarker {
	/** Time position in seconds */
	time: number;
	/** Beat strength (0-1), higher = stronger beat */
	strength: number;
}

export interface BeatDetectionResult {
	/** Detected BPM */
	bpm: number;
	/** Individual beat positions */
	beats: BeatMarker[];
	/** Detection confidence (0-1) */
	confidence: number;
}

export interface BeatDetectionOptions {
	/** Minimum BPM to detect (default: 60) */
	minBpm?: number;
	/** Maximum BPM to detect (default: 200) */
	maxBpm?: number;
	/** Peak detection sensitivity 0-1 (default: 0.5) */
	sensitivity?: number;
}

export interface BeatSyncOptions {
	/** Whether to auto-split clips at beat positions */
	splitAtBeats: boolean;
	/** Whether to auto-apply transitions at beat positions */
	applyTransitions: boolean;
	/** Transition type to apply */
	transitionType?: string;
}

export type BeatSyncStatus = "idle" | "analyzing" | "ready" | "error";

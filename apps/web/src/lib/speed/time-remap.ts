/**
 * Core time remapping functions for speed-adjusted playback.
 * Handles both constant speed and speed-curve-based remapping.
 */

import type { SpeedCurvePoint } from "@/types/speed";
import { DEFAULT_SPEED, MIN_SPEED, MAX_SPEED } from "@/types/speed";
import { SpeedCurveLUT } from "./speed-curve-lut";

/** Cache LUTs by element ID to avoid recomputation each frame */
const lutCache = new Map<
	string,
	{ curve: SpeedCurvePoint[]; lut: SpeedCurveLUT }
>();

/** Get or create a cached LUT for the given element and curve */
function getLUT(elementId: string, curve: SpeedCurvePoint[]): SpeedCurveLUT {
	const cached = lutCache.get(elementId);
	if (cached && cached.curve === curve) return cached.lut;

	const lut = new SpeedCurveLUT(curve);
	lutCache.set(elementId, { curve, lut });
	return lut;
}

/** Clear cached LUT for an element (call when curve changes) */
export function invalidateSpeedCache(elementId: string): void {
	lutCache.delete(elementId);
}

/** Clamp speed to valid range */
function clampSpeed(speed: number): number {
	return Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
}

interface ResolveSourceTimeParams {
	/** Time elapsed since element start on timeline */
	timelineLocalTime: number;
	/** Trim offset from source start */
	trimStart: number;
	/** Total source media duration */
	sourceDuration: number;
	/** Constant speed multiplier */
	speed?: number;
	/** Speed curve points (overrides constant speed) */
	speedCurve?: SpeedCurvePoint[];
	/** Element ID for LUT caching */
	elementId?: string;
}

/**
 * Resolve the source media time for a given timeline-local time,
 * accounting for speed adjustments and speed curves.
 */
export function resolveSourceTime({
	timelineLocalTime,
	trimStart,
	sourceDuration,
	speed,
	speedCurve,
	elementId,
}: ResolveSourceTimeParams): number {
	// Speed curve takes precedence over constant speed
	if (speedCurve && speedCurve.length > 0 && elementId) {
		const lut = getLUT(elementId, speedCurve);
		const displayDuration = sourceDuration / lut.averageSpeed();
		const normalizedPos =
			displayDuration > 0 ? timelineLocalTime / displayDuration : 0;
		const sourceFraction = lut.getSourceFraction(normalizedPos);
		return trimStart + sourceFraction * sourceDuration;
	}

	// Constant speed
	const effectiveSpeed = clampSpeed(speed ?? DEFAULT_SPEED);
	return trimStart + timelineLocalTime * effectiveSpeed;
}

interface ComputeDisplayDurationParams {
	/** Total source media duration */
	sourceDuration: number;
	/** Trim from start */
	trimStart: number;
	/** Trim from end */
	trimEnd: number;
	/** Constant speed multiplier */
	speed?: number;
	/** Speed curve points */
	speedCurve?: SpeedCurvePoint[];
	/** Element ID for LUT caching */
	elementId?: string;
}

/**
 * Compute how long an element appears on the timeline after speed adjustments.
 * Trimmed source duration divided by effective speed.
 */
export function computeDisplayDuration({
	sourceDuration,
	trimStart,
	trimEnd,
	speed,
	speedCurve,
	elementId,
}: ComputeDisplayDurationParams): number {
	const trimmedDuration = sourceDuration - trimStart - trimEnd;
	if (trimmedDuration <= 0) return 0;

	if (speedCurve && speedCurve.length > 0 && elementId) {
		const lut = getLUT(elementId, speedCurve);
		return trimmedDuration / lut.averageSpeed();
	}

	const effectiveSpeed = clampSpeed(speed ?? DEFAULT_SPEED);
	return trimmedDuration / effectiveSpeed;
}

/** Get the effective speed for an element, clamped to valid range */
export function getEffectiveSpeed(element: { speed?: number }): number {
	return clampSpeed(element.speed ?? DEFAULT_SPEED);
}

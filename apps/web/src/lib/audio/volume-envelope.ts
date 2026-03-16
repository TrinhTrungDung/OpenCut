import type { NumberKeyframe } from "@/types/animation";
import { generateUUID } from "@/utils/id";

export type FadePreset = "linear" | "exponential" | "logarithmic" | "s-curve";

export const DEFAULT_FADE_DURATION = 0.5;

export const FADE_PRESETS: { value: FadePreset; label: string }[] = [
	{ value: "linear", label: "Linear" },
	{ value: "exponential", label: "Exponential" },
	{ value: "logarithmic", label: "Logarithmic" },
	{ value: "s-curve", label: "S-Curve" },
];

function kf(time: number, value: number): NumberKeyframe {
	return {
		id: generateUUID(),
		time,
		value,
		interpolation: "linear",
	};
}

/**
 * Generate keyframes for a fade-in effect (0 -> 1) over the given duration.
 */
export function generateFadeInKeyframes({
	duration,
	preset,
}: {
	duration: number;
	preset: FadePreset;
}): NumberKeyframe[] {
	switch (preset) {
		case "linear":
			return [kf(0, 0), kf(duration, 1)];

		case "exponential":
			// Slow start, fast end
			return [
				kf(0, 0),
				kf(duration * 0.33, 0.05),
				kf(duration * 0.66, 0.3),
				kf(duration, 1),
			];

		case "logarithmic":
			// Fast start, slow end
			return [
				kf(0, 0),
				kf(duration * 0.33, 0.7),
				kf(duration * 0.66, 0.95),
				kf(duration, 1),
			];

		case "s-curve":
			// Slow-fast-slow
			return [
				kf(0, 0),
				kf(duration * 0.25, 0.05),
				kf(duration * 0.5, 0.5),
				kf(duration * 0.75, 0.95),
				kf(duration, 1),
			];
	}
}

/**
 * Generate keyframes for a fade-out effect (1 -> 0) at the end of an element.
 */
export function generateFadeOutKeyframes({
	elementDuration,
	fadeDuration,
	preset,
}: {
	elementDuration: number;
	fadeDuration: number;
	preset: FadePreset;
}): NumberKeyframe[] {
	const fadeStart = elementDuration - fadeDuration;

	switch (preset) {
		case "linear":
			return [kf(fadeStart, 1), kf(elementDuration, 0)];

		case "exponential":
			// Slow start, fast end
			return [
				kf(fadeStart, 1),
				kf(fadeStart + fadeDuration * 0.33, 0.95),
				kf(fadeStart + fadeDuration * 0.66, 0.7),
				kf(elementDuration, 0),
			];

		case "logarithmic":
			// Fast start, slow end
			return [
				kf(fadeStart, 1),
				kf(fadeStart + fadeDuration * 0.33, 0.3),
				kf(fadeStart + fadeDuration * 0.66, 0.05),
				kf(elementDuration, 0),
			];

		case "s-curve":
			// Slow-fast-slow
			return [
				kf(fadeStart, 1),
				kf(fadeStart + fadeDuration * 0.25, 0.95),
				kf(fadeStart + fadeDuration * 0.5, 0.5),
				kf(fadeStart + fadeDuration * 0.75, 0.05),
				kf(elementDuration, 0),
			];
	}
}

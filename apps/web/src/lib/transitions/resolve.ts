import type { TransitionInstance } from "@/types/transitions";
import { DEFAULT_TRANSITION_EASING } from "@/types/transitions";
import { applyTransitionEasing } from "./easing";

/**
 * Computes the transition progress (0..1) for a given time.
 * Returns null if `time` is outside the transition window.
 *
 * The transition window spans from (elementAEnd - duration) to elementAEnd,
 * where elementAEnd = startTime + duration of the outgoing clip.
 *
 * Easing is applied to the raw linear progress before returning.
 */
export function resolveTransitionProgress({
	transition,
	elementAEnd,
	time,
}: {
	transition: TransitionInstance;
	elementAEnd: number;
	time: number;
}): number | null {
	const transitionStart = elementAEnd - transition.duration;
	const transitionEnd = elementAEnd;

	if (time < transitionStart || time > transitionEnd) {
		return null;
	}

	if (transition.duration <= 0) {
		return null;
	}

	const rawProgress = (time - transitionStart) / transition.duration;
	const easing = transition.easing ?? DEFAULT_TRANSITION_EASING;

	return applyTransitionEasing({ progress: rawProgress, easing });
}

/**
 * Finds the active transition at a given time and computes its progress.
 * Returns the first matching transition with its eased progress, or null.
 */
export function findActiveTransition({
	transitions,
	elements,
	time,
}: {
	transitions: TransitionInstance[];
	elements: Array<{ id: string; startTime: number; duration: number }>;
	time: number;
}): { transition: TransitionInstance; progress: number } | null {
	for (const transition of transitions) {
		const elementA = elements.find((e) => e.id === transition.elementAId);
		if (!elementA) continue;

		const elementAEnd = elementA.startTime + elementA.duration;
		const progress = resolveTransitionProgress({
			transition,
			elementAEnd,
			time,
		});

		if (progress !== null) {
			return { transition, progress };
		}
	}

	return null;
}

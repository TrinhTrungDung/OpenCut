import type { TransitionInstance } from "@/types/transitions";

/**
 * Computes the transition progress (0..1) for a given time.
 * Returns null if `time` is outside the transition window.
 *
 * The transition window spans from (elementAEnd - duration) to elementAEnd,
 * where elementAEnd = startTime + duration of the outgoing clip.
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

	return (time - transitionStart) / transition.duration;
}

/**
 * Finds the active transition at a given time and computes its progress.
 * Returns the first matching transition with its progress, or null.
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

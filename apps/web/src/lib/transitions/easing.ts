import type { TransitionEasing } from "@/types/transitions";

/**
 * Apply an easing curve to a linear progress value (0..1).
 * Easing is applied on the CPU before passing to the GLSL shader,
 * so shaders stay simple and easing can be changed without recompilation.
 */
export function applyTransitionEasing({
	progress,
	easing,
}: {
	progress: number;
	easing: TransitionEasing;
}): number {
	switch (easing) {
		case "linear":
			return progress;
		case "ease-in":
			return progress * progress;
		case "ease-out":
			return progress * (2 - progress);
		case "ease-in-out":
			return progress < 0.5
				? 2 * progress * progress
				: -1 + (4 - 2 * progress) * progress;
	}
}

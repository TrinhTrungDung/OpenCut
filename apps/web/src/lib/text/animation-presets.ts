import type { ElementAnimations, NumberKeyframe, NumberAnimationChannel } from "@/types/animation";
import { generateUUID } from "@/utils/id";

/**
 * Text animation presets for entrance, exit, and loop animations.
 *
 * Each preset is a function that returns an ElementAnimations object
 * with unique keyframe IDs (safe for multiple applications).
 *
 * Entrance animations start at time 0 and animate to final state.
 * Exit animations animate from current state to hidden at element end.
 * Loop animations repeat continuously while element is visible.
 */

export type AnimationPresetType = "entrance" | "exit" | "loop";

export interface AnimationPreset {
	id: string;
	name: string;
	type: AnimationPresetType;
	/** Build the animation channels for this preset */
	build: ({ duration }: { duration: number }) => ElementAnimations;
}

/* ─── Entrance Presets ───────────────────────────────────── */

const entranceFadeIn: AnimationPreset = {
	id: "entrance-fade-in",
	name: "Fade In",
	type: "entrance",
	build: () => ({
		channels: {
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.5, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

const entranceSlideUp: AnimationPreset = {
	id: "entrance-slide-up",
	name: "Slide Up",
	type: "entrance",
	build: () => ({
		channels: {
			"transform.position.y": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 60, interpolation: "linear" },
					{ id: generateUUID(), time: 0.4, value: 0, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.3, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

const entranceSlideDown: AnimationPreset = {
	id: "entrance-slide-down",
	name: "Slide Down",
	type: "entrance",
	build: () => ({
		channels: {
			"transform.position.y": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: -60, interpolation: "linear" },
					{ id: generateUUID(), time: 0.4, value: 0, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.3, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

const entranceSlideLeft: AnimationPreset = {
	id: "entrance-slide-left",
	name: "Slide Left",
	type: "entrance",
	build: () => ({
		channels: {
			"transform.position.x": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: -80, interpolation: "linear" },
					{ id: generateUUID(), time: 0.4, value: 0, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.3, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

const entranceSlideRight: AnimationPreset = {
	id: "entrance-slide-right",
	name: "Slide Right",
	type: "entrance",
	build: () => ({
		channels: {
			"transform.position.x": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 80, interpolation: "linear" },
					{ id: generateUUID(), time: 0.4, value: 0, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.3, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

const entranceScaleBounce: AnimationPreset = {
	id: "entrance-scale-bounce",
	name: "Scale Bounce",
	type: "entrance",
	build: () => ({
		channels: {
			"transform.scale": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.2, value: 1.15, interpolation: "linear" },
					{ id: generateUUID(), time: 0.35, value: 1, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.15, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

const entranceZoomIn: AnimationPreset = {
	id: "entrance-zoom-in",
	name: "Zoom In",
	type: "entrance",
	build: () => ({
		channels: {
			"transform.scale": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0.3, interpolation: "linear" },
					{ id: generateUUID(), time: 0.4, value: 1, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.3, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

const entranceRotateIn: AnimationPreset = {
	id: "entrance-rotate-in",
	name: "Rotate In",
	type: "entrance",
	build: () => ({
		channels: {
			"transform.rotate": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: -90, interpolation: "linear" },
					{ id: generateUUID(), time: 0.5, value: 0, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: 0, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: 0.3, value: 1, interpolation: "linear" },
				],
			},
		},
	}),
};

/* ─── Exit Presets ───────────────────────────────────────── */

const exitFadeOut: AnimationPreset = {
	id: "exit-fade-out",
	name: "Fade Out",
	type: "exit",
	build: ({ duration }) => ({
		channels: {
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.5, value: 1, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 0, interpolation: "linear" },
				],
			},
		},
	}),
};

const exitSlideUp: AnimationPreset = {
	id: "exit-slide-up",
	name: "Slide Up",
	type: "exit",
	build: ({ duration }) => ({
		channels: {
			"transform.position.y": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.4, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: -60, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.3, value: 1, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 0, interpolation: "linear" },
				],
			},
		},
	}),
};

const exitSlideDown: AnimationPreset = {
	id: "exit-slide-down",
	name: "Slide Down",
	type: "exit",
	build: ({ duration }) => ({
		channels: {
			"transform.position.y": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.4, value: 0, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 60, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.3, value: 1, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 0, interpolation: "linear" },
				],
			},
		},
	}),
};

const exitScaleOut: AnimationPreset = {
	id: "exit-scale-out",
	name: "Scale Out",
	type: "exit",
	build: ({ duration }) => ({
		channels: {
			"transform.scale": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.35, value: 1, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 0, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.3, value: 1, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 0, interpolation: "linear" },
				],
			},
		},
	}),
};

const exitZoomOut: AnimationPreset = {
	id: "exit-zoom-out",
	name: "Zoom Out",
	type: "exit",
	build: ({ duration }) => ({
		channels: {
			"transform.scale": {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.4, value: 1, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 2, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: generateUUID(), time: duration - 0.3, value: 1, interpolation: "linear" },
					{ id: generateUUID(), time: duration, value: 0, interpolation: "linear" },
				],
			},
		},
	}),
};

/* ─── Loop Presets ───────────────────────────────────────── */

const loopPulse: AnimationPreset = {
	id: "loop-pulse",
	name: "Pulse",
	type: "loop",
	build: ({ duration }) => {
		/* Create repeating scale pulse keyframes across the duration */
		const interval = 1.0; // seconds per pulse
		const keyframes: NumberKeyframe[] = [];
		for (let t = 0; t <= duration; t += interval / 2) {
			const isExpanded = Math.round(t / (interval / 2)) % 2 === 0;
			keyframes.push({
				id: generateUUID(),
				time: Math.min(t, duration),
				value: isExpanded ? 1 : 1.05,
				interpolation: "linear",
			});
		}
		return {
			channels: {
				"transform.scale": { valueKind: "number", keyframes } as NumberAnimationChannel,
			},
		};
	},
};

const loopFloat: AnimationPreset = {
	id: "loop-float",
	name: "Float",
	type: "loop",
	build: ({ duration }) => {
		const interval = 1.5;
		const keyframes: NumberKeyframe[] = [];
		for (let t = 0; t <= duration; t += interval / 2) {
			const isUp = Math.round(t / (interval / 2)) % 2 === 0;
			keyframes.push({
				id: generateUUID(),
				time: Math.min(t, duration),
				value: isUp ? 0 : -8,
				interpolation: "linear",
			});
		}
		return {
			channels: {
				"transform.position.y": { valueKind: "number", keyframes } as NumberAnimationChannel,
			},
		};
	},
};

/* ─── Exports ────────────────────────────────────────────── */

export const ENTRANCE_PRESETS: AnimationPreset[] = [
	entranceFadeIn,
	entranceSlideUp,
	entranceSlideDown,
	entranceSlideLeft,
	entranceSlideRight,
	entranceScaleBounce,
	entranceZoomIn,
	entranceRotateIn,
];

export const EXIT_PRESETS: AnimationPreset[] = [
	exitFadeOut,
	exitSlideUp,
	exitSlideDown,
	exitScaleOut,
	exitZoomOut,
];

export const LOOP_PRESETS: AnimationPreset[] = [
	loopPulse,
	loopFloat,
];

export const ALL_ANIMATION_PRESETS: AnimationPreset[] = [
	...ENTRANCE_PRESETS,
	...EXIT_PRESETS,
	...LOOP_PRESETS,
];

/**
 * Merge entrance and exit animations into a single ElementAnimations object.
 * If both have keyframes for the same channel (e.g. opacity), they are combined.
 */
export function mergeAnimationPresets({
	entrance,
	exit,
	loop,
	duration,
}: {
	entrance: AnimationPreset | null;
	exit: AnimationPreset | null;
	loop: AnimationPreset | null;
	duration: number;
}): ElementAnimations | undefined {
	const parts = [entrance, exit, loop]
		.filter((p): p is AnimationPreset => p !== null)
		.map((preset) => preset.build({ duration }));

	if (parts.length === 0) return undefined;

	type MergedChannel = {
		valueKind: string;
		keyframes: Array<{ id: string; time: number; value: number; interpolation: string }>;
	};
	const merged: Record<string, MergedChannel> = {};

	for (const part of parts) {
		for (const [path, channel] of Object.entries(part.channels)) {
			if (!channel) continue;
			const ch = channel as NumberAnimationChannel;
			if (!merged[path]) {
				merged[path] = {
					valueKind: ch.valueKind,
					keyframes: ch.keyframes.map((kf) => ({ ...kf })),
				};
			} else {
				for (const kf of ch.keyframes) {
					merged[path].keyframes.push({ ...kf });
				}
			}
		}
	}

	/* Sort keyframes by time within each channel */
	for (const channel of Object.values(merged)) {
		channel.keyframes.sort((a, b) => a.time - b.time);
	}

	return { channels: merged } as unknown as ElementAnimations;
}

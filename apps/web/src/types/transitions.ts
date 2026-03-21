export type TransitionType =
	| "fade"
	| "dissolve"
	| "wipe-left"
	| "wipe-right"
	| "wipe-up"
	| "wipe-down"
	| "zoom-in"
	| "zoom-out"
	| "slide-left"
	| "slide-right"
	| "blur"
	| "dip-to-black"
	| "dip-to-white"
	| "circle-open"
	| "glitch";

export type TransitionEasing =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out";

/** Instance of a transition between two clips on a video track */
export interface TransitionInstance {
	id: string;
	type: TransitionType;
	/** Duration in seconds */
	duration: number;
	/** Outgoing clip element ID */
	elementAId: string;
	/** Incoming clip element ID */
	elementBId: string;
	/** Easing curve applied to progress (default: "ease-in-out") */
	easing?: TransitionEasing;
}

/** Definition of a transition type with its GLSL shader */
export interface TransitionDefinition {
	type: TransitionType;
	name: string;
	keywords: string[];
	/** Default duration in seconds */
	defaultDuration: number;
	/** gl-transitions compatible GLSL fragment shader body */
	fragmentShader: string;
}

export const DEFAULT_TRANSITION_DURATION = 0.5;
export const DEFAULT_TRANSITION_EASING: TransitionEasing = "ease-in-out";

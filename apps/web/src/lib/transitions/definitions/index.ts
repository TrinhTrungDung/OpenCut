import type { TransitionDefinition, TransitionType } from "@/types/transitions";
import { hasTransition, registerTransition } from "../registry";
import { wrapTransitionShader } from "../shader-wrapper";

import fadeGlsl from "./fade.frag.glsl";
import dissolveGlsl from "./dissolve.frag.glsl";
import wipeLeftGlsl from "./wipe-left.frag.glsl";
import wipeRightGlsl from "./wipe-right.frag.glsl";
import wipeUpGlsl from "./wipe-up.frag.glsl";
import wipeDownGlsl from "./wipe-down.frag.glsl";
import zoomInGlsl from "./zoom-in.frag.glsl";
import zoomOutGlsl from "./zoom-out.frag.glsl";
import slideLeftGlsl from "./slide-left.frag.glsl";
import slideRightGlsl from "./slide-right.frag.glsl";
import blurTransitionGlsl from "./blur-transition.frag.glsl";
import dipToBlackGlsl from "./dip-to-black.frag.glsl";
import dipToWhiteGlsl from "./dip-to-white.frag.glsl";
import circleOpenGlsl from "./circle-open.frag.glsl";
import glitchGlsl from "./glitch.frag.glsl";

interface RawTransition {
	type: TransitionType;
	name: string;
	keywords: string[];
	defaultDuration: number;
	glsl: string;
}

const RAW_TRANSITIONS: RawTransition[] = [
	{
		type: "fade",
		name: "Fade",
		keywords: ["fade", "crossfade", "opacity"],
		defaultDuration: 0.5,
		glsl: fadeGlsl,
	},
	{
		type: "dissolve",
		name: "Dissolve",
		keywords: ["dissolve", "noise", "random", "organic"],
		defaultDuration: 0.5,
		glsl: dissolveGlsl,
	},
	{
		type: "wipe-left",
		name: "Wipe Left",
		keywords: ["wipe", "left", "horizontal"],
		defaultDuration: 0.5,
		glsl: wipeLeftGlsl,
	},
	{
		type: "wipe-right",
		name: "Wipe Right",
		keywords: ["wipe", "right", "horizontal"],
		defaultDuration: 0.5,
		glsl: wipeRightGlsl,
	},
	{
		type: "wipe-up",
		name: "Wipe Up",
		keywords: ["wipe", "up", "vertical"],
		defaultDuration: 0.5,
		glsl: wipeUpGlsl,
	},
	{
		type: "wipe-down",
		name: "Wipe Down",
		keywords: ["wipe", "down", "vertical"],
		defaultDuration: 0.5,
		glsl: wipeDownGlsl,
	},
	{
		type: "zoom-in",
		name: "Zoom In",
		keywords: ["zoom", "in", "scale", "crosswarp"],
		defaultDuration: 0.5,
		glsl: zoomInGlsl,
	},
	{
		type: "zoom-out",
		name: "Zoom Out",
		keywords: ["zoom", "out", "scale", "crosswarp"],
		defaultDuration: 0.5,
		glsl: zoomOutGlsl,
	},
	{
		type: "slide-left",
		name: "Slide Left",
		keywords: ["slide", "left", "push"],
		defaultDuration: 0.5,
		glsl: slideLeftGlsl,
	},
	{
		type: "slide-right",
		name: "Slide Right",
		keywords: ["slide", "right", "push"],
		defaultDuration: 0.5,
		glsl: slideRightGlsl,
	},
	{
		type: "blur",
		name: "Blur",
		keywords: ["blur", "soft", "focus"],
		defaultDuration: 0.5,
		glsl: blurTransitionGlsl,
	},
	{
		type: "dip-to-black",
		name: "Dip to Black",
		keywords: ["dip", "black", "dark", "fade"],
		defaultDuration: 0.8,
		glsl: dipToBlackGlsl,
	},
	{
		type: "dip-to-white",
		name: "Dip to White",
		keywords: ["dip", "white", "flash", "bright"],
		defaultDuration: 0.8,
		glsl: dipToWhiteGlsl,
	},
	{
		type: "circle-open",
		name: "Circle Open",
		keywords: ["circle", "radial", "iris", "reveal"],
		defaultDuration: 0.6,
		glsl: circleOpenGlsl,
	},
	{
		type: "glitch",
		name: "Glitch",
		keywords: ["glitch", "distortion", "chromatic", "aberration", "digital"],
		defaultDuration: 0.4,
		glsl: glitchGlsl,
	},
];

export function registerDefaultTransitions(): void {
	for (const raw of RAW_TRANSITIONS) {
		if (hasTransition({ transitionType: raw.type })) {
			continue;
		}
		const definition: TransitionDefinition = {
			type: raw.type,
			name: raw.name,
			keywords: raw.keywords,
			defaultDuration: raw.defaultDuration,
			fragmentShader: wrapTransitionShader({ transitionGlsl: raw.glsl }),
		};
		registerTransition({ definition });
	}
}

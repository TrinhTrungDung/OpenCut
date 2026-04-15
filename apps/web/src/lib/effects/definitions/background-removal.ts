import type { EffectDefinition } from "@/types/effects";
import { processBackgroundRemoval } from "./background-removal-renderer";

export const backgroundRemovalEffectDefinition: EffectDefinition = {
	type: "background-removal",
	name: "Background Removal",
	keywords: [
		"background",
		"removal",
		"green screen",
		"chroma",
		"cutout",
		"person",
		"segmentation",
	],
	params: [
		{
			key: "threshold",
			label: "Threshold",
			type: "number",
			default: 0.7,
			min: 0,
			max: 1,
			step: 0.05,
		},
		{
			key: "edgeBlur",
			label: "Edge Blur",
			type: "number",
			default: 3,
			min: 0,
			max: 10,
			step: 1,
		},
	],
	renderer: {
		type: "custom",
		process: processBackgroundRemoval,
	},
};

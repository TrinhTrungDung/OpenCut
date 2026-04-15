import type { EffectDefinition } from "@/types/effects";
import blurFragmentShader from "./blur.frag.glsl";
import blurFragmentWGSL from "./blur.frag.wgsl";

/** Parse intensity param to number */
function parseIntensity(effectParams: Record<string, number | string | boolean>): number {
	return typeof effectParams.intensity === "number"
		? effectParams.intensity
		: Number.parseFloat(String(effectParams.intensity));
}

export const blurEffectDefinition: EffectDefinition = {
	type: "blur",
	name: "Blur",
	keywords: ["blur", "soft", "defocus"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 15,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
		{
			fragmentShader: blurFragmentShader,
			uniforms: ({ effectParams, width }) => {
				const intensity = parseIntensity(effectParams);
				return {
					u_sigma: Math.max((intensity / 5) * (width / 1920), 0.001),
					u_direction: [1, 0],
				};
			},
		},
		{
			fragmentShader: blurFragmentShader,
			uniforms: ({ effectParams, height }) => {
				const intensity = parseIntensity(effectParams);
				return {
					u_sigma: Math.max((intensity / 5) * (height / 1080), 0.001),
					u_direction: [0, 1],
				};
			},
		},
		],
	},
	gpuRenderer: {
		type: "webgpu",
		passes: [
			{
				shaderModule: blurFragmentWGSL,
				uniforms: ({ effectParams, width, height }) => {
					const intensity = parseIntensity(effectParams);
					return {
						u_resolution: [width, height],
						u_sigma: Math.max((intensity / 5) * (width / 1920), 0.001),
						u_direction: [1, 0],
					};
				},
			},
			{
				shaderModule: blurFragmentWGSL,
				uniforms: ({ effectParams, width, height }) => {
					const intensity = parseIntensity(effectParams);
					return {
						u_resolution: [width, height],
						u_sigma: Math.max((intensity / 5) * (height / 1080), 0.001),
						u_direction: [0, 1],
					};
				},
			},
		],
	},
};

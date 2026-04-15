export interface Effect {
	id: string;
	type: string;
	params: EffectParamValues;
	enabled: boolean;
}

export type EffectParamType = "number" | "boolean" | "select" | "color";

export type EffectParamValues = Record<string, number | string | boolean>;

interface BaseEffectParamDefinition {
	key: string;
	label: string;
}

export interface NumberEffectParamDefinition extends BaseEffectParamDefinition {
	type: "number";
	default: number;
	min: number;
	max: number;
	step: number;
}

interface BooleanEffectParamDefinition extends BaseEffectParamDefinition {
	type: "boolean";
	default: boolean;
}

interface SelectEffectParamDefinition extends BaseEffectParamDefinition {
	type: "select";
	default: string;
	options: Array<{ value: string; label: string }>;
}

interface ColorEffectParamDefinition extends BaseEffectParamDefinition {
	type: "color";
	default: string;
}

export type EffectParamDefinition =
	| NumberEffectParamDefinition
	| BooleanEffectParamDefinition
	| SelectEffectParamDefinition
	| ColorEffectParamDefinition;

export interface WebGLEffectPass {
	fragmentShader: string;
	uniforms(params: {
		effectParams: EffectParamValues;
		width: number;
		height: number;
	}): Record<string, number | number[]>;
}

export interface WebGLEffectRenderer {
	type: "webgl";
	passes: WebGLEffectPass[];
}

/** Custom renderer that gets full canvas access for effects needing external processing (e.g. MediaPipe segmentation) */
export interface CustomEffectRenderer {
	type: "custom";
	process(params: {
		source: CanvasImageSource;
		width: number;
		height: number;
		effectParams: EffectParamValues;
	}): Promise<CanvasImageSource>;
}

export type EffectRenderer = WebGLEffectRenderer | CustomEffectRenderer;

export interface EffectDefinition {
	type: string;
	name: string;
	keywords: string[];
	params: EffectParamDefinition[];
	renderer: EffectRenderer;
}

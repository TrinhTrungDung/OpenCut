/** All color correction parameters, each ranging from -100 to 100 (except hueShift: -180 to 180) */
export interface ColorCorrectionParams {
	brightness: number;
	contrast: number;
	saturation: number;
	exposure: number;
	temperature: number;
	tint: number;
	highlights: number;
	shadows: number;
	/** Hue shift in degrees (-180 to 180) */
	hueShift: number;
}

export const DEFAULT_COLOR_CORRECTION: ColorCorrectionParams = {
	brightness: 0,
	contrast: 0,
	saturation: 0,
	exposure: 0,
	temperature: 0,
	tint: 0,
	highlights: 0,
	shadows: 0,
	hueShift: 0,
};

/** Check if all color correction values are at defaults (no correction applied) */
export function isDefaultColorCorrection(
	params: ColorCorrectionParams,
): boolean {
	return (
		params.brightness === 0 &&
		params.contrast === 0 &&
		params.saturation === 0 &&
		params.exposure === 0 &&
		params.temperature === 0 &&
		params.tint === 0 &&
		params.highlights === 0 &&
		params.shadows === 0 &&
		params.hueShift === 0
	);
}

/**
 * Audio effect types, defaults, and parameter definitions.
 *
 * Per-clip effects: filter (lowpass/highpass) + 3-band parametric EQ.
 * Master effects: dynamics compressor + convolution reverb.
 */

/** Per-clip audio effect parameters stored on timeline elements. */
export interface AudioEffectParams {
	/** Filter type: lowpass, highpass, or none (bypass). */
	filterType: "lowpass" | "highpass" | "none";
	/** Filter cutoff frequency in Hz (20-20000). */
	filterFrequency: number;
	/** Filter Q/resonance (0.1-20). */
	filterQ: number;
	/** Low shelf EQ gain in dB (-12 to 12). */
	eqLowGain: number;
	/** Mid peaking EQ gain in dB (-12 to 12). */
	eqMidGain: number;
	/** High shelf EQ gain in dB (-12 to 12). */
	eqHighGain: number;
	/** Mid EQ center frequency in Hz (200-8000). */
	eqMidFreq: number;
}

/** Master audio effect parameters stored in editor state. */
export interface MasterAudioEffects {
	compressorEnabled: boolean;
	compressorThreshold: number;
	compressorRatio: number;
	compressorAttack: number;
	compressorRelease: number;
	reverbEnabled: boolean;
	reverbMix: number;
}

/** Default per-clip audio effects (all bypass / passthrough). */
export const DEFAULT_AUDIO_EFFECTS: AudioEffectParams = {
	filterType: "none",
	filterFrequency: 1000,
	filterQ: 1,
	eqLowGain: 0,
	eqMidGain: 0,
	eqHighGain: 0,
	eqMidFreq: 1000,
};

/** Default master audio effects (all disabled). */
export const DEFAULT_MASTER_AUDIO_EFFECTS: MasterAudioEffects = {
	compressorEnabled: false,
	compressorThreshold: -24,
	compressorRatio: 4,
	compressorAttack: 0.003,
	compressorRelease: 0.25,
	reverbEnabled: false,
	reverbMix: 0.3,
};

/** Check if per-clip effects are at default (i.e. bypass, no CPU cost). */
export function isAudioEffectsDefault(params: AudioEffectParams): boolean {
	return (
		params.filterType === "none" &&
		params.eqLowGain === 0 &&
		params.eqMidGain === 0 &&
		params.eqHighGain === 0
	);
}

/** EQ band frequency breakpoints for low/high shelves. */
export const EQ_LOW_FREQ = 320;
export const EQ_HIGH_FREQ = 3200;

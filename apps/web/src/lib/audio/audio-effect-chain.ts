/**
 * Per-clip audio effect chain factory.
 *
 * Signal chain:
 *   input (GainNode) -> BiquadFilter (lp/hp) -> EQ Low shelf -> EQ Mid peaking -> EQ High shelf -> output
 *
 * When all params are at default, the nodes are in passthrough mode (zero CPU cost).
 * The input node is a simple pass-through gain so callers can wire clipGain -> chain.input.
 */

import {
	type AudioEffectParams,
	DEFAULT_AUDIO_EFFECTS,
	EQ_HIGH_FREQ,
	EQ_LOW_FREQ,
} from "./audio-effects-config";

export interface AudioEffectChain {
	/** Connect the per-clip GainNode output to this node. */
	input: GainNode;
	/** Connect this node to masterGain. */
	output: AudioNode;
	/** Update effect parameters from timeline element data. */
	update(params: AudioEffectParams): void;
	/** Disconnect and release all nodes. */
	dispose(): void;
}

/**
 * Create a per-clip audio effect chain.
 * Nodes are created once per clip lifetime and params updated each scheduling cycle.
 */
export function createAudioEffectChain(ctx: AudioContext): AudioEffectChain {
	/* Pass-through input node (gain = 1) */
	const input = ctx.createGain();
	input.gain.value = 1;

	/* Filter: defaults to allpass (no-op) when filterType is "none" */
	const filter = ctx.createBiquadFilter();
	filter.type = "allpass";
	filter.frequency.value = DEFAULT_AUDIO_EFFECTS.filterFrequency;
	filter.Q.value = DEFAULT_AUDIO_EFFECTS.filterQ;

	/* 3-band parametric EQ */
	const eqLow = ctx.createBiquadFilter();
	eqLow.type = "lowshelf";
	eqLow.frequency.value = EQ_LOW_FREQ;
	eqLow.gain.value = 0;

	const eqMid = ctx.createBiquadFilter();
	eqMid.type = "peaking";
	eqMid.frequency.value = DEFAULT_AUDIO_EFFECTS.eqMidFreq;
	eqMid.Q.value = 1.5;
	eqMid.gain.value = 0;

	const eqHigh = ctx.createBiquadFilter();
	eqHigh.type = "highshelf";
	eqHigh.frequency.value = EQ_HIGH_FREQ;
	eqHigh.gain.value = 0;

	/* Wire: input -> filter -> eqLow -> eqMid -> eqHigh */
	input.connect(filter);
	filter.connect(eqLow);
	eqLow.connect(eqMid);
	eqMid.connect(eqHigh);

	const output: AudioNode = eqHigh;

	function update(params: AudioEffectParams): void {
		/* Update filter type */
		if (params.filterType === "none") {
			filter.type = "allpass";
		} else {
			filter.type = params.filterType;
			filter.frequency.value = params.filterFrequency;
			filter.Q.value = params.filterQ;
		}

		/* Update EQ gains */
		eqLow.gain.value = params.eqLowGain;
		eqMid.gain.value = params.eqMidGain;
		eqMid.frequency.value = params.eqMidFreq;
		eqHigh.gain.value = params.eqHighGain;
	}

	function dispose(): void {
		input.disconnect();
		filter.disconnect();
		eqLow.disconnect();
		eqMid.disconnect();
		eqHigh.disconnect();
	}

	return { input, output, update, dispose };
}

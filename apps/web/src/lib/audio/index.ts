export {
	type FadePreset,
	DEFAULT_FADE_DURATION,
	FADE_PRESETS,
	generateFadeInKeyframes,
	generateFadeOutKeyframes,
} from "./volume-envelope";

export {
	type AudioEffectParams,
	type MasterAudioEffects,
	DEFAULT_AUDIO_EFFECTS,
	DEFAULT_MASTER_AUDIO_EFFECTS,
	isAudioEffectsDefault,
} from "./audio-effects-config";

export {
	type AudioEffectChain,
	createAudioEffectChain,
} from "./audio-effect-chain";

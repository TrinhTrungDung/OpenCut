import { create } from "zustand";
import { DEFAULT_CANVAS_PRESETS } from "@/constants/project-constants";
import type { TCanvasSize } from "@/types/project";
import {
	type MasterAudioEffects,
	DEFAULT_MASTER_AUDIO_EFFECTS,
} from "@/lib/audio/audio-effects-config";

interface EditorState {
	isInitializing: boolean;
	isPanelsReady: boolean;
	canvasPresets: TCanvasSize[];
	/** Master audio effects applied to the full mix. */
	masterAudioEffects: MasterAudioEffects;
	setInitializing: (loading: boolean) => void;
	setPanelsReady: (ready: boolean) => void;
	setMasterAudioEffects: (effects: Partial<MasterAudioEffects>) => void;
	initializeApp: () => Promise<void>;
}

export const useEditorStore = create<EditorState>()((set) => ({
	isInitializing: true,
	isPanelsReady: false,
	canvasPresets: DEFAULT_CANVAS_PRESETS,
	masterAudioEffects: { ...DEFAULT_MASTER_AUDIO_EFFECTS },
	setInitializing: (loading) => set({ isInitializing: loading }),
	setPanelsReady: (ready) => set({ isPanelsReady: ready }),
	setMasterAudioEffects: (effects) =>
		set((state) => ({
			masterAudioEffects: { ...state.masterAudioEffects, ...effects },
		})),
	initializeApp: async () => {
		set({ isInitializing: true, isPanelsReady: false });
		set({ isPanelsReady: true, isInitializing: false });
	},
}));

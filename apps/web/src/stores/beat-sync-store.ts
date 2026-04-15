import { create } from "zustand";
import type { BeatDetectionResult, BeatSyncStatus } from "@/types/beat-sync";

interface BeatSyncStore {
	status: BeatSyncStatus;
	result: BeatDetectionResult | null;
	error: string | null;
	setStatus: (status: BeatSyncStatus) => void;
	setResult: (result: BeatDetectionResult | null) => void;
	setError: (error: string | null) => void;
	reset: () => void;
}

export const useBeatSyncStore = create<BeatSyncStore>((set) => ({
	status: "idle",
	result: null,
	error: null,

	setStatus: (status) => set({ status }),

	setResult: (result) => set({ result }),

	setError: (error) => set({ error }),

	reset: () => set({ status: "idle", result: null, error: null }),
}));

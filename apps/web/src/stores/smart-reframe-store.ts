import { create } from "zustand";
import type { ReframeResult, ReframeStatus } from "@/types/smart-reframe";

interface SmartReframeState {
	status: ReframeStatus;
	progress: number;
	result: ReframeResult | null;
	error: string | null;
	isOpen: boolean;
	setStatus: (status: ReframeStatus) => void;
	setProgress: (progress: number) => void;
	setResult: (result: ReframeResult | null) => void;
	setError: (error: string | null) => void;
	open: () => void;
	close: () => void;
	reset: () => void;
}

export const useSmartReframeStore = create<SmartReframeState>()((set) => ({
	status: "idle",
	progress: 0,
	result: null,
	error: null,
	isOpen: false,
	setStatus: (status) => set({ status }),
	setProgress: (progress) => set({ progress }),
	setResult: (result) => set({ result }),
	setError: (error) => set({ error }),
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false, status: "idle", progress: 0, result: null, error: null }),
	reset: () => set({ status: "idle", progress: 0, result: null, error: null }),
}));

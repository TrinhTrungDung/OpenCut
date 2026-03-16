import { create } from "zustand";
import type { MediaAsset } from "@/types/assets";

interface MediaPreviewStore {
	previewAsset: MediaAsset | null;
	trimStart: number;
	trimEnd: number;
	setPreviewAsset: ({ asset }: { asset: MediaAsset | null }) => void;
	setTrimRange: ({ start, end }: { start: number; end: number }) => void;
	resetTrim: () => void;
	closePreview: () => void;
}

export const useMediaPreviewStore = create<MediaPreviewStore>((set) => ({
	previewAsset: null,
	trimStart: 0,
	trimEnd: 0,
	setPreviewAsset: ({ asset }) =>
		set({
			previewAsset: asset,
			trimStart: 0,
			trimEnd: asset?.duration ?? 0,
		}),
	setTrimRange: ({ start, end }) => set({ trimStart: start, trimEnd: end }),
	resetTrim: () =>
		set((state) => ({
			trimStart: 0,
			trimEnd: state.previewAsset?.duration ?? 0,
		})),
	closePreview: () =>
		set({ previewAsset: null, trimStart: 0, trimEnd: 0 }),
}));

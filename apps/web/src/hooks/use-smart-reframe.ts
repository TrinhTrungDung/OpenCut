"use client";

import { useCallback } from "react";
import { useSmartReframeStore } from "@/stores/smart-reframe-store";
import { useEditor } from "@/hooks/use-editor";
import { computeReframeFromFile } from "@/lib/smart-reframe";
import type { ReframePreset } from "@/types/smart-reframe";

/**
 * Hook for smart reframe: analyze a video file for face positions
 * and compute an optimal crop region for a target aspect ratio.
 */
export function useSmartReframe() {
	const editor = useEditor();
	const { status, progress, result, error, isOpen } = useSmartReframeStore();
	const { setStatus, setProgress, setResult, setError, open, close, reset } =
		useSmartReframeStore();

	const analyze = useCallback(
		async (file: File, preset: ReframePreset) => {
			setStatus("analyzing");
			setProgress(0);
			setError(null);
			setResult(null);

			try {
				const reframeResult = await computeReframeFromFile({
					file,
					targetPreset: preset,
					onProgress: (p) => setProgress(p),
				});

				setResult(reframeResult);
				setStatus("ready");
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Analysis failed";
				setError(message);
				setStatus("error");
			}
		},
		[setStatus, setProgress, setError, setResult],
	);

	const apply = useCallback(async () => {
		if (!result) return;

		setStatus("applying");

		try {
			await editor.project.updateSettings({
				settings: {
					canvasSize: {
						width: result.outputWidth,
						height: result.outputHeight,
					},
				},
			});

			setStatus("idle");
			close();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to apply reframe";
			setError(message);
			setStatus("error");
		}
	}, [result, editor, setStatus, setError, close]);

	return {
		status,
		progress,
		result,
		error,
		isOpen,
		analyze,
		apply,
		open,
		close,
		reset,
	};
}

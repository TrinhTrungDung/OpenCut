import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBeatSyncStore } from "@/stores/beat-sync-store";
import { analyzeBeatSync, generateBeatMarkers } from "@/lib/beat-sync";
import { updateSceneInArray } from "@/lib/scenes";
import type { BeatDetectionOptions } from "@/types/beat-sync";

/**
 * Orchestrates beat detection and applying beat markers as bookmarks.
 */
export function useBeatSync() {
	const editor = useEditor();
	const status = useBeatSyncStore((s) => s.status);
	const result = useBeatSyncStore((s) => s.result);
	const error = useBeatSyncStore((s) => s.error);

	const analyze = useCallback(
		async (audioBlob: Blob, options?: BeatDetectionOptions) => {
			useBeatSyncStore.getState().setStatus("analyzing");
			useBeatSyncStore.getState().setError(null);

			try {
				const detectionResult = await analyzeBeatSync({
					audioBlob,
					options,
				});
				useBeatSyncStore.getState().setResult(detectionResult);
				useBeatSyncStore.getState().setStatus("ready");
				return detectionResult;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Beat detection failed";
				useBeatSyncStore.getState().setError(message);
				useBeatSyncStore.getState().setStatus("error");
				return null;
			}
		},
		[],
	);

	const applyBeats = useCallback(() => {
		const currentResult = useBeatSyncStore.getState().result;
		if (!currentResult) return;

		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;

		const beatBookmarks = generateBeatMarkers({ beats: currentResult.beats });
		const scenes = editor.scenes.getScenes();

		// Merge beat bookmarks with existing bookmarks, avoiding duplicates
		const existingTimes = new Set(
			activeScene.bookmarks.map((b) => Math.round(b.time * 1000)),
		);
		const newBookmarks = beatBookmarks.filter(
			(b) => !existingTimes.has(Math.round(b.time * 1000)),
		);
		const mergedBookmarks = [...activeScene.bookmarks, ...newBookmarks].sort(
			(a, b) => a.time - b.time,
		);

		const updatedScenes = updateSceneInArray({
			scenes,
			sceneId: activeScene.id,
			updates: { bookmarks: mergedBookmarks },
		});

		editor.scenes.setScenes({ scenes: updatedScenes });
	}, [editor]);

	const clearBeats = useCallback(() => {
		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;

		// Remove bookmarks that were created by beat sync (identified by note === "Beat")
		const filteredBookmarks = activeScene.bookmarks.filter(
			(b) => b.note !== "Beat",
		);
		const scenes = editor.scenes.getScenes();

		const updatedScenes = updateSceneInArray({
			scenes,
			sceneId: activeScene.id,
			updates: { bookmarks: filteredBookmarks },
		});

		editor.scenes.setScenes({ scenes: updatedScenes });
	}, [editor]);

	const reset = useCallback(() => {
		useBeatSyncStore.getState().reset();
	}, []);

	return { status, result, error, analyze, applyBeats, clearBeats, reset };
}

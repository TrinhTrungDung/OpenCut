import { useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { videoElementPool } from "@/services/video-element-pool";

/**
 * Syncs video element pool play/pause state with the playback manager.
 * Pre-creates video elements on play, starts/stops them in sync with playback.
 */
export function useVideoElementSync() {
	const editor = useEditor();

	useEffect(() => {
		let wasPlaying = false;

		const unsubscribe = editor.playback.subscribe(() => {
			const isPlaying = editor.playback.getIsPlaying();

			if (isPlaying && !wasPlaying) {
				startVideoElements();
			} else if (!isPlaying && wasPlaying) {
				videoElementPool.pauseAll();
			}

			wasPlaying = isPlaying;
		});

		function startVideoElements() {
			const currentTime = editor.playback.getCurrentTime();
			const tracks = editor.timeline.getTracks();
			const mediaAssets = editor.media.getAssets();
			const mediaMap = new Map(mediaAssets.map((m) => [m.id, m]));

			for (const track of tracks) {
				for (const element of track.elements) {
					if (element.type !== "video") continue;

					const mediaAsset = mediaMap.get(element.mediaId);
					if (!mediaAsset?.file) continue;

					// Pre-create video element
					const el = videoElementPool.getElement({
						elementId: element.id,
						file: mediaAsset.file,
						mediaId: element.mediaId,
					});

					// Calculate source time
					const localTime = currentTime - element.startTime;
					const sourceTime = localTime + element.trimStart;

					el.currentTime = sourceTime;
					el.playbackRate = element.speed ?? 1;

					// Only play elements visible at current time
					const elementEnd = element.startTime + element.duration;
					if (currentTime >= element.startTime && currentTime < elementEnd) {
						el.play().catch(() => {});
					}
				}
			}
		}

		return () => {
			unsubscribe();
			videoElementPool.pauseAll();
		};
	}, [editor]);
}

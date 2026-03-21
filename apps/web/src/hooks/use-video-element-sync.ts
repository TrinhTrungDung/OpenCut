import { useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { videoElementPool } from "@/services/video-element-pool";

/**
 * Syncs video element pool play/pause state with the playback manager.
 * Pre-creates video elements on play, starts/stops them in sync with playback.
 * Also pauses video elements when user starts scrubbing (dragging playhead)
 * during playback, so seekIfNeeded can seek to the scrubbed position.
 */
export function useVideoElementSync() {
	const editor = useEditor();

	useEffect(() => {
		let wasPlaying = false;
		let wasScrubbing = false;

		const unsubscribe = editor.playback.subscribe(() => {
			const isPlaying = editor.playback.getIsPlaying();
			const isScrubbing = editor.playback.getIsScrubbing();

			if (isPlaying && !wasPlaying && !isScrubbing) {
				startVideoElements();
			} else if (!isPlaying && wasPlaying) {
				videoElementPool.pauseAll();
			}

			// When user stops scrubbing and playback is still active,
			// re-sync video elements to the scrubbed position.
			// We do NOT pause on scrub start — the element keeps its decode
			// pipeline warm and the renderer seeks it directly via drift
			// correction, avoiding cold-start lag.
			if (!isScrubbing && wasScrubbing && isPlaying) {
				resyncVideoElements();
			}

			wasPlaying = isPlaying;
			wasScrubbing = isScrubbing;
		});

		// Auto-start/stop video elements during playback.
		// No pre-play — just start at the exact moment a clip enters range.
		// The element is already buffered (preload="auto", pre-seeked to
		// trimStart in startVideoElements), so play() starts near-instantly.
		const unsubscribeTime = editor.playback.subscribeToTime((time) => {
			if (!editor.playback.getIsPlaying() || editor.playback.getIsScrubbing()) return;

			const tracks = editor.timeline.getTracks();

			for (const track of tracks) {
				for (const element of track.elements) {
					if (element.type !== "video") continue;

					const entry = videoElementPool.getEntry(element.id);
					if (!entry) continue;

					const elementEnd = element.startTime + element.duration;
					const isInRange = time >= element.startTime && time < elementEnd;

					if (isInRange && entry.element.paused) {
						// Start from correct source time
						const localTime = time - element.startTime;
						const sourceTime = localTime + element.trimStart;
						entry.element.currentTime = sourceTime;
						entry.element.playbackRate = element.speed ?? 1;
						entry.element.play().catch(() => {});
					} else if (!isInRange && !entry.element.paused) {
						entry.element.pause();
					}
				}
			}
		});

		/** Re-sync playing video elements to the current scrubbed position */
		function resyncVideoElements() {
			const currentTime = editor.playback.getCurrentTime();
			const tracks = editor.timeline.getTracks();

			for (const track of tracks) {
				for (const element of track.elements) {
					if (element.type !== "video") continue;

					const entry = videoElementPool.getEntry(element.id);
					if (!entry) continue;

					const elementEnd = element.startTime + element.duration;
					const isInRange =
						currentTime >= element.startTime && currentTime < elementEnd;

					if (isInRange) {
						const localTime = currentTime - element.startTime;
						const sourceTime = localTime + element.trimStart;
						entry.element.currentTime = sourceTime;
						if (entry.element.paused) {
							entry.element.playbackRate = element.speed ?? 1;
							entry.element.play().catch(() => {});
						}
					}
				}
			}
		}

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

					// Pre-create video element for ALL clips (so future clips are pre-loaded)
					const el = videoElementPool.getElement({
						elementId: element.id,
						file: mediaAsset.file,
						mediaId: element.mediaId,
					});

					const elementEnd = element.startTime + element.duration;
					const isInRange =
						currentTime >= element.startTime && currentTime < elementEnd;

					if (isInRange) {
						// In-range: seek to correct source time and play
						const localTime = currentTime - element.startTime;
						const sourceTime = localTime + element.trimStart;
						el.currentTime = sourceTime;
						el.playbackRate = element.speed ?? 1;
						el.play().catch(() => {});
					} else {
						// Future/past clip: seek to start so it's pre-loaded and ready
						el.currentTime = element.trimStart;
						el.playbackRate = element.speed ?? 1;
					}
				}
			}
		}

		return () => {
			unsubscribe();
			unsubscribeTime();
			videoElementPool.pauseAll();
		};
	}, [editor]);
}

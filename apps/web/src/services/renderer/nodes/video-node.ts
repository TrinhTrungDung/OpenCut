import type { CanvasRenderer } from "../canvas-renderer";
import { VisualNode, type VisualNodeParams } from "./visual-node";
import { videoCache } from "@/services/video-cache/service";
import { videoElementPool } from "@/services/video-element-pool";

export interface VideoNodeParams extends VisualNodeParams {
	url: string;
	file: File;
	mediaId: string;
	/** When true, use <video> element for hardware-accelerated preview */
	isPreview?: boolean;
}

export class VideoNode extends VisualNode<VideoNodeParams> {
	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange({ time })) {
			return;
		}

		const videoTime = this.getSourceLocalTime({ time });

		// Preview path: use <video> element for both playback and paused frames
		if (this.params.isPreview && this.params.elementId) {
			const el = videoElementPool.getElement({
				elementId: this.params.elementId,
				file: this.params.file,
				mediaId: this.params.mediaId,
			});

			if (el.paused) {
				// When paused (scrubbing while not playing), seek to correct time
				videoElementPool.seekIfNeeded({
					elementId: this.params.elementId,
					time: videoTime,
				});
			} else if (Math.abs(el.currentTime - videoTime) > 0.15) {
				// During playback scrubbing, the element keeps playing but the
				// user moved the playhead. Seek the playing element directly —
				// this is faster than pause + cold-restart because the decode
				// pipeline stays warm.
				el.currentTime = videoTime;
			}

			// Draw from video element if it has decoded frame data.
			// During seeking readyState can drop to HAVE_METADATA (1), but
			// drawImage still produces the last decoded frame which is better
			// than showing black. Accept HAVE_METADATA when seeking so the
			// preview stays responsive during playhead scrubbing.
			const minReady = el.seeking
				? HTMLMediaElement.HAVE_METADATA
				: HTMLMediaElement.HAVE_CURRENT_DATA;
			if (el.readyState >= minReady && el.videoWidth > 0) {
				this.renderVisual({
					renderer,
					source: el,
					sourceWidth: el.videoWidth || renderer.width,
					sourceHeight: el.videoHeight || renderer.height,
					timelineTime: time,
				});
			}

			// Skip mediabunny fallback in preview — video element will be ready soon
			return;
		}

		// Export path only: use mediabunny for frame-accurate decode
		const frame = await videoCache.getFrameAt({
			mediaId: this.params.mediaId,
			file: this.params.file,
			time: videoTime,
		});

		if (frame) {
			this.renderVisual({
				renderer,
				source: frame.canvas,
				sourceWidth: frame.canvas.width,
				sourceHeight: frame.canvas.height,
				timelineTime: time,
			});
		}
	}

}

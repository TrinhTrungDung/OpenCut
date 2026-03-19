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

			// When paused, seek the video element to the correct source time
			if (el.paused) {
				videoElementPool.seekIfNeeded({
					elementId: this.params.elementId,
					time: videoTime,
				});
			}

			// Draw from video element if it has data (works both playing and paused)
			if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
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

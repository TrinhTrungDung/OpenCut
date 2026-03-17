import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";
import { FrameRingBuffer } from "./frame-ring-buffer";

/** How many frames to pre-decode ahead during playback */
const RING_BUFFER_SIZE = 15;

/** Max time gap (seconds) before a forward seek is cheaper than iterating */
const FORWARD_ITERATE_THRESHOLD = 2.0;

interface VideoSinkData {
	sink: CanvasSink;
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	currentFrame: WrappedCanvas | null;
	nextFrame: WrappedCanvas | null;
	lastTime: number;
	prefetching: boolean;
	prefetchPromise: Promise<void> | null;
	/** Ring buffer for decode-ahead during playback */
	ringBuffer: FrameRingBuffer;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	private isPlaybackActive = false;

	async getFrameAt({
		mediaId,
		file,
		time,
	}: {
		mediaId: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		await this.ensureSink({ mediaId, file });

		const sinkData = this.sinks.get(mediaId);
		if (!sinkData) return null;

		// During playback, try the ring buffer first (instant, no await)
		if (this.isPlaybackActive) {
			const buffered = sinkData.ringBuffer.getFrame(time);
			if (buffered) {
				// Keep currentFrame updated for fallback path
				sinkData.currentFrame = buffered;
				sinkData.lastTime = buffered.timestamp;

				// If buffer is running low, trigger a refill
				this.maybeRefillBuffer({ sinkData, currentTime: time });

				return buffered;
			}
		}

		// Fallback: original sync decode path (used for scrubbing, seeking, cache miss)
		return this.getFrameSync({ sinkData, time });
	}

	/**
	 * Signal that playback has started — begin pre-decoding frames ahead.
	 * Waits for initial buffer fill so first frames are ready before RAF starts.
	 * Called from PlaybackManager.play()
	 */
	async notifyPlaybackStart(currentTime: number): Promise<void> {
		this.isPlaybackActive = true;

		// Start filling ring buffers for all active sinks
		const fillPromises: Promise<void>[] = [];
		for (const sinkData of this.sinks.values()) {
			this.startBufferFill({ sinkData, fromTime: currentTime });
			fillPromises.push(sinkData.ringBuffer.waitForFill());
		}

		// Wait for initial buffer fill (decode a few frames before playback starts)
		if (fillPromises.length > 0) {
			await Promise.all(fillPromises);
		}
	}

	/**
	 * Signal that playback has paused/stopped — stop pre-decoding.
	 * Called from PlaybackManager.pause()
	 */
	notifyPlaybackStop(): void {
		this.isPlaybackActive = false;

		// Clear ring buffers to free memory
		for (const sinkData of this.sinks.values()) {
			sinkData.ringBuffer.clear();
		}
	}

	/**
	 * Signal a seek during playback — invalidate and refill buffers.
	 * Called from PlaybackManager.seek()
	 */
	notifySeek(time: number): void {
		if (!this.isPlaybackActive) return;

		for (const sinkData of this.sinks.values()) {
			sinkData.ringBuffer.clear();
			this.startBufferFill({ sinkData, fromTime: time });
		}
	}

	// --- Ring buffer management ---

	private startBufferFill({
		sinkData,
		fromTime,
	}: {
		sinkData: VideoSinkData;
		fromTime: number;
	}): void {
		if (sinkData.ringBuffer.isFilling()) return;

		// Create a fresh iterator from the target time
		const iterator = sinkData.sink.canvases(fromTime);
		sinkData.ringBuffer.startFilling(iterator);
	}

	private maybeRefillBuffer({
		sinkData,
		currentTime,
	}: {
		sinkData: VideoSinkData;
		currentTime: number;
	}): void {
		// Refill when buffer has less than 2 frames remaining
		if (sinkData.ringBuffer.isFilling()) return;
		if (sinkData.ringBuffer.getCount() >= 2) {
			// Check if playhead is close to the end of buffered range
			const latestTime = sinkData.ringBuffer.getLatestTime();
			if (latestTime - currentTime > 0.1) return; // Still have >100ms buffered
		}

		// Start a new fill cycle from just past the latest buffered time
		const latestTime = sinkData.ringBuffer.getLatestTime();
		const fillFrom = latestTime > 0 ? latestTime : currentTime;
		this.startBufferFill({ sinkData, fromTime: fillFrom });
	}

	// --- Original sync decode path (scrubbing, seeking, fallback) ---

	private async getFrameSync({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		if (sinkData.nextFrame && sinkData.nextFrame.timestamp <= time) {
			sinkData.currentFrame = sinkData.nextFrame;
			sinkData.nextFrame = null;
			this.startPrefetch({ sinkData });
		}

		if (
			sinkData.currentFrame &&
			this.isFrameValid({ frame: sinkData.currentFrame, time })
		) {
			if (!sinkData.nextFrame && !sinkData.prefetching) {
				this.startPrefetch({ sinkData });
			}
			return sinkData.currentFrame;
		}

		if (
			sinkData.iterator &&
			sinkData.currentFrame &&
			time >= sinkData.lastTime &&
			time < sinkData.lastTime + FORWARD_ITERATE_THRESHOLD
		) {
			const frame = await this.iterateToTime({ sinkData, targetTime: time });
			if (frame) {
				if (!sinkData.nextFrame && !sinkData.prefetching) {
					this.startPrefetch({ sinkData });
				}
				return frame;
			}
		}

		const frame = await this.seekToTime({ sinkData, time });
		if (frame && !sinkData.nextFrame && !sinkData.prefetching) {
			this.startPrefetch({ sinkData });
		}
		return frame;
	}

	private isFrameValid({
		frame,
		time,
	}: {
		frame: WrappedCanvas;
		time: number;
	}): boolean {
		return time >= frame.timestamp && time < frame.timestamp + frame.duration;
	}

	private async iterateToTime({
		sinkData,
		targetTime,
	}: {
		sinkData: VideoSinkData;
		targetTime: number;
	}): Promise<WrappedCanvas | null> {
		if (!sinkData.iterator) return null;

		try {
			while (true) {
				if (sinkData.prefetching && sinkData.prefetchPromise) {
					await sinkData.prefetchPromise;
				}

				if (
					sinkData.nextFrame &&
					sinkData.nextFrame.timestamp <= targetTime + 0.05
				) {
					sinkData.currentFrame = sinkData.nextFrame;
					sinkData.nextFrame = null;
				} else {
					const { value: frame, done } = await sinkData.iterator.next();
					if (done || !frame) break;
					sinkData.currentFrame = frame;
				}

				const frame = sinkData.currentFrame;
				if (!frame) break;

				sinkData.lastTime = frame.timestamp;

				if (this.isFrameValid({ frame, time: targetTime })) {
					return frame;
				}

				if (frame.timestamp > targetTime + 1.0) break;
			}
		} catch (error) {
			console.warn("Iterator failed, will restart:", error);
			sinkData.iterator = null;
		}

		return null;
	}

	private async seekToTime({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		try {
			if (sinkData.prefetching && sinkData.prefetchPromise) {
				await sinkData.prefetchPromise;
			}

			if (sinkData.iterator) {
				await sinkData.iterator.return();
				sinkData.iterator = null;
			}

			sinkData.nextFrame = null;
			sinkData.iterator = sinkData.sink.canvases(time);
			sinkData.lastTime = time;

			const { value: frame } = await sinkData.iterator.next();

			if (frame) {
				sinkData.currentFrame = frame;

				try {
					const { value: next } = await sinkData.iterator.next();
					if (next) {
						sinkData.nextFrame = next;
					}
				} catch (e) {
					console.warn("Failed to pre-fetch next frame on seek:", e);
				}

				return frame;
			}
		} catch (error) {
			console.warn("Failed to seek video:", error);
		}

		return null;
	}

	private startPrefetch({ sinkData }: { sinkData: VideoSinkData }): void {
		if (sinkData.prefetching || !sinkData.iterator || sinkData.nextFrame) {
			return;
		}

		sinkData.prefetching = true;
		sinkData.prefetchPromise = this.prefetchNextFrame({ sinkData });
	}

	private async prefetchNextFrame({
		sinkData,
	}: {
		sinkData: VideoSinkData;
	}): Promise<void> {
		if (!sinkData.iterator) {
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
			return;
		}

		try {
			const { value: frame, done } = await sinkData.iterator.next();

			if (done || !frame) {
				sinkData.prefetching = false;
				sinkData.prefetchPromise = null;
				return;
			}

			sinkData.nextFrame = frame;
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
		} catch (error) {
			console.warn("Prefetch failed:", error);
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
			sinkData.iterator = null;
		}
	}

	private async ensureSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		if (this.sinks.has(mediaId)) return;

		if (this.initPromises.has(mediaId)) {
			await this.initPromises.get(mediaId);
			return;
		}

		const initPromise = this.initializeSink({ mediaId, file });
		this.initPromises.set(mediaId, initPromise);

		try {
			await initPromise;
		} finally {
			this.initPromises.delete(mediaId);
		}
	}

	private async initializeSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		try {
			const input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			});

			const videoTrack = await input.getPrimaryVideoTrack();
			if (!videoTrack) {
				throw new Error("No video track found");
			}

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) {
				throw new Error("Video codec not supported for decoding");
			}

			const sink = new CanvasSink(videoTrack, {
				poolSize: 3,
				fit: "contain",
			});

			this.sinks.set(mediaId, {
				sink,
				iterator: null,
				currentFrame: null,
				nextFrame: null,
				lastTime: -1,
				prefetching: false,
				prefetchPromise: null,
				ringBuffer: new FrameRingBuffer(RING_BUFFER_SIZE),
			});
		} catch (error) {
			console.error(`Failed to initialize video sink for ${mediaId}:`, error);
			throw error;
		}
	}

	clearVideo({ mediaId }: { mediaId: string }): void {
		const sinkData = this.sinks.get(mediaId);
		if (sinkData) {
			sinkData.ringBuffer.clear();
			if (sinkData.iterator) {
				void sinkData.iterator.return();
			}
			this.sinks.delete(mediaId);
		}

		this.initPromises.delete(mediaId);
	}

	clearAll(): void {
		for (const [mediaId] of this.sinks) {
			this.clearVideo({ mediaId });
		}
	}

	getStats() {
		return {
			totalSinks: this.sinks.size,
			activeSinks: Array.from(this.sinks.values()).filter((s) => s.iterator)
				.length,
			cachedFrames: Array.from(this.sinks.values()).filter(
				(s) => s.currentFrame,
			).length,
			bufferedFrames: Array.from(this.sinks.values()).reduce(
				(sum, s) => sum + s.ringBuffer.getCount(),
				0,
			),
		};
	}
}

export const videoCache = new VideoCache();

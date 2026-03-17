import type { WrappedCanvas } from "mediabunny";

/** A buffered frame entry with its display time range */
interface BufferedFrame {
	frame: WrappedCanvas;
	/** Start time (inclusive) */
	timestamp: number;
	/** End time (exclusive) = timestamp + duration */
	endTime: number;
}

/**
 * Circular buffer that pre-decodes video frames ahead of the playhead.
 * During playback, the buffer continuously fetches frames from the iterator
 * so getFrame() can return immediately without blocking the RAF loop.
 */
export class FrameRingBuffer {
	private buffer: (BufferedFrame | null)[];
	private writeIndex = 0;
	private size: number;
	private filling = false;
	private fillPromise: Promise<void> | null = null;
	/** Tracks whether we've been invalidated (seek, stop) during a fill cycle */
	private generation = 0;

	constructor(size = 5) {
		this.size = size;
		this.buffer = new Array(size).fill(null);
	}

	/**
	 * Try to find a pre-decoded frame for the given time.
	 * Returns the frame if found in buffer, null if cache miss.
	 */
	getFrame(time: number): WrappedCanvas | null {
		for (let i = 0; i < this.size; i++) {
			const entry = this.buffer[i];
			if (entry && time >= entry.timestamp && time < entry.endTime) {
				return entry.frame;
			}
		}
		return null;
	}

	/**
	 * Start filling the buffer from an iterator, beginning at the given time.
	 * Non-blocking — kicks off async fill loop that runs in background.
	 */
	startFilling(
		iterator: AsyncGenerator<WrappedCanvas, void, unknown>,
		onExhausted?: () => void,
		onProgress?: (filled: number, total: number) => void,
	): void {
		// Invalidate any in-progress fill
		this.generation++;
		this.filling = true;

		const gen = this.generation;
		this.fillPromise = this.fillLoop(iterator, gen, onExhausted, onProgress);
	}

	/** Stop the fill loop and clear all buffered frames */
	clear(): void {
		this.generation++;
		this.filling = false;
		this.fillPromise = null;
		this.writeIndex = 0;
		for (let i = 0; i < this.size; i++) {
			this.buffer[i] = null;
		}
	}

	/** Check if the buffer is actively pre-decoding */
	isFilling(): boolean {
		return this.filling;
	}

	/** Wait for current fill cycle to complete (if any) */
	async waitForFill(): Promise<void> {
		if (this.fillPromise) {
			await this.fillPromise;
		}
	}

	/** Get the latest buffered time (for deciding when to refill) */
	getLatestTime(): number {
		let latest = -1;
		for (let i = 0; i < this.size; i++) {
			const entry = this.buffer[i];
			if (entry && entry.endTime > latest) {
				latest = entry.endTime;
			}
		}
		return latest;
	}

	/** Number of valid frames currently in buffer */
	getCount(): number {
		let count = 0;
		for (let i = 0; i < this.size; i++) {
			if (this.buffer[i]) count++;
		}
		return count;
	}

	/**
	 * Async loop that continuously decodes frames into the ring buffer.
	 * Stops when: buffer full, iterator exhausted, or generation changed (invalidated).
	 */
	private async fillLoop(
		iterator: AsyncGenerator<WrappedCanvas, void, unknown>,
		generation: number,
		onExhausted?: () => void,
		onProgress?: (filled: number, total: number) => void,
	): Promise<void> {
		let filled = 0;

		try {
			while (filled < this.size && this.generation === generation) {
				const { value: frame, done } = await iterator.next();

				// Check if we were invalidated during the await
				if (this.generation !== generation) break;

				if (done || !frame) {
					onExhausted?.();
					break;
				}

				this.buffer[this.writeIndex] = {
					frame,
					timestamp: frame.timestamp,
					endTime: frame.timestamp + frame.duration,
				};

				this.writeIndex = (this.writeIndex + 1) % this.size;
				filled++;
				onProgress?.(filled, this.size);
			}
		} catch (error) {
			console.warn("[FrameRingBuffer] Fill error:", error);
		} finally {
			if (this.generation === generation) {
				this.filling = false;
				this.fillPromise = null;
			}
		}
	}
}

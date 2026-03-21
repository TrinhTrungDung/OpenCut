/**
 * Manages hidden HTML5 <video> elements for hardware-accelerated preview.
 * Used for both playback (native .play()) and scrubbing (setting .currentTime).
 * Replaces WASM decoding entirely for preview rendering.
 */

interface PoolEntry {
	element: HTMLVideoElement;
	blobUrl: string;
	mediaId: string;
	file: File;
	/** Last source-time we seeked to (avoid redundant seeks when paused) */
	lastSeekTime: number;
	/** Queued seek time while a previous seek is in-flight */
	pendingSeekTime: number | null;
}

class VideoElementPool {
	private pool = new Map<string, PoolEntry>();
	private container: HTMLDivElement | null = null;

	/**
	 * Get or create a <video> element for a timeline element.
	 * Key is elementId (not mediaId) so multiple clips from same source get separate elements.
	 */
	getElement({
		elementId,
		file,
		mediaId,
	}: {
		elementId: string;
		file: File;
		mediaId: string;
	}): HTMLVideoElement {
		const existing = this.pool.get(elementId);
		if (existing) {
			return existing.element;
		}

		this.ensureContainer();

		const blobUrl = URL.createObjectURL(file);
		const el = document.createElement("video");
		el.src = blobUrl;
		el.muted = true;
		el.playsInline = true;
		el.preload = "auto";
		el.style.display = "none";
		// When a seek completes, apply any queued seek or notify the preview.
		el.addEventListener("seeked", () => {
			const entry = this.pool.get(elementId);
			if (entry?.pendingSeekTime != null) {
				const next = entry.pendingSeekTime;
				entry.pendingSeekTime = null;
				entry.lastSeekTime = next;
				el.currentTime = next;
				return; // Wait for the chained seeked event
			}
			window.dispatchEvent(new Event("video-seeked"));
		});
		if (this.container) {
			this.container.appendChild(el);
		}

		this.pool.set(elementId, {
			element: el,
			blobUrl,
			mediaId,
			file,
			lastSeekTime: -1,
			pendingSeekTime: null,
		});
		return el;
	}

	/**
	 * Seek video to a source time if it differs from the last seek.
	 * Only seeks when paused (scrubbing) — during playback the <video> advances natively.
	 * Returns true if the element is actively seeking (frame not ready yet).
	 */
	seekIfNeeded({
		elementId,
		time,
	}: {
		elementId: string;
		time: number;
	}): boolean {
		const entry = this.pool.get(elementId);
		if (!entry) return false;

		// Don't seek during native playback — the <video> is advancing on its own
		if (!entry.element.paused) return false;

		// Only seek if time changed meaningfully (>16ms ~ 1 frame at 60fps)
		if (Math.abs(time - entry.lastSeekTime) > 0.016) {
			if (entry.element.seeking) {
				// A seek is in-flight — queue this one so only 1 seek runs at a time.
				// The seeked handler will apply it when the current seek finishes.
				entry.pendingSeekTime = time;
			} else {
				entry.element.currentTime = time;
				entry.lastSeekTime = time;
				entry.pendingSeekTime = null;
			}
		}

		return entry.element.seeking;
	}

	/** Pause all active video elements */
	pauseAll(): void {
		for (const entry of this.pool.values()) {
			entry.element.pause();
		}
	}

	/** Get a pool entry by element ID */
	getEntry(elementId: string): PoolEntry | undefined {
		return this.pool.get(elementId);
	}

	/** Iterate all entries */
	entries(): IterableIterator<[string, PoolEntry]> {
		return this.pool.entries();
	}

	/** Release a single element */
	release(elementId: string): void {
		const entry = this.pool.get(elementId);
		if (!entry) return;

		entry.element.pause();
		entry.element.removeAttribute("src");
		entry.element.load();
		URL.revokeObjectURL(entry.blobUrl);
		entry.element.remove();
		this.pool.delete(elementId);
	}

	/** Release all elements for a given mediaId */
	releaseByMediaId(mediaId: string): void {
		for (const [elementId, entry] of this.pool) {
			if (entry.mediaId === mediaId) {
				this.release(elementId);
			}
		}
	}

	/** Cleanup everything */
	dispose(): void {
		for (const [elementId] of this.pool) {
			this.release(elementId);
		}
		if (this.container) {
			this.container.remove();
			this.container = null;
		}
	}

	private ensureContainer(): void {
		if (this.container) return;
		this.container = document.createElement("div");
		this.container.style.cssText =
			"position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none";
		this.container.setAttribute("aria-hidden", "true");
		document.body.appendChild(this.container);
	}
}

export const videoElementPool = new VideoElementPool();

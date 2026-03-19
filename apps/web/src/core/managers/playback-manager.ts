import type { EditorCore } from "@/core";

export class PlaybackManager {
	private isPlaying = false;
	private currentTime = 0;
	private volume = 1;
	private muted = false;
	private previousVolume = 1;
	private isScrubbing = false;
	private listeners = new Set<() => void>();
	private playbackTimer: number | null = null;

	/** Monotonic clock: wall time when playback started */
	private playStartWall = 0;
	/** Timeline time when playback started */
	private playStartTime = 0;
	/** Throttle: last time we notified listeners during playback */
	private lastNotifyTime = 0;

	constructor(private editor: EditorCore) {}

	play(): void {
		const duration = this.editor.timeline.getTotalDuration();

		if (duration > 0) {
			if (this.currentTime >= duration) {
				this.seek({ time: 0 });
			}
		}

		this.isPlaying = true;
		this.playStartWall = performance.now();
		this.playStartTime = this.currentTime;
		this.startTimer();
		this.notify();
	}

	pause(): void {
		this.isPlaying = false;
		this.stopTimer();
		this.notify();
	}

	toggle(): void {
		if (this.isPlaying) {
			this.pause();
		} else {
			this.play();
		}
	}

	seek({ time }: { time: number }): void {
		const duration = this.editor.timeline.getTotalDuration();
		this.currentTime = Math.max(0, Math.min(duration, time));

		if (this.isPlaying) {
			this.playStartWall = performance.now();
			this.playStartTime = this.currentTime;
		}

		this.notify();

		window.dispatchEvent(
			new CustomEvent("playback-seek", {
				detail: { time: this.currentTime },
			}),
		);
	}

	setVolume({ volume }: { volume: number }): void {
		const clampedVolume = Math.max(0, Math.min(1, volume));
		this.volume = clampedVolume;
		this.muted = clampedVolume === 0;
		if (clampedVolume > 0) {
			this.previousVolume = clampedVolume;
		}
		this.notify();
	}

	mute(): void {
		if (this.volume > 0) {
			this.previousVolume = this.volume;
		}
		this.muted = true;
		this.volume = 0;
		this.notify();
	}

	unmute(): void {
		this.muted = false;
		this.volume = this.previousVolume;
		this.notify();
	}

	toggleMute(): void {
		if (this.muted) {
			this.unmute();
		} else {
			this.mute();
		}
	}

	getIsPlaying(): boolean {
		return this.isPlaying;
	}

	getCurrentTime(): number {
		return this.currentTime;
	}

	getVolume(): number {
		return this.volume;
	}

	isMuted(): boolean {
		return this.muted;
	}

	setScrubbing({ isScrubbing }: { isScrubbing: boolean }): void {
		this.isScrubbing = isScrubbing;
		this.notify();
	}

	getIsScrubbing(): boolean {
		return this.isScrubbing;
	}

	getIsBuffering(): boolean {
		return false;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}

	private startTimer(): void {
		if (this.playbackTimer) {
			cancelAnimationFrame(this.playbackTimer);
		}
		this.updateTime();
	}

	private stopTimer(): void {
		if (this.playbackTimer) {
			cancelAnimationFrame(this.playbackTimer);
			this.playbackTimer = null;
		}
	}

	private updateTime = (): void => {
		if (!this.isPlaying) return;

		// Monotonic clock: always correct time regardless of dropped frames
		const elapsed = (performance.now() - this.playStartWall) / 1000;
		const newTime = this.playStartTime + elapsed;
		const duration = this.editor.timeline.getTotalDuration();

		if (duration > 0 && newTime >= duration) {
			this.currentTime = duration;
			this.pause();

			window.dispatchEvent(
				new CustomEvent("playback-seek", {
					detail: { time: duration },
				}),
			);
		} else {
			this.currentTime = newTime;
			// Throttle notifications to ~15Hz during playback.
			// Preview canvas has its own RAF loop and reads getCurrentTime() directly.
			// Full 60Hz notify() causes re-render storm across all editor components.
			const now = performance.now();
			if (now - this.lastNotifyTime >= 66) {
				this.lastNotifyTime = now;
				this.notify();
			}
		}

		this.playbackTimer = requestAnimationFrame(this.updateTime);
	};
}

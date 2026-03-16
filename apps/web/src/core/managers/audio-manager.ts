import type { EditorCore } from "@/core";
import type { AudioClipSource } from "@/lib/media/audio";
import { createAudioContext, collectAudioClips } from "@/lib/media/audio";
import { resolveVolumeAtTime } from "@/lib/animation/resolve";
import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type WrappedAudioBuffer,
} from "mediabunny";

export class AudioManager {
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private playbackStartTime = 0;
	private playbackStartContextTime = 0;
	private scheduleTimer: number | null = null;
	private lookaheadSeconds = 3;
	private scheduleIntervalMs = 300;
	private clips: AudioClipSource[] = [];
	private sinks = new Map<string, AudioBufferSink>();
	private inputs = new Map<string, Input>();
	private activeClipIds = new Set<string>();
	private clipIterators = new Map<
		string,
		AsyncGenerator<WrappedAudioBuffer, void, unknown>
	>();
	private clipGains = new Map<string, GainNode>();
	private queuedSources = new Set<AudioBufferSourceNode>();
	/** Maps each queued source node to the clip ID that owns it */
	private sourceClipIds = new Map<AudioBufferSourceNode, string>();
	private playbackSessionId = 0;
	private lastIsPlaying = false;
	private lastVolume = 1;
	private playbackLatencyCompensationSeconds = 0;
	private timelineChangeTimer: number | null = null;
	private unsubscribers: Array<() => void> = [];

	constructor(private editor: EditorCore) {
		this.lastVolume = this.editor.playback.getVolume();

		this.unsubscribers.push(
			this.editor.playback.subscribe(this.handlePlaybackChange),
			this.editor.timeline.subscribe(this.handleTimelineChange),
			this.editor.media.subscribe(this.handleTimelineChange),
		);
		if (typeof window !== "undefined") {
			window.addEventListener("playback-seek", this.handleSeek);
		}
	}

	dispose(): void {
		if (this.timelineChangeTimer) {
			clearTimeout(this.timelineChangeTimer);
			this.timelineChangeTimer = null;
		}
		this.stopPlayback();
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		if (typeof window !== "undefined") {
			window.removeEventListener("playback-seek", this.handleSeek);
		}
		this.disposeSinks();
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
			this.masterGain = null;
		}
	}

	private handlePlaybackChange = (): void => {
		const isPlaying = this.editor.playback.getIsPlaying();
		const volume = this.editor.playback.getVolume();

		if (volume !== this.lastVolume) {
			this.lastVolume = volume;
			this.updateGain();
		}

		if (isPlaying !== this.lastIsPlaying) {
			this.lastIsPlaying = isPlaying;
			if (isPlaying) {
				void this.startPlayback({
					time: this.editor.playback.getCurrentTime(),
				});
			} else {
				this.stopPlayback();
			}
		}
	};

	private handleSeek = (event: Event): void => {
		const detail = (event as CustomEvent<{ time: number }>).detail;
		if (!detail) return;

		if (this.editor.playback.getIsScrubbing()) {
			this.stopPlayback();
			return;
		}

		if (this.editor.playback.getIsPlaying()) {
			void this.startPlayback({ time: detail.time });
			return;
		}

		this.stopPlayback();
	};

	private handleTimelineChange = (): void => {
		if (this.timelineChangeTimer) {
			clearTimeout(this.timelineChangeTimer);
		}
		this.timelineChangeTimer = window.setTimeout(() => {
			this.timelineChangeTimer = null;
			if (!this.editor.playback.getIsPlaying()) return;

			const { structure, speed } = this.computeFingerprints();

			/* If structure changed (add/remove/mute/move clips), full restart */
			if (structure !== this.lastStructureFingerprint) {
				this.lastStructureFingerprint = structure;
				this.lastSpeedFingerprint = speed;
				this.crossfadeRestart();
				return;
			}

			/* If only speed changed, update playbackRate on existing nodes in-place */
			if (speed !== this.lastSpeedFingerprint) {
				this.lastSpeedFingerprint = speed;
				this.updatePlaybackRates();
			}
		}, 300);
	};

	/** Separate fingerprints: structure (needs restart) vs speed (can update in-place) */
	private lastStructureFingerprint = "";
	private lastSpeedFingerprint = "";

	private computeFingerprints(): { structure: string; speed: string } {
		const tracks = this.editor.timeline.getTracks();
		const structureParts: string[] = [];
		const speedParts: string[] = [];
		for (const track of tracks) {
			const muted = "muted" in track && track.muted;
			for (const el of track.elements) {
				if (el.type !== "audio" && el.type !== "video") continue;
				const elMuted = "muted" in el ? el.muted : false;
				structureParts.push(`${el.id}:${el.startTime}:${el.trimStart}:${muted || elMuted}`);
				speedParts.push(`${el.id}:${el.speed ?? 1}`);
			}
		}
		return {
			structure: structureParts.join("|"),
			speed: speedParts.join("|"),
		};
	}

	/** Update playbackRate on all queued source nodes without restarting audio */
	private updatePlaybackRates(): void {
		/* Build a map of clip ID → new speed from current tracks */
		const speedMap = new Map<string, number>();
		const tracks = this.editor.timeline.getTracks();
		for (const track of tracks) {
			for (const el of track.elements) {
				if (el.type !== "audio" && el.type !== "video") continue;
				speedMap.set(el.id, el.speed ?? 1);
			}
		}

		/* Also update the internal clips array so future buffers use new speed */
		for (const clip of this.clips) {
			const newSpeed = speedMap.get(clip.id);
			if (newSpeed !== undefined) {
				clip.speed = newSpeed;
			}
		}

		/* Update existing queued source nodes */
		for (const source of this.queuedSources) {
			const clipId = this.sourceClipIds.get(source);
			if (!clipId) continue;
			const newSpeed = speedMap.get(clipId);
			if (newSpeed !== undefined) {
				source.playbackRate.value = newSpeed;
			}
		}
	}

	/**
	 * Crossfade restart: fade out over 50ms, then start new playback.
	 * Keeps sinks alive so the new playback starts quickly.
	 */
	private crossfadeRestart(): void {
		const audioContext = this.audioContext;
		if (!audioContext || !this.masterGain) return;

		const now = audioContext.currentTime;
		const fadeMs = 50;
		const fadeSec = fadeMs / 1000;

		/* Ramp master gain to 0 */
		this.masterGain.gain.setValueAtTime(this.lastVolume, now);
		this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);

		/* Capture the target time now so it's accurate */
		const resumeTime = this.editor.playback.getCurrentTime();

		setTimeout(() => {
			if (!this.masterGain || !this.editor.playback.getIsPlaying()) return;

			/* Stop old sources */
			this.stopPlayback();

			/* Restore gain immediately */
			this.masterGain.gain.cancelScheduledValues(0);
			this.masterGain.gain.value = this.lastVolume;

			/* Start new playback — sinks are still alive so this is fast */
			void this.startPlayback({ time: resumeTime });
		}, fadeMs + 5);
	}

	private ensureAudioContext(): AudioContext | null {
		if (this.audioContext) return this.audioContext;
		if (typeof window === "undefined") return null;

		/* Use default sample rate — Web Audio API handles resampling automatically */
		this.audioContext = createAudioContext();
		this.masterGain = this.audioContext.createGain();
		this.masterGain.gain.value = this.lastVolume;
		this.masterGain.connect(this.audioContext.destination);

		/* Log sample rate for debugging audio clicking issues */
		console.debug(`[AudioManager] AudioContext sampleRate: ${this.audioContext.sampleRate}`);
		return this.audioContext;
	}

	private updateGain(): void {
		if (!this.masterGain) return;
		this.masterGain.gain.value = this.lastVolume;
	}

	private getOrCreateClipGain({
		clipId,
		audioContext,
	}: {
		clipId: string;
		audioContext: AudioContext;
	}): GainNode {
		let gain = this.clipGains.get(clipId);
		if (!gain) {
			gain = audioContext.createGain();
			gain.connect(this.masterGain ?? audioContext.destination);
			this.clipGains.set(clipId, gain);
		}
		return gain;
	}

	private getPlaybackTime(): number {
		if (!this.audioContext) return this.playbackStartTime;
		const elapsed =
			this.audioContext.currentTime - this.playbackStartContextTime;
		return this.playbackStartTime + elapsed;
	}

	private async startPlayback({ time }: { time: number }): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		this.stopPlayback();
		this.playbackSessionId++;
		this.playbackLatencyCompensationSeconds = 0;

		const tracks = this.editor.timeline.getTracks();
		const mediaAssets = this.editor.media.getAssets();
		const duration = this.editor.timeline.getTotalDuration();

		if (duration <= 0) return;

		if (audioContext.state === "suspended") {
			await audioContext.resume();
		}

		this.clips = await collectAudioClips({ tracks, mediaAssets });
		if (!this.editor.playback.getIsPlaying()) return;

		const fp = this.computeFingerprints();
		this.lastStructureFingerprint = fp.structure;
		this.lastSpeedFingerprint = fp.speed;
		this.playbackStartTime = time;
		this.playbackStartContextTime = audioContext.currentTime;

		this.scheduleUpcomingClips();

		if (typeof window !== "undefined") {
			this.scheduleTimer = window.setInterval(() => {
				this.scheduleUpcomingClips();
			}, this.scheduleIntervalMs);
		}
	}

	private scheduleUpcomingClips(): void {
		if (!this.editor.playback.getIsPlaying()) return;

		const currentTime = this.getPlaybackTime();
		const windowEnd = currentTime + this.lookaheadSeconds;

		for (const clip of this.clips) {
			if (clip.muted) continue;
			if (this.activeClipIds.has(clip.id)) continue;

			const clipEnd = clip.startTime + clip.duration;
			if (clipEnd <= currentTime) continue;
			if (clip.startTime > windowEnd) continue;

			this.activeClipIds.add(clip.id);
			void this.runClipIterator({
				clip,
				startTime: currentTime,
				sessionId: this.playbackSessionId,
			});
		}
	}

	private stopPlayback(): void {
		if (this.scheduleTimer && typeof window !== "undefined") {
			window.clearInterval(this.scheduleTimer);
		}
		this.scheduleTimer = null;

		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();

		for (const source of this.queuedSources) {
			try {
				source.stop();
			} catch {}
			source.disconnect();
		}
		this.queuedSources.clear();
		this.sourceClipIds.clear();

		for (const gain of this.clipGains.values()) {
			gain.disconnect();
		}
		this.clipGains.clear();
	}

	private async runClipIterator({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		const sink = await this.getAudioSink({ clip });
		if (!sink || !this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		const clipStart = clip.startTime;
		const clipEnd = clip.startTime + clip.duration;
		const playbackTimeAfterSinkReady = this.getPlaybackTime();
		const iteratorStartTime = Math.max(
			startTime,
			clipStart,
			playbackTimeAfterSinkReady,
		);
		if (iteratorStartTime >= clipEnd) {
			return;
		}
		const clipSpeed = clip.speed ?? 1;
		const sourceStartTime =
			clip.trimStart + (iteratorStartTime - clip.startTime) * clipSpeed;

		const iterator = sink.buffers(sourceStartTime);
		this.clipIterators.set(clip.id, iterator);
		let consecutiveDroppedBufferCount = 0;

		const clipGain = this.getOrCreateClipGain({
			clipId: clip.id,
			audioContext,
		});

		for await (const { buffer, timestamp } of iterator) {
			if (!this.editor.playback.getIsPlaying()) return;
			if (sessionId !== this.playbackSessionId) return;

			const timelineTime = clip.startTime + (timestamp - clip.trimStart) / clipSpeed;
			if (timelineTime >= clipEnd) break;

			const node = audioContext.createBufferSource();
			node.buffer = buffer;
			node.playbackRate.value = clip.speed ?? 1;
			/* Keep Pitch: prevent chipmunk/slow-motion voice distortion */
			if ("preservesPitch" in node) {
				node.preservesPitch = true;
			}
			node.connect(clipGain);

			const startTimestamp =
				this.playbackStartContextTime +
				this.playbackLatencyCompensationSeconds +
				(timelineTime - this.playbackStartTime);

			// Schedule per-clip volume from keyframe animation
			const localTime = timelineTime - clip.startTime;
			const clipAny = clip as AudioClipSource & {
				volume?: number;
				animations?: unknown;
			};
			const volume = resolveVolumeAtTime({
				baseVolume: clipAny.volume ?? 1,
				animations: clipAny.animations as Parameters<typeof resolveVolumeAtTime>[0]["animations"],
				localTime,
			});
			const audioTime = Math.max(startTimestamp, audioContext.currentTime);
			clipGain.gain.setValueAtTime(Math.max(0.0001, volume), audioTime);

			if (startTimestamp >= audioContext.currentTime) {
				node.start(startTimestamp);
				consecutiveDroppedBufferCount = 0;
			} else {
				const offset = audioContext.currentTime - startTimestamp;
				const effectiveBufferDuration = buffer.duration / clipSpeed;
				if (offset < effectiveBufferDuration) {
					node.start(audioContext.currentTime, offset * clipSpeed);
					consecutiveDroppedBufferCount = 0;
				} else {
					console.debug(`[AudioManager] Dropped buffer: offset=${offset.toFixed(3)}s behind`);
					consecutiveDroppedBufferCount += 1;
					if (consecutiveDroppedBufferCount >= 5) {
						const nextCompensationSeconds = Math.max(
							this.playbackLatencyCompensationSeconds,
							Math.min(0.25, offset + 0.01),
						);
						if (
							nextCompensationSeconds >
							this.playbackLatencyCompensationSeconds + 0.001
						) {
							this.playbackLatencyCompensationSeconds =
								nextCompensationSeconds;
						}
						const resyncStartTime = this.getPlaybackTime();
						this.clipIterators.delete(clip.id);
						void this.runClipIterator({
							clip,
							startTime: resyncStartTime,
							sessionId,
						});
						return;
					}
					continue;
				}
			}

			this.queuedSources.add(node);
			this.sourceClipIds.set(node, clip.id);
			node.addEventListener("ended", () => {
				node.disconnect();
				this.queuedSources.delete(node);
				this.sourceClipIds.delete(node);
			});

			const aheadTime = timelineTime - this.getPlaybackTime();
			if (aheadTime >= 2) {
				await this.waitUntilCaughtUp({ timelineTime, targetAhead: 1.5 });
				if (sessionId !== this.playbackSessionId) return;
			}
		}

		this.clipIterators.delete(clip.id);
		// don't remove from activeClipIds - prevents scheduler from restarting this clip
		// the set is cleared on stopPlayback anyway
	}

	private waitUntilCaughtUp({
		timelineTime,
		targetAhead,
	}: {
		timelineTime: number;
		targetAhead: number;
	}): Promise<void> {
		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				if (!this.editor.playback.getIsPlaying()) {
					clearInterval(checkInterval);
					resolve();
					return;
				}

				const playbackTime = this.getPlaybackTime();
				if (timelineTime - playbackTime < targetAhead) {
					clearInterval(checkInterval);
					resolve();
				}
			}, 100);
		});
	}

	private disposeSinks(): void {
		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();

		for (const gain of this.clipGains.values()) {
			gain.disconnect();
		}
		this.clipGains.clear();

		for (const input of this.inputs.values()) {
			input.dispose();
		}
		this.inputs.clear();
		this.sinks.clear();
	}

	private async getAudioSink({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBufferSink | null> {
		const existingSink = this.sinks.get(clip.sourceKey);
		if (existingSink) return existingSink;

		try {
			const input = new Input({
				source: new BlobSource(clip.file),
				formats: ALL_FORMATS,
			});
			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				input.dispose();
				return null;
			}

			const sink = new AudioBufferSink(audioTrack);
			this.inputs.set(clip.sourceKey, input);
			this.sinks.set(clip.sourceKey, sink);
			return sink;
		} catch (error) {
			console.warn("Failed to initialize audio sink:", error);
			return null;
		}
	}
}

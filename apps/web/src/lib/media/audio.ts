import type {
	AudioElement,
	LibraryAudioElement,
	TimelineElement,
	TimelineTrack,
} from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import type { ElementAnimations } from "@/types/animation";
import { canElementHaveAudio } from "@/lib/timeline/element-utils";
import { canTracktHaveAudio } from "@/lib/timeline";
import { mediaSupportsAudio } from "@/lib/media/media-utils";
import { getVideoAudioFile } from "@/lib/media/video-audio-cache";
import { resolveVolumeAtTime } from "@/lib/animation";


const EXPORT_SAMPLE_RATE = 44100;

export type CollectedAudioElement = Omit<
	AudioElement,
	"type" | "mediaId" | "volume" | "id" | "name" | "sourceType" | "sourceUrl"
> & { buffer: AudioBuffer; volume: number; animations?: ElementAnimations };

export function createAudioContext({ sampleRate }: { sampleRate?: number } = {}): AudioContext {
	const AudioContextConstructor =
		window.AudioContext ||
		(window as typeof window & { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;

	return new AudioContextConstructor(sampleRate ? { sampleRate } : undefined);
}

export interface DecodedAudio {
	samples: Float32Array;
	sampleRate: number;
}

export async function decodeAudioToFloat32({
	audioBlob,
}: {
	audioBlob: Blob;
}): Promise<DecodedAudio> {
	const audioContext = createAudioContext();
	const arrayBuffer = await audioBlob.arrayBuffer();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

	// mix down to mono
	const numChannels = audioBuffer.numberOfChannels;
	const length = audioBuffer.length;
	const samples = new Float32Array(length);

	for (let i = 0; i < length; i++) {
		let sum = 0;
		for (let channel = 0; channel < numChannels; channel++) {
			sum += audioBuffer.getChannelData(channel)[i];
		}
		samples[i] = sum / numChannels;
	}

	return { samples, sampleRate: audioBuffer.sampleRate };
}

export async function collectAudioElements({
	tracks,
	mediaAssets,
	audioContext,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	audioContext: AudioContext;
}): Promise<CollectedAudioElement[]> {
	const mediaMap = new Map<string, MediaAsset>(
		mediaAssets.map((media) => [media.id, media]),
	);
	const pendingElements: Array<Promise<CollectedAudioElement | null>> = [];

	for (const track of tracks) {
		if (canTracktHaveAudio(track) && track.muted) continue;

		for (const element of track.elements) {
			if (!canElementHaveAudio(element)) continue;
			if (element.duration <= 0) continue;

			const isTrackMuted = canTracktHaveAudio(track) && track.muted;

			if (element.type === "audio") {
				pendingElements.push(
					resolveAudioBufferForElement({
						element,
						mediaMap,
						audioContext,
					}).then((audioBuffer) => {
						if (!audioBuffer) return null;
						return {
							buffer: audioBuffer,
							startTime: element.startTime,
							duration: element.duration,
							trimStart: element.trimStart,
							trimEnd: element.trimEnd,
							muted: element.muted || isTrackMuted,
							volume: element.volume,
							animations: element.animations,
						};
					}),
				);
				continue;
			}

			if (element.type === "video") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset || !mediaSupportsAudio({ media: mediaAsset })) continue;

				/* Use pre-extracted audio file for video elements */
				const el = element;
				const ma = mediaAsset;
				pendingElements.push(
					getVideoAudioFile({
						mediaAssetId: ma.id,
						videoFile: ma.file,
					}).then(async (cached) => {
						if (!cached) return null;
						const arrayBuffer = await cached.file.arrayBuffer();
						const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
						const elementMuted = el.muted ?? false;
						return {
							buffer: audioBuffer,
							startTime: el.startTime,
							duration: el.duration,
							trimStart: el.trimStart,
							trimEnd: el.trimEnd,
							muted: elementMuted || isTrackMuted,
							volume: 1,
							animations: el.animations,
						};
					}),
				);
			}
		}
	}

	const resolvedElements = await Promise.all(pendingElements);
	const audioElements: CollectedAudioElement[] = [];
	for (const element of resolvedElements) {
		if (element) audioElements.push(element);
	}
	return audioElements;
}

async function resolveAudioBufferForElement({
	element,
	mediaMap,
	audioContext,
}: {
	element: AudioElement;
	mediaMap: Map<string, MediaAsset>;
	audioContext: AudioContext;
}): Promise<AudioBuffer | null> {
	try {
		if (element.sourceType === "upload") {
			const asset = mediaMap.get(element.mediaId);
			if (!asset || asset.type !== "audio") return null;

			const arrayBuffer = await asset.file.arrayBuffer();
			return await audioContext.decodeAudioData(arrayBuffer.slice(0));
		}

		if (element.buffer) return element.buffer;

		const response = await fetch(element.sourceUrl);
		if (!response.ok) {
			throw new Error(`Library audio fetch failed: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		return await audioContext.decodeAudioData(arrayBuffer.slice(0));
	} catch (error) {
		console.warn("Failed to decode audio:", error);
		return null;
	}
}

interface AudioMixSource {
	file: File;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
}

export interface AudioClipSource {
	id: string;
	sourceKey: string;
	file: File;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
	muted: boolean;
	/** Playback speed multiplier (default 1.0) */
	speed: number;
}

async function fetchLibraryAudioSource({
	element,
}: {
	element: LibraryAudioElement;
}): Promise<AudioMixSource | null> {
	try {
		const response = await fetch(element.sourceUrl);
		if (!response.ok) {
			throw new Error(`Library audio fetch failed: ${response.status}`);
		}

		const blob = await response.blob();
		const file = new File([blob], `${element.name}.mp3`, {
			type: "audio/mpeg",
		});

		return {
			file,
			startTime: element.startTime,
			duration: element.duration,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
		};
	} catch (error) {
		console.warn("Failed to fetch library audio:", error);
		return null;
	}
}

async function fetchLibraryAudioClip({
	element,
	muted,
}: {
	element: LibraryAudioElement;
	muted: boolean;
}): Promise<AudioClipSource | null> {
	try {
		const response = await fetch(element.sourceUrl);
		if (!response.ok) {
			throw new Error(`Library audio fetch failed: ${response.status}`);
		}

		const blob = await response.blob();
		const file = new File([blob], `${element.name}.mp3`, {
			type: "audio/mpeg",
		});

		return {
			id: element.id,
			sourceKey: element.id,
			file,
			startTime: element.startTime,
			duration: element.duration,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			muted,
			speed: element.speed ?? 1,
		};
	} catch (error) {
		console.warn("Failed to fetch library audio:", error);
		return null;
	}
}

function collectMediaAudioSource({
	element,
	mediaAsset,
}: {
	element: TimelineElement;
	mediaAsset: MediaAsset;
}): AudioMixSource {
	return {
		file: mediaAsset.file,
		startTime: element.startTime,
		duration: element.duration,
		trimStart: element.trimStart,
		trimEnd: element.trimEnd,
	};
}

function collectMediaAudioClip({
	element,
	mediaAsset,
	muted,
}: {
	element: TimelineElement;
	mediaAsset: MediaAsset;
	muted: boolean;
}): AudioClipSource {
	return {
		id: element.id,
		sourceKey: mediaAsset.id,
		file: mediaAsset.file,
		startTime: element.startTime,
		duration: element.duration,
		trimStart: element.trimStart,
		trimEnd: element.trimEnd,
		muted,
		speed: element.speed ?? 1,
	};
}

export async function collectAudioMixSources({
	tracks,
	mediaAssets,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
}): Promise<AudioMixSource[]> {
	const audioMixSources: AudioMixSource[] = [];
	const mediaMap = new Map<string, MediaAsset>(
		mediaAssets.map((asset) => [asset.id, asset]),
	);
	const pendingSources: Array<Promise<AudioMixSource | null>> = [];

	for (const track of tracks) {
		if (canTracktHaveAudio(track) && track.muted) continue;

		for (const element of track.elements) {
			if (!canElementHaveAudio(element)) continue;

			if (element.type === "audio") {
				if (element.sourceType === "upload") {
					const mediaAsset = mediaMap.get(element.mediaId);
					if (!mediaAsset) continue;

					audioMixSources.push(
						collectMediaAudioSource({ element, mediaAsset }),
					);
				} else {
					pendingSources.push(fetchLibraryAudioSource({ element }));
				}
				continue;
			}

			if (element.type === "video") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset) continue;

				if (mediaSupportsAudio({ media: mediaAsset })) {
					/* Use pre-extracted audio for video elements */
					const el = element;
					const ma = mediaAsset;
					pendingSources.push(
						getVideoAudioFile({
							mediaAssetId: ma.id,
							videoFile: ma.file,
						}).then((cached) => {
							if (!cached) return null;
							return {
								file: cached.file,
								startTime: el.startTime,
								duration: el.duration,
								trimStart: el.trimStart,
								trimEnd: el.trimEnd,
							};
						}),
					);
				}
			}
		}
	}

	const resolvedSources = await Promise.all(pendingSources);
	for (const source of resolvedSources) {
		if (source) audioMixSources.push(source);
	}

	return audioMixSources;
}

export async function collectAudioClips({
	tracks,
	mediaAssets,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
}): Promise<AudioClipSource[]> {
	const clips: AudioClipSource[] = [];
	const mediaMap = new Map<string, MediaAsset>(
		mediaAssets.map((asset) => [asset.id, asset]),
	);
	const pendingClips: Array<Promise<AudioClipSource | null>> = [];

	for (const track of tracks) {
		const isTrackMuted = canTracktHaveAudio(track) && track.muted;

		for (const element of track.elements) {
			if (!canElementHaveAudio(element)) continue;

			const isElementMuted =
				"muted" in element ? (element.muted ?? false) : false;
			const muted = isTrackMuted || isElementMuted;

			if (element.type === "audio") {
				if (element.sourceType === "upload") {
					const mediaAsset = mediaMap.get(element.mediaId);
					if (!mediaAsset) continue;

					clips.push(
						collectMediaAudioClip({
							element,
							mediaAsset,
							muted,
						}),
					);
				} else {
					pendingClips.push(fetchLibraryAudioClip({ element, muted }));
				}
				continue;
			}

			if (element.type === "video") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset) continue;

				if (mediaSupportsAudio({ media: mediaAsset })) {
					/* Use pre-extracted audio file instead of raw video container.
					   This separates video and audio processing completely —
					   the audio pipeline never touches the video demuxer. */
					const el = element;
					const ma = mediaAsset;
					pendingClips.push(
						getVideoAudioFile({
							mediaAssetId: ma.id,
							videoFile: ma.file,
						}).then((cached) => {
							if (!cached) return null;
							return {
								id: el.id,
								sourceKey: `${ma.id}-audio`,
								file: cached.file,
								startTime: el.startTime,
								duration: el.duration,
								trimStart: el.trimStart,
								trimEnd: el.trimEnd,
								muted,
								speed: el.speed ?? 1,
							};
						}),
					);
				}
			}
		}
	}

	const resolvedClips = await Promise.all(pendingClips);
	for (const clip of resolvedClips) {
		if (clip) clips.push(clip);
	}

	return clips;
}

export async function createTimelineAudioBuffer({
	tracks,
	mediaAssets,
	duration,
	sampleRate = EXPORT_SAMPLE_RATE,
	audioContext,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	sampleRate?: number;
	audioContext?: AudioContext;
}): Promise<AudioBuffer | null> {
	const context = audioContext ?? createAudioContext({ sampleRate });

	const audioElements = await collectAudioElements({
		tracks,
		mediaAssets,
		audioContext: context,
	});

	if (audioElements.length === 0) return null;

	const outputChannels = 2;
	const outputLength = Math.ceil(duration * sampleRate);
	const outputBuffer = context.createBuffer(
		outputChannels,
		outputLength,
		sampleRate,
	);

	for (const element of audioElements) {
		if (element.muted) continue;

		mixAudioChannels({
			element,
			outputBuffer,
			outputLength,
			sampleRate,
		});
	}

	return outputBuffer;
}

function mixAudioChannels({
	element,
	outputBuffer,
	outputLength,
	sampleRate,
}: {
	element: CollectedAudioElement;
	outputBuffer: AudioBuffer;
	outputLength: number;
	sampleRate: number;
}): void {
	const { buffer, startTime, trimStart, duration: elementDuration } = element;

	const sourceStartSample = Math.floor(trimStart * buffer.sampleRate);
	const sourceLengthSamples = Math.floor(elementDuration * buffer.sampleRate);
	const outputStartSample = Math.floor(startTime * sampleRate);

	const resampleRatio = sampleRate / buffer.sampleRate;
	const resampledLength = Math.floor(sourceLengthSamples * resampleRatio);

	const outputChannels = 2;
	for (let channel = 0; channel < outputChannels; channel++) {
		const outputData = outputBuffer.getChannelData(channel);
		const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
		const sourceData = buffer.getChannelData(sourceChannel);

		for (let i = 0; i < resampledLength; i++) {
			const outputIndex = outputStartSample + i;
			if (outputIndex >= outputLength) break;

			const sourceIndex = sourceStartSample + Math.floor(i / resampleRatio);
			if (sourceIndex >= sourceData.length) break;

			const localTime = (i / resampleRatio) / buffer.sampleRate;
			const volume = resolveVolumeAtTime({
				baseVolume: element.volume,
				animations: element.animations,
				localTime,
			});

			outputData[outputIndex] += sourceData[sourceIndex] * volume;
		}
	}
}

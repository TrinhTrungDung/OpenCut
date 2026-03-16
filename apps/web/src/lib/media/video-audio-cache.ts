/**
 * Pre-extracts and caches audio streams from video files.
 *
 * CapCut (and all professional NLEs) treat video and audio as separate streams.
 * This cache demuxes audio from video containers at load time, so the audio
 * playback pipeline always works with clean audio files — never on-the-fly
 * demuxing from video containers during playback.
 */

import { extractAudioFromVideo } from "./extract-audio-from-video";

interface CachedAudioEntry {
	file: File;
	duration: number;
}

/** In-flight extraction promises to avoid duplicate work */
const pendingExtractions = new Map<string, Promise<CachedAudioEntry | null>>();

/** Completed extractions */
const cache = new Map<string, CachedAudioEntry>();

/**
 * Get a clean audio File extracted from a video file.
 * Returns cached result on subsequent calls for the same media asset.
 */
export async function getVideoAudioFile({
	mediaAssetId,
	videoFile,
}: {
	mediaAssetId: string;
	videoFile: File;
}): Promise<CachedAudioEntry | null> {
	/* Return from cache if already extracted */
	const cached = cache.get(mediaAssetId);
	if (cached) return cached;

	/* If extraction is already in progress, wait for it */
	const pending = pendingExtractions.get(mediaAssetId);
	if (pending) return pending;

	/* Start extraction */
	const extraction = doExtract({ mediaAssetId, videoFile });
	pendingExtractions.set(mediaAssetId, extraction);

	try {
		const result = await extraction;
		if (result) {
			cache.set(mediaAssetId, result);
		}
		return result;
	} finally {
		pendingExtractions.delete(mediaAssetId);
	}
}

async function doExtract({
	mediaAssetId,
	videoFile,
}: {
	mediaAssetId: string;
	videoFile: File;
}): Promise<CachedAudioEntry | null> {
	try {
		const { blob, duration } = await extractAudioFromVideo({
			file: videoFile,
		});

		const nameWithoutExt = videoFile.name.replace(/\.[^/.]+$/, "");
		const audioFile = new File([blob], `${nameWithoutExt}-audio.wav`, {
			type: "audio/wav",
		});

		return { file: audioFile, duration };
	} catch (error) {
		console.warn(
			`[VideoAudioCache] Failed to extract audio from ${videoFile.name}:`,
			error,
		);
		return null;
	}
}

/** Pre-warm the cache for a video file (call at import time) */
export function preExtractAudio({
	mediaAssetId,
	videoFile,
}: {
	mediaAssetId: string;
	videoFile: File;
}): void {
	if (cache.has(mediaAssetId) || pendingExtractions.has(mediaAssetId)) return;
	/* Fire and forget — extraction runs in background */
	void getVideoAudioFile({ mediaAssetId, videoFile });
}

/** Remove a cached entry (when media asset is removed) */
export function evictVideoAudio({
	mediaAssetId,
}: {
	mediaAssetId: string;
}): void {
	cache.delete(mediaAssetId);
}

/** Clear entire cache */
export function clearVideoAudioCache(): void {
	cache.clear();
	pendingExtractions.clear();
}

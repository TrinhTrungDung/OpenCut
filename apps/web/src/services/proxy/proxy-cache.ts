/**
 * Caches proxy files for video assets.
 * Follows the same pattern as video-audio-cache.ts — pre-generate on import,
 * serve from cache during playback.
 */

import { generateProxy } from "./proxy-generator";

interface ProxyCacheEntry {
	file: File;
}

/** In-flight proxy generation promises */
const pendingGenerations = new Map<string, Promise<ProxyCacheEntry | null>>();

/** Completed proxy files */
const cache = new Map<string, ProxyCacheEntry>();

/** Progress listeners for UI feedback */
type ProgressListener = (progress: number) => void;
const progressListeners = new Map<string, Set<ProgressListener>>();

/**
 * Get the proxy file for a video asset.
 * Returns null if proxy not yet generated or generation failed.
 */
export function getProxyFile({
	mediaAssetId,
}: {
	mediaAssetId: string;
}): File | null {
	return cache.get(mediaAssetId)?.file ?? null;
}

/**
 * Get the proxy file, generating it if needed (async).
 */
export async function getOrGenerateProxy({
	mediaAssetId,
	videoFile,
}: {
	mediaAssetId: string;
	videoFile: File;
}): Promise<ProxyCacheEntry | null> {
	const cached = cache.get(mediaAssetId);
	if (cached) return cached;

	const pending = pendingGenerations.get(mediaAssetId);
	if (pending) return pending;

	const generation = doGenerate({ mediaAssetId, videoFile });
	pendingGenerations.set(mediaAssetId, generation);

	try {
		const result = await generation;
		if (result) {
			cache.set(mediaAssetId, result);
		}
		return result;
	} finally {
		pendingGenerations.delete(mediaAssetId);
	}
}

async function doGenerate({
	mediaAssetId,
	videoFile,
}: {
	mediaAssetId: string;
	videoFile: File;
}): Promise<ProxyCacheEntry | null> {
	try {
		const file = await generateProxy({
			file: videoFile,
			onProgress: ({ progress }) => {
				const listeners = progressListeners.get(mediaAssetId);
				if (listeners) {
					for (const listener of listeners) {
						listener(progress);
					}
				}
			},
		});

		return { file };
	} catch (error) {
		console.warn(
			`[ProxyCache] Failed to generate proxy for ${videoFile.name}:`,
			error,
		);
		return null;
	}
}

/** Pre-warm: start proxy generation in background (call at import time) */
export function preGenerateProxy({
	mediaAssetId,
	videoFile,
}: {
	mediaAssetId: string;
	videoFile: File;
}): void {
	if (cache.has(mediaAssetId) || pendingGenerations.has(mediaAssetId)) return;
	void getOrGenerateProxy({ mediaAssetId, videoFile });
}

/** Check if proxy is ready (sync check for render path) */
export function hasProxy({
	mediaAssetId,
}: {
	mediaAssetId: string;
}): boolean {
	return cache.has(mediaAssetId);
}

/** Check if proxy is currently being generated */
export function isGeneratingProxy({
	mediaAssetId,
}: {
	mediaAssetId: string;
}): boolean {
	return pendingGenerations.has(mediaAssetId);
}

/** Subscribe to generation progress for a specific asset */
export function onProxyProgress({
	mediaAssetId,
	listener,
}: {
	mediaAssetId: string;
	listener: ProgressListener;
}): () => void {
	let listeners = progressListeners.get(mediaAssetId);
	if (!listeners) {
		listeners = new Set();
		progressListeners.set(mediaAssetId, listeners);
	}
	listeners.add(listener);

	return () => {
		listeners!.delete(listener);
		if (listeners!.size === 0) {
			progressListeners.delete(mediaAssetId);
		}
	};
}

/** Remove a cached proxy (when media asset is removed) */
export function evictProxy({
	mediaAssetId,
}: {
	mediaAssetId: string;
}): void {
	cache.delete(mediaAssetId);
	progressListeners.delete(mediaAssetId);
}

/** Clear entire proxy cache */
export function clearProxyCache(): void {
	cache.clear();
	pendingGenerations.clear();
	progressListeners.clear();
}

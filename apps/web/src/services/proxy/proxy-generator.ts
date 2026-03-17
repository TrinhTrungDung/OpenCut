/**
 * Generates low-resolution proxy files from video sources using FFmpeg WASM.
 * Proxy files (540p H.264) decode 4-8x faster than 4K originals, enabling
 * smooth preview playback while preserving full-res originals for export.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const PROXY_HEIGHT = 540;
const PROXY_BITRATE = "2M";
const PROXY_PRESET = "ultrafast";

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureFFmpeg(): Promise<FFmpeg> {
	if (ffmpeg?.loaded) return ffmpeg;

	if (loadPromise) {
		await loadPromise;
		return ffmpeg!;
	}

	ffmpeg = new FFmpeg();

	loadPromise = (async () => {
		const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
		await ffmpeg!.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(
				`${baseURL}/ffmpeg-core.wasm`,
				"application/wasm",
			),
		});
	})();

	try {
		await loadPromise;
	} catch (error) {
		ffmpeg = null;
		loadPromise = null;
		throw error;
	}

	return ffmpeg;
}

export async function generateProxy({
	file,
	onProgress,
}: {
	file: File;
	onProgress?: ({ progress }: { progress: number }) => void;
}): Promise<File> {
	const ff = await ensureFFmpeg();

	onProgress?.({ progress: 5 });

	const inputName = "input" + getExtension(file.name);
	const outputName = "proxy.mp4";

	await ff.writeFile(inputName, await fetchFile(file));

	onProgress?.({ progress: 15 });

	ff.on("progress", ({ progress }) => {
		onProgress?.({ progress: 15 + Math.floor(progress * 75) });
	});

	await ff.exec([
		"-i",
		inputName,
		"-vf",
		`scale=-2:${PROXY_HEIGHT}`,
		"-c:v",
		"libx264",
		"-preset",
		PROXY_PRESET,
		"-b:v",
		PROXY_BITRATE,
		"-an", // strip audio — handled separately by audio pipeline
		"-y",
		outputName,
	]);

	onProgress?.({ progress: 92 });

	const data = await ff.readFile(outputName);
	const blob = new Blob([data], { type: "video/mp4" });

	// Clean up FFmpeg filesystem
	await ff.deleteFile(inputName);
	await ff.deleteFile(outputName);

	const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
	const proxyFile = new File([blob], `${nameWithoutExt}-proxy.mp4`, {
		type: "video/mp4",
	});

	onProgress?.({ progress: 100 });

	return proxyFile;
}

function getExtension(filename: string): string {
	const match = filename.match(/\.[^/.]+$/);
	return match ? match[0] : ".mp4";
}

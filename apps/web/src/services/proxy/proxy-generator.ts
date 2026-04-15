/**
 * Generates low-resolution proxy files from video sources using FFmpeg WASM.
 * Proxy files (540p H.264) decode 4-8x faster than 4K originals, enabling
 * smooth preview playback while preserving full-res originals for export.
 */

import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const PROXY_HEIGHT = 540;
// Intra-only proxies: every frame is a keyframe -> O(1) seek cost, backward
// scrubbing no longer pays GOP traversal. Bitrate bumped to compensate for
// lost inter-frame compression. Disk footprint ~3-4x vs default, but OPFS
// quota is large and scrub perf is the primary UX metric.
const PROXY_BITRATE = "5M";
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

	// Mount the input File via WORKERFS so FFmpeg reads it lazily without
	// copying the full buffer into the WASM heap. Previously writeFile +
	// fetchFile() slurped the entire file into memory — OOM risk on 4K+ clips.
	// WORKERFS exposes each File under its original .name property.
	const mountPoint = "/input";
	const inputName = `${mountPoint}/${file.name}`;
	const outputName = "proxy.mp4";

	await ff.mount(FFFSType.WORKERFS, { files: [file] }, mountPoint);

	let data: Uint8Array | string;
	try {
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
			"-tune",
			"fastdecode",
			"-g",
			"1", // GOP=1 -> every frame is a keyframe
			"-keyint_min",
			"1",
			"-bf",
			"0", // no B-frames: no reordering cost during seek
			"-pix_fmt",
			"yuv420p", // widest browser hardware-decode support
			"-b:v",
			PROXY_BITRATE,
			"-an", // strip audio — handled separately by audio pipeline
			"-y",
			outputName,
		]);

		onProgress?.({ progress: 92 });

		data = await ff.readFile(outputName);
	} finally {
		// Always unmount so the next generateProxy call can re-mount /input.
		// deleteFile of the output is best-effort (may not exist if exec failed).
		try {
			await ff.unmount(mountPoint);
		} catch {}
		try {
			await ff.deleteFile(outputName);
		} catch {}
	}

	const blob = new Blob([data], { type: "video/mp4" });

	const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
	const proxyFile = new File([blob], `${nameWithoutExt}-proxy.mp4`, {
		type: "video/mp4",
	});

	onProgress?.({ progress: 100 });

	return proxyFile;
}

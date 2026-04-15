/**
 * Export Web Worker entry point.
 *
 * Runs the entire export pipeline (scene build + render + encode) off the main thread.
 * Receives project data and audio from the main thread, loads media from OPFS,
 * builds the scene graph, and runs SceneExporter with mediabunny.
 *
 * Message protocol:
 * - Main -> Worker: "start" (project data + params), "cancel"
 * - Worker -> Main: "progress", "complete", "error", "cancelled", "codec-info"
 */

import type {
	ExportWorkerMessage,
	ExportWorkerResponse,
} from "@/types/export-worker";
import type { MediaAssetData } from "@/services/storage/types";
import { SceneExporter } from "@/services/renderer/scene-exporter";
import { buildScene } from "@/services/renderer/scene-builder";
import { OPFSAdapter } from "@/services/storage/opfs-adapter";
import { checkCodecSupport } from "./codec-check";
import { reconstructAudioBuffer } from "./audio-transfer";

let currentExporter: SceneExporter | null = null;
let cancelled = false;

/** Type-safe postMessage wrapper */
function respond(message: ExportWorkerResponse): void {
	self.postMessage(
		message,
		// Transfer the buffer for zero-copy when completing
		message.type === "complete" ? [message.buffer] : [],
	);
}

self.onmessage = async (event: MessageEvent<ExportWorkerMessage>) => {
	switch (event.data.type) {
		case "start":
			await handleExport(event.data);
			break;
		case "cancel":
			handleCancel();
			break;
	}
};

function handleCancel(): void {
	cancelled = true;
	currentExporter?.cancel();
}

/** Extract the "start" variant from the worker message union */
type ExportStartPayload = Extract<ExportWorkerMessage, { type: "start" }>;

async function handleExport(msg: ExportStartPayload): Promise<void> {
	cancelled = false;

	try {
		const { params, projectId, tracks, mediaAssetDataList, duration, canvasSize, background, audioData } = msg;

		// 1. Check codec support and report back to UI
		const codecInfo = await checkCodecSupport({
			format: params.format,
			width: params.width,
			height: params.height,
			quality: params.quality,
		});
		respond({ type: "codec-info", result: codecInfo });

		if (cancelled) {
			respond({ type: "cancelled" });
			return;
		}

		// 2. Load media files from OPFS
		const opfs = new OPFSAdapter(`media-files-${projectId}`);
		const mediaAssets = await loadMediaAssets({ opfs, mediaAssetDataList });

		if (cancelled) {
			respond({ type: "cancelled" });
			return;
		}

		// 3. Reconstruct audio buffer from transferred data
		let audioBuffer: AudioBuffer | undefined;
		if (audioData && audioData.channels.length > 0) {
			audioBuffer = reconstructAudioBuffer(audioData);
		}

		// 4. Build scene graph (same function used on main thread)
		const scene = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize,
			background,
			isPreview: false,
		});

		// 5. Create exporter and run
		const exporter = new SceneExporter({
			width: params.width,
			height: params.height,
			fps: params.fps,
			format: params.format,
			quality: params.quality,
			shouldIncludeAudio: params.hasAudio,
			audioBuffer,
		});
		currentExporter = exporter;

		exporter.on("progress", (progress) => {
			respond({ type: "progress", progress });
		});

		exporter.on("cancelled", () => {
			respond({ type: "cancelled" });
		});

		const buffer = await exporter.export({ rootNode: scene });
		currentExporter = null;

		if (cancelled) {
			respond({ type: "cancelled" });
			return;
		}

		if (!buffer) {
			respond({ type: "error", error: "Export produced no output" });
			return;
		}

		// Transfer buffer back to main thread (zero-copy)
		respond({ type: "complete", buffer });
	} catch (error) {
		currentExporter = null;
		const message =
			error instanceof Error ? error.message : "Unknown export error";
		console.error("[ExportWorker] Export failed:", error);
		respond({ type: "error", error: message });
	}
}

/**
 * Load media files from OPFS and reconstruct MediaAsset objects.
 * Creates object URLs for each file so scene nodes can reference them.
 */
async function loadMediaAssets({
	opfs,
	mediaAssetDataList,
}: {
	opfs: OPFSAdapter;
	mediaAssetDataList: MediaAssetData[];
}): Promise<
	Array<{
		id: string;
		name: string;
		type: "image" | "video" | "audio";
		file: File;
		url: string;
		width?: number;
		height?: number;
		duration?: number;
		fps?: number;
	}>
> {
	const assets: Array<{
		id: string;
		name: string;
		type: "image" | "video" | "audio";
		file: File;
		url: string;
		width?: number;
		height?: number;
		duration?: number;
		fps?: number;
	}> = [];

	for (const data of mediaAssetDataList) {
		const file = await opfs.get(data.id);
		if (!file) {
			console.warn(
				`[ExportWorker] Media file not found in OPFS: ${data.id}`,
			);
			continue;
		}

		const url = URL.createObjectURL(file);
		assets.push({
			id: data.id,
			name: data.name,
			type: data.type,
			file,
			url,
			width: data.width,
			height: data.height,
			duration: data.duration,
			fps: data.fps,
		});
	}

	return assets;
}

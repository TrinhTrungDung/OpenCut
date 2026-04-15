/**
 * Main-thread client for the export Web Worker.
 *
 * Manages worker lifecycle, message passing, and provides a Promise-based API.
 * Falls back gracefully if the worker cannot be created.
 */

import type {
	ExportWorkerParams,
	ExportWorkerResponse,
	TransferableAudioData,
	CodecCheckResult,
} from "@/types/export-worker";
import type { TimelineTrack } from "@/types/timeline";
import type { TBackground, TCanvasSize } from "@/types/project";
import type { MediaAssetData } from "@/services/storage/types";
import { getAudioTransferables } from "./audio-transfer";

export interface ExportWorkerClientParams {
	params: ExportWorkerParams;
	projectId: string;
	tracks: TimelineTrack[];
	mediaAssetDataList: MediaAssetData[];
	duration: number;
	canvasSize: TCanvasSize;
	background: TBackground;
	audioData?: TransferableAudioData;
	onProgress: (progress: number) => void;
	onCodecInfo?: (result: CodecCheckResult) => void;
}

export type ExportWorkerResult =
	| { success: true; buffer: ArrayBuffer }
	| { cancelled: true }
	| { error: string };

export class ExportWorkerClient {
	private worker: Worker | null = null;

	/**
	 * Check if Web Workers are available in the current environment.
	 */
	static isSupported(): boolean {
		return typeof Worker !== "undefined";
	}

	/**
	 * Run export in a Web Worker.
	 * Returns a Promise that resolves with the export result.
	 */
	async export(params: ExportWorkerClientParams): Promise<ExportWorkerResult> {
		return new Promise<ExportWorkerResult>((resolve) => {
			try {
				this.worker = new Worker(
					new URL("./export-worker.ts", import.meta.url),
					{ type: "module" },
				);
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Failed to create export worker";
				resolve({ error: message });
				return;
			}

			this.worker.onmessage = (
				event: MessageEvent<ExportWorkerResponse>,
			) => {
				const data = event.data;

				switch (data.type) {
					case "progress":
						params.onProgress(data.progress);
						break;
					case "codec-info":
						params.onCodecInfo?.(data.result);
						break;
					case "complete":
						this.dispose();
						resolve({ success: true, buffer: data.buffer });
						break;
					case "error":
						this.dispose();
						resolve({ error: data.error });
						break;
					case "cancelled":
						this.dispose();
						resolve({ cancelled: true });
						break;
				}
			};

			this.worker.onerror = (event) => {
				this.dispose();
				resolve({
					error: event.message || "Export worker encountered an error",
				});
			};

			// Build transferable list for zero-copy transfer of audio data
			const transferables: Transferable[] = [];
			if (params.audioData) {
				transferables.push(
					...getAudioTransferables(params.audioData),
				);
			}

			// Send start message to worker
			this.worker.postMessage(
				{
					type: "start",
					params: params.params,
					projectId: params.projectId,
					tracks: params.tracks,
					mediaAssetDataList: params.mediaAssetDataList,
					duration: params.duration,
					canvasSize: params.canvasSize,
					background: params.background,
					audioData: params.audioData,
				},
				transferables,
			);
		});
	}

	/**
	 * Cancel the in-progress export.
	 */
	cancel(): void {
		this.worker?.postMessage({ type: "cancel" });
	}

	/**
	 * Terminate the worker and release resources.
	 */
	dispose(): void {
		this.worker?.terminate();
		this.worker = null;
	}
}

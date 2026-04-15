import type { ExportFormat, ExportQuality } from "./export";
import type { TimelineTrack } from "./timeline";
import type { TBackground, TCanvasSize } from "./project";
import type { MediaAssetData } from "@/services/storage/types";

/**
 * Parameters for export worker configuration.
 */
export interface ExportWorkerParams {
	width: number;
	height: number;
	fps: number;
	format: ExportFormat;
	quality: ExportQuality;
	hasAudio: boolean;
	audioSampleRate?: number;
	audioChannels?: number;
}

/**
 * Serialized audio data that can be transferred to workers.
 * AudioBuffer itself is not transferable, so we extract raw Float32 channel data.
 */
export interface TransferableAudioData {
	channels: Float32Array[];
	sampleRate: number;
	length: number;
}

/**
 * Codec capability check result.
 */
export interface CodecCheckResult {
	supported: boolean;
	hardwareAcceleration: boolean;
	selectedCodec: string;
	selectedAcceleration:
		| "prefer-hardware"
		| "prefer-software"
		| "no-preference";
}

/**
 * Messages sent from main thread to export worker.
 */
export type ExportWorkerMessage =
	| {
			type: "start";
			params: ExportWorkerParams;
			projectId: string;
			tracks: TimelineTrack[];
			mediaAssetDataList: MediaAssetData[];
			duration: number;
			canvasSize: TCanvasSize;
			background: TBackground;
			audioData?: TransferableAudioData;
	  }
	| { type: "cancel" };

/**
 * Responses sent from export worker to main thread.
 */
export type ExportWorkerResponse =
	| { type: "progress"; progress: number }
	| { type: "complete"; buffer: ArrayBuffer }
	| { type: "error"; error: string }
	| { type: "cancelled" }
	| { type: "codec-info"; result: CodecCheckResult };

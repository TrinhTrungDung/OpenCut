import type { EditorCore } from "@/core";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import type { ExportOptions, ExportResult } from "@/types/export";
import type { CodecCheckResult } from "@/types/export-worker";
import type { TimelineTrack } from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import type { TBackground } from "@/types/project";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import { SceneExporter } from "@/services/renderer/scene-exporter";
import { buildScene } from "@/services/renderer/scene-builder";
import { createTimelineAudioBuffer } from "@/lib/media/audio";
import { formatTimeCode, getLastFrameTime } from "@/lib/time";
import { downloadBlob } from "@/utils/browser";
import { ExportWorkerClient } from "@/services/export/export-worker-client";
import { serializeAudioBuffer } from "@/services/export/audio-transfer";

export class RendererManager {
	private renderTree: RootNode | null = null;
	private listeners = new Set<() => void>();
	private workerClient: ExportWorkerClient | null = null;
	private _codecInfo: CodecCheckResult | null = null;

	constructor(private editor: EditorCore) {}

	/** Get codec info from the last export attempt (if worker was used) */
	getCodecInfo(): CodecCheckResult | null {
		return this._codecInfo;
	}

	setRenderTree({ renderTree }: { renderTree: RootNode | null }): void {
		this.renderTree = renderTree;
		this.notify();
	}

	getRenderTree(): RootNode | null {
		return this.renderTree;
	}

	async saveSnapshot(): Promise<{ success: boolean; error?: string }> {
		try {
			const renderTree = this.getRenderTree();
			const activeProject = this.editor.project.getActive();

			if (!renderTree || !activeProject) {
				return { success: false, error: "No project or scene to capture" };
			}

			const duration = this.editor.timeline.getTotalDuration();
			if (duration === 0) {
				return { success: false, error: "Project is empty" };
			}

			const { canvasSize, fps } = activeProject.settings;
			const currentTime = this.editor.playback.getCurrentTime();
			const lastFrameTime = getLastFrameTime({ duration, fps });
			const renderTime = Math.min(currentTime, lastFrameTime);

			const renderer = new CanvasRenderer({
				width: canvasSize.width,
				height: canvasSize.height,
				fps,
			});

			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = canvasSize.width;
			tempCanvas.height = canvasSize.height;

			await renderer.renderToCanvas({
				node: renderTree,
				time: renderTime,
				targetCanvas: tempCanvas,
			});

			const blob = await new Promise<Blob | null>((resolve) => {
				tempCanvas.toBlob((result) => resolve(result), "image/png");
			});

			if (!blob) {
				return { success: false, error: "Failed to create image" };
			}

			const timecode = formatTimeCode({
				timeInSeconds: renderTime,
				fps,
			}).replace(/:/g, "-");
			const safeName = activeProject.metadata.name
				.replace(/[<>:"/\\|?*]/g, "-")
				.trim() || "snapshot";
			const filename = `${safeName}-${timecode}.png`;

			downloadBlob({ blob, filename });
			return { success: true };
		} catch (error) {
			console.error("Save snapshot failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async exportProject({
		options,
		onProgress,
		onCancel,
	}: {
		options: ExportOptions;
		onProgress?: ({ progress }: { progress: number }) => void;
		onCancel?: () => boolean;
	}): Promise<ExportResult> {
		const { format, quality, fps, includeAudio } = options;

		try {
			const tracks = this.editor.timeline.getTracks();
			const mediaAssets = this.editor.media.getAssets();
			const activeProject = this.editor.project.getActive();

			if (!activeProject) {
				return { success: false, error: "No active project" };
			}

			const duration = this.editor.timeline.getTotalDuration();
			if (duration === 0) {
				return { success: false, error: "Project is empty" };
			}

			const exportFps = fps || activeProject.settings.fps;
			const canvasSize = activeProject.settings.canvasSize;

			// Audio mixing must happen on main thread (AudioContext not available in workers)
			let audioBuffer: AudioBuffer | null = null;
			if (includeAudio) {
				onProgress?.({ progress: 0.05 });
				audioBuffer = await createTimelineAudioBuffer({
					tracks,
					mediaAssets,
					duration,
				});
			}

			// Try worker-based export first for non-blocking UI
			if (ExportWorkerClient.isSupported()) {
				try {
					const result = await this.exportWithWorker({
						tracks,
						mediaAssets,
						activeProject,
						duration,
						exportFps,
						canvasSize,
						format,
						quality,
						includeAudio: !!includeAudio,
						audioBuffer,
						onProgress,
						onCancel,
					});
					if (result) return result;
				} catch (workerError) {
					console.warn(
						"Worker export failed, falling back to main thread:",
						workerError,
					);
				}
			}

			// Fallback: main-thread export (existing code path)
			return await this.exportMainThread({
				tracks,
				mediaAssets,
				duration,
				exportFps,
				canvasSize,
				format,
				quality,
				includeAudio: !!includeAudio,
				audioBuffer,
				background: activeProject.settings.background,
				onProgress,
				onCancel,
			});
		} catch (error) {
			console.error("Export failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown export error",
			};
		}
	}

	/**
	 * Export using a Web Worker for non-blocking UI.
	 * Returns null if worker setup fails (caller should fall back).
	 */
	private async exportWithWorker({
		tracks,
		mediaAssets,
		activeProject,
		duration,
		exportFps,
		canvasSize,
		format,
		quality,
		includeAudio,
		audioBuffer,
		onProgress,
		onCancel,
	}: {
		tracks: TimelineTrack[];
		mediaAssets: MediaAsset[];
		activeProject: { metadata: { id: string }; settings: { background: TBackground } };
		duration: number;
		exportFps: number;
		canvasSize: { width: number; height: number };
		format: ExportOptions["format"];
		quality: ExportOptions["quality"];
		includeAudio: boolean;
		audioBuffer: AudioBuffer | null;
		onProgress?: ({ progress }: { progress: number }) => void;
		onCancel?: () => boolean;
	}): Promise<ExportResult | null> {
		const client = new ExportWorkerClient();
		this.workerClient = client;

		// Serialize audio for transfer
		const audioData =
			audioBuffer && includeAudio
				? serializeAudioBuffer(audioBuffer)
				: undefined;

		// Extract media metadata for worker (file data loaded from OPFS in worker)
		const mediaAssetDataList = mediaAssets.map((m) => ({
			id: m.id,
			name: m.name,
			type: m.type,
			size: m.file.size,
			lastModified: m.file.lastModified,
			width: m.width,
			height: m.height,
			duration: m.duration,
			fps: m.fps,
		}));

		// Set up cancel polling
		let cancelCheckInterval: ReturnType<typeof setInterval> | null = null;
		if (onCancel) {
			cancelCheckInterval = setInterval(() => {
				if (onCancel()) {
					client.cancel();
				}
			}, 100);
		}

		try {
			const result = await client.export({
				params: {
					width: canvasSize.width,
					height: canvasSize.height,
					fps: exportFps,
					format,
					quality,
					hasAudio: includeAudio,
					audioSampleRate: audioBuffer?.sampleRate,
					audioChannels: audioBuffer?.numberOfChannels,
				},
				projectId: activeProject.metadata.id,
				tracks,
				mediaAssetDataList,
				duration,
				canvasSize,
				background: activeProject.settings.background,
				audioData,
				onProgress: (progress) => {
					const adjustedProgress = includeAudio
						? 0.05 + progress * 0.95
						: progress;
					onProgress?.({ progress: adjustedProgress });
				},
				onCodecInfo: (codecInfo) => {
					this._codecInfo = codecInfo;
					this.notify();
				},
			});

			if ("cancelled" in result) {
				return { success: false, cancelled: true };
			}

			if ("error" in result) {
				// Worker reported an error -- let caller fall back to main thread
				console.warn("Worker export error:", result.error);
				return null;
			}

			return { success: true, buffer: result.buffer };
		} finally {
			if (cancelCheckInterval) clearInterval(cancelCheckInterval);
			this.workerClient = null;
		}
	}

	/**
	 * Original main-thread export path. Used as fallback when worker is unavailable.
	 */
	private async exportMainThread({
		tracks,
		mediaAssets,
		duration,
		exportFps,
		canvasSize,
		format,
		quality,
		includeAudio,
		audioBuffer,
		background,
		onProgress,
		onCancel,
	}: {
		tracks: TimelineTrack[];
		mediaAssets: MediaAsset[];
		duration: number;
		exportFps: number;
		canvasSize: { width: number; height: number };
		format: ExportOptions["format"];
		quality: ExportOptions["quality"];
		includeAudio: boolean;
		audioBuffer: AudioBuffer | null;
		background: TBackground;
		onProgress?: ({ progress }: { progress: number }) => void;
		onCancel?: () => boolean;
	}): Promise<ExportResult> {
		const scene = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize,
			background,
		});

		const exporter = new SceneExporter({
			width: canvasSize.width,
			height: canvasSize.height,
			fps: exportFps,
			format,
			quality,
			shouldIncludeAudio: includeAudio,
			audioBuffer: audioBuffer || undefined,
		});

		exporter.on("progress", (progress) => {
			const adjustedProgress = includeAudio
				? 0.05 + progress * 0.95
				: progress;
			onProgress?.({ progress: adjustedProgress });
		});

		let cancelled = false;
		const checkCancel = () => {
			if (onCancel?.()) {
				cancelled = true;
				exporter.cancel();
			}
		};

		const cancelInterval = setInterval(checkCancel, 100);

		try {
			const buffer = await exporter.export({ rootNode: scene });
			clearInterval(cancelInterval);

			if (cancelled) {
				return { success: false, cancelled: true };
			}

			if (!buffer) {
				return { success: false, error: "Export failed to produce buffer" };
			}

			return { success: true, buffer };
		} finally {
			clearInterval(cancelInterval);
		}
	}

	/** Cancel any in-progress worker export */
	cancelWorkerExport(): void {
		this.workerClient?.cancel();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}

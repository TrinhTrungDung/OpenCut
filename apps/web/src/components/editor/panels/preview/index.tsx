"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useEditor } from "@/hooks/use-editor";
import { useRafLoop } from "@/hooks/use-raf-loop";
import { useContainerSize } from "@/hooks/use-container-size";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import { buildScene } from "@/services/renderer/scene-builder";
import { getLastFrameTime } from "@/lib/time";
import { PreviewInteractionOverlay } from "./preview-interaction-overlay";
import { BookmarkNoteOverlay } from "./bookmark-note-overlay";
import { MediaSourcePreview } from "./media-source-preview";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { usePreviewStore } from "@/stores/preview-store";
import { useMediaPreviewStore } from "@/stores/media-preview-store";
import { PreviewContextMenu } from "./context-menu";
import { PreviewToolbar } from "./toolbar";
import { useVideoElementSync } from "@/hooks/use-video-element-sync";

function usePreviewSize() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	return {
		width: activeProject?.settings.canvasSize.width,
		height: activeProject?.settings.canvasSize.height,
	};
}

export function PreviewPanel() {
	const containerRef = useRef<HTMLDivElement>(null);
	const { isFullscreen, toggleFullscreen } = useFullscreen({ containerRef });
	const previewAsset = useMediaPreviewStore((s) => s.previewAsset);
	const editor = useEditor();

	/* Close media preview when user interacts with the timeline */
	useEffect(() => {
		if (!previewAsset) return;
		/* Skip the first notification (initial state) */
		let skipFirst = true;
		const unsubscribe = editor.selection.subscribe(() => {
			if (skipFirst) {
				skipFirst = false;
				return;
			}
			useMediaPreviewStore.getState().closePreview();
		});
		return unsubscribe;
	}, [editor.selection, previewAsset]);

	return (
		<div
			ref={containerRef}
			className="panel bg-background relative flex size-full min-h-0 min-w-0 flex-col rounded-sm border"
		>
			<div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-2 pb-0">
				<PreviewCanvas
					onToggleFullscreen={toggleFullscreen}
					containerRef={containerRef}
				/>
				<RenderTreeController />
				<VideoElementSyncController />
				{previewAsset && <MediaSourcePreview />}
			</div>
			<PreviewToolbar
				isFullscreen={isFullscreen}
				onToggleFullscreen={toggleFullscreen}
			/>
		</div>
	);
}

function VideoElementSyncController() {
	useVideoElementSync();
	return null;
}

function RenderTreeController() {
	const editor = useEditor();
	const tracks = editor.timeline.getTracks();
	const mediaAssets = editor.media.getAssets();
	const activeProject = editor.project.getActive();

	const { width, height } = usePreviewSize();

	useDeepCompareEffect(() => {
		if (!activeProject) return;

		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize: { width, height },
			background: activeProject.settings.background,
			isPreview: true,
		});

		editor.renderer.setRenderTree({ renderTree });
	}, [tracks, mediaAssets, activeProject?.settings.background, width, height]);

	return null;
}

/** Live debug overlay showing FPS and frame timing */
function DebugOverlay({ statsRef }: { statsRef: React.RefObject<{ fps: number; lastRenderMs: number; droppedFrames: number } | null> }) {
	const [stats, setStats] = useState({ fps: 0, lastRenderMs: 0, droppedFrames: 0 });
	const editor = useEditor();
	const isPlaying = editor.playback.getIsPlaying();

	useEffect(() => {
		if (!isPlaying) return;
		const interval = setInterval(() => {
			if (statsRef.current) {
				setStats({ ...statsRef.current });
			}
		}, 200);
		return () => clearInterval(interval);
	}, [isPlaying, statsRef]);

	if (!isPlaying) return null;

	return (
		<div
			style={{
				position: "absolute",
				top: 4,
				left: 4,
				background: "rgba(0,0,0,0.7)",
				color: stats.fps >= 25 ? "#0f0" : stats.fps >= 15 ? "#ff0" : "#f00",
				padding: "2px 6px",
				fontSize: 11,
				fontFamily: "monospace",
				borderRadius: 3,
				zIndex: 50,
				pointerEvents: "none",
			}}
		>
			{stats.fps} FPS | {stats.lastRenderMs.toFixed(1)}ms | dropped: {stats.droppedFrames}
		</div>
	);
}

function PreviewCanvas({
	onToggleFullscreen,
	containerRef,
}: {
	onToggleFullscreen: () => void;
	containerRef: React.RefObject<HTMLElement | null>;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const outerContainerRef = useRef<HTMLDivElement>(null);
	const canvasBoundsRef = useRef<HTMLDivElement>(null);
	const lastFrameRef = useRef(-1);
	const lastSceneRef = useRef<RootNode | null>(null);
	const { width: nativeWidth, height: nativeHeight } = usePreviewSize();
	const containerSize = useContainerSize({ containerRef: outerContainerRef });
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { overlays } = usePreviewStore();

	// Debug stats
	const statsRef = useRef({ fps: 0, lastRenderMs: 0, droppedFrames: 0 });
	const frameCountRef = useRef(0);
	const fpsTimerRef = useRef(performance.now());

	const renderer = useMemo(() => {
		return new CanvasRenderer({
			width: nativeWidth,
			height: nativeHeight,
			fps: activeProject.settings.fps,
		});
	}, [nativeWidth, nativeHeight, activeProject.settings.fps]);

	const displaySize = useMemo(() => {
		if (
			!nativeWidth ||
			!nativeHeight ||
			containerSize.width === 0 ||
			containerSize.height === 0
		) {
			return { width: nativeWidth ?? 0, height: nativeHeight ?? 0 };
		}

		const paddingBuffer = 4;
		const availableWidth = containerSize.width - paddingBuffer;
		const availableHeight = containerSize.height - paddingBuffer;

		const aspectRatio = nativeWidth / nativeHeight;
		const containerAspect = availableWidth / availableHeight;

		const displayWidth =
			containerAspect > aspectRatio
				? availableHeight * aspectRatio
				: availableWidth;
		const displayHeight =
			containerAspect > aspectRatio
				? availableHeight
				: availableWidth / aspectRatio;

		return { width: displayWidth, height: displayHeight };
	}, [nativeWidth, nativeHeight, containerSize.width, containerSize.height]);

	const renderTree = editor.renderer.getRenderTree();
	const isPlaying = editor.playback.getIsPlaying();

	// Force re-render when playback state changes (rendering path switches between
	// <video> element during playback and mediabunny when paused/scrubbing)
	useEffect(() => {
		if (!isPlaying) {
			lastFrameRef.current = -1;
		}
	}, [isPlaying]);

	const render = useCallback(() => {
		if (canvasRef.current && renderTree) {
			const time = editor.playback.getCurrentTime();
			const lastFrameTime = getLastFrameTime({
				duration: renderTree.duration,
				fps: renderer.fps,
			});
			const renderTime = Math.min(time, lastFrameTime);
			const frame = Math.floor(renderTime * renderer.fps);

			if (
				frame !== lastFrameRef.current ||
				renderTree !== lastSceneRef.current
			) {
				lastSceneRef.current = renderTree;
				const renderStart = performance.now();

				// Fire-and-forget: render is effectively synchronous for preview
				// (drawImage on <video> element takes ~0.3ms). No blocking guard needed.
				renderer
					.renderToCanvas({
						node: renderTree,
						time: renderTime,
						targetCanvas: canvasRef.current,
					})
					.then(() => {
						lastFrameRef.current = frame;

						const renderMs = performance.now() - renderStart;
						statsRef.current.lastRenderMs = renderMs;

						frameCountRef.current++;
						const now = performance.now();
						const elapsed = now - fpsTimerRef.current;
						if (elapsed >= 1000) {
							statsRef.current.fps = Math.round((frameCountRef.current * 1000) / elapsed);
							frameCountRef.current = 0;
							fpsTimerRef.current = now;
						}

						if (renderMs > 16) {
							statsRef.current.droppedFrames++;
						}
					});
			}
		}
	}, [renderer, renderTree, editor.playback]);

	useRafLoop(render);

	return (
		<div
			ref={outerContainerRef}
			className="relative flex size-full items-center justify-center"
		>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						ref={canvasBoundsRef}
						className="relative"
						style={{ width: displaySize.width, height: displaySize.height }}
					>
						<canvas
							ref={canvasRef}
							width={nativeWidth}
							height={nativeHeight}
							className="block border"
							style={{
								width: displaySize.width,
								height: displaySize.height,
								background:
									activeProject.settings.background.type === "blur"
										? "transparent"
										: activeProject?.settings.background.color,
							}}
						/>
						<DebugOverlay statsRef={statsRef} />
						<PreviewInteractionOverlay
							canvasRef={canvasRef}
							containerRef={canvasBoundsRef}
						/>
						{overlays.bookmarks && <BookmarkNoteOverlay />}
					</div>
				</ContextMenuTrigger>
				<PreviewContextMenu
					onToggleFullscreen={onToggleFullscreen}
					containerRef={containerRef}
				/>
			</ContextMenu>
		</div>
	);
}

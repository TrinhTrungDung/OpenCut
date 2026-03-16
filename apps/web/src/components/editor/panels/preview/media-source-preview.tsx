"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { useMediaPreviewStore } from "@/stores/media-preview-store";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import { formatDuration } from "@/components/editor/panels/assets/views/assets";
import {
	Cancel01Icon,
	PauseIcon,
	PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Plus } from "lucide-react";

export function MediaSourcePreview() {
	const { previewAsset, trimStart, trimEnd, closePreview } =
		useMediaPreviewStore();
	const editor = useEditor();
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const seekBarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const onTimeUpdate = () => setCurrentTime(video.currentTime);
		const onLoadedMetadata = () => setDuration(video.duration);
		const onPlay = () => setIsPlaying(true);
		const onPause = () => setIsPlaying(false);
		const onEnded = () => setIsPlaying(false);

		video.addEventListener("timeupdate", onTimeUpdate);
		video.addEventListener("loadedmetadata", onLoadedMetadata);
		video.addEventListener("play", onPlay);
		video.addEventListener("pause", onPause);
		video.addEventListener("ended", onEnded);

		return () => {
			video.removeEventListener("timeupdate", onTimeUpdate);
			video.removeEventListener("loadedmetadata", onLoadedMetadata);
			video.removeEventListener("play", onPlay);
			video.removeEventListener("pause", onPause);
			video.removeEventListener("ended", onEnded);
		};
	}, [previewAsset]);

	const togglePlay = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			video.play();
		} else {
			video.pause();
		}
	}, []);

	const handleSeek = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const bar = seekBarRef.current;
			const video = videoRef.current;
			if (!bar || !video || duration === 0) return;

			const rect = bar.getBoundingClientRect();
			const ratio = Math.max(
				0,
				Math.min(1, (e.clientX - rect.left) / rect.width),
			);
			video.currentTime = ratio * duration;
		},
		[duration],
	);

	const handleAddToTimeline = useCallback(() => {
		if (!previewAsset) return;

		const trimmedDuration = trimEnd - trimStart;
		const element = buildElementFromMedia({
			mediaId: previewAsset.id,
			mediaType: previewAsset.type,
			name: previewAsset.name,
			duration: trimmedDuration,
			startTime: editor.playback.getCurrentTime(),
		});

		if ("trimStart" in element) {
			(element as { trimStart: number }).trimStart = trimStart;
		}

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});

		closePreview();
	}, [previewAsset, trimStart, trimEnd, editor, closePreview]);

	if (!previewAsset || !previewAsset.url) return null;

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
	const trimStartPct = duration > 0 ? (trimStart / duration) * 100 : 0;
	const trimEndPct = duration > 0 ? (trimEnd / duration) * 100 : 100;

	return (
		<div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90">
			{/* Close button */}
			<Button
				variant="ghost"
				size="icon"
				className="absolute top-2 right-2 z-30 text-white hover:bg-white/20"
				onClick={closePreview}
			>
				<HugeiconsIcon icon={Cancel01Icon} />
			</Button>

			{/* Video */}
			<div className="flex flex-1 items-center justify-center p-4">
				<video
					ref={videoRef}
					src={previewAsset.url}
					className="max-h-full max-w-full rounded"
					onClick={togglePlay}
				/>
			</div>

			{/* Controls */}
			<div className="flex w-full flex-col gap-2 px-4 pb-4">
				{/* Seek bar with trim region */}
				<div
					ref={seekBarRef}
					className="relative h-6 w-full cursor-pointer rounded bg-white/10"
					onClick={handleSeek}
					onKeyDown={undefined}
				>
					{/* Trim region highlight */}
					<div
						className="absolute top-0 h-full rounded bg-white/15"
						style={{
							left: `${trimStartPct}%`,
							width: `${trimEndPct - trimStartPct}%`,
						}}
					/>
					{/* Progress */}
					<div
						className="bg-primary absolute top-0 left-0 h-full rounded"
						style={{ width: `${progress}%`, opacity: 0.6 }}
					/>
					{/* Playhead */}
					<div
						className="bg-primary absolute top-0 h-full w-0.5"
						style={{ left: `${progress}%` }}
					/>
				</div>

				{/* Buttons row */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							className="text-white hover:bg-white/20"
							onClick={togglePlay}
						>
							<HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} />
						</Button>
						<span className="font-mono text-xs text-white/70">
							{formatDuration({ duration: currentTime })}
							{" / "}
							{formatDuration({ duration })}
						</span>
					</div>

					{/* Trim info */}
					{(trimStart > 0 || (duration > 0 && trimEnd < duration)) && (
						<span className="text-xs text-white/50">
							Trim: {formatDuration({ duration: trimStart })} -{" "}
							{formatDuration({ duration: trimEnd })}
						</span>
					)}

					<Button
						variant="secondary"
						size="sm"
						className="gap-1"
						onClick={handleAddToTimeline}
					>
						<Plus className="size-4" />
						Add to timeline
					</Button>
				</div>
			</div>
		</div>
	);
}

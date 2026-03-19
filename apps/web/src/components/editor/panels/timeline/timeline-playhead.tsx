"use client";

import { useEffect, useRef } from "react";
import {
	getCenteredLineLeft,
	TIMELINE_INDICATOR_LINE_WIDTH_PX,
	timelineTimeToSnappedPixels,
} from "@/lib/timeline";
import { useTimelinePlayhead } from "@/hooks/timeline/use-timeline-playhead";
import { useEditor } from "@/hooks/use-editor";

interface TimelinePlayheadProps {
	zoomLevel: number;
	rulerRef: React.RefObject<HTMLDivElement | null>;
	rulerScrollRef: React.RefObject<HTMLDivElement | null>;
	tracksScrollRef: React.RefObject<HTMLDivElement | null>;
	timelineRef: React.RefObject<HTMLDivElement | null>;
	playheadRef?: React.RefObject<HTMLDivElement | null>;
	isSnappingToPlayhead?: boolean;
}

export function TimelinePlayhead({
	zoomLevel,
	rulerRef,
	rulerScrollRef,
	tracksScrollRef,
	timelineRef,
	playheadRef: externalPlayheadRef,
	isSnappingToPlayhead = false,
}: TimelinePlayheadProps) {
	const editor = useEditor();
	const duration = editor.timeline.getTotalDuration();
	const internalPlayheadRef = useRef<HTMLDivElement>(null);
	const playheadRef = externalPlayheadRef || internalPlayheadRef;

	const { playheadPosition, handlePlayheadMouseDown } = useTimelinePlayhead({
		zoomLevel,
		rulerRef,
		rulerScrollRef,
		tracksScrollRef,
		playheadRef,
	});

	const timelineContainerHeight =
		tracksScrollRef.current?.clientHeight ??
		timelineRef.current?.clientHeight ??
		400;
	const totalHeight = Math.max(0, timelineContainerHeight - 4);

	const centerPosition = timelineTimeToSnappedPixels({
		time: playheadPosition,
		zoomLevel,
	});
	const leftPosition = getCenteredLineLeft({ centerPixel: centerPosition });

	// RAF-based DOM update during playback — bypasses React re-renders
	const isPlaying = editor.playback.getIsPlaying();
	useEffect(() => {
		if (!isPlaying) return;

		let raf: number;
		const update = () => {
			const el = playheadRef.current;
			if (!el) return;
			const time = editor.playback.getCurrentTime();
			const center = timelineTimeToSnappedPixels({ time, zoomLevel });
			const left = getCenteredLineLeft({ centerPixel: center });
			el.style.left = `${left}px`;

			// Auto-scroll timeline to follow playhead
			const rulerViewport = rulerScrollRef.current;
			const tracksViewport = tracksScrollRef.current;
			if (rulerViewport && tracksViewport) {
				const playheadPixels = center;
				const viewportWidth = rulerViewport.clientWidth;
				const needsScroll =
					playheadPixels < rulerViewport.scrollLeft ||
					playheadPixels > rulerViewport.scrollLeft + viewportWidth;
				if (needsScroll) {
					const scrollMax = rulerViewport.scrollWidth - viewportWidth;
					const desiredScroll = Math.max(
						0,
						Math.min(scrollMax, playheadPixels - viewportWidth / 2),
					);
					rulerViewport.scrollLeft = tracksViewport.scrollLeft = desiredScroll;
				}
			}

			raf = requestAnimationFrame(update);
		};
		raf = requestAnimationFrame(update);
		return () => cancelAnimationFrame(raf);
	}, [isPlaying, zoomLevel, editor.playback, playheadRef, rulerScrollRef, tracksScrollRef]);

	const handlePlayheadKeyDown = (
		event: React.KeyboardEvent<HTMLDivElement>,
	) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

		event.preventDefault();
		const step = 1 / Math.max(1, editor.project.getActive().settings.fps);
		const direction = event.key === "ArrowRight" ? 1 : -1;
		const nextTime = Math.max(
			0,
			Math.min(duration, playheadPosition + direction * step),
		);

		editor.playback.seek({ time: nextTime });
	};

	return (
		<div
			ref={playheadRef}
			role="slider"
			aria-label="Timeline playhead"
			aria-valuemin={0}
			aria-valuemax={duration}
			aria-valuenow={playheadPosition}
			tabIndex={0}
			className="pointer-events-none absolute z-5"
			style={{
				left: `${leftPosition}px`,
				top: 0,
				height: `${totalHeight}px`,
				width: `${TIMELINE_INDICATOR_LINE_WIDTH_PX}px`,
			}}
			onKeyDown={handlePlayheadKeyDown}
		>
			<div className="bg-foreground pointer-events-none absolute left-0 h-full w-0.5" />

			<button
				type="button"
				aria-label="Drag playhead"
				className={`pointer-events-auto absolute top-1 left-1/2 size-3 -translate-x-1/2 transform cursor-col-resize rounded-full border-2 shadow-xs ${isSnappingToPlayhead ? "bg-foreground border-foreground" : "bg-foreground border-foreground/50"}`}
				onMouseDown={handlePlayheadMouseDown}
			/>
		</div>
	);
}

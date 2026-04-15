import { getSnappedSeekTime } from "@/lib/time";
import { useState, useEffect, useCallback, useRef } from "react";
import { useEdgeAutoScroll } from "@/hooks/timeline/use-edge-auto-scroll";
import { useManagers } from "@/hooks/editor";
import { useShiftKey } from "@/hooks/use-shift-key";
import { findSnapPoints, snapToNearestPoint } from "@/lib/timeline/snap-utils";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

interface UseTimelinePlayheadProps {
	zoomLevel: number;
	rulerRef: React.RefObject<HTMLDivElement | null>;
	rulerScrollRef: React.RefObject<HTMLDivElement | null>;
	tracksScrollRef: React.RefObject<HTMLDivElement | null>;
	playheadRef?: React.RefObject<HTMLDivElement | null>;
}

export function useTimelinePlayhead({
	zoomLevel,
	rulerRef,
	rulerScrollRef,
	tracksScrollRef,
	playheadRef,
}: UseTimelinePlayheadProps) {
	const { playback, timeline, scenes, project } = useManagers(
		"playback",
		"timeline",
		"scenes",
		"project",
	);
	const activeProject = project.getActive();
	const currentTime = playback.getCurrentTime();
	const duration = timeline.getTotalDuration();
	const isPlaying = playback.getIsPlaying();
	const isScrubbing = playback.getIsScrubbing();
	const isShiftHeldRef = useShiftKey();

	const seek = useCallback(
		({ time }: { time: number }) => playback.seek({ time }),
		[playback],
	);

	const [scrubTime, setScrubTime] = useState<number | null>(null);

	const [isDraggingRuler, setIsDraggingRuler] = useState(false);
	const [hasDraggedRuler, setHasDraggedRuler] = useState(false);
	const lastMouseXRef = useRef<number>(0);
	const seekThrottleRef = useRef<number | null>(null);
	const pendingSeekTimeRef = useRef<number | null>(null);

	// Refs to avoid effect dependency churn during scrubbing
	const scrubTimeRef = useRef<number | null>(null);
	scrubTimeRef.current = scrubTime;
	const isDraggingRulerRef = useRef(false);
	isDraggingRulerRef.current = isDraggingRuler;
	const hasDraggedRulerRef = useRef(false);
	hasDraggedRulerRef.current = hasDraggedRuler;

	const playheadPosition =
		isScrubbing && scrubTime !== null ? scrubTime : currentTime;

	const handleScrub = useCallback(
		({
			event,
			snappingEnabled = true,
		}: {
			event: MouseEvent | React.MouseEvent;
			snappingEnabled?: boolean;
		}) => {
			const ruler = rulerRef.current;
			if (!ruler) return;
			const rulerRect = ruler.getBoundingClientRect();
			const relativeMouseX = event.clientX - rulerRect.left;

			const timelineContentWidth =
				duration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;

			const clampedMouseX = Math.max(
				0,
				Math.min(timelineContentWidth, relativeMouseX),
			);

			const rawTime = Math.max(
				0,
				Math.min(
					duration,
					clampedMouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel),
				),
			);

			const framesPerSecond = activeProject.settings.fps;
			const frameTime = getSnappedSeekTime({
				rawTime,
				duration,
				fps: framesPerSecond,
			});

			const shouldSnap = snappingEnabled && !isShiftHeldRef.current;
			const time = (() => {
				if (!shouldSnap) return frameTime;
				const tracks = timeline.getTracks();
				const bookmarks = scenes.getActiveScene()?.bookmarks ?? [];
				const snapPoints = findSnapPoints({
					tracks,
					playheadTime: frameTime,
					bookmarks,
					enablePlayheadSnapping: false,
				});
				const snapResult = snapToNearestPoint({
					targetTime: frameTime,
					snapPoints,
					zoomLevel,
				});
				return snapResult.snapPoint ? snapResult.snappedTime : frameTime;
			})();

			setScrubTime(time);
			pendingSeekTimeRef.current = time;

			// Throttle seek() to avoid re-rendering entire editor on every frame
			// Playhead visual position updates immediately via scrubTime state,
			// but expensive video frame decode only runs every ~50ms
			if (seekThrottleRef.current === null) {
				seekThrottleRef.current = window.setTimeout(() => {
					seekThrottleRef.current = null;
					if (pendingSeekTimeRef.current !== null) {
						seek({ time: pendingSeekTimeRef.current });
					}
				}, 50);
			}

			lastMouseXRef.current = event.clientX;
		},
		[
			duration,
			zoomLevel,
			seek,
			rulerRef,
			activeProject.settings.fps,
			isShiftHeldRef,
			scenes,
			timeline,
		],
	);

	const handlePlayheadMouseDown = useCallback(
		({ event }: { event: React.MouseEvent }) => {
			event.preventDefault();
			event.stopPropagation();
			playback.setScrubbing({ isScrubbing: true });
			handleScrub({ event });
		},
		[handleScrub, playback],
	);

	const handleRulerMouseDown = useCallback(
		({ event }: { event: React.MouseEvent }) => {
			if (event.button !== 0) return;

			if (playheadRef?.current?.contains(event.target as Node)) return;

			event.preventDefault();
			setIsDraggingRuler(true);
			setHasDraggedRuler(false);

			playback.setScrubbing({ isScrubbing: true });
			handleScrub({ event, snappingEnabled: false });
		},
		[handleScrub, playheadRef, playback],
	);

	const handlePlayheadMouseDownEvent = useCallback(
		(event: React.MouseEvent) => handlePlayheadMouseDown({ event }),
		[handlePlayheadMouseDown],
	);

	const handleRulerMouseDownEvent = useCallback(
		(event: React.MouseEvent) => handleRulerMouseDown({ event }),
		[handleRulerMouseDown],
	);

	useEdgeAutoScroll({
		isActive: isScrubbing,
		getMouseClientX: () => lastMouseXRef.current,
		rulerScrollRef,
		tracksScrollRef,
		contentWidth: duration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel,
	});

	useEffect(() => {
		if (!isScrubbing) return;

		let rafId: number | null = null;

		const onMouseMove = (event: MouseEvent) => {
			if (rafId !== null) return;
			rafId = requestAnimationFrame(() => {
				rafId = null;
				handleScrub({ event });
				if (isDraggingRulerRef.current) {
					setHasDraggedRuler(true);
				}
			});
		};

		const onMouseUp = (event: MouseEvent) => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			if (seekThrottleRef.current !== null) {
				clearTimeout(seekThrottleRef.current);
				seekThrottleRef.current = null;
			}
			playback.setScrubbing({ isScrubbing: false });
			if (scrubTimeRef.current !== null) {
				seek({ time: scrubTimeRef.current });
				project.setTimelineViewState({
					viewState: {
						zoomLevel,
						scrollLeft: tracksScrollRef.current?.scrollLeft ?? 0,
						playheadTime: scrubTimeRef.current,
					},
				});
			}
			setScrubTime(null);
			pendingSeekTimeRef.current = null;

			if (isDraggingRulerRef.current) {
				setIsDraggingRuler(false);
				if (!hasDraggedRulerRef.current) {
					handleScrub({ event, snappingEnabled: false });
				}
				setHasDraggedRuler(false);
			}
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);

		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
			if (seekThrottleRef.current !== null) {
				clearTimeout(seekThrottleRef.current);
				seekThrottleRef.current = null;
			}
		};
	}, [
		isScrubbing,
		seek,
		handleScrub,
		playback,
		project,
		tracksScrollRef,
		zoomLevel,
	]);

	useEffect(() => {
		if (!isPlaying || isScrubbing) return;

		const rulerViewport = rulerScrollRef.current;
		const tracksViewport = tracksScrollRef.current;
		if (!rulerViewport || !tracksViewport) return;

		const playheadPixels =
			playheadPosition * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
		const viewportWidth = rulerViewport.clientWidth;
		const scrollMinimum = 0;
		const scrollMaximum = rulerViewport.scrollWidth - viewportWidth;

		const needsScroll =
			playheadPixels < rulerViewport.scrollLeft ||
			playheadPixels > rulerViewport.scrollLeft + viewportWidth;

		if (needsScroll) {
			const desiredScroll = Math.max(
				scrollMinimum,
				Math.min(scrollMaximum, playheadPixels - viewportWidth / 2),
			);
			rulerViewport.scrollLeft = tracksViewport.scrollLeft = desiredScroll;
		}
	}, [
		playheadPosition,
		zoomLevel,
		rulerScrollRef,
		tracksScrollRef,
		isScrubbing,
		isPlaying,
	]);

	return {
		playheadPosition,
		handlePlayheadMouseDown: handlePlayheadMouseDownEvent,
		handleRulerMouseDown: handleRulerMouseDownEvent,
		isDraggingRuler,
	};
}

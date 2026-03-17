"use client";

import { useCallback } from "react";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { TimelineElement } from "./timeline-element";
import { TransitionOverlay } from "./transition-overlay";
import type { TimelineTrack, VideoTrack } from "@/types/timeline";
import type { TimelineElement as TimelineElementType } from "@/types/timeline";
import type { TransitionType } from "@/types/transitions";
import type { SnapPoint } from "@/lib/timeline/snap-utils";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { useEdgeAutoScroll } from "@/hooks/timeline/use-edge-auto-scroll";
import type { ElementDragState } from "@/types/timeline";
import { useEditor } from "@/hooks/use-editor";
import { getTrackHeight, timelineTimeToSnappedPixels } from "@/lib/timeline";

interface TimelineTrackContentProps {
	track: TimelineTrack;
	zoomLevel: number;
	dragState: ElementDragState;
	rulerScrollRef: React.RefObject<HTMLDivElement | null>;
	tracksScrollRef: React.RefObject<HTMLDivElement | null>;
	lastMouseXRef: React.RefObject<number>;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
	onResizeStateChange?: (params: { isResizing: boolean }) => void;
	onElementMouseDown: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
	}) => void;
	onElementClick: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
	}) => void;
	onTrackMouseDown?: (event: React.MouseEvent) => void;
	onTrackClick?: (event: React.MouseEvent) => void;
	shouldIgnoreClick?: () => boolean;
	targetElementId?: string | null;
}

export function TimelineTrackContent({
	track,
	zoomLevel,
	dragState,
	rulerScrollRef,
	tracksScrollRef,
	lastMouseXRef,
	onSnapPointChange,
	onResizeStateChange,
	onElementMouseDown,
	onElementClick,
	onTrackMouseDown,
	onTrackClick,
	shouldIgnoreClick,
	targetElementId = null,
}: TimelineTrackContentProps) {
	const editor = useEditor();
	const { isElementSelected } = useElementSelection();

	const duration = editor.timeline.getTotalDuration();

	useEdgeAutoScroll({
		isActive: dragState.isDragging,
		getMouseClientX: () => lastMouseXRef.current ?? 0,
		rulerScrollRef,
		tracksScrollRef,
		contentWidth: duration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel,
	});

	const transitions =
		track.type === "video"
			? (track as VideoTrack).transitions ?? []
			: [];

	const trackHeight = getTrackHeight({ type: track.type });
	const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND;

	const handleTransitionDurationChange = useCallback(
		({ transitionId, newDuration }: { transitionId: string; newDuration: number }) => {
			editor.timeline.updateTransition({
				trackId: track.id,
				transitionId,
				updates: { duration: newDuration },
			});
		},
		[editor, track.id],
	);

	const handleTransitionRemove = useCallback(
		({ transitionId }: { transitionId: string }) => {
			editor.timeline.removeTransition({
				trackId: track.id,
				transitionId,
			});
		},
		[editor, track.id],
	);

	const handleTransitionChangeType = useCallback(
		({ transitionId, newType }: { transitionId: string; newType: TransitionType }) => {
			editor.timeline.updateTransition({
				trackId: track.id,
				transitionId,
				updates: { type: newType },
			});
		},
		[editor, track.id],
	);

	return (
		<button
			className="size-full"
			onClick={(event) => {
				if (shouldIgnoreClick?.()) return;
				onTrackClick?.(event);
			}}
			onMouseDown={(event) => {
				event.preventDefault();
				onTrackMouseDown?.(event);
			}}
			type="button"
		>
			<div className="relative h-full min-w-full">
				{track.elements.length === 0 ? (
					<div className="text-muted-foreground border-muted/30 flex size-full items-center justify-center rounded-sm border-2 border-dashed text-xs" />
				) : (
					<>
						{track.elements.map((element) => {
							const isSelected = isElementSelected({
								trackId: track.id,
								elementId: element.id,
							});

							return (
								<TimelineElement
									key={element.id}
									element={element}
									track={track}
									zoomLevel={zoomLevel}
									isSelected={isSelected}
									onSnapPointChange={onSnapPointChange}
									onResizeStateChange={onResizeStateChange}
									onElementMouseDown={(event, element) =>
										onElementMouseDown({ event, element, track })
									}
									onElementClick={(event, element) =>
										onElementClick({ event, element, track })
									}
									dragState={dragState}
									isDropTarget={element.id === targetElementId}
								/>
							);
						})}
						{transitions.map((transition) => {
							const elementA = track.elements.find(
								(e) => e.id === transition.elementAId,
							);
							if (!elementA) return null;

							const elementAEnd =
								elementA.startTime + elementA.duration;
							const transitionStart =
								elementAEnd - transition.duration;
							const offsetPx = timelineTimeToSnappedPixels({
								time: transitionStart,
								zoomLevel,
							});

							return (
								<TransitionOverlay
									key={transition.id}
									transition={transition}
									pixelsPerSecond={pixelsPerSecond}
									zoomLevel={zoomLevel}
									offsetPx={offsetPx}
									trackHeight={trackHeight}
									onDurationChange={({ newDuration }) =>
										handleTransitionDurationChange({
											transitionId: transition.id,
											newDuration,
										})
									}
									onRemove={() =>
										handleTransitionRemove({
											transitionId: transition.id,
										})
									}
									onChangeType={({ newType }) =>
										handleTransitionChangeType({
											transitionId: transition.id,
											newType,
										})
									}
								/>
							);
						})}
					</>
				)}
			</div>
		</button>
	);
}

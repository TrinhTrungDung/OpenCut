import { useCallback, useEffect, useRef, useState } from "react";
import { useManagers } from "@/hooks/editor";
import { useShiftKey } from "@/hooks/use-shift-key";
import type { TextElement, TimelineElement, Transform } from "@/types/timeline";
import type { ElementAnimations, NumberAnimationChannel } from "@/types/animation";
import { getVisibleElementsWithBounds } from "@/lib/preview/element-bounds";
import { hitTest } from "@/lib/preview/hit-test";
import {
	screenPixelsToLogicalThreshold,
	screenToCanvas,
} from "@/lib/preview/preview-coords";
import { isVisualElement } from "@/lib/timeline/element-utils";
import {
	SNAP_THRESHOLD_SCREEN_PIXELS,
	snapPosition,
	type SnapLine,
} from "@/lib/preview/preview-snap";

const MIN_DRAG_DISTANCE = 0.5;

/**
 * Offset position animation keyframes by the drag delta.
 * When an element has `transform.position.x/y` keyframes (e.g. slide animations),
 * dragging must shift those keyframe values too, otherwise the animation
 * overrides the base transform and locks movement on that axis.
 */
function offsetPositionKeyframes({
	animations,
	deltaX,
	deltaY,
}: {
	animations: ElementAnimations;
	deltaX: number;
	deltaY: number;
}): ElementAnimations | null {
	const xChannel = animations.channels?.["transform.position.x"] as NumberAnimationChannel | undefined;
	const yChannel = animations.channels?.["transform.position.y"] as NumberAnimationChannel | undefined;

	if (!xChannel && !yChannel) return null;

	const channels = { ...animations.channels };

	if (xChannel && deltaX !== 0) {
		channels["transform.position.x"] = {
			...xChannel,
			keyframes: xChannel.keyframes.map((kf) => ({
				...kf,
				value: kf.value + deltaX,
			})),
		};
	}

	if (yChannel && deltaY !== 0) {
		channels["transform.position.y"] = {
			...yChannel,
			keyframes: yChannel.keyframes.map((kf) => ({
				...kf,
				value: kf.value + deltaY,
			})),
		};
	}

	return { channels };
}

interface DragState {
	startX: number;
	startY: number;
	bounds: {
		width: number;
		height: number;
	};
	elements: Array<{
		trackId: string;
		elementId: string;
		initialTransform: Transform;
		initialAnimations: ElementAnimations | undefined;
	}>;
}

export function usePreviewInteraction({
	canvasRef,
}: {
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
	const { playback, timeline, project, media, selection } = useManagers("playback", "timeline", "project", "media", "selection");
	const isShiftHeldRef = useShiftKey();
	const [isDragging, setIsDragging] = useState(false);
	const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
	const [editingText, setEditingText] = useState<{
		trackId: string;
		elementId: string;
		element: TextElement;
		originalOpacity: number;
	} | null>(null);
	const dragStateRef = useRef<DragState | null>(null);
	const wasPlayingRef = useRef(playback.getIsPlaying());
	const editingTextRef = useRef(editingText);
	editingTextRef.current = editingText;

	const commitTextEdit = useCallback(() => {
		const current = editingTextRef.current;
		if (!current) return;
		timeline.previewElements({
			updates: [
				{
					trackId: current.trackId,
					elementId: current.elementId,
					updates: { opacity: current.originalOpacity },
				},
			],
		});
		timeline.commitPreview();
		setEditingText(null);
	}, [timeline]);

	const cancelTextEdit = useCallback(() => {
		timeline.discardPreview();
		setEditingText(null);
	}, [timeline]);

	useEffect(() => {
		const unsubscribe = playback.subscribe(() => {
			const isPlaying = playback.getIsPlaying();
			if (isPlaying && !wasPlayingRef.current && editingTextRef.current) {
				commitTextEdit();
			}
			wasPlayingRef.current = isPlaying;
		});
		return unsubscribe;
	}, [playback, commitTextEdit]);

	const handleDoubleClick = useCallback(
		({ clientX, clientY }: React.MouseEvent) => {
			if (!canvasRef.current || editingText) return;

			const tracks = timeline.getTracks();
			const currentTime = playback.getCurrentTime();
			const mediaAssets = media.getAssets();
			const canvasSize = project.getActive().settings.canvasSize;

			const startPos = screenToCanvas({
				clientX,
				clientY,
				canvas: canvasRef.current,
			});

			const elementsWithBounds = getVisibleElementsWithBounds({
				tracks,
				currentTime,
				canvasSize,
				mediaAssets,
			});

			const hit = hitTest({
				canvasX: startPos.x,
				canvasY: startPos.y,
				elementsWithBounds,
			});

			if (!hit || hit.element.type !== "text") return;

			const textElement = hit.element as TextElement;
			timeline.previewElements({
				updates: [
					{
						trackId: hit.trackId,
						elementId: hit.elementId,
						updates: { opacity: 0 },
					},
				],
			});
			setEditingText({
				trackId: hit.trackId,
				elementId: hit.elementId,
				element: textElement,
				originalOpacity: textElement.opacity,
			});
		},
		[canvasRef, timeline, playback, media, project, editingText],
	);

	const handlePointerDown = useCallback(
		({
			clientX,
			clientY,
			currentTarget,
			pointerId,
			button,
		}: React.PointerEvent) => {
			if (!canvasRef.current) return;
			if (editingText) return;
			if (button !== 0) return;

			const tracks = timeline.getTracks();
			const currentTime = playback.getCurrentTime();
			const mediaAssets = media.getAssets();
			const canvasSize = project.getActive().settings.canvasSize;

			const startPos = screenToCanvas({
				clientX,
				clientY,
				canvas: canvasRef.current,
			});

			const elementsWithBounds = getVisibleElementsWithBounds({
				tracks,
				currentTime,
				canvasSize,
				mediaAssets,
			});

			const hit = hitTest({
				canvasX: startPos.x,
				canvasY: startPos.y,
				elementsWithBounds,
			});

			if (!hit) {
				selection.clearSelection();
				return;
			}

			selection.setSelectedElements({
				elements: [{ trackId: hit.trackId, elementId: hit.elementId }],
			});

			const elementsWithTracks = timeline.getElementsWithTracks({
				elements: [{ trackId: hit.trackId, elementId: hit.elementId }],
			});

			const draggableElements = elementsWithTracks.filter(({ element }) =>
				isVisualElement(element),
			);

			if (draggableElements.length === 0) return;

			dragStateRef.current = {
				startX: startPos.x,
				startY: startPos.y,
				bounds: {
					width: hit.bounds.width,
					height: hit.bounds.height,
				},
				elements: draggableElements.map(({ track, element }) => ({
					trackId: track.id,
					elementId: element.id,
					initialTransform: (element as { transform: Transform }).transform,
					initialAnimations: (element as TimelineElement & { animations?: ElementAnimations }).animations,
				})),
			};

			setIsDragging(true);
			currentTarget.setPointerCapture(pointerId);
		},
		[timeline, playback, media, project, selection, canvasRef, editingText],
	);

	const handlePointerMove = useCallback(
		({ clientX, clientY }: React.PointerEvent) => {
			if (!dragStateRef.current || !isDragging || !canvasRef.current) return;

			const canvasSize = project.getActive().settings.canvasSize;

			const currentPos = screenToCanvas({
				clientX,
				clientY,
				canvas: canvasRef.current,
			});

			const deltaX = currentPos.x - dragStateRef.current.startX;
			const deltaY = currentPos.y - dragStateRef.current.startY;
			const hasMovement =
				Math.abs(deltaX) > MIN_DRAG_DISTANCE ||
				Math.abs(deltaY) > MIN_DRAG_DISTANCE;
			if (!hasMovement) {
				setSnapLines([]);
				return;
			}

			const firstElement = dragStateRef.current.elements[0];
			const proposedPosition = {
				x: firstElement.initialTransform.position.x + deltaX,
				y: firstElement.initialTransform.position.y + deltaY,
			};

			const shouldSnap = !isShiftHeldRef.current;
			const snapThreshold = screenPixelsToLogicalThreshold({
				canvas: canvasRef.current,
				screenPixels: SNAP_THRESHOLD_SCREEN_PIXELS,
			});
			const { snappedPosition, activeLines } = shouldSnap
				? snapPosition({
						proposedPosition,
						canvasSize,
						elementSize: dragStateRef.current.bounds,
						snapThreshold,
					})
				: {
						snappedPosition: proposedPosition,
						activeLines: [] as SnapLine[],
					};

			setSnapLines(activeLines);

			const deltaSnappedX =
				snappedPosition.x - firstElement.initialTransform.position.x;
			const deltaSnappedY =
				snappedPosition.y - firstElement.initialTransform.position.y;

			const updates = dragStateRef.current.elements.map(
				({ trackId, elementId, initialTransform, initialAnimations }) => {
					const result: Record<string, unknown> = {
						transform: {
							...initialTransform,
							position: {
								x: initialTransform.position.x + deltaSnappedX,
								y: initialTransform.position.y + deltaSnappedY,
							},
						},
					};

					/* Offset position animation keyframes so they move with the drag */
					if (initialAnimations) {
						const offsetAnimations = offsetPositionKeyframes({
							animations: initialAnimations,
							deltaX: deltaSnappedX,
							deltaY: deltaSnappedY,
						});
						if (offsetAnimations) {
							result.animations = offsetAnimations;
						}
					}

					return { trackId, elementId, updates: result };
				},
			);

			timeline.previewElements({ updates });
		},
		[isDragging, canvasRef, project, timeline, isShiftHeldRef],
	);

	const handlePointerUp = useCallback(
		({ clientX, clientY, currentTarget, pointerId }: React.PointerEvent) => {
			if (!dragStateRef.current || !isDragging || !canvasRef.current) return;

			const currentPos = screenToCanvas({
				clientX,
				clientY,
				canvas: canvasRef.current,
			});

			const deltaX = currentPos.x - dragStateRef.current.startX;
			const deltaY = currentPos.y - dragStateRef.current.startY;

			const hasMovement =
				Math.abs(deltaX) > MIN_DRAG_DISTANCE ||
				Math.abs(deltaY) > MIN_DRAG_DISTANCE;

			if (!hasMovement) {
				timeline.discardPreview();
			} else {
				timeline.commitPreview();
			}

			dragStateRef.current = null;
			setIsDragging(false);
			setSnapLines([]);
			currentTarget.releasePointerCapture(pointerId);
		},
		[isDragging, canvasRef, timeline],
	);

	return {
		onPointerDown: handlePointerDown,
		onPointerMove: handlePointerMove,
		onPointerUp: handlePointerUp,
		onDoubleClick: handleDoubleClick,
		snapLines,
		editingText,
		commitTextEdit,
		cancelTextEdit,
	};
}

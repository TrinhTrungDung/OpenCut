import {
	useState,
	useCallback,
	useEffect,
	useRef,
	type MouseEvent as ReactMouseEvent,
	type RefObject,
} from "react";
import { useManagers } from "@/hooks/editor";
import { useShiftKey } from "@/hooks/use-shift-key";
import { useTimelineStore } from "@/stores/timeline-store";
import { useDragStore } from "@/stores/drag-store";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import {
	DRAG_THRESHOLD_PX,
	TIMELINE_CONSTANTS,
} from "@/constants/timeline-constants";
import { snapTimeToFrame } from "@/lib/time";
import { computeDropTarget } from "@/lib/timeline/drop-utils";
import { getMouseTimeFromClientX } from "@/lib/timeline/drag-utils";
import { generateUUID } from "@/utils/id";
import {
	findSnapPoints,
	snapToNearestPoint,
	type SnapPoint,
	type SnapResult,
} from "@/lib/timeline/snap-utils";
import type {
	DropTarget,
	TimelineElement,
	TimelineTrack,
} from "@/types/timeline";

interface UseElementInteractionProps {
	zoomLevel: number;
	timelineRef: RefObject<HTMLDivElement | null>;
	tracksContainerRef: RefObject<HTMLDivElement | null>;
	tracksScrollRef: RefObject<HTMLDivElement | null>;
	headerRef?: RefObject<HTMLElement | null>;
	snappingEnabled: boolean;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
}

const MOUSE_BUTTON_RIGHT = 2;

interface PendingDragState {
	elementId: string;
	trackId: string;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
}

function getClickOffsetTime({
	clientX,
	elementRect,
	zoomLevel,
}: {
	clientX: number;
	elementRect: DOMRect;
	zoomLevel: number;
}): number {
	const clickOffsetX = clientX - elementRect.left;
	return clickOffsetX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
}

function getVerticalDragDirection({
	startMouseY,
	currentMouseY,
}: {
	startMouseY: number;
	currentMouseY: number;
}): "up" | "down" | null {
	if (currentMouseY < startMouseY) return "up";
	if (currentMouseY > startMouseY) return "down";
	return null;
}

function getDragDropTarget({
	clientX,
	clientY,
	elementId,
	trackId,
	tracks,
	tracksContainerRef,
	tracksScrollRef,
	headerRef,
	zoomLevel,
	snappedTime,
	verticalDragDirection,
}: {
	clientX: number;
	clientY: number;
	elementId: string;
	trackId: string;
	tracks: TimelineTrack[];
	tracksContainerRef: RefObject<HTMLDivElement | null>;
	tracksScrollRef: RefObject<HTMLDivElement | null>;
	headerRef?: RefObject<HTMLElement | null>;
	zoomLevel: number;
	snappedTime: number;
	verticalDragDirection?: "up" | "down" | null;
}): DropTarget | null {
	const containerRect = tracksContainerRef.current?.getBoundingClientRect();
	const scrollContainer = tracksScrollRef.current;
	if (!containerRect || !scrollContainer) return null;

	const sourceTrack = tracks.find(({ id }) => id === trackId);
	const movingElement = sourceTrack?.elements.find(
		({ id }) => id === elementId,
	);
	if (!movingElement) return null;

	const elementDuration = movingElement.duration;
	const scrollLeft = scrollContainer.scrollLeft;
	const scrollTop = scrollContainer.scrollTop;
	const scrollContainerRect = scrollContainer.getBoundingClientRect();
	const headerHeight = headerRef?.current?.getBoundingClientRect().height ?? 0;
	const mouseX = clientX - scrollContainerRect.left + scrollLeft;
	const mouseY = clientY - scrollContainerRect.top + scrollTop - headerHeight;

	return computeDropTarget({
		elementType: movingElement.type,
		mouseX,
		mouseY,
		tracks,
		playheadTime: snappedTime,
		isExternalDrop: false,
		elementDuration,
		pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
		zoomLevel,
		startTimeOverride: snappedTime,
		excludeElementId: movingElement.id,
		verticalDragDirection,
	});
}

interface StartDragParams {
	elementId: string;
	trackId: string;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
	initialCurrentTime: number;
	initialCurrentMouseY: number;
}

export function useElementInteraction({
	zoomLevel,
	timelineRef,
	tracksContainerRef,
	tracksScrollRef,
	headerRef,
	snappingEnabled,
	onSnapPointChange,
}: UseElementInteractionProps) {
	const { playback, timeline, project, selection } = useManagers(
		"playback",
		"timeline",
		"project",
		"selection",
	);
	const rippleEditingEnabled = useTimelineStore((s) => s.rippleEditingEnabled);
	const isShiftHeldRef = useShiftKey();
	const tracks = timeline.getTracks();
	const {
		isElementSelected,
		selectElement,
		handleElementClick: handleSelectionClick,
	} = useElementSelection();

	const isDragging = useDragStore((s) => s.dragState.isDragging);

	const [isPendingDrag, setIsPendingDrag] = useState(false);
	const pendingDragRef = useRef<PendingDragState | null>(null);
	const lastMouseXRef = useRef(0);
	const mouseDownLocationRef = useRef<{ x: number; y: number } | null>(null);
	const cachedSnapPointsRef = useRef<SnapPoint[] | null>(null);

	const startDrag = useCallback(
		({
			elementId,
			trackId,
			startMouseX,
			startMouseY,
			startElementTime,
			clickOffsetTime,
			initialCurrentTime,
			initialCurrentMouseY,
		}: StartDragParams) => {
			useDragStore.getState().setDragState({
				isDragging: true,
				elementId,
				trackId,
				startMouseX,
				startMouseY,
				startElementTime,
				clickOffsetTime,
				currentTime: initialCurrentTime,
				currentMouseY: initialCurrentMouseY,
			});
		},
		[],
	);

	const endDrag = useCallback(() => {
		useDragStore.getState().endDrag();
		cachedSnapPointsRef.current = null;
	}, []);

	const getDragSnapResult = useCallback(
		({
			frameSnappedTime,
			movingElement,
		}: {
			frameSnappedTime: number;
			movingElement: TimelineElement | null | undefined;
		}) => {
			const shouldSnap = snappingEnabled && !isShiftHeldRef.current;
			if (!shouldSnap || !movingElement) {
				return { snappedTime: frameSnappedTime, snapPoint: null };
			}

			const elementDuration = movingElement.duration;
			const playheadTime = playback.getCurrentTime();

			if (!cachedSnapPointsRef.current) {
				cachedSnapPointsRef.current = findSnapPoints({
					tracks,
					playheadTime,
					excludeElementId: movingElement.id,
				});
			}
			const snapPoints = cachedSnapPointsRef.current;

			const startSnap = snapToNearestPoint({
				targetTime: frameSnappedTime,
				snapPoints,
				zoomLevel,
			});

			const endTargetTime = frameSnappedTime + elementDuration;
			const endSnap = snapToNearestPoint({
				targetTime: endTargetTime,
				snapPoints,
				zoomLevel,
			});
			const endSnapResult: SnapResult = {
				snappedTime: endSnap.snapPoint
					? endSnap.snappedTime - elementDuration
					: frameSnappedTime,
				snapPoint: endSnap.snapPoint,
				snapDistance: endSnap.snapDistance,
			};

			const snapResult =
				startSnap.snapDistance <= endSnapResult.snapDistance
					? startSnap
					: endSnapResult;
			if (!snapResult.snapPoint) {
				return { snappedTime: frameSnappedTime, snapPoint: null };
			}

			return {
				snappedTime: snapResult.snappedTime,
				snapPoint: snapResult.snapPoint,
			};
		},
		[snappingEnabled, playback, tracks, zoomLevel, isShiftHeldRef],
	);

	const rafIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isDragging && !isPendingDrag) return;

		const handleMouseMove = ({ clientX, clientY }: MouseEvent) => {
			const timeline = timelineRef.current;
			const scrollContainer = tracksScrollRef.current;
			if (!timeline || !scrollContainer) return;
			lastMouseXRef.current = clientX;

			if (isPendingDrag && pendingDragRef.current) {
				const deltaX = Math.abs(clientX - pendingDragRef.current.startMouseX);
				const deltaY = Math.abs(clientY - pendingDragRef.current.startMouseY);
				if (deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX) {
					const activeProject = project.getActive();
					if (!activeProject) return;
					const scrollLeft = scrollContainer.scrollLeft;
					const mouseTime = getMouseTimeFromClientX({
						clientX,
						containerRect: scrollContainer.getBoundingClientRect(),
						zoomLevel,
						scrollLeft,
					});
					const adjustedTime = Math.max(
						0,
						mouseTime - pendingDragRef.current.clickOffsetTime,
					);
					const snappedTime = snapTimeToFrame({
						time: adjustedTime,
						fps: activeProject.settings.fps,
					});
					startDrag({
						...pendingDragRef.current,
						initialCurrentTime: snappedTime,
						initialCurrentMouseY: clientY,
					});
					pendingDragRef.current = null;
					setIsPendingDrag(false);
				}
				return;
			}

			if (rafIdRef.current !== null) return;
			rafIdRef.current = requestAnimationFrame(() => {
				rafIdRef.current = null;

				const ds = useDragStore.getState().dragState;
				if (ds.elementId && ds.trackId) {
					const alreadySelected = isElementSelected({
						trackId: ds.trackId,
						elementId: ds.elementId,
					});
					if (!alreadySelected) {
						selectElement({
							trackId: ds.trackId,
							elementId: ds.elementId,
						});
					}
				}

				const activeProject = project.getActive();
				if (!activeProject) return;

				const scrollLeft = scrollContainer.scrollLeft;
				const mouseTime = getMouseTimeFromClientX({
					clientX,
					containerRect: scrollContainer.getBoundingClientRect(),
					zoomLevel,
					scrollLeft,
				});
				const adjustedTime = Math.max(0, mouseTime - ds.clickOffsetTime);
				const fps = activeProject.settings.fps;
				const frameSnappedTime = snapTimeToFrame({ time: adjustedTime, fps });

				const sourceTrack = tracks.find(({ id }) => id === ds.trackId);
				const movingElement = sourceTrack?.elements.find(
					({ id }) => id === ds.elementId,
				);
				const { snappedTime, snapPoint } = getDragSnapResult({
					frameSnappedTime,
					movingElement,
				});

				const newDragState = {
					...ds,
					currentTime: snappedTime,
					currentMouseY: clientY,
				};

				onSnapPointChange?.(snapPoint);

				let newDropTarget: DropTarget | null = null;
				if (ds.elementId && ds.trackId) {
					const verticalDragDirection = getVerticalDragDirection({
						startMouseY: ds.startMouseY,
						currentMouseY: clientY,
					});
					const dropTarget = getDragDropTarget({
						clientX,
						clientY,
						elementId: ds.elementId,
						trackId: ds.trackId,
						tracks,
						tracksContainerRef,
						tracksScrollRef,
						headerRef,
						zoomLevel,
						snappedTime,
						verticalDragDirection,
					});
					newDropTarget = dropTarget?.isNewTrack ? dropTarget : null;
				}

				useDragStore.getState().setDrag(newDragState, newDropTarget);
			});
		};

		document.addEventListener("mousemove", handleMouseMove);
		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [
		isDragging,
		zoomLevel,
		isElementSelected,
		selectElement,
		project,
		timelineRef,
		tracksScrollRef,
		tracksContainerRef,
		headerRef,
		tracks,
		isPendingDrag,
		startDrag,
		getDragSnapResult,
		onSnapPointChange,
	]);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseUp = ({ clientX, clientY }: MouseEvent) => {
			const ds = useDragStore.getState().dragState;
			if (!ds.elementId || !ds.trackId) return;

			if (mouseDownLocationRef.current) {
				const deltaX = Math.abs(clientX - mouseDownLocationRef.current.x);
				const deltaY = Math.abs(clientY - mouseDownLocationRef.current.y);
				if (deltaX <= DRAG_THRESHOLD_PX && deltaY <= DRAG_THRESHOLD_PX) {
					mouseDownLocationRef.current = null;
					endDrag();
					onSnapPointChange?.(null);
					return;
				}
			}

			const dropTarget = getDragDropTarget({
				clientX,
				clientY,
				elementId: ds.elementId,
				trackId: ds.trackId,
				tracks,
				tracksContainerRef,
				tracksScrollRef,
				headerRef,
				zoomLevel,
				snappedTime: ds.currentTime,
				verticalDragDirection: getVerticalDragDirection({
					startMouseY: ds.startMouseY,
					currentMouseY: clientY,
				}),
			});
			if (!dropTarget) {
				endDrag();
				onSnapPointChange?.(null);
				return;
			}
			const snappedTime = ds.currentTime;

			const sourceTrack = tracks.find(({ id }) => id === ds.trackId);
			if (!sourceTrack) {
				endDrag();
				onSnapPointChange?.(null);
				return;
			}

			if (dropTarget.isNewTrack) {
				const newTrackId = generateUUID();

				timeline.moveElement({
					sourceTrackId: ds.trackId,
					targetTrackId: newTrackId,
					elementId: ds.elementId,
					newStartTime: snappedTime,
					createTrack: { type: sourceTrack.type, index: dropTarget.trackIndex },
					rippleEnabled: rippleEditingEnabled,
				});
				selectElement({ trackId: newTrackId, elementId: ds.elementId });
			} else {
				const targetTrack = tracks[dropTarget.trackIndex];
				if (targetTrack) {
					timeline.moveElement({
						sourceTrackId: ds.trackId,
						targetTrackId: targetTrack.id,
						elementId: ds.elementId,
						newStartTime: snappedTime,
						rippleEnabled: rippleEditingEnabled,
					});
					if (targetTrack.id !== ds.trackId) {
						selectElement({
							trackId: targetTrack.id,
							elementId: ds.elementId,
						});
					}
				}
			}

			endDrag();
			onSnapPointChange?.(null);
		};

		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [
		isDragging,
		zoomLevel,
		tracks,
		endDrag,
		onSnapPointChange,
		timeline,
		tracksContainerRef,
		tracksScrollRef,
		headerRef,
		rippleEditingEnabled,
		selectElement,
	]);

	useEffect(() => {
		if (!isPendingDrag) return;

		const handleMouseUp = () => {
			pendingDragRef.current = null;
			setIsPendingDrag(false);
			onSnapPointChange?.(null);
		};

		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [isPendingDrag, onSnapPointChange]);

	const handleElementMouseDown = useCallback(
		({
			event,
			element,
			track,
		}: {
			event: ReactMouseEvent;
			element: TimelineElement;
			track: TimelineTrack;
		}) => {
			const isRightClick = event.button === MOUSE_BUTTON_RIGHT;

			if (isRightClick) {
				const alreadySelected = isElementSelected({
					trackId: track.id,
					elementId: element.id,
				});
				if (!alreadySelected) {
					handleSelectionClick({
						trackId: track.id,
						elementId: element.id,
						isMultiKey: false,
					});
				}
				return;
			}

			event.stopPropagation();
			mouseDownLocationRef.current = { x: event.clientX, y: event.clientY };

			const isMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey;

			if (isMultiSelect) {
				handleSelectionClick({
					trackId: track.id,
					elementId: element.id,
					isMultiKey: true,
				});
			}

			const clickOffsetTime = getClickOffsetTime({
				clientX: event.clientX,
				elementRect: event.currentTarget.getBoundingClientRect(),
				zoomLevel,
			});
			pendingDragRef.current = {
				elementId: element.id,
				trackId: track.id,
				startMouseX: event.clientX,
				startMouseY: event.clientY,
				startElementTime: element.startTime,
				clickOffsetTime,
			};
			setIsPendingDrag(true);
		},
		[zoomLevel, isElementSelected, handleSelectionClick],
	);

	const handleElementClick = useCallback(
		({
			event,
			element,
			track,
		}: {
			event: ReactMouseEvent;
			element: TimelineElement;
			track: TimelineTrack;
		}) => {
			event.stopPropagation();

			if (mouseDownLocationRef.current) {
				const deltaX = Math.abs(event.clientX - mouseDownLocationRef.current.x);
				const deltaY = Math.abs(event.clientY - mouseDownLocationRef.current.y);
				if (deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX) {
					mouseDownLocationRef.current = null;
					return;
				}
			}

			if (event.metaKey || event.ctrlKey || event.shiftKey) return;

			const alreadySelected = isElementSelected({
				trackId: track.id,
				elementId: element.id,
			});
			if (!alreadySelected) {
				selectElement({ trackId: track.id, elementId: element.id });
				return;
			}

			selection.clearKeyframeSelection();
		},
		[selection, isElementSelected, selectElement],
	);

	return {
		handleElementMouseDown,
		handleElementClick,
		lastMouseXRef,
	};
}

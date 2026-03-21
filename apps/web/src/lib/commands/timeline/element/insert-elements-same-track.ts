import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type {
	CreateTimelineElement,
	TimelineTrack,
	TimelineElement,
	TrackType,
} from "@/types/timeline";
import { generateUUID } from "@/utils/id";
import {
	requiresMediaId,
} from "@/lib/timeline/element-utils";
import {
	buildEmptyTrack,
	canElementGoOnTrack,
	getDefaultInsertIndexForTrack,
	enforceMainTrackStart,
} from "@/lib/timeline/track-utils";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

/**
 * Insert multiple elements sequentially on the same track.
 * Elements are placed back-to-back starting at `startTime`.
 */
export class InsertElementsSameTrackCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private elementIds: string[] = [];

	constructor(
		private elements: CreateTimelineElement[],
		private startTime: number,
	) {
		super();
		this.elementIds = elements.map(() => generateUUID());
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		if (!this.savedState || this.elements.length === 0) return;

		// Build all elements with sequential timing
		const builtElements: TimelineElement[] = [];
		let currentTime = this.startTime;

		for (let i = 0; i < this.elements.length; i++) {
			const el = this.elements[i];
			if (requiresMediaId({ element: el }) && !("mediaId" in el)) {
				continue;
			}

			const duration =
				el.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;

			builtElements.push({
				...el,
				id: this.elementIds[i],
				startTime: currentTime,
				trimStart: el.trimStart ?? 0,
				trimEnd: el.trimEnd ?? 0,
				duration,
			} as TimelineElement);

			currentTime += duration;
		}

		if (builtElements.length === 0) return;

		// Determine track type from first element
		const trackType = this.getTrackType(builtElements[0]);

		// Find existing track with no overlaps for the full range
		const fullEnd = currentTime;
		const existingTrack = this.savedState.find((track) => {
			if (!canElementGoOnTrack({ elementType: builtElements[0].type, trackType: track.type })) {
				return false;
			}
			// Check no existing elements overlap our full range
			return !track.elements.some((existing) => {
				const existingEnd = existing.startTime + existing.duration;
				return this.startTime < existingEnd && fullEnd > existing.startTime;
			});
		});

		let updatedTracks: TimelineTrack[];

		if (existingTrack) {
			// Adjust for main track constraints
			const tracks = this.savedState;
			const adjustedElements = builtElements.map((el) => ({
				...el,
				startTime: enforceMainTrackStart({
					tracks,
					targetTrackId: existingTrack.id,
					requestedStartTime: el.startTime,
				}),
			}));

			updatedTracks = this.savedState.map((track) =>
				track.id === existingTrack.id
					? { ...track, elements: [...track.elements, ...adjustedElements] }
					: track,
			) as TimelineTrack[];
		} else {
			// Create new track
			const newTrackId = generateUUID();
			const newTrack = buildEmptyTrack({ id: newTrackId, type: trackType });
			const newTrackWithElements = {
				...newTrack,
				elements: builtElements,
			} as TimelineTrack;

			updatedTracks = [...this.savedState];
			const insertIndex = getDefaultInsertIndexForTrack({
				tracks: updatedTracks,
				trackType,
			});
			updatedTracks.splice(insertIndex, 0, newTrackWithElements);
		}

		// Auto-set canvas size from first visual element (same as InsertElementCommand)
		const firstVisual = builtElements.find(
			(el) => el.type === "video" || el.type === "image",
		);
		const totalExisting = this.savedState.reduce(
			(sum, t) => sum + t.elements.length,
			0,
		);
		if (totalExisting === 0 && firstVisual && "mediaId" in firstVisual) {
			const mediaAssets = editor.media.getAssets();
			const asset = mediaAssets.find((a) => a.id === firstVisual.mediaId);
			if (asset?.width && asset?.height) {
				const activeProject = editor.project.getActive();
				const shouldSetOriginal =
					!activeProject?.settings.originalCanvasSize;
				editor.project.updateSettings({
					settings: {
						canvasSize: { width: asset.width, height: asset.height },
						...(shouldSetOriginal
							? {
									originalCanvasSize: {
										width: asset.width,
										height: asset.height,
									},
								}
							: {}),
					},
					pushHistory: false,
				});
			}
			if (asset?.type === "video" && asset?.fps) {
				editor.project.updateSettings({
					settings: { fps: asset.fps },
					pushHistory: false,
				});
			}
		}

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}

	private getTrackType(element: TimelineElement): TrackType {
		if (element.type === "video" || element.type === "image") return "video";
		return element.type as TrackType;
	}
}

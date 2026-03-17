import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TimelineTrack, VideoTrack } from "@/types/timeline";
import type { TransitionInstance, TransitionType } from "@/types/transitions";
import { DEFAULT_TRANSITION_DURATION } from "@/types/transitions";
import { generateUUID } from "@/utils/id";

export class AddTransitionCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private transitionId: string;

	constructor(
		private readonly trackId: string,
		private readonly elementAId: string,
		private readonly elementBId: string,
		private readonly transitionType: TransitionType,
		private readonly duration: number = DEFAULT_TRANSITION_DURATION,
	) {
		super();
		this.transitionId = generateUUID();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		this.savedState = tracks;

		const updatedTracks = tracks.map((track) => {
			if (track.id !== this.trackId || track.type !== "video") return track;

			const videoTrack = track as VideoTrack;
			const transitions = videoTrack.transitions ?? [];

			// Avoid duplicate transitions between the same elements
			const exists = transitions.some(
				(t) =>
					t.elementAId === this.elementAId &&
					t.elementBId === this.elementBId,
			);
			if (exists) return track;

			const newTransition: TransitionInstance = {
				id: this.transitionId,
				type: this.transitionType,
				duration: this.duration,
				elementAId: this.elementAId,
				elementBId: this.elementBId,
			};

			return {
				...videoTrack,
				transitions: [...transitions, newTransition],
			} as VideoTrack;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			EditorCore.getInstance().timeline.updateTracks(this.savedState);
		}
	}

	getTransitionId(): string {
		return this.transitionId;
	}
}

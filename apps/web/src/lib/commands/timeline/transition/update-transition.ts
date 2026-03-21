import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TimelineTrack, VideoTrack } from "@/types/timeline";
import type { TransitionInstance } from "@/types/transitions";

export class UpdateTransitionCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private readonly trackId: string,
		private readonly transitionId: string,
		private readonly updates: Partial<Pick<TransitionInstance, "type" | "duration" | "easing">>,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		this.savedState = tracks;

		const updatedTracks = tracks.map((track) => {
			if (track.id !== this.trackId || track.type !== "video") return track;

			const videoTrack = track as VideoTrack;
			const transitions = (videoTrack.transitions ?? []).map((t) => {
				if (t.id !== this.transitionId) return t;
				return { ...t, ...this.updates };
			});

			return { ...videoTrack, transitions } as VideoTrack;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			EditorCore.getInstance().timeline.updateTracks(this.savedState);
		}
	}
}

import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TimelineTrack, VideoTrack } from "@/types/timeline";

export class RemoveTransitionCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private readonly trackId: string,
		private readonly transitionId: string,
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
			const transitions = videoTrack.transitions ?? [];

			return {
				...videoTrack,
				transitions: transitions.filter((t) => t.id !== this.transitionId),
			} as VideoTrack;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			EditorCore.getInstance().timeline.updateTracks(this.savedState);
		}
	}
}

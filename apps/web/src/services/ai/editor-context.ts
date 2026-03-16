/**
 * Serializes lightweight editor state snapshot for Gemini system prompts.
 * Keeps payload small — summaries only, no binary data.
 */
import { EditorCore } from "@/core";
import type { EditorContext } from "@/types/ai";

/** Build a structured context object from current editor state */
export function getEditorContext(): EditorContext {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActive();
	const tracks = editor.timeline.getTracks();
	const assets = editor.media.getAssets();
	const duration = editor.timeline.getTotalDuration();

	/* Count elements by track type */
	const typeCounts = new Map<string, number>();
	for (const track of tracks) {
		const count = typeCounts.get(track.type) ?? 0;
		typeCounts.set(track.type, count + track.elements.length);
	}

	return {
		projectName: project.metadata.name,
		canvasSize: project.settings.canvasSize,
		fps: project.settings.fps,
		totalDuration: duration,
		trackCount: tracks.length,
		elementSummary: Array.from(typeCounts, ([type, count]) => ({
			type,
			count,
		})),
		mediaAssets: assets.map((a) => ({
			name: a.name,
			type: a.type,
			duration: a.duration,
		})),
	};
}

/** Format editor context as concise text for Gemini system prompt injection */
export function formatContextForPrompt(ctx: EditorContext): string {
	const elements = ctx.elementSummary
		.map((e) => `${e.count} ${e.type}`)
		.join(", ");
	const media = ctx.mediaAssets
		.map(
			(m) =>
				`${m.name} (${m.type}${m.duration ? `, ${m.duration.toFixed(1)}s` : ""})`,
		)
		.join("; ");

	return [
		`Project: ${ctx.projectName}`,
		`Canvas: ${ctx.canvasSize.width}x${ctx.canvasSize.height} @ ${ctx.fps}fps`,
		`Duration: ${ctx.totalDuration.toFixed(1)}s`,
		`Tracks: ${ctx.trackCount} (${elements || "empty"})`,
		media ? `Media: ${media}` : "Media: none",
	].join("\n");
}

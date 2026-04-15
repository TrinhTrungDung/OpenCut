"use client";

import { useActionHandler } from "@/hooks/actions/use-action-handler";
import { useEditor } from "../use-editor";
import { useSmartReframeStore } from "@/stores/smart-reframe-store";
import { useElementSelection } from "../timeline/element/use-element-selection";

/**
 * Action handlers for creator-focused features:
 * beat sync, background removal, smart reframe
 */
export function useCreatorActions() {
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const openReframe = useSmartReframeStore((s) => s.open);

	useActionHandler(
		"add-background-removal",
		() => {
			if (selectedElements.length === 0) return;

			const first = selectedElements[0];
			const tracks = editor.timeline.getTracks();
			const track = tracks.find((t) => t.id === first.trackId);
			if (!track) return;

			const element = track.elements.find((e) => e.id === first.elementId);
			if (!element || (element.type !== "video" && element.type !== "image")) return;

			// Check if already has background removal
			const existingEffects = ("effects" in element ? element.effects : null) ?? [];
			const alreadyHas = existingEffects.some((e) => e.type === "background-removal");
			if (alreadyHas) return;

			editor.timeline.addClipEffect({
				trackId: first.trackId,
				elementId: first.elementId,
				effectType: "background-removal",
			});
		},
		undefined,
	);

	useActionHandler(
		"open-smart-reframe",
		() => {
			openReframe();
		},
		undefined,
	);
}

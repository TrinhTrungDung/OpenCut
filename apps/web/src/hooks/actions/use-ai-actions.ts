"use client";

import { useActionHandler } from "@/hooks/actions/use-action-handler";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import type { Tab } from "@/stores/assets-panel-store";

export function useAIActions() {
	const setActiveTab = useAssetsPanelStore((s) => s.setActiveTab);

	useActionHandler(
		"open-ai-chat",
		() => {
			// "ai" tab added by assets-panel-store tab system
			setActiveTab("ai" as Tab);
		},
		undefined,
	);

	useActionHandler(
		"ai-generate-subtitles",
		() => {
			setActiveTab("captions");
		},
		undefined,
	);

	useActionHandler(
		"ai-analyze-video",
		() => {
			setActiveTab("ai" as Tab);
		},
		undefined,
	);
}

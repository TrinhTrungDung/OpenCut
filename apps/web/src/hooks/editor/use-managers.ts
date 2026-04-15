import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { EditorCore } from "@/core";
import type { PlaybackManager } from "@/core/managers/playback-manager";
import type { TimelineManager } from "@/core/managers/timeline-manager";
import type { ScenesManager } from "@/core/managers/scenes-manager";
import type { ProjectManager } from "@/core/managers/project-manager";
import type { MediaManager } from "@/core/managers/media-manager";
import type { RendererManager } from "@/core/managers/renderer-manager";
import type { SelectionManager } from "@/core/managers/selection-manager";

type ManagerMap = {
	playback: PlaybackManager;
	timeline: TimelineManager;
	scenes: ScenesManager;
	project: ProjectManager;
	media: MediaManager;
	renderer: RendererManager;
	selection: SelectionManager;
};

export type ManagerKey = keyof ManagerMap;

type PickManagers<K extends ManagerKey> = { [P in K]: ManagerMap[P] };

export function useManagers<K extends ManagerKey>(
	...keys: K[]
): PickManagers<K> {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handler = () => {
				versionRef.current += 1;
				onStoreChange();
			};
			const unsubs = keys.map((key) => editor[key].subscribe(handler));
			return () => {
				for (const unsub of unsubs) {
					unsub();
				}
			};
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: keys are static per call site
		[editor],
	);

	const getSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	const result = {} as PickManagers<K>;
	for (const key of keys) {
		(result as Record<string, unknown>)[key] = editor[key];
	}
	return result;
}

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { EditorCore } from "@/core";
import type { TimelineManager } from "@/core/managers/timeline-manager";

export function useTimeline(): TimelineManager {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handler = () => {
				versionRef.current += 1;
				onStoreChange();
			};
			return editor.timeline.subscribe(handler);
		},
		[editor],
	);

	const getSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return editor.timeline;
}

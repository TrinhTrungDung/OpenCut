import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { EditorCore } from "@/core";
import type { ScenesManager } from "@/core/managers/scenes-manager";

export function useScenesManager(): ScenesManager {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handler = () => {
				versionRef.current += 1;
				onStoreChange();
			};
			return editor.scenes.subscribe(handler);
		},
		[editor],
	);

	const getSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return editor.scenes;
}

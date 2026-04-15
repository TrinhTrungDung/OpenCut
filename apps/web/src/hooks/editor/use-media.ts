import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { EditorCore } from "@/core";
import type { MediaManager } from "@/core/managers/media-manager";

export function useMediaManager(): MediaManager {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handler = () => {
				versionRef.current += 1;
				onStoreChange();
			};
			return editor.media.subscribe(handler);
		},
		[editor],
	);

	const getSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return editor.media;
}

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { EditorCore } from "@/core";
import type { SelectionManager } from "@/core/managers/selection-manager";

export function useSelectionManager(): SelectionManager {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handler = () => {
				versionRef.current += 1;
				onStoreChange();
			};
			return editor.selection.subscribe(handler);
		},
		[editor],
	);

	const getSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return editor.selection;
}

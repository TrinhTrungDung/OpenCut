import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { EditorCore } from "@/core";
import type { RendererManager } from "@/core/managers/renderer-manager";

export function useRendererManager(): RendererManager {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handler = () => {
				versionRef.current += 1;
				onStoreChange();
			};
			return editor.renderer.subscribe(handler);
		},
		[editor],
	);

	const getSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return editor.renderer;
}

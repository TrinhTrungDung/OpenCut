import { useMemo } from "react";
import { EditorCore } from "@/core";

/**
 * Returns the EditorCore singleton with NO reactive subscriptions.
 * Use this when you only need to call actions/methods and don't need
 * the component to re-render on manager state changes.
 */
export function useEditorCore(): EditorCore {
	return useMemo(() => EditorCore.getInstance(), []);
}

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSelectionManager } from "@/hooks/editor";

type ElementRef = { trackId: string; elementId: string };

export function useElementSelection() {
	const selection = useSelectionManager();
	const selectedElements = useSyncExternalStore(
		(listener) => selection.subscribe(listener),
		() => selection.getSelectedElements(),
	);

	const selectedSet = useMemo(
		() =>
			new Set(
				selectedElements.map((e) => `${e.trackId}:${e.elementId}`),
			),
		[selectedElements],
	);

	const isElementSelected = useCallback(
		({ trackId, elementId }: ElementRef) =>
			selectedSet.has(`${trackId}:${elementId}`),
		[selectedSet],
	);

	const selectElement = useCallback(
		({ trackId, elementId }: ElementRef) => {
			selection.setSelectedElements({
				elements: [{ trackId, elementId }],
			});
		},
		[selection],
	);

	const addElementToSelection = useCallback(
		({ trackId, elementId }: ElementRef) => {
			const alreadySelected = selectedElements.some(
				(element) =>
					element.trackId === trackId && element.elementId === elementId,
			);
			if (alreadySelected) return;

			selection.setSelectedElements({
				elements: [...selectedElements, { trackId, elementId }],
			});
		},
		[selectedElements, selection],
	);

	const removeElementFromSelection = useCallback(
		({ trackId, elementId }: ElementRef) => {
			selection.setSelectedElements({
				elements: selectedElements.filter(
					(element) =>
						!(element.trackId === trackId && element.elementId === elementId),
				),
			});
		},
		[selectedElements, selection],
	);

	const toggleElementSelection = useCallback(
		({ trackId, elementId }: ElementRef) => {
			const alreadySelected = selectedElements.some(
				(element) =>
					element.trackId === trackId && element.elementId === elementId,
			);

			if (alreadySelected) {
				removeElementFromSelection({ trackId, elementId });
			} else {
				addElementToSelection({ trackId, elementId });
			}
		},
		[selectedElements, addElementToSelection, removeElementFromSelection],
	);

	const clearElementSelection = useCallback(() => {
		selection.clearSelection();
	}, [selection]);

	const setElementSelection = useCallback(
		({ elements }: { elements: ElementRef[] }) => {
			selection.setSelectedElements({ elements });
		},
		[selection],
	);

	/**
	 * Handles click interaction on an element.
	 * - Regular click: select only this element
	 * - Multi-key click (Ctrl/Cmd): toggle this element in selection
	 */
	const handleElementClick = useCallback(
		({
			trackId,
			elementId,
			isMultiKey,
		}: ElementRef & { isMultiKey: boolean }) => {
			if (isMultiKey) {
				toggleElementSelection({ trackId, elementId });
			} else {
				selectElement({ trackId, elementId });
			}
		},
		[toggleElementSelection, selectElement],
	);

	return {
		selectedElements,
		isElementSelected,
		selectElement,
		setElementSelection,
		addElementToSelection,
		removeElementFromSelection,
		toggleElementSelection,
		clearElementSelection,
		handleElementClick,
	};
}

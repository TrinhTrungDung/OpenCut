import { useCallback, useSyncExternalStore } from "react";
import { useSelectionManager } from "@/hooks/editor";
import type { SelectedKeyframeRef } from "@/types/animation";

function getSelectedKeyframeId({
	keyframe,
}: {
	keyframe: SelectedKeyframeRef;
}): string {
	return `${keyframe.trackId}:${keyframe.elementId}:${keyframe.propertyPath}:${keyframe.keyframeId}`;
}

function mergeUniqueKeyframes({
	keyframes,
}: {
	keyframes: SelectedKeyframeRef[];
}): SelectedKeyframeRef[] {
	const keyframesById = new Map<string, SelectedKeyframeRef>();
	for (const keyframe of keyframes) {
		keyframesById.set(getSelectedKeyframeId({ keyframe }), keyframe);
	}
	return [...keyframesById.values()];
}

export function useKeyframeSelection() {
	const selection = useSelectionManager();
	const selectedKeyframes = useSyncExternalStore(
		(listener) => selection.subscribe(listener),
		() => selection.getSelectedKeyframes(),
	);
	const keyframeSelectionAnchor = useSyncExternalStore(
		(listener) => selection.subscribe(listener),
		() => selection.getKeyframeSelectionAnchor(),
	);

	const isKeyframeSelected = useCallback(
		({ keyframe }: { keyframe: SelectedKeyframeRef }) => {
			const keyframeId = getSelectedKeyframeId({ keyframe });
			return selectedKeyframes.some(
				(selectedKeyframe) =>
					getSelectedKeyframeId({ keyframe: selectedKeyframe }) === keyframeId,
			);
		},
		[selectedKeyframes],
	);

	const setKeyframeSelection = useCallback(
		({
			keyframes,
			anchorKeyframe,
		}: {
			keyframes: SelectedKeyframeRef[];
			anchorKeyframe?: SelectedKeyframeRef;
		}) => {
			const uniqueKeyframes = mergeUniqueKeyframes({ keyframes });
			selection.setSelectedKeyframes({
				keyframes: uniqueKeyframes,
				anchorKeyframe:
					anchorKeyframe ?? uniqueKeyframes[uniqueKeyframes.length - 1] ?? null,
			});
		},
		[selection],
	);

	const addKeyframesToSelection = useCallback(
		({
			keyframes,
			anchorKeyframe,
		}: {
			keyframes: SelectedKeyframeRef[];
			anchorKeyframe?: SelectedKeyframeRef;
		}) => {
			const mergedKeyframes = mergeUniqueKeyframes({
				keyframes: [...selectedKeyframes, ...keyframes],
			});
			selection.setSelectedKeyframes({
				keyframes: mergedKeyframes,
				anchorKeyframe:
					anchorKeyframe ?? mergedKeyframes[mergedKeyframes.length - 1] ?? null,
			});
		},
		[selectedKeyframes, selection],
	);

	const removeKeyframesFromSelection = useCallback(
		({
			keyframes,
			anchorKeyframe,
		}: {
			keyframes: SelectedKeyframeRef[];
			anchorKeyframe?: SelectedKeyframeRef;
		}) => {
			const keyframeIdsToRemove = new Set(
				keyframes.map((keyframe) => getSelectedKeyframeId({ keyframe })),
			);
			const nextKeyframes = selectedKeyframes.filter(
				(selectedKeyframe) =>
					!keyframeIdsToRemove.has(
						getSelectedKeyframeId({ keyframe: selectedKeyframe }),
					),
			);
			selection.setSelectedKeyframes({
				keyframes: nextKeyframes,
				anchorKeyframe:
					anchorKeyframe ?? nextKeyframes[nextKeyframes.length - 1] ?? null,
			});
		},
		[selectedKeyframes, selection],
	);

	const clearKeyframeSelection = useCallback(() => {
		selection.clearKeyframeSelection();
	}, [selection]);

	const toggleKeyframeSelection = useCallback(
		({
			keyframes,
			isMultiKey,
		}: {
			keyframes: SelectedKeyframeRef[];
			isMultiKey: boolean;
		}) => {
			const anchorKeyframe = keyframes[0];
			const areAllKeyframesSelected = keyframes.every((keyframe) =>
				isKeyframeSelected({ keyframe }),
			);
			if (!isMultiKey) {
				setKeyframeSelection({ keyframes, anchorKeyframe });
				return;
			}

			if (areAllKeyframesSelected) {
				removeKeyframesFromSelection({ keyframes, anchorKeyframe });
				return;
			}

			addKeyframesToSelection({ keyframes, anchorKeyframe });
		},
		[
			setKeyframeSelection,
			isKeyframeSelected,
			removeKeyframesFromSelection,
			addKeyframesToSelection,
		],
	);

	const selectKeyframeRange = useCallback(
		({
			orderedKeyframes,
			targetKeyframes,
			isAdditive,
		}: {
			orderedKeyframes: SelectedKeyframeRef[];
			targetKeyframes: SelectedKeyframeRef[];
			isAdditive: boolean;
		}) => {
			if (orderedKeyframes.length === 0 || targetKeyframes.length === 0) {
				return;
			}

			const anchorKeyframe =
				keyframeSelectionAnchor ??
				selectedKeyframes[selectedKeyframes.length - 1] ??
				targetKeyframes[0];
			if (!anchorKeyframe) {
				return;
			}

			const targetKeyframeIds = new Set(
				targetKeyframes.map((keyframe) => getSelectedKeyframeId({ keyframe })),
			);
			const anchorId = getSelectedKeyframeId({ keyframe: anchorKeyframe });
			const anchorIndex = orderedKeyframes.findIndex(
				(keyframe) => getSelectedKeyframeId({ keyframe }) === anchorId,
			);
			if (anchorIndex === -1) {
				if (isAdditive) {
					addKeyframesToSelection({
						keyframes: targetKeyframes,
						anchorKeyframe,
					});
					return;
				}
				setKeyframeSelection({ keyframes: targetKeyframes, anchorKeyframe });
				return;
			}

			const targetIndexes = orderedKeyframes
				.map((keyframe, index) => ({
					keyframeId: getSelectedKeyframeId({ keyframe }),
					index,
				}))
				.filter(({ keyframeId }) => targetKeyframeIds.has(keyframeId))
				.map(({ index }) => index);
			if (targetIndexes.length === 0) {
				return;
			}

			const rangeStart = Math.min(anchorIndex, ...targetIndexes);
			const rangeEnd = Math.max(anchorIndex, ...targetIndexes);
			const rangeKeyframes = orderedKeyframes.slice(rangeStart, rangeEnd + 1);

			if (isAdditive) {
				addKeyframesToSelection({ keyframes: rangeKeyframes, anchorKeyframe });
				return;
			}

			setKeyframeSelection({ keyframes: rangeKeyframes, anchorKeyframe });
		},
		[
			keyframeSelectionAnchor,
			selectedKeyframes,
			addKeyframesToSelection,
			setKeyframeSelection,
		],
	);

	return {
		selectedKeyframes,
		keyframeSelectionAnchor,
		isKeyframeSelected,
		setKeyframeSelection,
		addKeyframesToSelection,
		removeKeyframesFromSelection,
		clearKeyframeSelection,
		toggleKeyframeSelection,
		selectKeyframeRange,
	};
}

"use client";

import { useCallback, useMemo, useState } from "react";
import type { TextElement } from "@/types/timeline";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import {
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	LOOP_PRESETS,
	mergeAnimationPresets,
	type AnimationPreset,
} from "@/lib/text/animation-presets";

export function TextAnimationTab({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();

	/* Track which presets are currently selected */
	const [selectedEntrance, setSelectedEntrance] =
		useState<AnimationPreset | null>(null);
	const [selectedExit, setSelectedExit] = useState<AnimationPreset | null>(
		null,
	);
	const [selectedLoop, setSelectedLoop] = useState<AnimationPreset | null>(
		null,
	);

	const applyAnimations = useCallback(
		({
			entrance,
			exit,
			loop,
		}: {
			entrance: AnimationPreset | null;
			exit: AnimationPreset | null;
			loop: AnimationPreset | null;
		}) => {
			const animations = mergeAnimationPresets({
				entrance,
				exit,
				loop,
				duration: element.duration,
			});

			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { animations: animations ?? { channels: {} } },
					},
				],
			});
		},
		[editor, trackId, element.id, element.duration],
	);

	const handleSelectEntrance = useCallback(
		(preset: AnimationPreset | null) => {
			setSelectedEntrance(preset);
			applyAnimations({ entrance: preset, exit: selectedExit, loop: selectedLoop });
		},
		[applyAnimations, selectedExit, selectedLoop],
	);

	const handleSelectExit = useCallback(
		(preset: AnimationPreset | null) => {
			setSelectedExit(preset);
			applyAnimations({ entrance: selectedEntrance, exit: preset, loop: selectedLoop });
		},
		[applyAnimations, selectedEntrance, selectedLoop],
	);

	const handleSelectLoop = useCallback(
		(preset: AnimationPreset | null) => {
			setSelectedLoop(preset);
			applyAnimations({ entrance: selectedEntrance, exit: selectedExit, loop: preset });
		},
		[applyAnimations, selectedEntrance, selectedExit],
	);

	const handleClearAll = useCallback(() => {
		setSelectedEntrance(null);
		setSelectedExit(null);
		setSelectedLoop(null);
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { animations: { channels: {} } },
				},
			],
		});
	}, [editor, trackId, element.id]);

	const hasAnyAnimation = selectedEntrance || selectedExit || selectedLoop;

	return (
		<div className="flex flex-col gap-4 p-3">
			{/* Clear all button */}
			{hasAnyAnimation && (
				<button
					type="button"
					onClick={handleClearAll}
					className="text-muted-foreground hover:text-foreground self-end text-xs underline"
				>
					Clear all
				</button>
			)}

			{/* Entrance animations */}
			<AnimationSection
				title="Entrance"
				presets={ENTRANCE_PRESETS}
				selectedId={selectedEntrance?.id ?? null}
				onSelect={handleSelectEntrance}
			/>

			{/* Exit animations */}
			<AnimationSection
				title="Exit"
				presets={EXIT_PRESETS}
				selectedId={selectedExit?.id ?? null}
				onSelect={handleSelectExit}
			/>

			{/* Loop animations */}
			<AnimationSection
				title="Loop"
				presets={LOOP_PRESETS}
				selectedId={selectedLoop?.id ?? null}
				onSelect={handleSelectLoop}
			/>
		</div>
	);
}

function AnimationSection({
	title,
	presets,
	selectedId,
	onSelect,
}: {
	title: string;
	presets: AnimationPreset[];
	selectedId: string | null;
	onSelect: (preset: AnimationPreset | null) => void;
}) {
	return (
		<div>
			<h3 className="text-muted-foreground mb-2 text-xs font-medium">
				{title}
			</h3>
			<div className="grid grid-cols-3 gap-1.5">
				{/* None option */}
				<AnimationPresetButton
					name="None"
					isSelected={selectedId === null}
					onClick={() => onSelect(null)}
				/>
				{presets.map((preset) => (
					<AnimationPresetButton
						key={preset.id}
						name={preset.name}
						isSelected={selectedId === preset.id}
						onClick={() =>
							onSelect(selectedId === preset.id ? null : preset)
						}
					/>
				))}
			</div>
		</div>
	);
}

function AnimationPresetButton({
	name,
	isSelected,
	onClick,
}: {
	name: string;
	isSelected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-center justify-center rounded-md px-2 py-2 text-xs transition-colors",
				isSelected
					? "bg-primary text-primary-foreground"
					: "bg-accent text-muted-foreground hover:bg-accent/80 hover:text-foreground",
			)}
		>
			{name}
		</button>
	);
}

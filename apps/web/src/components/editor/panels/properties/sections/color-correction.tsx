"use client";

import { useEditor } from "@/hooks/use-editor";
import { clamp } from "@/utils/math";
import { NumberField } from "@/components/ui/number-field";
import { buildDefaultEffectInstance } from "@/lib/effects";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "../section";
import type { Effect } from "@/types/effects";
import type { ElementType } from "@/types/timeline";
import type { ElementAnimations } from "@/types/animation";
import { useCallback, useRef } from "react";

type ColorCorrectionElement = {
	id: string;
	type: ElementType;
	effects?: Effect[];
	startTime: number;
	duration: number;
	animations?: ElementAnimations;
};

const SLIDERS = [
	{ key: "brightness", label: "Brightness", min: -100, max: 100 },
	{ key: "contrast", label: "Contrast", min: -100, max: 100 },
	{ key: "saturation", label: "Saturation", min: -100, max: 100 },
	{ key: "exposure", label: "Exposure", min: -100, max: 100 },
	{ key: "temperature", label: "Temperature", min: -100, max: 100 },
	{ key: "tint", label: "Tint", min: -100, max: 100 },
	{ key: "highlights", label: "Highlights", min: -100, max: 100 },
	{ key: "shadows", label: "Shadows", min: -100, max: 100 },
	{ key: "hueShift", label: "Hue Shift", min: -180, max: 180 },
] as const;

const EFFECT_TYPE = "color-correction";

function findColorCorrectionEffect(effects?: Effect[]): Effect | undefined {
	return effects?.find((e) => e.type === EFFECT_TYPE);
}

function buildUpdatedEffects({
	effects,
	key,
	value,
}: {
	effects: Effect[] | undefined;
	key: string;
	value: number;
}): Effect[] {
	const existing = findColorCorrectionEffect(effects);
	if (existing) {
		return (effects ?? []).map((e) =>
			e.id !== existing.id
				? e
				: { ...e, params: { ...e.params, [key]: value } },
		);
	}
	const newEffect = buildDefaultEffectInstance({ effectType: EFFECT_TYPE });
	newEffect.params[key] = value;
	return [...(effects ?? []), newEffect];
}

export function ColorCorrectionSection({
	element,
	trackId,
}: {
	element: ColorCorrectionElement;
	trackId: string;
}) {
	const editor = useEditor();
	const ccEffect = findColorCorrectionEffect(element.effects);
	const isScrubbing = useRef(false);

	const handleScrub = useCallback(
		({ key, min, max }: { key: string; min: number; max: number }) =>
			(rawValue: number) => {
				const value = Math.round(clamp({ value: rawValue, min, max }));
				const updatedEffects = buildUpdatedEffects({
					effects: element.effects,
					key,
					value,
				});
				isScrubbing.current = true;
				editor.timeline.previewElements({
					updates: [
						{
							trackId,
							elementId: element.id,
							updates: { effects: updatedEffects },
						},
					],
				});
			},
		[editor, trackId, element.id, element.effects],
	);

	const handleScrubEnd = useCallback(() => {
		isScrubbing.current = false;
		editor.timeline.commitPreview();
	}, [editor]);

	const handleChange = useCallback(
		({
			key,
			min,
			max,
		}: { key: string; min: number; max: number }) =>
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const parsed = Number.parseInt(event.target.value, 10);
				if (Number.isNaN(parsed)) return;
				const value = Math.round(clamp({ value: parsed, min, max }));
				const updatedEffects = buildUpdatedEffects({
					effects: element.effects,
					key,
					value,
				});
				editor.timeline.updateElements({
					updates: [
						{
							trackId,
							elementId: element.id,
							updates: { effects: updatedEffects },
						},
					],
				});
			},
		[editor, trackId, element.id, element.effects],
	);

	const handleReset = useCallback(() => {
		if (!ccEffect) return;
		const updatedEffects = (element.effects ?? []).filter(
			(e) => e.id !== ccEffect.id,
		);
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { effects: updatedEffects },
				},
			],
		});
	}, [editor, trackId, element.id, element.effects, ccEffect]);

	const hasNonDefaultValues = ccEffect
		? Object.values(ccEffect.params).some((v) => v !== 0)
		: false;

	return (
		<Section
			collapsible
			sectionKey={`${element.type}:color-correction`}
		>
			<SectionHeader
				trailing={
					hasNonDefaultValues ? (
						<Button
							variant="ghost"
							size="icon"
							aria-label="Reset color correction"
							onClick={(event) => {
								event.stopPropagation();
								handleReset();
							}}
						>
							<HugeiconsIcon
								icon={ArrowTurnBackwardIcon}
								className="size-4"
							/>
						</Button>
					) : undefined
				}
			>
				<SectionTitle>Color Correction</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionFields>
					{SLIDERS.map(({ key, label, min, max }) => {
						const value = ccEffect
							? Number(ccEffect.params[key] ?? 0)
							: 0;
						return (
							<SectionField key={key} label={label}>
								<NumberField
									className="w-full"
									value={value}
									min={min}
									max={max}
									onChange={handleChange({ key, min, max })}
									onScrub={handleScrub({ key, min, max })}
									onScrubEnd={handleScrubEnd}
									onReset={() => {
										if (!ccEffect || value === 0) return;
										const updatedEffects = buildUpdatedEffects({
											effects: element.effects,
											key,
											value: 0,
										});
										editor.timeline.updateElements({
											updates: [
												{
													trackId,
													elementId: element.id,
													updates: { effects: updatedEffects },
												},
											],
										});
									}}
									isDefault={value === 0}
								/>
							</SectionField>
						);
					})}
				</SectionFields>
			</SectionContent>
		</Section>
	);
}

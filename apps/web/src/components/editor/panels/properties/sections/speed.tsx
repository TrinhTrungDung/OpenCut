"use client";

import { useEditor } from "@/hooks/use-editor";
import { clamp } from "@/utils/math";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "../section";
import { SpeedCurveEditor } from "../speed-curve-editor";
import type { SpeedCurvePoint } from "@/types/speed";
import { DEFAULT_SPEED, MIN_SPEED, MAX_SPEED } from "@/types/speed";
import { computeDisplayDuration } from "@/lib/speed";
import type { ElementType } from "@/types/timeline";

type SpeedElement = {
	id: string;
	type: ElementType;
	speed?: number;
	speedCurve?: SpeedCurvePoint[];
	startTime: number;
	duration: number;
	sourceDuration?: number;
	trimStart: number;
	trimEnd: number;
};

const SPEED_PRESETS = [
	{ label: "0.5x", value: 0.5 },
	{ label: "1x", value: 1 },
	{ label: "1.5x", value: 1.5 },
	{ label: "2x", value: 2 },
	{ label: "4x", value: 4 },
] as const;

const DEFAULT_CURVE_POINTS: SpeedCurvePoint[] = [
	{ position: 0, speed: 1 },
	{ position: 1, speed: 1 },
];

export function SpeedSection({
	element,
	trackId,
}: {
	element: SpeedElement;
	trackId: string;
}) {
	const editor = useEditor();
	const speed = element.speed ?? DEFAULT_SPEED;
	const [isCurveMode, setIsCurveMode] = useState(
		() => (element.speedCurve?.length ?? 0) > 0,
	);

	const displayValue =
		speed >= 10
			? Math.round(speed).toString()
			: speed >= 1
				? speed.toFixed(1)
				: speed.toFixed(2);

	const updateSpeed = (newSpeed: number) => {
		const clamped = clamp({ value: newSpeed, min: MIN_SPEED, max: MAX_SPEED });
		const srcDuration = element.sourceDuration ?? (element.duration * (element.speed ?? 1));
		const newDuration = computeDisplayDuration({
			sourceDuration: srcDuration,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			speed: clamped,
		});
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { speed: clamped, duration: newDuration, sourceDuration: srcDuration },
				},
			],
		});
	};

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const parsed = Number.parseFloat(event.target.value);
		if (Number.isNaN(parsed)) return;
		updateSpeed(parsed);
	};

	const handleBlur = () => {
		updateSpeed(speed);
	};

	const handleScrub = (value: number) => {
		updateSpeed(value);
	};

	const handleCurveChange = (points: SpeedCurvePoint[]) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { speedCurve: points },
				},
			],
		});
	};

	const toggleCurveMode = () => {
		const next = !isCurveMode;
		setIsCurveMode(next);
		if (next) {
			handleCurveChange(element.speedCurve ?? DEFAULT_CURVE_POINTS);
		} else {
			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { speedCurve: undefined },
					},
				],
			});
		}
	};

	return (
		<Section collapsible sectionKey={`${element.type}:speed`}>
			<SectionHeader>
				<SectionTitle>Speed</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionFields>
					<SectionField label="Speed">
						<NumberField
							className="w-full"
							icon="x"
							value={displayValue}
							min={MIN_SPEED}
							max={MAX_SPEED}
							onChange={handleChange}
							onBlur={handleBlur}
							onScrub={handleScrub}
							onScrubEnd={() => {}}
							onReset={() => updateSpeed(DEFAULT_SPEED)}
							isDefault={speed === DEFAULT_SPEED}
							dragSensitivity="slow"
						/>
					</SectionField>

					<div className="flex items-center gap-1.5">
						{SPEED_PRESETS.map((preset) => (
							<Button
								key={preset.value}
								type="button"
								variant={speed === preset.value ? "secondary" : "ghost"}
								size="sm"
								className="h-7 flex-1 px-1 text-xs"
								onClick={() => updateSpeed(preset.value)}
							>
								{preset.label}
							</Button>
						))}
					</div>

					<div className="flex items-center justify-between">
						<span className="text-xs text-muted-foreground">Speed curve</span>
						<Button
							type="button"
							variant={isCurveMode ? "secondary" : "ghost"}
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={toggleCurveMode}
						>
							{isCurveMode ? "On" : "Off"}
						</Button>
					</div>

					{isCurveMode && (
						<SpeedCurveEditor
							points={element.speedCurve ?? DEFAULT_CURVE_POINTS}
							onChange={handleCurveChange}
						/>
					)}
				</SectionFields>
			</SectionContent>
		</Section>
	);
}

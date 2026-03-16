"use client";

import { useEditor } from "@/hooks/use-editor";
import { clamp } from "@/utils/math";
import { NumberField } from "@/components/ui/number-field";
import {
	Section,
	SectionContent,
	SectionField,
	SectionHeader,
	SectionTitle,
} from "./section";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AudioElement } from "@/types/timeline";
import { KeyframeToggle } from "./keyframe-toggle";
import { useKeyframedNumberProperty } from "./hooks/use-keyframed-number-property";
import { useElementPlayhead } from "./hooks/use-element-playhead";
import { resolveVolumeAtTime } from "@/lib/animation";
import { isPropertyAtDefault } from "./sections/transform";
import {
	type FadePreset,
	DEFAULT_FADE_DURATION,
	FADE_PRESETS,
	generateFadeInKeyframes,
	generateFadeOutKeyframes,
} from "@/lib/audio";

const DEFAULT_VOLUME = 1;

/**
 * Audio properties panel with volume keyframing and fade presets.
 *
 * Props are optional for backward compatibility -- Phase 10 will update
 * the properties router to pass `element` and `trackId`.
 */
export function AudioProperties({
	element,
	trackId,
}: {
	element?: AudioElement;
	trackId?: string;
} = {}) {
	if (!element || !trackId) {
		return <div className="space-y-4 p-5">Audio properties</div>;
	}

	return <AudioPropertiesInner element={element} trackId={trackId} />;
}

function AudioPropertiesInner({
	element,
	trackId,
}: {
	element: AudioElement;
	trackId: string;
}) {
	const editor = useEditor();

	const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});

	const resolvedVolume = resolveVolumeAtTime({
		baseVolume: element.volume,
		animations: element.animations,
		localTime,
	});

	const volume = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "volume",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedVolume * 100).toString(),
		parse: (input) => {
			const parsed = Number.parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: parsed, min: 0, max: 200 }) / 100;
		},
		valueAtPlayhead: resolvedVolume,
		buildBaseUpdates: ({ value }) => ({ volume: value }),
	});

	const applyFadeIn = (preset: FadePreset) => {
		const keyframes = generateFadeInKeyframes({
			duration: DEFAULT_FADE_DURATION,
			preset,
		});
		const upserts = keyframes.map((kf) => ({
			trackId,
			elementId: element.id,
			propertyPath: "volume" as const,
			time: kf.time,
			value: kf.value,
		}));
		editor.timeline.upsertKeyframes({ keyframes: upserts });
	};

	const applyFadeOut = (preset: FadePreset) => {
		const keyframes = generateFadeOutKeyframes({
			elementDuration: element.duration,
			fadeDuration: DEFAULT_FADE_DURATION,
			preset,
		});
		const upserts = keyframes.map((kf) => ({
			trackId,
			elementId: element.id,
			propertyPath: "volume" as const,
			time: kf.time,
			value: kf.value,
		}));
		editor.timeline.upsertKeyframes({ keyframes: upserts });
	};

	return (
		<div className="space-y-0">
			<Section collapsible sectionKey="audio:volume">
				<SectionHeader>
					<SectionTitle>Volume</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionField
						label="Volume"
						beforeLabel={
							<KeyframeToggle
								isActive={volume.isKeyframedAtTime}
								isDisabled={!isPlayheadWithinElementRange}
								title="Toggle volume keyframe"
								onToggle={volume.toggleKeyframe}
							/>
						}
					>
						<NumberField
							className="w-full"
							value={volume.displayValue}
							min={0}
							max={200}
							onFocus={volume.onFocus}
							onChange={volume.onChange}
							onBlur={volume.onBlur}
							onScrub={volume.scrubTo}
							onScrubEnd={volume.commitScrub}
							onReset={() => volume.commitValue({ value: DEFAULT_VOLUME })}
							isDefault={isPropertyAtDefault({
								hasAnimatedKeyframes: volume.hasAnimatedKeyframes,
								isPlayheadWithinElementRange,
								resolvedValue: resolvedVolume,
								staticValue: element.volume,
								defaultValue: DEFAULT_VOLUME,
							})}
							dragSensitivity="slow"
						/>
					</SectionField>
				</SectionContent>
			</Section>

			<Section collapsible sectionKey="audio:fade">
				<SectionHeader>
					<SectionTitle>Fade</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<div className="flex items-start gap-2">
						<SectionField label="Fade In" className="w-1/2">
							<Select onValueChange={(v) => applyFadeIn(v as FadePreset)}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									{FADE_PRESETS.map((preset) => (
										<SelectItem key={preset.value} value={preset.value}>
											{preset.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SectionField>
						<SectionField label="Fade Out" className="w-1/2">
							<Select onValueChange={(v) => applyFadeOut(v as FadePreset)}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									{FADE_PRESETS.map((preset) => (
										<SelectItem key={preset.value} value={preset.value}>
											{preset.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SectionField>
					</div>
				</SectionContent>
			</Section>
		</div>
	);
}

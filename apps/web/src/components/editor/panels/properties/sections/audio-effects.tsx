"use client";

/**
 * Per-clip audio effects section: filter (lowpass/highpass) + 3-band EQ.
 * Renders in the AudioProperties panel for audio and video elements.
 */

import { useEditor } from "@/hooks/use-editor";
import { NumberField } from "@/components/ui/number-field";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "../section";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type AudioEffectParams,
	DEFAULT_AUDIO_EFFECTS,
} from "@/lib/audio/audio-effects-config";

interface AudioEffectsSectionProps {
	trackId: string;
	elementId: string;
	audioEffects?: AudioEffectParams;
}

export function AudioEffectsSection({
	trackId,
	elementId,
	audioEffects,
}: AudioEffectsSectionProps) {
	const editor = useEditor();
	const effects = audioEffects ?? DEFAULT_AUDIO_EFFECTS;

	const updateEffects = (patch: Partial<AudioEffectParams>) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId,
					updates: {
						audioEffects: { ...effects, ...patch },
					},
				},
			],
		});
	};

	return (
		<>
			<Section collapsible sectionKey="audio:filter">
				<SectionHeader>
					<SectionTitle>Filter</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields>
						<SectionField label="Type">
							<Select
								value={effects.filterType}
								onValueChange={(v) =>
									updateEffects({
										filterType: v as AudioEffectParams["filterType"],
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									<SelectItem value="lowpass">Low Pass</SelectItem>
									<SelectItem value="highpass">High Pass</SelectItem>
								</SelectContent>
							</Select>
						</SectionField>

						{effects.filterType !== "none" && (
							<>
								<SectionField label="Frequency">
									<NumberField
										className="w-full"
										value={Math.round(effects.filterFrequency).toString()}
										min={20}
										max={20000}
										icon="Hz"
										onChange={(e) => {
											const v = Number.parseFloat(e.target.value);
											if (!Number.isNaN(v)) {
												updateEffects({
													filterFrequency: Math.max(20, Math.min(20000, v)),
												});
											}
										}}
										onBlur={() => {}}
										isDefault={
											effects.filterFrequency ===
											DEFAULT_AUDIO_EFFECTS.filterFrequency
										}
										onReset={() =>
											updateEffects({
												filterFrequency:
													DEFAULT_AUDIO_EFFECTS.filterFrequency,
											})
										}
									/>
								</SectionField>
								<SectionField label="Resonance">
									<NumberField
										className="w-full"
										value={effects.filterQ.toFixed(1)}
										min={0.1}
										max={20}
										icon="Q"
										onChange={(e) => {
											const v = Number.parseFloat(e.target.value);
											if (!Number.isNaN(v)) {
												updateEffects({
													filterQ: Math.max(0.1, Math.min(20, v)),
												});
											}
										}}
										onBlur={() => {}}
										isDefault={
											effects.filterQ === DEFAULT_AUDIO_EFFECTS.filterQ
										}
										onReset={() =>
											updateEffects({
												filterQ: DEFAULT_AUDIO_EFFECTS.filterQ,
											})
										}
										dragSensitivity="slow"
									/>
								</SectionField>
							</>
						)}
					</SectionFields>
				</SectionContent>
			</Section>

			<Section collapsible sectionKey="audio:eq">
				<SectionHeader>
					<SectionTitle>Equalizer</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields>
						<SectionField label="Low">
							<NumberField
								className="w-full"
								value={effects.eqLowGain.toFixed(1)}
								min={-12}
								max={12}
								icon="dB"
								onChange={(e) => {
									const v = Number.parseFloat(e.target.value);
									if (!Number.isNaN(v)) {
										updateEffects({
											eqLowGain: Math.max(-12, Math.min(12, v)),
										});
									}
								}}
								onBlur={() => {}}
								isDefault={effects.eqLowGain === 0}
								onReset={() => updateEffects({ eqLowGain: 0 })}
								dragSensitivity="slow"
							/>
						</SectionField>
						<SectionField label="Mid">
							<NumberField
								className="w-full"
								value={effects.eqMidGain.toFixed(1)}
								min={-12}
								max={12}
								icon="dB"
								onChange={(e) => {
									const v = Number.parseFloat(e.target.value);
									if (!Number.isNaN(v)) {
										updateEffects({
											eqMidGain: Math.max(-12, Math.min(12, v)),
										});
									}
								}}
								onBlur={() => {}}
								isDefault={effects.eqMidGain === 0}
								onReset={() => updateEffects({ eqMidGain: 0 })}
								dragSensitivity="slow"
							/>
						</SectionField>
						<SectionField label="Mid Freq">
							<NumberField
								className="w-full"
								value={Math.round(effects.eqMidFreq).toString()}
								min={200}
								max={8000}
								icon="Hz"
								onChange={(e) => {
									const v = Number.parseFloat(e.target.value);
									if (!Number.isNaN(v)) {
										updateEffects({
											eqMidFreq: Math.max(200, Math.min(8000, v)),
										});
									}
								}}
								onBlur={() => {}}
								isDefault={
									effects.eqMidFreq === DEFAULT_AUDIO_EFFECTS.eqMidFreq
								}
								onReset={() =>
									updateEffects({
										eqMidFreq: DEFAULT_AUDIO_EFFECTS.eqMidFreq,
									})
								}
							/>
						</SectionField>
						<SectionField label="High">
							<NumberField
								className="w-full"
								value={effects.eqHighGain.toFixed(1)}
								min={-12}
								max={12}
								icon="dB"
								onChange={(e) => {
									const v = Number.parseFloat(e.target.value);
									if (!Number.isNaN(v)) {
										updateEffects({
											eqHighGain: Math.max(-12, Math.min(12, v)),
										});
									}
								}}
								onBlur={() => {}}
								isDefault={effects.eqHighGain === 0}
								onReset={() => updateEffects({ eqHighGain: 0 })}
								dragSensitivity="slow"
							/>
						</SectionField>
					</SectionFields>
				</SectionContent>
			</Section>
		</>
	);
}

"use client";

import { useState, useCallback } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FPS_PRESETS } from "@/constants/project-constants";
import { useEditor } from "@/hooks/use-editor";
import { useEditorStore } from "@/stores/editor-store";
import { useAIStore } from "@/stores/ai-store";
import { geminiService } from "@/services/ai/gemini-service";
import { dimensionToAspectRatio } from "@/utils/geometry";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/editor/panels/properties/section";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { AIModel } from "@/types/ai";

const ORIGINAL_PRESET_VALUE = "original";

export function findPresetIndexByAspectRatio({
	presets,
	targetAspectRatio,
}: {
	presets: Array<{ width: number; height: number }>;
	targetAspectRatio: string;
}) {
	for (let index = 0; index < presets.length; index++) {
		const preset = presets[index];
		const presetAspectRatio = dimensionToAspectRatio({
			width: preset.width,
			height: preset.height,
		});
		if (presetAspectRatio === targetAspectRatio) {
			return index;
		}
	}
	return -1;
}

export function SettingsView() {
	return (
		<PanelView contentClassName="px-0" hideHeader>
			<div className="flex flex-col">
				<Section showTopBorder={false}>
					<SectionContent>
						<ProjectInfoContent />
					</SectionContent>
				</Section>
				<Popover>
					<Section className="cursor-pointer">
						<PopoverTrigger asChild>
							<div>
								<SectionHeader
									trailing={<div className="size-4 rounded-sm bg-red-500" />}
								>
									<SectionTitle>Background</SectionTitle>
								</SectionHeader>
							</div>
						</PopoverTrigger>
					</Section>
					<PopoverContent>
						<div className="size-4 rounded-sm bg-red-500" />
					</PopoverContent>
				</Popover>
				<Section>
					<SectionHeader>
						<SectionTitle>AI Settings</SectionTitle>
					</SectionHeader>
					<SectionContent>
						<AISettingsContent />
					</SectionContent>
				</Section>
			</div>
		</PanelView>
	);
}

function ProjectInfoContent() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { canvasPresets } = useEditorStore();

	const currentCanvasSize = activeProject.settings.canvasSize;
	const currentAspectRatio = dimensionToAspectRatio(currentCanvasSize);
	const originalCanvasSize = activeProject.settings.originalCanvasSize ?? null;
	const presetIndex = findPresetIndexByAspectRatio({
		presets: canvasPresets,
		targetAspectRatio: currentAspectRatio,
	});
	const selectedPresetValue =
		presetIndex !== -1 ? presetIndex.toString() : ORIGINAL_PRESET_VALUE;

	const handleAspectRatioChange = ({ value }: { value: string }) => {
		if (value === ORIGINAL_PRESET_VALUE) {
			const canvasSize = originalCanvasSize ?? currentCanvasSize;
			editor.project.updateSettings({
				settings: { canvasSize },
			});
			return;
		}
		const index = parseInt(value, 10);
		const preset = canvasPresets[index];
		if (preset) {
			editor.project.updateSettings({ settings: { canvasSize: preset } });
		}
	};

	const handleFpsChange = ({ value }: { value: string }) => {
		const fps = parseFloat(value);
		editor.project.updateSettings({ settings: { fps } });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Name</Label>
				<span className="leading-none text-sm">
					{activeProject.metadata.name}
				</span>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Aspect ratio</Label>
				<Select
					value={selectedPresetValue}
					onValueChange={(value) => handleAspectRatioChange({ value })}
				>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select an aspect ratio" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ORIGINAL_PRESET_VALUE}>Original</SelectItem>
						{canvasPresets.map((preset, index) => {
							const label = dimensionToAspectRatio({
								width: preset.width,
								height: preset.height,
							});
							return (
								<SelectItem key={label} value={index.toString()}>
									{label}
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Frame rate</Label>
				<Select
					value={activeProject.settings.fps.toString()}
					onValueChange={(value) => handleFpsChange({ value })}
				>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select a frame rate" />
					</SelectTrigger>
					<SelectContent>
						{FPS_PRESETS.map((preset) => (
							<SelectItem key={preset.value} value={preset.value}>
								{preset.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

const AI_MODELS: { value: AIModel; label: string }[] = [
	{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
	{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

function AISettingsContent() {
	const apiKey = useAIStore((s) => s.apiKey);
	const setApiKey = useAIStore((s) => s.setApiKey);
	const model = useAIStore((s) => s.model);
	const setModel = useAIStore((s) => s.setModel);
	const isKeyValid = useAIStore((s) => s.isKeyValid);
	const setKeyValid = useAIStore((s) => s.setKeyValid);

	const [showKey, setShowKey] = useState(false);
	const [isValidating, setIsValidating] = useState(false);
	const [localKey, setLocalKey] = useState(apiKey);

	const handleValidateKey = useCallback(
		async (key: string) => {
			if (!key.trim()) {
				setKeyValid(null);
				return;
			}
			setIsValidating(true);
			try {
				const valid = await geminiService.validateApiKey(key);
				setKeyValid(valid);
			} finally {
				setIsValidating(false);
			}
		},
		[setKeyValid],
	);

	const handleBlur = useCallback(() => {
		if (localKey !== apiKey) {
			setApiKey(localKey);
			handleValidateKey(localKey);
		}
	}, [localKey, apiKey, setApiKey, handleValidateKey]);

	const handleClear = useCallback(() => {
		setLocalKey("");
		setApiKey("");
		setKeyValid(null);
	}, [setApiKey, setKeyValid]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>API Key</Label>
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Input
							type={showKey ? "text" : "password"}
							value={localKey}
							onChange={(e) => setLocalKey(e.target.value)}
							onBlur={handleBlur}
							placeholder="Enter Gemini API key"
							className="pr-8"
						/>
						<button
							type="button"
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onClick={() => setShowKey((v) => !v)}
							tabIndex={-1}
						>
							{showKey ? (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<title>Hide</title>
									<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
									<line x1="1" y1="1" x2="23" y2="23" />
								</svg>
							) : (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<title>Show</title>
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							)}
						</button>
					</div>
					<ValidationStatus
						isValidating={isValidating}
						isKeyValid={isKeyValid}
					/>
				</div>
				<a
					href="https://aistudio.google.com/apikey"
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs text-muted-foreground hover:text-foreground underline"
				>
					Get API key from Google AI Studio
				</a>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Model</Label>
				<Select value={model} onValueChange={(v) => setModel(v as AIModel)}>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select a model" />
					</SelectTrigger>
					<SelectContent>
						{AI_MODELS.map((m) => (
							<SelectItem key={m.value} value={m.value}>
								{m.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{apiKey && (
				<Button variant="outline" size="sm" onClick={handleClear}>
					Clear API key
				</Button>
			)}
		</div>
	);
}

function ValidationStatus({
	isValidating,
	isKeyValid,
}: {
	isValidating: boolean;
	isKeyValid: boolean | null;
}) {
	if (isValidating) {
		return (
			<svg
				className="size-4 animate-spin text-muted-foreground"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<title>Validating</title>
				<circle
					className="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					strokeWidth="4"
				/>
				<path
					className="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
				/>
			</svg>
		);
	}
	if (isKeyValid === true) {
		return (
			<svg
				className="size-4 text-green-500"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<title>Valid</title>
				<polyline points="20 6 9 17 4 12" />
			</svg>
		);
	}
	if (isKeyValid === false) {
		return (
			<svg
				className="size-4 text-red-500"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<title>Invalid</title>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		);
	}
	return null;
}

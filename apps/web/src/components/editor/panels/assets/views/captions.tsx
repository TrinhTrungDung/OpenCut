import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState, useRef, useSyncExternalStore } from "react";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { useEditor } from "@/hooks/use-editor";
import type { TimelineTrack } from "@/types/timeline";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { TRANSCRIPTION_LANGUAGES } from "@/constants/transcription-constants";
import { LANGUAGES } from "@/constants/language-constants";
import type {
	TranscriptionLanguage,
	TranscriptionProgress,
	CaptionChunk,
} from "@/types/transcription";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { buildCaptionChunks } from "@/lib/transcription/caption";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { useAIStore } from "@/stores/ai-store";
import { aiSubtitleGenerator } from "@/services/ai/subtitle-generator";

type CaptionProvider = "local" | "gemini";

export function Captions() {
	const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
	const [provider, setProvider] = useState<CaptionProvider>("local");
	const [targetLanguage, setTargetLanguage] = useState<string>("none");
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const editor = useEditor();

	const selectedElements = useSyncExternalStore(
		(listener) => editor.selection.subscribe(listener),
		() => editor.selection.getSelectedElements(),
	);

	const apiKey = useAIStore((s) => s.apiKey);
	const model = useAIStore((s) => s.model);
	const hasApiKey = apiKey.length > 0;

	const handleProgress = (progress: TranscriptionProgress) => {
		if (progress.status === "loading-model") {
			setProcessingStep(`Loading model ${Math.round(progress.progress)}%`);
		} else if (progress.status === "transcribing") {
			setProcessingStep("Transcribing...");
		}
	};

	const wrapCaptionText = (text: string, maxCharsPerLine = 42): string => {
		if (text.length <= maxCharsPerLine) return text;
		/* Find a break point near the middle, preferring word boundaries */
		const mid = Math.ceil(text.length / 2);
		const spaceAfter = text.indexOf(" ", mid);
		const spaceBefore = text.lastIndexOf(" ", mid);
		const breakAt =
			spaceBefore > 0
				? spaceAfter >= 0 && spaceAfter - mid < mid - spaceBefore
					? spaceAfter
					: spaceBefore
				: spaceAfter >= 0
					? spaceAfter
					: mid;
		return `${text.slice(0, breakAt)}\n${text.slice(breakAt + 1)}`;
	};

	const insertCaptions = (captionChunks: CaptionChunk[]) => {
		const canvasHeight =
			editor.project.getActive().settings.canvasSize.height;

		/* Remove existing caption tracks (text tracks named "Caption *") */
		const tracks = editor.timeline.getTracks();
		for (const track of tracks) {
			if (
				track.type === "text" &&
				track.elements.length > 0 &&
				track.elements[0].name.startsWith("Caption ")
			) {
				editor.timeline.removeTrack({ trackId: track.id });
			}
		}

		const captionTrackId = editor.timeline.addTrack({
			type: "text",
			index: 0,
		});

		for (let i = 0; i < captionChunks.length; i++) {
			const caption = captionChunks[i];
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId: captionTrackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					name: `Caption ${i + 1}`,
					content: wrapCaptionText(caption.text),
					duration: caption.duration,
					startTime: caption.startTime,
					fontSize: 5,
					fontWeight: "bold",
					transform: {
						scale: 1,
						position: { x: 0, y: canvasHeight * 0.35 },
						rotate: 0,
					},
				},
			});
		}
	};

	const handleLocalTranscription = async (audioBlob: Blob) => {
		setProcessingStep("Preparing audio...");
		const { samples } = await decodeAudioToFloat32({ audioBlob });

		const result = await transcriptionService.transcribe({
			audioData: samples,
			language: selectedLanguage === "auto" ? undefined : selectedLanguage,
			onProgress: handleProgress,
		});

		setProcessingStep("Generating captions...");
		return buildCaptionChunks({ segments: result.segments });
	};

	const handleGeminiTranscription = async (audioBlob: Blob) => {
		setProcessingStep("Sending audio to Gemini...");

		const sourceLangName =
			selectedLanguage === "auto"
				? undefined
				: LANGUAGES.find((l) => l.code === selectedLanguage)?.name ??
					selectedLanguage;

		const targetLangName =
			targetLanguage !== "none"
				? LANGUAGES.find((l) => l.code === targetLanguage)?.name
				: undefined;

		const captionChunks = await aiSubtitleGenerator.generateSubtitles({
			audioBlob,
			sourceLanguage: sourceLangName,
			targetLanguage: targetLangName,
			apiKey,
			model,
		});

		setProcessingStep("Processing subtitles...");
		return captionChunks;
	};

	/** Build tracks containing only the selected elements, plus compute their time range */
	const getSelectedScope = () => {
		const allTracks = editor.timeline.getTracks();
		const selected = editor.selection.getSelectedElements();

		if (selected.length === 0) {
			return {
				tracks: allTracks,
				totalDuration: editor.timeline.getTotalDuration(),
				timeOffset: 0,
			};
		}

		const selectedSet = new Set(selected.map((s) => `${s.trackId}:${s.elementId}`));
		const filteredTracks: TimelineTrack[] = [];
		let minStart = Number.POSITIVE_INFINITY;
		let maxEnd = 0;

		for (const track of allTracks) {
			const matchingElements = track.elements.filter((el) =>
				selectedSet.has(`${track.id}:${el.id}`),
			);
			if (matchingElements.length === 0) continue;

			for (const el of matchingElements) {
				minStart = Math.min(minStart, el.startTime);
				maxEnd = Math.max(maxEnd, el.startTime + el.duration);
			}

			filteredTracks.push({ ...track, elements: matchingElements } as TimelineTrack);
		}

		return {
			tracks: filteredTracks,
			totalDuration: maxEnd,
			timeOffset: 0,
		};
	};

	const handleGenerateTranscript = async () => {
		try {
			setIsProcessing(true);
			setError(null);
			setProcessingStep("Extracting audio...");

			const { tracks, totalDuration } = getSelectedScope();

			const audioBlob = await extractTimelineAudio({
				tracks,
				mediaAssets: editor.media.getAssets(),
				totalDuration,
			});

			const captionChunks =
				provider === "gemini"
					? await handleGeminiTranscription(audioBlob)
					: await handleLocalTranscription(audioBlob);

			setProcessingStep("Inserting captions...");
			insertCaptions(captionChunks);
		} catch (error) {
			console.error("Transcription failed:", error);
			setError(
				error instanceof Error ? error.message : "An unexpected error occurred",
			);
		} finally {
			setIsProcessing(false);
			setProcessingStep("");
		}
	};

	const handleLanguageChange = ({ value }: { value: string }) => {
		if (value === "auto") {
			setSelectedLanguage("auto");
			return;
		}

		const languageList =
			provider === "gemini" ? LANGUAGES : TRANSCRIPTION_LANGUAGES;
		const matchedLanguage = languageList.find(
			(language) => language.code === value,
		);
		if (!matchedLanguage) return;
		setSelectedLanguage(matchedLanguage.code as TranscriptionLanguage);
	};

	return (
		<PanelView title="Captions" ref={containerRef}>
			<div className="flex flex-col gap-3">
				<Label>Provider</Label>
				<Select
					value={provider}
					onValueChange={(value) => setProvider(value as CaptionProvider)}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="local">Local (Whisper)</SelectItem>
						<SelectItem value="gemini" disabled={!hasApiKey}>
							AI (Gemini){!hasApiKey && " — API key required"}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-3">
				<Label>Language</Label>
				<Select
					value={selectedLanguage}
					onValueChange={(value) => handleLanguageChange({ value })}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select a language" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="auto">Auto detect</SelectItem>
						{(provider === "gemini" ? LANGUAGES : TRANSCRIPTION_LANGUAGES).map(
							(language) => (
								<SelectItem key={language.code} value={language.code}>
									{language.name}
								</SelectItem>
							),
						)}
					</SelectContent>
				</Select>
			</div>

			{provider === "gemini" && (
				<div className="flex flex-col gap-3">
					<Label>Translate to</Label>
					<Select value={targetLanguage} onValueChange={setTargetLanguage}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">None (original language)</SelectItem>
							{LANGUAGES.map((language) => (
								<SelectItem key={language.code} value={language.code}>
									{language.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="flex flex-col gap-4">
				{error && (
					<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
						<p className="text-destructive text-sm">{error}</p>
					</div>
				)}

				{selectedElements.length > 0 && (
					<p className="text-muted-foreground text-xs">
						{selectedElements.length} clip{selectedElements.length > 1 ? "s" : ""} selected — captions will be generated for selected clips only
					</p>
				)}

				<Button
					className="w-full"
					onClick={handleGenerateTranscript}
					disabled={isProcessing}
				>
					{isProcessing && <Spinner className="mr-1" />}
					{isProcessing
						? processingStep
						: selectedElements.length > 0
							? `Generate for ${selectedElements.length} clip${selectedElements.length > 1 ? "s" : ""}`
							: "Generate transcript"}
				</Button>
			</div>
		</PanelView>
	);
}

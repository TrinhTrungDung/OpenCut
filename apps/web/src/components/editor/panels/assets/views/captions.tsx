import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState, useRef } from "react";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { TRANSCRIPTION_LANGUAGES } from "@/constants/transcription-constants";
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
	const [selectedLanguage, setSelectedLanguage] =
		useState<TranscriptionLanguage>("auto");
	const [provider, setProvider] = useState<CaptionProvider>("local");
	const [targetLanguage, setTargetLanguage] = useState<string>("none");
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const editor = useEditor();

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

	const insertCaptions = (captionChunks: CaptionChunk[]) => {
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
					content: caption.text,
					duration: caption.duration,
					startTime: caption.startTime,
					fontSize: 65,
					fontWeight: "bold",
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
				? "Auto detect"
				: TRANSCRIPTION_LANGUAGES.find((l) => l.code === selectedLanguage)
						?.name ?? selectedLanguage;

		const targetLangName =
			targetLanguage !== "none"
				? TRANSCRIPTION_LANGUAGES.find((l) => l.code === targetLanguage)?.name
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

	const handleGenerateTranscript = async () => {
		try {
			setIsProcessing(true);
			setError(null);
			setProcessingStep("Extracting audio...");

			const audioBlob = await extractTimelineAudio({
				tracks: editor.timeline.getTracks(),
				mediaAssets: editor.media.getAssets(),
				totalDuration: editor.timeline.getTotalDuration(),
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

		const matchedLanguage = TRANSCRIPTION_LANGUAGES.find(
			(language) => language.code === value,
		);
		if (!matchedLanguage) return;
		setSelectedLanguage(matchedLanguage.code);
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
						{TRANSCRIPTION_LANGUAGES.map((language) => (
							<SelectItem key={language.code} value={language.code}>
								{language.name}
							</SelectItem>
						))}
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
							{TRANSCRIPTION_LANGUAGES.map((language) => (
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

				<Button
					className="w-full"
					onClick={handleGenerateTranscript}
					disabled={isProcessing}
				>
					{isProcessing && <Spinner className="mr-1" />}
					{isProcessing ? processingStep : "Generate transcript"}
				</Button>
			</div>
		</PanelView>
	);
}

/**
 * AI-powered subtitle generation using Gemini.
 * Converts audio to base64, sends to Gemini with SRT prompt,
 * parses response back to CaptionChunk[].
 */
import type { AIModel } from "@/types/ai";
import type { CaptionChunk } from "@/types/transcription";
import { geminiService } from "@/services/ai/gemini-service";
import { parseSRT, srtEntriesToCaptionChunks } from "@/lib/transcription/srt-parser";

const MAX_INLINE_AUDIO_BYTES = 100 * 1024 * 1024; // 100MB — Gemini supports large inline audio

function buildTranscriptionPrompt(
	sourceLanguage?: string,
	targetLanguage?: string,
): string {
	const translationLine = targetLanguage
		? `5. Translate all subtitles to ${targetLanguage}`
		: "";

	const languageLine = sourceLanguage
		? `4. Source language: ${sourceLanguage}`
		: "4. Auto-detect the spoken language";

	return `Transcribe this audio into SRT subtitle format. Rules:
1. Output ONLY valid SRT format, no extra text or markdown fences
2. Each subtitle: max 2 lines, max 42 characters per line
3. Minimum duration: 1 second per subtitle
${languageLine}
${translationLine}

SRT format example:
1
00:00:01,000 --> 00:00:04,000
Hello, welcome to the video.

2
00:00:04,500 --> 00:00:07,000
Today we will talk about editing.`.trim();
}

function buildTranslationPrompt(targetLanguage: string): string {
	return `Translate the following SRT subtitles to ${targetLanguage}. Rules:
1. Output ONLY valid SRT format, no extra text or markdown fences
2. Keep the exact same timestamps
3. Each subtitle: max 2 lines, max 42 characters per line
4. Translate naturally, not word-for-word`.trim();
}

async function blobToBase64(blob: Blob): Promise<string> {
	const buffer = await blob.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function extractSRTFromResponse(text: string): string {
	// Strip markdown code fences if Gemini wraps the output
	const fenceMatch = text.match(/```(?:srt)?\s*\n([\s\S]*?)```/);
	if (fenceMatch) return fenceMatch[1].trim();
	return text.trim();
}

export class AISubtitleGenerator {
	/**
	 * Generate subtitles from audio using Gemini.
	 * Sends audio as inline base64 data with an SRT-format prompt.
	 */
	async generateSubtitles({
		audioBlob,
		sourceLanguage,
		targetLanguage,
		apiKey,
		model,
	}: {
		audioBlob: Blob;
		sourceLanguage?: string;
		targetLanguage?: string;
		apiKey: string;
		model: AIModel;
	}): Promise<CaptionChunk[]> {
		if (audioBlob.size > MAX_INLINE_AUDIO_BYTES) {
			throw new Error(
				`Audio file too large (${Math.round(audioBlob.size / 1024 / 1024)}MB). Maximum is 25MB for inline processing.`,
			);
		}

		const base64Audio = await blobToBase64(audioBlob);
		const mimeType = audioBlob.type || "audio/wav";
		const prompt = buildTranscriptionPrompt(sourceLanguage, targetLanguage);

		const responseText = await geminiService.generateContent({
			apiKey,
			model,
			contents: [
				{
					inlineData: { mimeType, data: base64Audio },
				},
				{ text: prompt },
			],
		});

		if (!responseText.trim()) {
			throw new Error("Gemini returned an empty response. The audio may have no speech content.");
		}

		const srtText = extractSRTFromResponse(responseText);
		const entries = parseSRT(srtText);

		if (entries.length === 0) {
			/* Surface what Gemini actually returned so user can understand why */
			const preview = responseText.slice(0, 200);
			throw new Error(
				`No subtitles could be parsed. Gemini response: "${preview}${responseText.length > 200 ? "..." : ""}"`,
			);
		}

		return srtEntriesToCaptionChunks(entries);
	}

	/**
	 * Translate existing SRT subtitles to a target language using Gemini.
	 */
	async translateSubtitles({
		srtText,
		targetLanguage,
		apiKey,
		model,
	}: {
		srtText: string;
		targetLanguage: string;
		apiKey: string;
		model: AIModel;
	}): Promise<CaptionChunk[]> {
		const prompt = buildTranslationPrompt(targetLanguage);

		const responseText = await geminiService.generateContent({
			apiKey,
			model,
			contents: `${prompt}\n\n${srtText}`,
		});

		const cleaned = extractSRTFromResponse(responseText);
		const entries = parseSRT(cleaned);

		if (entries.length === 0) {
			throw new Error("Translation failed — no subtitles parsed from response.");
		}

		return srtEntriesToCaptionChunks(entries);
	}
}

export const aiSubtitleGenerator = new AISubtitleGenerator();

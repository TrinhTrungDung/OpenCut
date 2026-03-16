/**
 * Video analyzer service — extracts keyframes and sends to Gemini for analysis.
 */

import type { AIAnalysisResult, AIModel } from "@/types/ai";
import { geminiService } from "@/services/ai/gemini-service";
import {
	extractKeyframes,
	composeKeyframeGrid,
} from "@/lib/media/keyframe-extractor";

interface AnalyzeVideoOptions {
	videoUrl: string;
	duration: number;
	fps?: number;
	apiKey: string;
	model: AIModel;
}

class VideoAnalyzer {
	async analyzeVideo({
		videoUrl,
		duration,
		fps = 30,
		apiKey,
		model,
	}: AnalyzeVideoOptions): Promise<AIAnalysisResult> {
		const count = Math.min(16, Math.max(4, Math.floor(duration)));
		const cols = count <= 4 ? 2 : 4;
		const rows = Math.ceil(count / cols);
		const interval = duration / count;

		const frames = await extractKeyframes({ videoUrl, count });
		const gridDataUrl = await composeKeyframeGrid({
			images: frames,
			cols,
		});

		// Strip data URL prefix for Gemini inline data
		const base64Data = gridDataUrl.replace(/^data:image\/jpeg;base64,/, "");

		const prompt = [
			`Analyze this video represented as a grid of keyframes (left-to-right, top-to-bottom, chronological order).`,
			`The video is ${duration.toFixed(1)}s at ${fps}fps.`,
			`Grid layout: ${cols}x${rows}, each frame represents ~${interval.toFixed(1)}s of video.`,
			"",
			"Provide analysis in this JSON format:",
			JSON.stringify(
				{
					scenes: [
						{
							startTime: 0,
							endTime: 5.2,
							description: "...",
							tags: ["outdoor", "nature"],
						},
					],
					summary: "Brief 1-2 sentence summary",
					suggestedTags: ["tag1", "tag2"],
					suggestedTitle: "Optional suggested title",
				},
				null,
				2,
			),
			"",
			"Output ONLY valid JSON.",
		].join("\n");

		const responseText = await geminiService.generateContent({
			apiKey,
			model,
			contents: [
				{
					inlineData: {
						mimeType: "image/jpeg",
						data: base64Data,
					},
				},
				{ text: prompt },
			],
		});

		return parseAnalysisResponse(responseText);
	}
}

/** Parse Gemini response text into AIAnalysisResult, stripping markdown fences if present */
function parseAnalysisResponse(text: string): AIAnalysisResult {
	let cleaned = text.trim();

	// Strip markdown code fences
	if (cleaned.startsWith("```")) {
		cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		throw new Error(`Failed to parse AI analysis response as JSON: ${cleaned.slice(0, 200)}`);
	}

	if (
		!parsed ||
		typeof parsed !== "object" ||
		!("scenes" in parsed) ||
		!Array.isArray((parsed as { scenes: unknown }).scenes)
	) {
		throw new Error("Invalid analysis response: missing scenes array");
	}

	const result = parsed as AIAnalysisResult;

	// Basic validation
	for (const scene of result.scenes) {
		if (typeof scene.startTime !== "number" || typeof scene.endTime !== "number") {
			throw new Error("Invalid scene: startTime and endTime must be numbers");
		}
		if (!scene.description || typeof scene.description !== "string") {
			throw new Error("Invalid scene: description must be a string");
		}
		scene.tags = Array.isArray(scene.tags) ? scene.tags : [];
	}

	result.suggestedTags = Array.isArray(result.suggestedTags)
		? result.suggestedTags
		: [];
	result.summary = typeof result.summary === "string" ? result.summary : "";

	return result;
}

export const videoAnalyzer = new VideoAnalyzer();

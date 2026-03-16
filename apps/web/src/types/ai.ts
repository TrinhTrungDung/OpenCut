/** AI integration types for Gemini-powered features */

export type AIModel = "gemini-2.5-flash" | "gemini-2.5-pro";

export type AIMessageRole = "user" | "assistant";

export type AIChatStatus = "idle" | "streaming" | "error";

export type AIAnalysisStatus = "idle" | "analyzing" | "complete" | "error";

export interface AIMessage {
	id: string;
	role: AIMessageRole;
	content: string;
	timestamp: number;
}

export interface AISceneSegment {
	startTime: number;
	endTime: number;
	description: string;
	tags: string[];
}

export interface AIAnalysisResult {
	scenes: AISceneSegment[];
	summary: string;
	suggestedTags: string[];
	suggestedTitle?: string;
}

export interface AISubtitleSegment {
	startTime: number;
	endTime: number;
	text: string;
}

/** Lightweight editor state snapshot sent as context to Gemini */
export interface EditorContext {
	projectName: string;
	canvasSize: { width: number; height: number };
	fps: number;
	totalDuration: number;
	trackCount: number;
	elementSummary: { type: string; count: number }[];
	mediaAssets: { name: string; type: string; duration?: number }[];
}

/**
 * Gemini AI service singleton — wraps @google/genai SDK.
 * Mirrors TranscriptionService singleton pattern.
 */
import { GoogleGenAI, type Chat } from "@google/genai";
import type { AIModel } from "@/types/ai";

class GeminiService {
	private client: GoogleGenAI | null = null;
	private currentApiKey: string | null = null;

	/** Initialize or re-initialize the client when API key changes */
	private ensureClient(apiKey: string): GoogleGenAI {
		if (this.client && this.currentApiKey === apiKey) {
			return this.client;
		}
		this.client = new GoogleGenAI({ apiKey });
		this.currentApiKey = apiKey;
		return this.client;
	}

	/** Validate API key by making a lightweight test call */
	async validateApiKey(apiKey: string): Promise<boolean> {
		try {
			const client = new GoogleGenAI({ apiKey });
			const response = await client.models.generateContent({
				model: "gemini-2.5-flash",
				contents: "Reply with 'ok'",
			});
			return !!response.text;
		} catch {
			return false;
		}
	}

	/** Create a multi-turn chat session */
	createChat({
		apiKey,
		model,
		systemPrompt,
	}: {
		apiKey: string;
		model: AIModel;
		systemPrompt: string;
	}): Chat {
		const client = this.ensureClient(apiKey);
		return client.chats.create({
			model,
			config: { systemInstruction: systemPrompt },
		});
	}

	/** Send a message to a chat session and yield streaming text chunks */
	async *sendChatMessage(
		chat: Chat,
		message: string,
	): AsyncGenerator<string, void, unknown> {
		const stream = await chat.sendMessageStream({ message });
		for await (const chunk of stream) {
			if (chunk.text) {
				yield chunk.text;
			}
		}
	}

	/** One-shot content generation (for subtitles, analysis, etc.) */
	async generateContent({
		apiKey,
		model,
		contents,
	}: {
		apiKey: string;
		model: AIModel;
		contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"];
	}): Promise<string> {
		const client = this.ensureClient(apiKey);
		const response = await client.models.generateContent({
			model,
			contents,
		});
		return response.text ?? "";
	}

	/** Clear cached client */
	destroy() {
		this.client = null;
		this.currentApiKey = null;
	}
}

export const geminiService = new GeminiService();

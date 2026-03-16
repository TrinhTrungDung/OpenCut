"use client";

import {
	useRef,
	useEffect,
	useState,
	useCallback,
	type KeyboardEvent,
} from "react";
import type { Chat } from "@google/genai";
import { nanoid } from "nanoid";
import { useAIStore } from "@/stores/ai-store";
import { geminiService } from "@/services/ai/gemini-service";
import {
	getEditorContext,
	formatContextForPrompt,
} from "@/services/ai/editor-context";
import { AIChatMessage } from "./ai-chat-message";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const SUGGESTIONS = [
	"Summarize my project",
	"Suggest improvements",
	"Help me with transitions",
	"How do I export?",
];

const SYSTEM_PROMPT_BASE = `You are an AI assistant for OpenCut video editor. You help users with video editing tasks.

Current project context:
{context}

Respond concisely. Use markdown formatting. When suggesting editing actions, be specific about timeline positions and element names.`;

function buildSystemPrompt(): string {
	try {
		const ctx = getEditorContext();
		return SYSTEM_PROMPT_BASE.replace("{context}", formatContextForPrompt(ctx));
	} catch {
		return SYSTEM_PROMPT_BASE.replace("{context}", "No project loaded.");
	}
}

export function AIChatView() {
	const {
		messages,
		chatStatus,
		apiKey,
		model,
		addMessage,
		updateLastAssistantMessage,
		setChatStatus,
		clearMessages,
	} = useAIStore();

	const [inputValue, setInputValue] = useState("");
	const chatRef = useRef<Chat | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Auto-scroll on new messages or streaming updates
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Auto-resize textarea
	useEffect(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.style.height = "auto";
		ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
	}, [inputValue]);

	const sendMessage = useCallback(
		async (text: string) => {
			const trimmed = text.trim();
			if (!trimmed || chatStatus === "streaming") return;

			if (!apiKey) {
				setChatStatus("error");
				addMessage({
					id: nanoid(),
					role: "assistant",
					content:
						"Please set your Gemini API key in the **Settings** tab before using AI chat.",
					timestamp: Date.now(),
				});
				return;
			}

			// Add user message
			addMessage({
				id: nanoid(),
				role: "user",
				content: trimmed,
				timestamp: Date.now(),
			});
			setInputValue("");

			// Create chat session if needed
			if (!chatRef.current) {
				chatRef.current = geminiService.createChat({
					apiKey,
					model,
					systemPrompt: buildSystemPrompt(),
				});
			}

			// Add placeholder assistant message
			const assistantId = nanoid();
			addMessage({
				id: assistantId,
				role: "assistant",
				content: "",
				timestamp: Date.now(),
			});
			setChatStatus("streaming");

			try {
				let accumulated = "";
				for await (const chunk of geminiService.sendChatMessage(
					chatRef.current,
					trimmed,
				)) {
					accumulated += chunk;
					updateLastAssistantMessage(accumulated);
				}
				setChatStatus("idle");
			} catch (err) {
				const errorMsg =
					err instanceof Error ? err.message : "An unexpected error occurred";
				updateLastAssistantMessage(`**Error:** ${errorMsg}`);
				setChatStatus("error");
				// Reset chat session on error so it can be recreated
				chatRef.current = null;
			}
		},
		[
			apiKey,
			model,
			chatStatus,
			addMessage,
			updateLastAssistantMessage,
			setChatStatus,
		],
	);

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage(inputValue);
		}
	};

	const handleClear = () => {
		clearMessages();
		chatRef.current = null;
	};

	const isStreaming = chatStatus === "streaming";
	const hasMessages = messages.length > 0;

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="bg-background flex h-11 shrink-0 items-center justify-between border-b px-4 pr-2">
				<span className="text-muted-foreground text-sm">AI Assistant</span>
				{hasMessages && (
					<Button
						variant="ghost"
						size="sm"
						onClick={handleClear}
						disabled={isStreaming}
						className="text-muted-foreground text-xs"
					>
						Clear
					</Button>
				)}
			</div>

			{/* Messages area */}
			<div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
				{!hasMessages ? (
					<div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
						<div className="text-muted-foreground space-y-1">
							<p className="text-sm font-medium">AI Assistant</p>
							<p className="text-xs">
								Ask questions about your project or get help with video editing.
							</p>
						</div>
						<div className="flex flex-wrap justify-center gap-2">
							{SUGGESTIONS.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => sendMessage(s)}
									className="bg-muted hover:bg-muted/80 text-foreground rounded-full px-3 py-1.5 text-xs transition-colors"
								>
									{s}
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{messages.map((msg) => (
							<AIChatMessage key={msg.id} message={msg} />
						))}
						{isStreaming && messages[messages.length - 1]?.content === "" && (
							<div className="flex justify-start">
								<Spinner className="h-4 w-4" />
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			{/* Input area */}
			<div className="border-t px-3 py-2">
				<div className="bg-muted flex items-end gap-2 rounded-lg px-3 py-2">
					<textarea
						ref={textareaRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask anything..."
						disabled={isStreaming}
						rows={1}
						className="placeholder:text-muted-foreground max-h-[120px] min-h-[20px] flex-1 resize-none bg-transparent text-sm outline-none"
					/>
					<Button
						size="sm"
						onClick={() => sendMessage(inputValue)}
						disabled={!inputValue.trim() || isStreaming}
						className="h-7 shrink-0 px-3 text-xs"
					>
						{isStreaming ? <Spinner className="h-3 w-3" /> : "Send"}
					</Button>
				</div>
			</div>
		</div>
	);
}

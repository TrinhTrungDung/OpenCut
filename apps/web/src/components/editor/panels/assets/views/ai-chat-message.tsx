"use client";

import type { AIMessage } from "@/types/ai";
import ReactMarkdown from "react-markdown";
import { cn } from "@/utils/ui";

function relativeTime(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

export function AIChatMessage({ message }: { message: AIMessage }) {
	const isUser = message.role === "user";

	return (
		<div
			className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
		>
			<div
				className={cn(
					"max-w-[85%] rounded-lg px-3 py-2 text-sm",
					isUser
						? "bg-primary text-primary-foreground"
						: "bg-muted text-foreground",
				)}
			>
				{isUser ? (
					<p className="whitespace-pre-wrap">{message.content}</p>
				) : (
					<div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-pre:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 max-w-none break-words">
						<ReactMarkdown>{message.content}</ReactMarkdown>
					</div>
				)}
				<span
					className={cn(
						"mt-1 block text-[10px] opacity-50",
						isUser ? "text-right" : "text-left",
					)}
				>
					{relativeTime(message.timestamp)}
				</span>
			</div>
		</div>
	);
}

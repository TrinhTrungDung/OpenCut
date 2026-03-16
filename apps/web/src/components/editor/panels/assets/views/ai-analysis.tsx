"use client";

import { useCallback, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useEditor } from "@/hooks/use-editor";
import { useAIStore } from "@/stores/ai-store";
import { videoAnalyzer } from "@/services/ai/video-analyzer";
import type { AIAnalysisResult, AISceneSegment } from "@/types/ai";

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AIAnalysisView() {
	const editor = useEditor();
	const {
		apiKey,
		model,
		analysisResult,
		analysisStatus,
		setAnalysisResult,
		setAnalysisStatus,
	} = useAIStore();
	const [error, setError] = useState<string | null>(null);

	const handleAnalyze = useCallback(async () => {
		if (!apiKey) {
			setError("Please set your Gemini API key in AI settings first.");
			return;
		}

		// Find first video asset
		const assets = editor.media.getAssets();
		const videoAsset = assets.find((a) => a.type === "video");
		if (!videoAsset) {
			setError("No video asset found. Import a video to analyze.");
			return;
		}

		setError(null);
		setAnalysisStatus("analyzing");
		setAnalysisResult(null);

		try {
			const result = await videoAnalyzer.analyzeVideo({
				videoUrl: videoAsset.url,
				duration: videoAsset.duration ?? 10,
				apiKey,
				model,
			});
			setAnalysisResult(result);
			setAnalysisStatus("complete");
		} catch (err) {
			console.error("Video analysis failed:", err);
			setError(
				err instanceof Error ? err.message : "Analysis failed unexpectedly",
			);
			setAnalysisStatus("error");
		}
	}, [apiKey, model, editor, setAnalysisResult, setAnalysisStatus]);

	const handleSeek = useCallback(
		(time: number) => {
			editor.playback.seek(time);
		},
		[editor],
	);

	return (
		<PanelView title="AI Analysis">
			<div className="flex flex-col gap-4 pb-4">
				{analysisStatus === "idle" && !analysisResult && (
					<IdleState
						error={error}
						onAnalyze={handleAnalyze}
					/>
				)}

				{analysisStatus === "analyzing" && <AnalyzingState />}

				{analysisStatus === "error" && (
					<ErrorState error={error} onRetry={handleAnalyze} />
				)}

				{(analysisStatus === "complete" || analysisResult) &&
					analysisResult && (
						<ResultsState
							result={analysisResult}
							onSeek={handleSeek}
							onReanalyze={handleAnalyze}
						/>
					)}
			</div>
		</PanelView>
	);
}

function IdleState({
	error,
	onAnalyze,
}: {
	error: string | null;
	onAnalyze: () => void;
}) {
	return (
		<>
			<p className="text-muted-foreground text-sm">
				Analyze your video with AI to get scene descriptions, content tags, and
				a summary.
			</p>
			{error && (
				<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
					<p className="text-destructive text-sm">{error}</p>
				</div>
			)}
			<Button className="w-full" onClick={onAnalyze}>
				Analyze Video
			</Button>
		</>
	);
}

function AnalyzingState() {
	return (
		<div className="flex flex-col items-center gap-3 py-8">
			<Spinner />
			<p className="text-muted-foreground text-sm">
				Extracting keyframes and analyzing...
			</p>
		</div>
	);
}

function ErrorState({
	error,
	onRetry,
}: {
	error: string | null;
	onRetry: () => void;
}) {
	return (
		<>
			<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
				<p className="text-destructive text-sm">
					{error ?? "Analysis failed. Please try again."}
				</p>
			</div>
			<Button className="w-full" onClick={onRetry}>
				Retry Analysis
			</Button>
		</>
	);
}

function ResultsState({
	result,
	onSeek,
	onReanalyze,
}: {
	result: AIAnalysisResult;
	onSeek: (time: number) => void;
	onReanalyze: () => void;
}) {
	return (
		<>
			{/* Summary */}
			<div className="bg-muted/50 rounded-md p-3">
				<p className="text-sm font-medium mb-1">Summary</p>
				<p className="text-muted-foreground text-sm">{result.summary}</p>
				{result.suggestedTitle && (
					<p className="text-muted-foreground mt-1 text-xs">
						Suggested title: <span className="font-medium">{result.suggestedTitle}</span>
					</p>
				)}
			</div>

			{/* Scenes */}
			{result.scenes.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Scenes</p>
					{result.scenes.map((scene, idx) => (
						<SceneItem
							key={`${scene.startTime}-${idx}`}
							scene={scene}
							onSeek={onSeek}
						/>
					))}
				</div>
			)}

			{/* Tags */}
			{result.suggestedTags.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Suggested Tags</p>
					<div className="flex flex-wrap gap-1.5">
						{result.suggestedTags.map((tag) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
					</div>
				</div>
			)}

			<Button variant="outline" className="w-full" onClick={onReanalyze}>
				Re-analyze
			</Button>
		</>
	);
}

function SceneItem({
	scene,
	onSeek,
}: {
	scene: AISceneSegment;
	onSeek: (time: number) => void;
}) {
	return (
		<div className="bg-muted/30 rounded-md p-2.5">
			<button
				type="button"
				className="text-primary text-xs font-mono hover:underline cursor-pointer"
				onClick={() => onSeek(scene.startTime)}
			>
				{formatTime(scene.startTime)} - {formatTime(scene.endTime)}
			</button>
			<p className="text-muted-foreground mt-1 text-sm">
				{scene.description}
			</p>
			{scene.tags.length > 0 && (
				<div className="mt-1.5 flex flex-wrap gap-1">
					{scene.tags.map((tag) => (
						<Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
							{tag}
						</Badge>
					))}
				</div>
			)}
		</div>
	);
}

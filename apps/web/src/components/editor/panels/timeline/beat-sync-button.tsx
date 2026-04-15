"use client";

import { useState, useCallback } from "react";
import { useManagers } from "@/hooks/editor";
import { useBeatSync } from "@/hooks/use-beat-sync";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { MusicNote03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

export function BeatSyncButton() {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							variant="text"
							size="icon"
							className="rounded-sm"
						>
							<HugeiconsIcon icon={MusicNote03Icon} />
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>Beat sync</TooltipContent>
			</Tooltip>
			<PopoverContent
				className="flex w-72 flex-col gap-3 p-3"
				align="start"
				side="bottom"
				sideOffset={8}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<BeatSyncPopoverContent onClose={() => setOpen(false)} />
			</PopoverContent>
		</Popover>
	);
}

function BeatSyncPopoverContent({ onClose }: { onClose: () => void }) {
	const { scenes, media } = useManagers("scenes", "media");
	const { status, result, error, analyze, applyBeats, clearBeats, reset } =
		useBeatSync();
	const [sensitivity, setSensitivity] = useState(0.5);

	const findAudioBlob = useCallback((): File | null => {
		const activeScene = scenes.getActiveScene();
		if (!activeScene) return null;

		const mediaAssets = media.getAssets();

		// Search tracks for first audio or video element with a mediaId
		for (const track of activeScene.tracks) {
			for (const element of track.elements) {
				if (
					(element.type === "audio" || element.type === "video") &&
					"mediaId" in element
				) {
					const asset = mediaAssets.find(
						(a) => a.id === element.mediaId,
					);
					if (asset?.file) return asset.file;
				}
			}
		}

		return null;
	}, [scenes, media]);

	const handleAnalyze = useCallback(async () => {
		const audioFile = findAudioBlob();
		if (!audioFile) return;
		await analyze(audioFile, { sensitivity });
	}, [findAudioBlob, analyze, sensitivity]);

	const handleClear = useCallback(() => {
		clearBeats();
		reset();
		onClose();
	}, [clearBeats, reset, onClose]);

	const hasAudio = findAudioBlob() !== null;

	return (
		<>
			<div className="text-sm font-medium">Beat Sync</div>

			{!hasAudio && (
				<p className="text-muted-foreground text-xs">
					Add an audio or video track to use beat sync.
				</p>
			)}

			{hasAudio && status === "idle" && (
				<>
					<div className="flex flex-col gap-2">
						<Label className="text-xs">
							Sensitivity: {sensitivity.toFixed(2)}
						</Label>
						<Slider
							value={[sensitivity]}
							onValueChange={(v) => setSensitivity(v[0])}
							min={0}
							max={1}
							step={0.05}
						/>
					</div>
					<Button size="sm" onClick={handleAnalyze}>
						Analyze Audio
					</Button>
				</>
			)}

			{status === "analyzing" && (
				<div className="flex items-center gap-2 py-2">
					<div
						className={cn(
							"border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent",
						)}
					/>
					<span className="text-muted-foreground text-xs">
						Analyzing beats...
					</span>
				</div>
			)}

			{status === "error" && (
				<>
					<p className="text-destructive text-xs">
						{error || "Analysis failed"}
					</p>
					<Button size="sm" variant="outline" onClick={reset}>
						Try Again
					</Button>
				</>
			)}

			{status === "ready" && result && (
				<>
					<div className="flex flex-col gap-1 text-xs">
						<span>
							BPM: <strong>{result.bpm}</strong>
						</span>
						<span>
							Beats: <strong>{result.beats.length}</strong>
						</span>
						<span>
							Confidence:{" "}
							<strong>
								{(result.confidence * 100).toFixed(0)}%
							</strong>
						</span>
					</div>

					<div className="flex flex-col gap-2">
						<Label className="text-xs">
							Sensitivity: {sensitivity.toFixed(2)}
						</Label>
						<Slider
							value={[sensitivity]}
							onValueChange={(v) => setSensitivity(v[0])}
							min={0}
							max={1}
							step={0.05}
						/>
					</div>

					<div className="flex gap-2">
						<Button
							size="sm"
							className="flex-1"
							onClick={applyBeats}
						>
							Apply Beat Markers
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={handleAnalyze}
						>
							Re-analyze
						</Button>
					</div>
					<Button
						size="sm"
						variant="outline"
						className="text-destructive hover:bg-destructive/10"
						onClick={handleClear}
					>
						Clear Beats
					</Button>
				</>
			)}
		</>
	);
}

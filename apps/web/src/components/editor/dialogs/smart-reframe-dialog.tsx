"use client";

import { useState, useMemo } from "react";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSmartReframe } from "@/hooks/use-smart-reframe";
import { useManagers } from "@/hooks/editor";
import { REFRAME_PRESETS, type ReframePreset } from "@/types/smart-reframe";
import { cn } from "@/utils/ui";

/**
 * Dialog for smart reframe: select a target aspect ratio preset,
 * analyze the selected video clip for face positions, and apply
 * the computed crop by resizing the project canvas.
 */
export function SmartReframeDialog() {
	const { timeline, media, selection } = useManagers("timeline", "media", "selection");
	const { status, progress, result, error, isOpen, analyze, apply, close } =
		useSmartReframe();
	const [selectedPreset, setSelectedPreset] = useState<ReframePreset>(
		REFRAME_PRESETS[0],
	);

	const selectedVideoFile = useMemo(() => {
		if (!isOpen) return null;

		const selectedElements = selection.getSelectedElements();
		if (selectedElements.length === 0) return null;

		const elementsWithTracks = timeline.getElementsWithTracks({
			elements: selectedElements,
		});

		const videoElement = elementsWithTracks.find(
			({ element }) => element.type === "video",
		);

		if (!videoElement) return null;

		const mediaId = (videoElement.element as { mediaId: string }).mediaId;
		const asset = media
			.getAssets()
			.find((a) => a.id === mediaId);

		return asset?.file ?? null;
	}, [selection, timeline, media, isOpen]);

	const handleAnalyze = async () => {
		if (!selectedVideoFile) return;
		await analyze(selectedVideoFile, selectedPreset);
	};

	const isAnalyzing = status === "analyzing";
	const isReady = status === "ready";
	const isApplying = status === "applying";
	const canAnalyze = selectedVideoFile !== null && !isAnalyzing && !isApplying;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
			<DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle>Smart Reframe</DialogTitle>
					<DialogDescription>
						Auto-crop your video for different aspect ratios using face
						detection.
					</DialogDescription>
				</DialogHeader>

				<DialogBody className="flex flex-col gap-4">
					{/* Preset selection */}
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium">Target Format</span>
						<div className="grid grid-cols-2 gap-2">
							{REFRAME_PRESETS.map((preset) => (
								<Button
									key={preset.label}
									variant={
										selectedPreset.label === preset.label
											? "default"
											: "outline"
									}
									size="sm"
									className={cn(
										"justify-start text-xs",
										selectedPreset.label === preset.label &&
											"ring-2 ring-primary",
									)}
									onClick={() => setSelectedPreset(preset)}
									disabled={isAnalyzing || isApplying}
								>
									<span className="font-mono mr-2">
										{preset.width}x{preset.height}
									</span>
									{preset.label.split(" ")[0]}
								</Button>
							))}
						</div>
					</div>

					{/* No video selected warning */}
					{!selectedVideoFile && (
						<p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
							Select a video clip on the timeline first.
						</p>
					)}

					{/* Progress bar */}
					{isAnalyzing && (
						<div className="flex flex-col gap-1.5">
							<span className="text-sm text-muted-foreground">
								Analyzing frames...
							</span>
							<Progress value={progress * 100} />
						</div>
					)}

					{/* Result preview */}
					{isReady && result && (
						<div className="flex flex-col gap-1 text-sm bg-muted rounded-md p-3">
							<span className="font-medium">Analysis Complete</span>
							<span className="text-muted-foreground">
								Crop region: {Math.round(result.cropX * 100)}%,{" "}
								{Math.round(result.cropY * 100)}% at{" "}
								{Math.round(result.cropWidth * 100)}% x{" "}
								{Math.round(result.cropHeight * 100)}%
							</span>
							<span className="text-muted-foreground">
								Output: {result.outputWidth}x{result.outputHeight}
							</span>
						</div>
					)}

					{/* Error */}
					{error && (
						<p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
							{error}
						</p>
					)}
				</DialogBody>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={close}
						disabled={isAnalyzing || isApplying}
					>
						Cancel
					</Button>

					{isReady && result ? (
						<Button onClick={apply} disabled={isApplying}>
							{isApplying ? "Applying..." : "Apply Reframe"}
						</Button>
					) : (
						<Button
							onClick={handleAnalyze}
							disabled={!canAnalyze}
						>
							{isAnalyzing ? "Analyzing..." : "Analyze & Reframe"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaPreviewStore } from "@/stores/media-preview-store";
import { formatDuration } from "@/components/editor/panels/assets/views/assets";

export function MediaTrimHandles({
	duration,
	assetId,
}: {
	duration: number;
	assetId: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { previewAsset, trimStart, trimEnd, setTrimRange, setPreviewAsset } =
		useMediaPreviewStore();
	const [dragging, setDragging] = useState<"start" | "end" | null>(null);
	const [isHovered, setIsHovered] = useState(false);

	/* Local trim state that persists even when this asset isn't being previewed */
	const [localStart, setLocalStart] = useState(0);
	const [localEnd, setLocalEnd] = useState(duration);

	const isActive = previewAsset?.id === assetId;

	/* Sync from store when this asset is active */
	useEffect(() => {
		if (isActive) {
			setLocalStart(trimStart);
			setLocalEnd(trimEnd);
		}
	}, [isActive, trimStart, trimEnd]);

	/* Use refs for drag handler to avoid stale closures */
	const stateRef = useRef({ localStart, localEnd, dragging });
	stateRef.current = { localStart, localEnd, dragging };

	const startPct = (localStart / duration) * 100;
	const endPct = (localEnd / duration) * 100;

	const handleMouseDown = useCallback(
		(e: React.MouseEvent, handle: "start" | "end") => {
			e.preventDefault();
			e.stopPropagation();
			setDragging(handle);
		},
		[],
	);

	useEffect(() => {
		if (!dragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			const container = containerRef.current;
			if (!container) return;

			const rect = container.getBoundingClientRect();
			const ratio = Math.max(
				0,
				Math.min(1, (e.clientX - rect.left) / rect.width),
			);
			const time = ratio * duration;
			const { localStart: curStart, localEnd: curEnd } = stateRef.current;

			if (dragging === "start") {
				const newStart = Math.max(0, Math.min(time, curEnd - 0.1));
				setLocalStart(newStart);
				if (isActive) {
					setTrimRange({ start: newStart, end: curEnd });
				}
			} else {
				const newEnd = Math.min(duration, Math.max(time, curStart + 0.1));
				setLocalEnd(newEnd);
				if (isActive) {
					setTrimRange({ start: curStart, end: newEnd });
				}
			}
		};

		const handleMouseUp = () => {
			setDragging(null);
			/* If asset isn't previewed yet, sync trim to store */
			if (!isActive) {
				const { localStart: s, localEnd: e } = stateRef.current;
				setTrimRange({ start: s, end: e });
			}
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [dragging, duration, isActive, setTrimRange]);

	const showHandles = isHovered || dragging !== null || isActive;
	const hasTrim = localStart > 0.01 || localEnd < duration - 0.01;

	if (!showHandles && !hasTrim) {
		return (
			<div
				ref={containerRef}
				className="absolute inset-0 z-10"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			/>
		);
	}

	return (
		<div
			ref={containerRef}
			className="absolute inset-0 z-10"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => {
				if (!dragging) setIsHovered(false);
			}}
		>
			{/* Dimmed regions outside trim */}
			{startPct > 0 && (
				<div
					className="absolute top-0 left-0 h-full bg-black/50"
					style={{ width: `${startPct}%` }}
				/>
			)}
			{endPct < 100 && (
				<div
					className="absolute top-0 right-0 h-full bg-black/50"
					style={{ width: `${100 - endPct}%` }}
				/>
			)}

			{/* Start handle */}
			<div
				className="bg-primary/80 hover:bg-primary absolute top-0 h-full w-1.5 cursor-col-resize transition-colors"
				style={{ left: `${startPct}%` }}
				onMouseDown={(e) => handleMouseDown(e, "start")}
			>
				{dragging === "start" && (
					<span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-black/80 px-1 text-[10px] text-white">
						{formatDuration({ duration: localStart })}
					</span>
				)}
			</div>

			{/* End handle */}
			<div
				className="bg-primary/80 hover:bg-primary absolute top-0 h-full w-1.5 cursor-col-resize transition-colors"
				style={{ left: `${endPct}%`, transform: "translateX(-100%)" }}
				onMouseDown={(e) => handleMouseDown(e, "end")}
			>
				{dragging === "end" && (
					<span className="absolute -top-5 right-0 whitespace-nowrap rounded bg-black/80 px-1 text-[10px] text-white">
						{formatDuration({ duration: localEnd })}
					</span>
				)}
			</div>
		</div>
	);
}

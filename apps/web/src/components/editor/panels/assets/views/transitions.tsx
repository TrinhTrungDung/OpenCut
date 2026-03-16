"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Input } from "@/components/ui/input";
import { getAllTransitions } from "@/lib/transitions";
import type { TransitionDefinition, TransitionType } from "@/types/transitions";
import { cn } from "@/utils/ui";

const TRANSITION_TYPE_LABELS: Record<string, string> = {
	fade: "Opacity",
	dissolve: "Noise",
	"wipe-left": "Wipe",
	"wipe-right": "Wipe",
	"wipe-up": "Wipe",
	"wipe-down": "Wipe",
	"zoom-in": "Zoom",
	"zoom-out": "Zoom",
	"slide-left": "Slide",
	"slide-right": "Slide",
	blur: "Blur",
};

export function TransitionsView() {
	const [searchQuery, setSearchQuery] = useState("");
	const allTransitions = getAllTransitions();

	const filteredTransitions = useMemo(() => {
		if (!searchQuery.trim()) return allTransitions;
		const query = searchQuery.toLowerCase();
		return allTransitions.filter(
			(t) =>
				t.name.toLowerCase().includes(query) ||
				t.keywords.some((k) => k.toLowerCase().includes(query)),
		);
	}, [allTransitions, searchQuery]);

	return (
		<PanelView
			title="Transitions"
			actions={
				<Input
					placeholder="Search..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="h-7 w-32 text-xs"
				/>
			}
		>
			{filteredTransitions.length === 0 ? (
				<div className="flex h-32 items-center justify-center">
					<p className="text-muted-foreground text-sm">
						{searchQuery ? "No transitions found" : "No transitions available"}
					</p>
				</div>
			) : (
				<TransitionsGrid transitions={filteredTransitions} />
			)}
		</PanelView>
	);
}

function TransitionsGrid({
	transitions,
}: { transitions: TransitionDefinition[] }) {
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
		>
			{transitions.map((t) => (
				<TransitionCard key={t.type} transition={t} />
			))}
		</div>
	);
}

function TransitionPreviewCanvas({
	transition,
	isHovered,
}: { transition: TransitionDefinition; isHovered: boolean }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const frameRef = useRef<number>(0);

	useEffect(() => {
		if (!isHovered) {
			// Draw static preview at progress=0.5
			drawTransitionFrame({
				canvas: canvasRef.current,
				transitionType: transition.type,
				progress: 0.5,
			});
			return;
		}

		const start = performance.now();
		const duration = 2000;

		const animate = () => {
			const elapsed = performance.now() - start;
			const progress = (elapsed % duration) / duration;
			drawTransitionFrame({
				canvas: canvasRef.current,
				transitionType: transition.type,
				progress,
			});
			frameRef.current = requestAnimationFrame(animate);
		};

		frameRef.current = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(frameRef.current);
	}, [isHovered, transition.type]);

	return (
		<canvas
			ref={canvasRef}
			className="size-full"
			width={96}
			height={54}
		/>
	);
}

/** Draw a simplified transition preview frame to a canvas */
function drawTransitionFrame({
	canvas,
	transitionType,
	progress,
}: {
	canvas: HTMLCanvasElement | null;
	transitionType: TransitionType;
	progress: number;
}) {
	if (!canvas) return;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const { width, height } = canvas;
	const colorA = "#6366f1"; // indigo
	const colorB = "#ec4899"; // pink

	ctx.clearRect(0, 0, width, height);

	switch (transitionType) {
		case "fade":
		case "dissolve": {
			ctx.fillStyle = colorA;
			ctx.globalAlpha = 1 - progress;
			ctx.fillRect(0, 0, width, height);
			ctx.fillStyle = colorB;
			ctx.globalAlpha = progress;
			ctx.fillRect(0, 0, width, height);
			ctx.globalAlpha = 1;
			break;
		}
		case "wipe-left": {
			const boundary = width * (1 - progress);
			ctx.fillStyle = colorA;
			ctx.fillRect(0, 0, boundary, height);
			ctx.fillStyle = colorB;
			ctx.fillRect(boundary, 0, width - boundary, height);
			break;
		}
		case "wipe-right": {
			const boundary = width * progress;
			ctx.fillStyle = colorB;
			ctx.fillRect(0, 0, boundary, height);
			ctx.fillStyle = colorA;
			ctx.fillRect(boundary, 0, width - boundary, height);
			break;
		}
		case "wipe-up": {
			const boundary = height * (1 - progress);
			ctx.fillStyle = colorA;
			ctx.fillRect(0, 0, width, boundary);
			ctx.fillStyle = colorB;
			ctx.fillRect(0, boundary, width, height - boundary);
			break;
		}
		case "wipe-down": {
			const boundary = height * progress;
			ctx.fillStyle = colorB;
			ctx.fillRect(0, 0, width, boundary);
			ctx.fillStyle = colorA;
			ctx.fillRect(0, boundary, width, height - boundary);
			break;
		}
		case "slide-left": {
			const offset = width * progress;
			ctx.fillStyle = colorA;
			ctx.fillRect(-offset, 0, width, height);
			ctx.fillStyle = colorB;
			ctx.fillRect(width - offset, 0, width, height);
			break;
		}
		case "slide-right": {
			const offset = width * progress;
			ctx.fillStyle = colorA;
			ctx.fillRect(offset, 0, width, height);
			ctx.fillStyle = colorB;
			ctx.fillRect(offset - width, 0, width, height);
			break;
		}
		case "zoom-in": {
			ctx.fillStyle = colorB;
			ctx.fillRect(0, 0, width, height);
			const scale = 1 - progress;
			const cx = width / 2;
			const cy = height / 2;
			ctx.fillStyle = colorA;
			ctx.fillRect(
				cx - (cx * scale),
				cy - (cy * scale),
				width * scale,
				height * scale,
			);
			break;
		}
		case "zoom-out": {
			ctx.fillStyle = colorA;
			ctx.fillRect(0, 0, width, height);
			const s = progress;
			const cxo = width / 2;
			const cyo = height / 2;
			ctx.fillStyle = colorB;
			ctx.fillRect(
				cxo - (cxo * s),
				cyo - (cyo * s),
				width * s,
				height * s,
			);
			break;
		}
		case "blur": {
			ctx.fillStyle = colorA;
			ctx.globalAlpha = 1 - progress;
			ctx.fillRect(0, 0, width, height);
			ctx.fillStyle = colorB;
			ctx.globalAlpha = progress;
			ctx.fillRect(0, 0, width, height);
			ctx.globalAlpha = 1;
			// Simulated blur: draw semi-transparent overlay at midpoint
			if (progress > 0.2 && progress < 0.8) {
				ctx.fillStyle = "rgba(255,255,255,0.15)";
				ctx.fillRect(0, 0, width, height);
			}
			break;
		}
		default: {
			ctx.fillStyle = colorA;
			ctx.globalAlpha = 1 - progress;
			ctx.fillRect(0, 0, width, height);
			ctx.fillStyle = colorB;
			ctx.globalAlpha = progress;
			ctx.fillRect(0, 0, width, height);
			ctx.globalAlpha = 1;
		}
	}
}

function TransitionCard({
	transition,
}: { transition: TransitionDefinition }) {
	const [isHovered, setIsHovered] = useState(false);
	const categoryLabel =
		TRANSITION_TYPE_LABELS[transition.type] ?? "Other";

	return (
		<div
			className="group relative w-full"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="relative flex h-auto w-full cursor-default flex-col gap-1 p-1">
				<div
					className={cn(
						"bg-accent relative overflow-hidden rounded-sm",
						"aspect-video",
					)}
				>
					<TransitionPreviewCanvas
						transition={transition}
						isHovered={isHovered}
					/>
					{/* Duration badge */}
					<span className="absolute bottom-1 right-1 rounded-sm bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white leading-none">
						{transition.defaultDuration}s
					</span>
				</div>
				<div className="flex flex-col">
					<span
						className="text-muted-foreground w-full truncate text-left text-[0.7rem]"
						title={transition.name}
					>
						{transition.name}
					</span>
					<span className="text-muted-foreground/60 w-full truncate text-left text-[0.6rem]">
						{categoryLabel}
					</span>
				</div>
			</div>
		</div>
	);
}

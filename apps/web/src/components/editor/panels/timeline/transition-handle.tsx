"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/utils/ui";

interface TransitionHandleProps {
	side: "left" | "right";
	onDragStart?: () => void;
	onDrag: ({ deltaPx }: { deltaPx: number }) => void;
}

export function TransitionHandle({ side, onDragStart, onDrag }: TransitionHandleProps) {
	const dragStartXRef = useRef(0);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();
			dragStartXRef.current = e.clientX;
			onDragStart?.();
			const target = e.currentTarget;
			target.setPointerCapture(e.pointerId);

			const handleMove = (moveEvent: Event) => {
				const pe = moveEvent as PointerEvent;
				const totalDeltaPx = pe.clientX - dragStartXRef.current;
				onDrag({ deltaPx: totalDeltaPx });
			};

			const handleUp = () => {
				target.removeEventListener("pointermove", handleMove);
				target.removeEventListener("pointerup", handleUp);
			};

			target.addEventListener("pointermove", handleMove);
			target.addEventListener("pointerup", handleUp);
		},
		[onDrag, onDragStart],
	);

	return (
		<div
			className={cn(
				"absolute top-0 bottom-0 w-1.5 cursor-col-resize",
				"hover:bg-purple-400/60 active:bg-purple-400/80 transition-colors",
				side === "left" ? "left-0 rounded-l-sm" : "right-0 rounded-r-sm",
			)}
			onPointerDown={handlePointerDown}
		/>
	);
}

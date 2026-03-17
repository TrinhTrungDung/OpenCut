"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/utils/ui";

interface TransitionHandleProps {
	side: "left" | "right";
	onDrag: ({ deltaPx }: { deltaPx: number }) => void;
}

export function TransitionHandle({ side, onDrag }: TransitionHandleProps) {
	const startXRef = useRef(0);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();
			startXRef.current = e.clientX;
			const target = e.currentTarget;
			target.setPointerCapture(e.pointerId);

			const handleMove = (moveEvent: Event) => {
				const pe = moveEvent as PointerEvent;
				const deltaPx = pe.clientX - startXRef.current;
				if (deltaPx !== 0) {
					onDrag({ deltaPx });
					startXRef.current = pe.clientX;
				}
			};

			const handleUp = () => {
				target.removeEventListener("pointermove", handleMove);
				target.removeEventListener("pointerup", handleUp);
			};

			target.addEventListener("pointermove", handleMove);
			target.addEventListener("pointerup", handleUp);
		},
		[onDrag],
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

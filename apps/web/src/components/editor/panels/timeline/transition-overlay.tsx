"use client";

import { useCallback, useState } from "react";
import type { TransitionInstance, TransitionType } from "@/types/transitions";
import { TransitionHandle } from "./transition-handle";
import { cn } from "@/utils/ui";

const MIN_TRANSITION_DURATION = 0.1;
const MAX_TRANSITION_DURATION = 5;

const TRANSITION_ICONS: Record<TransitionType, string> = {
	fade: "\u25C7",
	dissolve: "\u25C6",
	"wipe-left": "\u25C0",
	"wipe-right": "\u25B6",
	"wipe-up": "\u25B2",
	"wipe-down": "\u25BC",
	"zoom-in": "\u2295",
	"zoom-out": "\u2296",
	"slide-left": "\u21E0",
	"slide-right": "\u21E2",
	blur: "\u25CE",
};

interface TransitionOverlayProps {
	transition: TransitionInstance;
	pixelsPerSecond: number;
	zoomLevel: number;
	offsetPx: number;
	trackHeight: number;
	isSelected?: boolean;
	onSelect?: () => void;
	onDurationChange?: ({
		newDuration,
	}: { newDuration: number }) => void;
	onRemove?: () => void;
	onChangeType?: ({
		newType,
	}: { newType: TransitionType }) => void;
}

export function TransitionOverlay({
	transition,
	pixelsPerSecond,
	zoomLevel,
	offsetPx,
	trackHeight,
	isSelected = false,
	onSelect,
	onDurationChange,
	onRemove,
	onChangeType,
}: TransitionOverlayProps) {
	const [showContextMenu, setShowContextMenu] = useState(false);
	const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

	const widthPx = transition.duration * pixelsPerSecond * zoomLevel;
	const icon = TRANSITION_ICONS[transition.type] ?? "\u25C7";

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onSelect?.();
		},
		[onSelect],
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setContextMenuPos({ x: e.clientX, y: e.clientY });
			setShowContextMenu(true);
		},
		[],
	);

	const handleDurationDrag = useCallback(
		({ deltaPx, side }: { deltaPx: number; side: "left" | "right" }) => {
			const deltaSeconds = deltaPx / (pixelsPerSecond * zoomLevel);
			const directionMultiplier = side === "right" ? 1 : -1;
			const newDuration = Math.min(
				MAX_TRANSITION_DURATION,
				Math.max(
					MIN_TRANSITION_DURATION,
					transition.duration + deltaSeconds * directionMultiplier,
				),
			);
			onDurationChange?.({ newDuration });
		},
		[pixelsPerSecond, zoomLevel, transition.duration, onDurationChange],
	);

	const handleDragLeft = useCallback(
		({ deltaPx }: { deltaPx: number }) => {
			handleDurationDrag({ deltaPx, side: "left" });
		},
		[handleDurationDrag],
	);

	const handleDragRight = useCallback(
		({ deltaPx }: { deltaPx: number }) => {
			handleDurationDrag({ deltaPx, side: "right" });
		},
		[handleDurationDrag],
	);

	const closeContextMenu = useCallback(() => {
		setShowContextMenu(false);
	}, []);

	return (
		<>
			<div
				className={cn(
					"absolute top-0 flex items-center justify-center",
					"rounded-sm cursor-pointer z-10",
					"bg-purple-500/20 border border-purple-500/40",
					"hover:bg-purple-500/30 transition-colors",
					isSelected && "ring-1 ring-purple-400 bg-purple-500/30",
				)}
				style={{
					width: `${widthPx}px`,
					height: `${trackHeight}px`,
					left: `${offsetPx}px`,
				}}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				title={`${transition.type} (${transition.duration.toFixed(1)}s)`}
			>
				{/* Transition icon */}
				<span className="text-purple-300 text-sm select-none pointer-events-none">
					{icon}
				</span>

				{/* Type label (shown if wide enough) */}
				{widthPx > 40 && (
					<span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-purple-300/70 font-medium truncate px-0.5 pointer-events-none">
						{transition.type}
					</span>
				)}

				{/* Duration handles */}
				<TransitionHandle side="left" onDrag={handleDragLeft} />
				<TransitionHandle side="right" onDrag={handleDragRight} />
			</div>

			{/* Context menu */}
			{showContextMenu && (
				<TransitionContextMenu
					position={contextMenuPos}
					currentType={transition.type}
					onChangeType={onChangeType}
					onRemove={onRemove}
					onClose={closeContextMenu}
				/>
			)}
		</>
	);
}

const ALL_TRANSITION_TYPES: TransitionType[] = [
	"fade",
	"dissolve",
	"wipe-left",
	"wipe-right",
	"wipe-up",
	"wipe-down",
	"zoom-in",
	"zoom-out",
	"slide-left",
	"slide-right",
	"blur",
];

function TransitionContextMenu({
	position,
	currentType,
	onChangeType,
	onRemove,
	onClose,
}: {
	position: { x: number; y: number };
	currentType: TransitionType;
	onChangeType?: ({
		newType,
	}: { newType: TransitionType }) => void;
	onRemove?: () => void;
	onClose: () => void;
}) {
	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			onClose();
		},
		[onClose],
	);

	const handleTypeSelect = useCallback(
		(type: TransitionType) => {
			onChangeType?.({ newType: type });
			onClose();
		},
		[onChangeType, onClose],
	);

	const handleRemove = useCallback(() => {
		onRemove?.();
		onClose();
	}, [onRemove, onClose]);

	return (
		<>
			{/* Backdrop to close menu */}
			<div
				className="fixed inset-0 z-50"
				onClick={handleBackdropClick}
				onContextMenu={handleBackdropClick}
			/>

			<div
				className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
				style={{ left: position.x, top: position.y }}
			>
				{/* Change type submenu */}
				<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
					Change Type
				</div>
				{ALL_TRANSITION_TYPES.map((type) => (
					<button
						key={type}
						type="button"
						className={cn(
							"flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer",
							"hover:bg-accent hover:text-accent-foreground",
							type === currentType && "bg-accent/50 font-medium",
						)}
						onClick={() => handleTypeSelect(type)}
					>
						<span className="text-xs">{TRANSITION_ICONS[type]}</span>
						<span className="capitalize">
							{type.replace(/-/g, " ")}
						</span>
						{type === currentType && (
							<span className="ml-auto text-xs text-muted-foreground">
								current
							</span>
						)}
					</button>
				))}

				{/* Separator */}
				<div className="my-1 h-px bg-border" />

				{/* Remove */}
				<button
					type="button"
					className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-destructive hover:bg-destructive/10"
					onClick={handleRemove}
				>
					Remove Transition
				</button>
			</div>
		</>
	);
}

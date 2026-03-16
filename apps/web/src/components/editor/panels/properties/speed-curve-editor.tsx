"use client";

import type { SpeedCurvePoint } from "@/types/speed";
import { useCallback, useRef, useState } from "react";

const CANVAS_HEIGHT = 120;
const PADDING = { top: 12, bottom: 12, left: 12, right: 12 };

const GRID_SPEEDS = [0.5, 1, 2, 4];
const MIN_LOG_SPEED = Math.log(0.1);
const MAX_LOG_SPEED = Math.log(10);

/** Map speed (log scale) to canvas Y */
function speedToY(speed: number, height: number): number {
	const logSpeed = Math.log(Math.max(speed, 0.1));
	const t = (logSpeed - MIN_LOG_SPEED) / (MAX_LOG_SPEED - MIN_LOG_SPEED);
	return PADDING.top + (1 - t) * (height - PADDING.top - PADDING.bottom);
}

/** Map canvas Y to speed (log scale) */
function yToSpeed(y: number, height: number): number {
	const t =
		1 - (y - PADDING.top) / (height - PADDING.top - PADDING.bottom);
	const logSpeed = MIN_LOG_SPEED + t * (MAX_LOG_SPEED - MIN_LOG_SPEED);
	return Math.exp(logSpeed);
}

/** Map position (0-1) to canvas X */
function positionToX(position: number, width: number): number {
	return PADDING.left + position * (width - PADDING.left - PADDING.right);
}

/** Map canvas X to position (0-1) */
function xToPosition(x: number, width: number): number {
	return (x - PADDING.left) / (width - PADDING.left - PADDING.right);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function SpeedCurveEditor({
	points,
	onChange,
}: {
	points: SpeedCurvePoint[];
	onChange: (points: SpeedCurvePoint[]) => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
	const [canvasWidth, setCanvasWidth] = useState(200);

	const getCanvasDimensions = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return { width: canvasWidth, height: CANVAS_HEIGHT };
		return { width: canvas.width, height: canvas.height };
	}, [canvasWidth]);

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const { width, height } = canvas;
		ctx.clearRect(0, 0, width, height);

		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
		ctx.fillRect(0, 0, width, height);

		// Grid lines
		ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
		ctx.lineWidth = 1;
		for (const gridSpeed of GRID_SPEEDS) {
			const y = speedToY(gridSpeed, height);
			ctx.beginPath();
			ctx.moveTo(PADDING.left, y);
			ctx.lineTo(width - PADDING.right, y);
			ctx.stroke();

			// Label
			ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
			ctx.font = "9px sans-serif";
			ctx.textAlign = "left";
			ctx.fillText(`${gridSpeed}x`, 1, y - 2);
		}

		// Curve
		if (points.length >= 2) {
			const sorted = [...points].sort((a, b) => a.position - b.position);
			ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(
				positionToX(sorted[0].position, width),
				speedToY(sorted[0].speed, height),
			);
			for (let i = 1; i < sorted.length; i++) {
				const prev = sorted[i - 1];
				const curr = sorted[i];
				const px = positionToX(prev.position, width);
				const py = speedToY(prev.speed, height);
				const cx = positionToX(curr.position, width);
				const cy = speedToY(curr.speed, height);

				if (prev.controlOut && curr.controlIn) {
					ctx.bezierCurveTo(
						px + prev.controlOut.x * (width - PADDING.left - PADDING.right),
						py - prev.controlOut.y * (height - PADDING.top - PADDING.bottom),
						cx + curr.controlIn.x * (width - PADDING.left - PADDING.right),
						cy - curr.controlIn.y * (height - PADDING.top - PADDING.bottom),
						cx,
						cy,
					);
				} else {
					ctx.lineTo(cx, cy);
				}
			}
			ctx.stroke();
		}

		// Points
		for (let i = 0; i < points.length; i++) {
			const point = points[i];
			const x = positionToX(point.position, width);
			const y = speedToY(point.speed, height);

			ctx.beginPath();
			ctx.arc(x, y, 5, 0, Math.PI * 2);
			ctx.fillStyle =
				draggingIndex === i
					? "rgba(59, 130, 246, 1)"
					: "rgba(59, 130, 246, 0.7)";
			ctx.fill();
			ctx.strokeStyle = "white";
			ctx.lineWidth = 1.5;
			ctx.stroke();
		}
	}, [points, draggingIndex]);

	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const canvasCallbackRef = useCallback(
		(node: HTMLCanvasElement | null) => {
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
				resizeObserverRef.current = null;
			}
			(canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
				node;
			if (!node) return;

			const observe = () => {
				const ro = new ResizeObserver((entries) => {
					for (const entry of entries) {
						const w = Math.round(entry.contentRect.width);
						if (w > 0) {
							node.width = w;
							node.height = CANVAS_HEIGHT;
							setCanvasWidth(w);
							draw();
						}
					}
				});
				ro.observe(node);
				resizeObserverRef.current = ro;
			};

			// Initial size
			const container = containerRef.current;
			if (container) {
				const w = Math.round(container.clientWidth);
				if (w > 0) {
					node.width = w;
					node.height = CANVAS_HEIGHT;
					setCanvasWidth(w);
				}
			}
			observe();
			draw();
		},
		[draw],
	);

	// Redraw when points change
	const prevPointsRef = useRef(points);
	if (prevPointsRef.current !== points) {
		prevPointsRef.current = points;
		requestAnimationFrame(draw);
	}

	const findPointAt = (clientX: number, clientY: number): number | null => {
		const canvas = canvasRef.current;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		const mx = clientX - rect.left;
		const my = clientY - rect.top;
		const { width, height } = canvas;
		const scaleX = width / rect.width;
		const scaleY = height / rect.height;

		for (let i = 0; i < points.length; i++) {
			const px = positionToX(points[i].position, width);
			const py = speedToY(points[i].speed, height);
			const dx = mx * scaleX - px;
			const dy = my * scaleY - py;
			if (dx * dx + dy * dy < 100) return i;
		}
		return null;
	};

	const handlePointerDown = (event: React.PointerEvent) => {
		const idx = findPointAt(event.clientX, event.clientY);
		if (idx !== null) {
			setDraggingIndex(idx);
			event.currentTarget.setPointerCapture(event.pointerId);
		}
	};

	const handlePointerMove = (event: React.PointerEvent) => {
		if (draggingIndex === null) return;
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const mx = event.clientX - rect.left;
		const my = event.clientY - rect.top;
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		const position = clamp(
			xToPosition(mx * scaleX, canvas.width),
			0,
			1,
		);
		const speed = clamp(yToSpeed(my * scaleY, canvas.height), 0.1, 10);

		const updated = [...points];
		updated[draggingIndex] = {
			...updated[draggingIndex],
			position,
			speed,
		};
		onChange(updated);
	};

	const handlePointerUp = () => {
		setDraggingIndex(null);
	};

	const handleDoubleClick = (event: React.MouseEvent) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = event.clientX - rect.left;
		const my = event.clientY - rect.top;
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		const position = clamp(
			xToPosition(mx * scaleX, canvas.width),
			0,
			1,
		);
		const speed = clamp(yToSpeed(my * scaleY, canvas.height), 0.1, 10);

		onChange([...points, { position, speed }]);
	};

	const handleContextMenu = (event: React.MouseEvent) => {
		event.preventDefault();
		if (points.length <= 2) return;
		const idx = findPointAt(event.clientX, event.clientY);
		if (idx !== null) {
			onChange(points.filter((_, i) => i !== idx));
		}
	};

	return (
		<div ref={containerRef} className="w-full overflow-hidden rounded-md">
			<canvas
				ref={canvasCallbackRef}
				height={CANVAS_HEIGHT}
				className="w-full cursor-crosshair touch-none"
				style={{ height: CANVAS_HEIGHT }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onDoubleClick={handleDoubleClick}
				onContextMenu={handleContextMenu}
			/>
		</div>
	);
}

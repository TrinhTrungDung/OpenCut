"use client";

import { useMemo, useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { resolveVolumeAtTime } from "@/lib/animation";
import { getNumberChannelForPath } from "@/lib/animation/number-channel";
import type { ElementAnimations } from "@/types/animation";

const SAMPLE_COUNT = 50;
const STROKE_COLOR = "#F59E0B";
const STROKE_WIDTH = 1.5;
const HANDLE_RADIUS = 4;
const MAX_VOLUME = 2;

interface VolumeEnvelopeOverlayProps {
	baseVolume: number;
	animations?: ElementAnimations;
	duration: number;
	width: number;
	height: number;
	trackId: string;
	elementId: string;
}

function volumeToY({
	volume,
	height,
}: { volume: number; height: number }): number {
	// volume 0 = bottom, 1 = center, 2 = top
	const clamped = Math.min(Math.max(volume, 0), MAX_VOLUME);
	return height - (clamped / MAX_VOLUME) * height;
}

export function VolumeEnvelopeOverlay({
	baseVolume,
	animations,
	duration,
	width,
	height,
	trackId,
	elementId,
}: VolumeEnvelopeOverlayProps) {
	const editor = useEditor();

	const polylinePoints = useMemo(() => {
		if (duration <= 0 || width <= 0) return "";

		const points: string[] = [];
		for (let i = 0; i <= SAMPLE_COUNT; i++) {
			const t = (i / SAMPLE_COUNT) * duration;
			const vol = resolveVolumeAtTime({
				baseVolume,
				animations,
				localTime: t,
			});
			const x = (t / duration) * width;
			const y = volumeToY({ volume: vol, height });
			points.push(`${x},${y}`);
		}
		return points.join(" ");
	}, [baseVolume, animations, duration, width, height]);

	const keyframeHandles = useMemo(() => {
		const channel = getNumberChannelForPath({
			animations,
			propertyPath: "volume",
		});
		if (!channel?.keyframes.length) return [];

		return channel.keyframes.map((kf) => ({
			id: kf.id,
			time: kf.time,
			value: kf.value,
			x: duration > 0 ? (kf.time / duration) * width : 0,
			y: volumeToY({ volume: kf.value, height }),
		}));
	}, [animations, duration, width, height]);

	const handleDoubleClick = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			if (duration <= 0 || width <= 0) return;
			const rect = e.currentTarget.getBoundingClientRect();
			const localX = e.clientX - rect.left;
			const time = (localX / width) * duration;
			const value = resolveVolumeAtTime({
				baseVolume,
				animations,
				localTime: time,
			});

			editor.timeline.upsertKeyframes({
				keyframes: [
					{
						trackId,
						elementId,
						propertyPath: "volume",
						time,
						value,
					},
				],
			});
		},
		[editor, trackId, elementId, baseVolume, animations, duration, width],
	);

	if (width <= 0 || height <= 0) return null;

	return (
		<svg
			className="absolute inset-0 pointer-events-auto"
			width={width}
			height={height}
			onDoubleClick={handleDoubleClick}
		>
			<polyline
				points={polylinePoints}
				fill="none"
				stroke={STROKE_COLOR}
				strokeWidth={STROKE_WIDTH}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			{keyframeHandles.map((handle) => (
				<circle
					key={handle.id}
					cx={handle.x}
					cy={handle.y}
					r={HANDLE_RADIUS}
					fill={STROKE_COLOR}
					stroke="white"
					strokeWidth={1}
					className="cursor-grab"
				/>
			))}
		</svg>
	);
}

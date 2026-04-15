"use client";

/**
 * Audio waveform/spectrum visualization overlay for the preview panel.
 * Reads data from the AudioManager's AnalyserNode and renders bars on a canvas.
 * Only active during playback.
 */

import { useCallback, useEffect, useRef } from "react";
import { useAudioAnalyser, type AnalyserMode } from "@/hooks/use-audio-analyser";

interface AudioVisualizationProps {
	/** The AnalyserNode from AudioManager (null when not initialized). */
	analyser: AnalyserNode | null;
	/** Whether audio is playing. */
	isPlaying: boolean;
	/** Visualization mode. */
	mode?: AnalyserMode;
	/** Canvas width in CSS pixels. */
	width?: number;
	/** Canvas height in CSS pixels. */
	height?: number;
}

export function AudioVisualization({
	analyser,
	isPlaying,
	mode = "frequency",
	width = 200,
	height = 40,
}: AudioVisualizationProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { data } = useAudioAnalyser({
		analyser,
		isActive: isPlaying,
		mode,
		fftSize: 256,
	});

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas || !data) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const w = canvas.width / dpr;
		const h = canvas.height / dpr;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const barCount = data.length;
		const barWidth = w / barCount;

		ctx.fillStyle = "rgba(59, 130, 246, 0.6)"; /* blue-500 with opacity */

		for (let i = 0; i < barCount; i++) {
			const normalized = data[i] / 255;
			const barHeight = normalized * h;
			ctx.fillRect(
				i * barWidth * dpr,
				(h - barHeight) * dpr,
				Math.max(barWidth * dpr - 1, 1),
				barHeight * dpr,
			);
		}
	}, [data]);

	/* Draw whenever data changes */
	useEffect(() => {
		draw();
	}, [draw]);

	/* Set canvas resolution for HiDPI */
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
	}, [width, height]);

	if (!isPlaying) return null;

	return (
		<canvas
			ref={canvasRef}
			style={{ width, height }}
			className="pointer-events-none absolute bottom-1 left-1 opacity-70"
		/>
	);
}

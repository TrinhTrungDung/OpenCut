import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { VolumeEnvelopeOverlay } from "./volume-envelope-overlay";
import type { ElementAnimations } from "@/types/animation";

interface AudioWaveformProps {
	audioUrl?: string;
	audioBuffer?: AudioBuffer;
	height?: number;
	className?: string;
	baseVolume?: number;
	animations?: ElementAnimations;
	duration?: number;
	trackId?: string;
	elementId?: string;
}

function extractPeaks({
	buffer,
	length = 512,
}: {
	buffer: AudioBuffer;
	length?: number;
}): number[][] {
	const channels = buffer.numberOfChannels;
	const peaks: number[][] = [];

	for (let c = 0; c < channels; c++) {
		const data = buffer.getChannelData(c);
		const step = Math.floor(data.length / length);
		const channelPeaks: number[] = [];

		for (let i = 0; i < length; i++) {
			const start = i * step;
			const end = Math.min(start + step, data.length);
			let max = 0;
			for (let j = start; j < end; j++) {
				const abs = Math.abs(data[j]);
				if (abs > max) max = abs;
			}
			channelPeaks.push(max);
		}
		peaks.push(channelPeaks);
	}

	return peaks;
}

export function AudioWaveform({
	audioUrl,
	audioBuffer,
	height = 32,
	className = "",
	baseVolume,
	animations,
	duration,
	trackId,
	elementId,
}: AudioWaveformProps) {
	const waveformRef = useRef<HTMLDivElement>(null);
	const wavesurfer = useRef<WaveSurfer | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let mounted = true;
		const ws = wavesurfer.current;

		const initWaveSurfer = async () => {
			if (!waveformRef.current || (!audioUrl && !audioBuffer)) return;

			try {
				if (ws) {
					wavesurfer.current = null;
				}

				const newWaveSurfer = WaveSurfer.create({
					container: waveformRef.current,
					waveColor: "rgba(255, 255, 255, 0.6)",
					progressColor: "rgba(255, 255, 255, 0.9)",
					cursorColor: "transparent",
					barWidth: 2,
					barGap: 1,
					height,
					normalize: true,
					interact: false,
				});

				if (mounted) {
					wavesurfer.current = newWaveSurfer;
				} else {
					try {
						newWaveSurfer.destroy();
					} catch {}
					return;
				}

				newWaveSurfer.on("ready", () => {
					if (mounted) {
						setIsLoading(false);
						setError(false);
					}
				});

				newWaveSurfer.on("error", (err) => {
					if (mounted) {
						console.error("WaveSurfer error:", err);
						setError(true);
						setIsLoading(false);
					}
				});

				if (audioBuffer) {
					const peaks = extractPeaks({ buffer: audioBuffer });
					newWaveSurfer.load("", peaks, audioBuffer.duration);
				} else if (audioUrl) {
					await newWaveSurfer.load(audioUrl);
				}
			} catch (err) {
				if (mounted) {
					console.error("Failed to initialize WaveSurfer:", err);
					setError(true);
					setIsLoading(false);
				}
			}
		};

		if (ws) {
			const wsToDestroy = ws;
			wavesurfer.current = null;

			requestAnimationFrame(() => {
				try {
					wsToDestroy.destroy();
				} catch {}
				if (mounted) {
					initWaveSurfer();
				}
			});
		} else {
			initWaveSurfer();
		}

		return () => {
			mounted = false;

			const wsToDestroy = wavesurfer.current;

			wavesurfer.current = null;

			if (wsToDestroy) {
				requestAnimationFrame(() => {
					try {
						wsToDestroy.destroy();
					} catch {}
				});
			}
		};
	}, [audioUrl, audioBuffer, height]);

	if (error) {
		return (
			<div
				className={`flex items-center justify-center ${className}`}
				style={{ height }}
			>
				<span className="text-foreground/60 text-xs">Audio unavailable</span>
			</div>
		);
	}

	const showOverlay =
		baseVolume !== undefined &&
		duration !== undefined &&
		trackId !== undefined &&
		elementId !== undefined;

	return (
		<div className={`relative ${className}`}>
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="text-foreground/60 text-xs">Loading...</span>
				</div>
			)}
			<div
				ref={waveformRef}
				className={`w-full ${isLoading ? "opacity-0" : "opacity-100"}`}
				style={{ height }}
			/>
			{showOverlay && (
				<VolumeEnvelopeOverlay
					baseVolume={baseVolume}
					animations={animations}
					duration={duration}
					width={waveformRef.current?.clientWidth ?? 0}
					height={height}
					trackId={trackId}
					elementId={elementId}
				/>
			)}
		</div>
	);
}

export default AudioWaveform;

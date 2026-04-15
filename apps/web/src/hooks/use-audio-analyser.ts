/**
 * Hook to read AnalyserNode frequency/waveform data at ~60fps.
 *
 * Returns a Uint8Array that updates each animation frame while isActive is true.
 * Auto-stops on unmount.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type AnalyserMode = "frequency" | "waveform";

interface UseAudioAnalyserOptions {
	/** The AnalyserNode to read from (null when not available). */
	analyser: AnalyserNode | null;
	/** Whether to actively poll data (tie to isPlaying). */
	isActive: boolean;
	/** Data mode: frequency spectrum or time-domain waveform. */
	mode?: AnalyserMode;
	/** FFT size (power of 2, 32-32768). Default 256. */
	fftSize?: number;
}

interface UseAudioAnalyserResult {
	/** Current audio data buffer (updated at ~60fps). */
	data: Uint8Array | null;
}

export function useAudioAnalyser({
	analyser,
	isActive,
	mode = "frequency",
	fftSize = 256,
}: UseAudioAnalyserOptions): UseAudioAnalyserResult {
	const [data, setData] = useState<Uint8Array | null>(null);
	const rafRef = useRef<number | null>(null);
	const bufferRef = useRef<Uint8Array | null>(null);

	/* Configure analyser FFT size when it changes */
	useEffect(() => {
		if (analyser && analyser.fftSize !== fftSize) {
			analyser.fftSize = fftSize;
		}
	}, [analyser, fftSize]);

	const tick = useCallback(() => {
		if (!analyser) return;

		const binCount = analyser.frequencyBinCount;
		if (!bufferRef.current || bufferRef.current.length !== binCount) {
			bufferRef.current = new Uint8Array(binCount);
		}

		if (mode === "frequency") {
			analyser.getByteFrequencyData(bufferRef.current);
		} else {
			analyser.getByteTimeDomainData(bufferRef.current);
		}

		/* Create a new array each frame so React detects the change */
		setData(new Uint8Array(bufferRef.current));
		rafRef.current = requestAnimationFrame(tick);
	}, [analyser, mode]);

	useEffect(() => {
		if (isActive && analyser) {
			rafRef.current = requestAnimationFrame(tick);
		}
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [isActive, analyser, tick]);

	/* Clear data when playback stops */
	useEffect(() => {
		if (!isActive) {
			setData(null);
		}
	}, [isActive]);

	return { data };
}

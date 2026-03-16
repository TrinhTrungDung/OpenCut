import { Input, ALL_FORMATS, BlobSource, AudioBufferSink } from "mediabunny";
import { createWavBlob } from "@/lib/media/mediabunny";

const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 2;

export async function extractAudioFromVideo({
	file,
	onProgress,
}: {
	file: File;
	onProgress?: ({ progress }: { progress: number }) => void;
}): Promise<{ blob: Blob; duration: number }> {
	const input = new Input({
		source: new BlobSource(file),
		formats: ALL_FORMATS,
	});

	try {
		onProgress?.({ progress: 5 });

		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) {
			throw new Error("No audio track found in video file");
		}

		onProgress?.({ progress: 10 });

		const sink = new AudioBufferSink(audioTrack);
		const chunks: AudioBuffer[] = [];
		let totalSamples = 0;

		for await (const { buffer } of sink.buffers(0)) {
			chunks.push(buffer);
			totalSamples += buffer.length;
		}

		if (chunks.length === 0) {
			throw new Error("No audio data found in video file");
		}

		onProgress?.({ progress: 60 });

		const nativeSampleRate = chunks[0].sampleRate;
		const numChannels = Math.min(NUM_CHANNELS, chunks[0].numberOfChannels);

		// Collect all channel data
		const nativeChannels = Array.from(
			{ length: numChannels },
			() => new Float32Array(totalSamples),
		);
		let offset = 0;
		for (const chunk of chunks) {
			for (let ch = 0; ch < numChannels; ch++) {
				const sourceData = chunk.getChannelData(
					Math.min(ch, chunk.numberOfChannels - 1),
				);
				nativeChannels[ch].set(sourceData, offset);
			}
			offset += chunk.length;
		}

		onProgress?.({ progress: 75 });

		// Resample to target sample rate
		const resampleRatio = SAMPLE_RATE / nativeSampleRate;
		const outputSamples = Math.ceil(totalSamples * resampleRatio);

		// Interleave channels for WAV
		const interleavedSamples = new Float32Array(outputSamples * NUM_CHANNELS);
		for (let i = 0; i < outputSamples; i++) {
			const sourceIdx = Math.floor(i / resampleRatio);
			for (let ch = 0; ch < NUM_CHANNELS; ch++) {
				const sourceChannel = ch < numChannels ? ch : 0;
				const sample =
					sourceIdx < nativeChannels[sourceChannel].length
						? nativeChannels[sourceChannel][sourceIdx]
						: 0;
				interleavedSamples[i * NUM_CHANNELS + ch] = Math.max(
					-1,
					Math.min(1, sample),
				);
			}
		}

		onProgress?.({ progress: 90 });

		const blob = createWavBlob({ samples: interleavedSamples });
		const duration = outputSamples / SAMPLE_RATE;

		onProgress?.({ progress: 100 });

		return { blob, duration };
	} finally {
		input.dispose();
	}
}

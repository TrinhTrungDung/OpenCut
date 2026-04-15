import type { TransferableAudioData } from "@/types/export-worker";

/**
 * Serialize an AudioBuffer into transferable Float32Arrays.
 * AudioBuffer cannot be directly transferred via postMessage,
 * so we extract raw channel data as typed arrays.
 */
export function serializeAudioBuffer(
	buffer: AudioBuffer,
): TransferableAudioData {
	const channels: Float32Array[] = [];
	for (let i = 0; i < buffer.numberOfChannels; i++) {
		// Copy channel data (getChannelData returns a reference)
		channels.push(new Float32Array(buffer.getChannelData(i)));
	}
	return {
		channels,
		sampleRate: buffer.sampleRate,
		length: buffer.length,
	};
}

/**
 * Get transferable ArrayBuffers from serialized audio data.
 * Used in postMessage transfer list for zero-copy transfer.
 */
export function getAudioTransferables(
	data: TransferableAudioData,
): ArrayBuffer[] {
	return data.channels.map((ch) => ch.buffer as ArrayBuffer);
}

/**
 * Reconstruct an AudioBuffer from transferred Float32 channel data.
 * Uses OfflineAudioContext which is available in Web Workers.
 */
export function reconstructAudioBuffer(
	data: TransferableAudioData,
): AudioBuffer {
	const channelCount = data.channels.length;
	const ctx = new OfflineAudioContext(
		channelCount,
		data.length,
		data.sampleRate,
	);
	const buffer = ctx.createBuffer(channelCount, data.length, data.sampleRate);
	for (let i = 0; i < channelCount; i++) {
		buffer.getChannelData(i).set(data.channels[i]);
	}
	return buffer;
}

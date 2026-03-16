import type { CaptionChunk } from "@/types/transcription";

export interface SRTEntry {
	index: number;
	startTime: number; // seconds
	endTime: number; // seconds
	text: string;
}

/** Convert SRT timestamp "HH:MM:SS,mmm" to seconds */
export function srtTimeToSeconds(time: string): number {
	const trimmed = time.trim();
	const match = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
	if (!match) {
		throw new Error(`Invalid SRT timestamp: "${trimmed}"`);
	}
	const [, hours, minutes, seconds, millis] = match;
	const ms = millis.padEnd(3, "0");
	return (
		Number(hours) * 3600 +
		Number(minutes) * 60 +
		Number(seconds) +
		Number(ms) / 1000
	);
}

/** Parse SRT text into structured entries */
export function parseSRT(srtText: string): SRTEntry[] {
	// Strip BOM and normalize line endings
	const cleaned = srtText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
	const blocks = cleaned.split(/\n\n+/).filter((b) => b.trim());

	const entries: SRTEntry[] = [];

	for (const block of blocks) {
		const lines = block.trim().split("\n");
		if (lines.length < 2) continue;

		// Find the timestamp line (may or may not have an index line before it)
		let timestampLineIdx = -1;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes("-->")) {
				timestampLineIdx = i;
				break;
			}
		}
		if (timestampLineIdx === -1) continue;

		// Parse index (line before timestamp, if present)
		const indexStr =
			timestampLineIdx > 0 ? lines[timestampLineIdx - 1].trim() : "";
		const index = /^\d+$/.test(indexStr) ? Number(indexStr) : entries.length + 1;

		// Parse timestamps
		const timeParts = lines[timestampLineIdx].split("-->");
		if (timeParts.length !== 2) continue;

		let startTime: number;
		let endTime: number;
		try {
			startTime = srtTimeToSeconds(timeParts[0]);
			endTime = srtTimeToSeconds(timeParts[1]);
		} catch {
			continue; // Skip malformed timestamps
		}

		// Remaining lines are subtitle text
		const text = lines
			.slice(timestampLineIdx + 1)
			.join("\n")
			.trim();
		if (!text) continue;

		entries.push({ index, startTime, endTime, text });
	}

	return entries;
}

/** Convert SRT entries to CaptionChunk[] compatible with existing caption system */
export function srtEntriesToCaptionChunks(entries: SRTEntry[]): CaptionChunk[] {
	return entries.map((entry) => ({
		text: entry.text.replace(/\n/g, " "),
		startTime: entry.startTime,
		duration: Math.max(0.1, entry.endTime - entry.startTime),
	}));
}

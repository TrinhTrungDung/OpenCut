import type { ExportFormat } from "@/types/export";
import type { CodecCheckResult } from "@/types/export-worker";

/**
 * Quality-to-bitrate mapping for codec negotiation.
 * These are approximate values used only for isConfigSupported() checks.
 */
const BITRATE_MAP = {
	low: 1_000_000,
	medium: 2_500_000,
	high: 5_000_000,
	very_high: 10_000_000,
} as const;

/**
 * Get the WebCodecs codec string for a given export format.
 */
function getCodecString(format: ExportFormat): string {
	// VP9 profile 0, level 1.0, 8-bit
	if (format === "webm") return "vp09.00.10.08";
	// H.264 High profile, level 4.0
	return "avc1.640028";
}

/**
 * Check WebCodecs VideoEncoder support with hardware acceleration preference.
 * Tries hardware first, then software, then no-preference.
 *
 * This is purely informational -- mediabunny handles actual encoding.
 * The result is used to display codec info in the UI.
 */
export async function checkCodecSupport({
	format,
	width,
	height,
	quality,
}: {
	format: ExportFormat;
	width: number;
	height: number;
	quality: keyof typeof BITRATE_MAP;
}): Promise<CodecCheckResult> {
	const codec = getCodecString(format);
	const bitrate = BITRATE_MAP[quality];

	// VideoEncoder not available (e.g., older browsers)
	if (typeof VideoEncoder === "undefined") {
		return {
			supported: false,
			hardwareAcceleration: false,
			selectedCodec: codec,
			selectedAcceleration: "no-preference",
		};
	}

	const baseConfig: VideoEncoderConfig = {
		codec,
		width,
		height,
		bitrate,
	};

	// Try hardware acceleration first
	try {
		const hwResult = await VideoEncoder.isConfigSupported({
			...baseConfig,
			hardwareAcceleration: "prefer-hardware",
		});
		if (hwResult.supported) {
			return {
				supported: true,
				hardwareAcceleration: true,
				selectedCodec: codec,
				selectedAcceleration: "prefer-hardware",
			};
		}
	} catch {
		// Hardware check failed, try software
	}

	// Fall back to software encoding
	try {
		const swResult = await VideoEncoder.isConfigSupported({
			...baseConfig,
			hardwareAcceleration: "prefer-software",
		});
		if (swResult.supported) {
			return {
				supported: true,
				hardwareAcceleration: false,
				selectedCodec: codec,
				selectedAcceleration: "prefer-software",
			};
		}
	} catch {
		// Software check also failed
	}

	// Last resort: no preference
	try {
		const result = await VideoEncoder.isConfigSupported(baseConfig);
		return {
			supported: !!result.supported,
			hardwareAcceleration: false,
			selectedCodec: codec,
			selectedAcceleration: "no-preference",
		};
	} catch {
		return {
			supported: false,
			hardwareAcceleration: false,
			selectedCodec: codec,
			selectedAcceleration: "no-preference",
		};
	}
}

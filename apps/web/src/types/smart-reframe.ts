/** Smart reframe types for auto-cropping to social media aspect ratios */

export interface FacePosition {
	/** Normalized center X (0-1) */
	x: number;
	/** Normalized center Y (0-1) */
	y: number;
	/** Normalized width (0-1) */
	width: number;
	/** Normalized height (0-1) */
	height: number;
	/** Detection confidence (0-1) */
	confidence: number;
}

export interface FrameAnalysis {
	/** Frame time in seconds */
	time: number;
	/** Detected faces in this frame */
	faces: FacePosition[];
}

export interface ReframePreset {
	label: string;
	/** Target aspect ratio as width/height */
	aspectRatio: number;
	/** Display dimensions */
	width: number;
	height: number;
}

export const REFRAME_PRESETS: ReframePreset[] = [
	{ label: "9:16 (Vertical)", aspectRatio: 9 / 16, width: 1080, height: 1920 },
	{ label: "1:1 (Square)", aspectRatio: 1, width: 1080, height: 1080 },
	{ label: "4:5 (Instagram)", aspectRatio: 4 / 5, width: 1080, height: 1350 },
	{ label: "16:9 (Landscape)", aspectRatio: 16 / 9, width: 1920, height: 1080 },
];

export interface ReframeResult {
	/** Crop region normalized (0-1) */
	cropX: number;
	cropY: number;
	cropWidth: number;
	cropHeight: number;
	/** Target output dimensions */
	outputWidth: number;
	outputHeight: number;
}

export type ReframeStatus = "idle" | "analyzing" | "ready" | "applying" | "error";

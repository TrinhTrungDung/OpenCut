import type { VisualElement } from "./timeline";
import type { TransitionType } from "./transitions";

interface BaseDragData {
	id: string;
	name: string;
}

export interface MediaDragData extends BaseDragData {
	type: "media";
	mediaType: "image" | "video" | "audio";
	targetElementTypes?: ("video" | "image")[];
	trimStart?: number;
	trimEnd?: number;
}

export interface TextDragData extends BaseDragData {
	type: "text";
	content: string;
}

export interface StickerDragData extends BaseDragData {
	type: "sticker";
	stickerId: string;
}

export interface EffectDragData extends BaseDragData {
	type: "effect";
	effectType: string;
	targetElementTypes: VisualElement["type"][];
}

export interface TransitionDragData extends BaseDragData {
	type: "transition";
	transitionType: TransitionType;
	defaultDuration: number;
}

export type TimelineDragData =
	| MediaDragData
	| TextDragData
	| StickerDragData
	| EffectDragData
	| TransitionDragData;

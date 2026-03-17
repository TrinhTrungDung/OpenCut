import type { TextElement, TextBackground } from "@/types/timeline";
import type { ElementAnimations } from "@/types/animation";

/** Visual style properties that a text template overrides */
export interface TextTemplateStyle {
	content?: string;
	fontSize?: number;
	fontFamily?: string;
	color?: string;
	background?: Partial<TextBackground>;
	textAlign?: TextElement["textAlign"];
	fontWeight?: TextElement["fontWeight"];
	fontStyle?: TextElement["fontStyle"];
	textDecoration?: TextElement["textDecoration"];
	letterSpacing?: number;
	lineHeight?: number;
	opacity?: number;
}

/** Category groupings for template browsing */
export type TextTemplateCategory =
	| "titles"
	| "lower-thirds"
	| "social-media"
	| "minimal"
	| "bold"
	| "creative";

export interface TextTemplate {
	/** Unique identifier for the template */
	id: string;
	/** Display name shown in the template browser */
	name: string;
	/** Category for filtering */
	category: TextTemplateCategory;
	/** Style overrides applied on top of DEFAULT_TEXT_ELEMENT */
	style: TextTemplateStyle;
	/** Optional entrance/exit animations baked into the template */
	animations?: ElementAnimations;
	/** Duration override in seconds (default: 5) */
	duration?: number;
	/** Transform position override (e.g. lower thirds at bottom) */
	position?: { x: number; y: number };
}

export const TEXT_TEMPLATE_CATEGORY_LABELS: Record<TextTemplateCategory, string> = {
	"titles": "Titles",
	"lower-thirds": "Lower Thirds",
	"social-media": "Social Media",
	"minimal": "Minimal",
	"bold": "Bold",
	"creative": "Creative",
};

/** Order for category display in the UI */
export const TEXT_TEMPLATE_CATEGORY_ORDER: TextTemplateCategory[] = [
	"titles",
	"lower-thirds",
	"social-media",
	"minimal",
	"bold",
	"creative",
];

import type { TextTemplate } from "@/types/text-templates";

/**
 * Built-in text templates organized by category.
 *
 * Each template defines style overrides applied on top of DEFAULT_TEXT_ELEMENT.
 * Templates can include animations (entrance/exit keyframes) and position overrides.
 *
 * Animation keyframe times are relative to element start:
 *   - time: 0 = element start
 *   - time: duration = element end
 *   - We use placeholder values here; the factory function adjusts
 *     exit keyframe times based on actual element duration.
 */

const FADE_IN_DURATION = 0.5;
const FADE_OUT_OFFSET = 0.5; // seconds before element end

/** Helper: create fade-in opacity animation */
function fadeInAnimation(): NonNullable<TextTemplate["animations"]> {
	return {
		channels: {
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: "tmpl-fade-in-0", time: 0, value: 0, interpolation: "linear" },
					{ id: "tmpl-fade-in-1", time: FADE_IN_DURATION, value: 1, interpolation: "linear" },
				],
			},
		},
	};
}

/** Helper: create fade-in + fade-out opacity animation */
function fadeInOutAnimation({ duration }: { duration: number }): NonNullable<TextTemplate["animations"]> {
	const fadeOutStart = duration - FADE_OUT_OFFSET;
	return {
		channels: {
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: "tmpl-fio-0", time: 0, value: 0, interpolation: "linear" },
					{ id: "tmpl-fio-1", time: FADE_IN_DURATION, value: 1, interpolation: "linear" },
					{ id: "tmpl-fio-2", time: fadeOutStart, value: 1, interpolation: "linear" },
					{ id: "tmpl-fio-3", time: duration, value: 0, interpolation: "linear" },
				],
			},
		},
	};
}

/** Helper: slide-up entrance animation */
function slideUpAnimation({ duration }: { duration: number }): NonNullable<TextTemplate["animations"]> {
	return {
		channels: {
			"transform.position.y": {
				valueKind: "number",
				keyframes: [
					{ id: "tmpl-su-0", time: 0, value: 50, interpolation: "linear" },
					{ id: "tmpl-su-1", time: 0.4, value: 0, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: "tmpl-su-o0", time: 0, value: 0, interpolation: "linear" },
					{ id: "tmpl-su-o1", time: 0.4, value: 1, interpolation: "linear" },
					{ id: "tmpl-su-o2", time: duration - 0.4, value: 1, interpolation: "linear" },
					{ id: "tmpl-su-o3", time: duration, value: 0, interpolation: "linear" },
				],
			},
		},
	};
}

/** Helper: scale bounce entrance */
function scaleBounceAnimation(): NonNullable<TextTemplate["animations"]> {
	return {
		channels: {
			"transform.scale": {
				valueKind: "number",
				keyframes: [
					{ id: "tmpl-sb-0", time: 0, value: 0, interpolation: "linear" },
					{ id: "tmpl-sb-1", time: 0.2, value: 1.15, interpolation: "linear" },
					{ id: "tmpl-sb-2", time: 0.35, value: 1, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: "tmpl-sb-o0", time: 0, value: 0, interpolation: "linear" },
					{ id: "tmpl-sb-o1", time: 0.15, value: 1, interpolation: "linear" },
				],
			},
		},
	};
}

/* ─── Titles ─────────────────────────────────────────────── */

const TITLES: TextTemplate[] = [
	{
		id: "title-cinematic",
		name: "Cinematic",
		category: "titles",
		style: {
			content: "CINEMATIC TITLE",
			fontSize: 24,
			fontFamily: "Georgia",
			color: "#ffffff",
			fontWeight: "bold",
			letterSpacing: 6,
			textAlign: "center",
		},
		animations: fadeInOutAnimation({ duration: 5 }),
		duration: 5,
	},
	{
		id: "title-modern",
		name: "Modern",
		category: "titles",
		style: {
			content: "Modern Title",
			fontSize: 22,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "bold",
			letterSpacing: 2,
			textAlign: "center",
		},
		animations: scaleBounceAnimation(),
	},
	{
		id: "title-serif-elegant",
		name: "Elegant",
		category: "titles",
		style: {
			content: "Elegant Title",
			fontSize: 22,
			fontFamily: "Playfair Display",
			color: "#f0e6d3",
			fontWeight: "bold",
			fontStyle: "italic",
			letterSpacing: 3,
			textAlign: "center",
		},
		animations: fadeInAnimation(),
	},
	{
		id: "title-glitch",
		name: "Glitch",
		category: "titles",
		style: {
			content: "GLITCH TITLE",
			fontSize: 22,
			fontFamily: "Courier New",
			color: "#00ff88",
			fontWeight: "bold",
			letterSpacing: 4,
			textAlign: "center",
		},
		animations: scaleBounceAnimation(),
	},
];

/* ─── Lower Thirds ───────────────────────────────────────── */

const LOWER_THIRDS: TextTemplate[] = [
	{
		id: "lt-classic",
		name: "Classic",
		category: "lower-thirds",
		style: {
			content: "John Doe | Director",
			fontSize: 13,
			fontFamily: "Arial",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#000000cc",
				cornerRadius: 4,
				paddingX: 20,
				paddingY: 10,
			},
		},
		animations: slideUpAnimation({ duration: 5 }),
		duration: 5,
	},
	{
		id: "lt-modern-bar",
		name: "Modern Bar",
		category: "lower-thirds",
		style: {
			content: "Jane Smith",
			fontSize: 13,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#2563eb",
				cornerRadius: 0,
				paddingX: 24,
				paddingY: 8,
			},
		},
		animations: slideUpAnimation({ duration: 5 }),
		duration: 5,
	},
	{
		id: "lt-minimal-line",
		name: "Minimal",
		category: "lower-thirds",
		style: {
			content: "Speaker Name",
			fontSize: 12,
			fontFamily: "Helvetica",
			color: "#ffffff",
			fontWeight: "normal",
			textAlign: "center",
			letterSpacing: 3,
		},
		animations: fadeInOutAnimation({ duration: 5 }),
		duration: 5,
	},
	{
		id: "lt-news",
		name: "News",
		category: "lower-thirds",
		style: {
			content: "BREAKING NEWS",
			fontSize: 14,
			fontFamily: "Arial",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#dc2626",
				cornerRadius: 0,
				paddingX: 20,
				paddingY: 8,
			},
		},
		animations: slideUpAnimation({ duration: 5 }),
		duration: 5,
	},
];

/* ─── Social Media ───────────────────────────────────────── */

const SOCIAL_MEDIA: TextTemplate[] = [
	{
		id: "sm-instagram",
		name: "Instagram",
		category: "social-media",
		style: {
			content: "Follow @username",
			fontSize: 14,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#e1306c",
				cornerRadius: 30,
				paddingX: 24,
				paddingY: 12,
			},
		},
		animations: scaleBounceAnimation(),
	},
	{
		id: "sm-youtube-subscribe",
		name: "Subscribe",
		category: "social-media",
		style: {
			content: "SUBSCRIBE",
			fontSize: 13,
			fontFamily: "Arial",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			letterSpacing: 2,
			background: {
				enabled: true,
				color: "#ff0000",
				cornerRadius: 4,
				paddingX: 24,
				paddingY: 10,
			},
		},
		animations: scaleBounceAnimation(),
	},
	{
		id: "sm-tiktok-caption",
		name: "TikTok Caption",
		category: "social-media",
		style: {
			content: "Swipe up for more",
			fontSize: 14,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
		},
		animations: fadeInOutAnimation({ duration: 5 }),
	},
	{
		id: "sm-hashtag",
		name: "Hashtag",
		category: "social-media",
		style: {
			content: "#trending #viral",
			fontSize: 12,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#00000080",
				cornerRadius: 16,
				paddingX: 18,
				paddingY: 8,
			},
		},
		animations: fadeInAnimation(),
	},
];

/* ─── Minimal ────────────────────────────────────────────── */

const MINIMAL: TextTemplate[] = [
	{
		id: "min-clean",
		name: "Clean",
		category: "minimal",
		style: {
			content: "Clean Text",
			fontSize: 15,
			fontFamily: "Helvetica",
			color: "#ffffff",
			fontWeight: "normal",
			textAlign: "center",
			letterSpacing: 4,
		},
		animations: fadeInOutAnimation({ duration: 5 }),
	},
	{
		id: "min-thin",
		name: "Thin",
		category: "minimal",
		style: {
			content: "Thin Text",
			fontSize: 17,
			fontFamily: "Inter",
			color: "#ffffffcc",
			fontWeight: "normal",
			textAlign: "center",
			letterSpacing: 6,
		},
		animations: fadeInAnimation(),
	},
	{
		id: "min-typewriter",
		name: "Typewriter",
		category: "minimal",
		style: {
			content: "Typewriter Text",
			fontSize: 14,
			fontFamily: "Courier New",
			color: "#e0e0e0",
			fontWeight: "normal",
			textAlign: "left",
			lineHeight: 1.6,
		},
		animations: fadeInAnimation(),
	},
];

/* ─── Bold ───────────────────────────────────────────────── */

const BOLD: TextTemplate[] = [
	{
		id: "bold-impact",
		name: "Impact",
		category: "bold",
		style: {
			content: "BOLD TEXT",
			fontSize: 28,
			fontFamily: "Impact",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			letterSpacing: 2,
		},
		animations: scaleBounceAnimation(),
	},
	{
		id: "bold-neon",
		name: "Neon",
		category: "bold",
		style: {
			content: "NEON",
			fontSize: 26,
			fontFamily: "Arial",
			color: "#00ffff",
			fontWeight: "bold",
			textAlign: "center",
			letterSpacing: 6,
		},
		animations: scaleBounceAnimation(),
	},
	{
		id: "bold-highlight",
		name: "Highlight",
		category: "bold",
		style: {
			content: "HIGHLIGHTED",
			fontSize: 20,
			fontFamily: "Arial",
			color: "#000000",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#facc15",
				cornerRadius: 4,
				paddingX: 16,
				paddingY: 8,
			},
		},
		animations: scaleBounceAnimation(),
	},
];

/* ─── Creative ───────────────────────────────────────────── */

const CREATIVE: TextTemplate[] = [
	{
		id: "cr-handwritten",
		name: "Handwritten",
		category: "creative",
		style: {
			content: "Handwritten",
			fontSize: 20,
			fontFamily: "Caveat",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
		},
		animations: fadeInAnimation(),
	},
	{
		id: "cr-retro",
		name: "Retro",
		category: "creative",
		style: {
			content: "RETRO VIBES",
			fontSize: 20,
			fontFamily: "Georgia",
			color: "#ff6b35",
			fontWeight: "bold",
			fontStyle: "italic",
			textAlign: "center",
			letterSpacing: 4,
		},
		animations: scaleBounceAnimation(),
	},
	{
		id: "cr-gradient-box",
		name: "Gradient Box",
		category: "creative",
		style: {
			content: "Creative Text",
			fontSize: 16,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#8b5cf6",
				cornerRadius: 12,
				paddingX: 24,
				paddingY: 14,
			},
		},
		animations: fadeInOutAnimation({ duration: 5 }),
	},
	{
		id: "cr-comic",
		name: "Comic",
		category: "creative",
		style: {
			content: "POW!",
			fontSize: 28,
			fontFamily: "Comic Sans MS",
			color: "#ffdd00",
			fontWeight: "bold",
			textAlign: "center",
		},
		animations: scaleBounceAnimation(),
	},
];

/** All built-in text templates */
export const BUILT_IN_TEXT_TEMPLATES: TextTemplate[] = [
	...TITLES,
	...LOWER_THIRDS,
	...SOCIAL_MEDIA,
	...MINIMAL,
	...BOLD,
	...CREATIVE,
];

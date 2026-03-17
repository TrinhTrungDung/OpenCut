import type { TextTemplate } from "@/types/text-templates";
import type { CreateTimelineElement } from "@/types/timeline";
import { buildTextElement } from "@/lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { DEFAULT_TEXT_TEMPLATE_SCALE } from "@/constants/text-constants";
import { generateUUID } from "@/utils/id";

/**
 * Convert a TextTemplate into a CreateTimelineElement ready for insertion.
 *
 * Merges the template's style overrides onto DEFAULT_TEXT_ELEMENT via
 * buildTextElement, then applies animations, position, and duration.
 *
 * Animation keyframe IDs are made unique per invocation to avoid
 * collisions when the same template is applied multiple times.
 */
export function applyTextTemplate({
	template,
	startTime,
}: {
	template: TextTemplate;
	startTime: number;
}): CreateTimelineElement {
	const duration =
		template.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;

	const element = buildTextElement({
		raw: {
			name: template.name,
			content: template.style.content ?? "Text",
			fontSize: template.style.fontSize,
			fontFamily: template.style.fontFamily,
			color: template.style.color,
			background: template.style.background
				? {
						enabled: template.style.background.enabled ?? false,
						color: template.style.background.color ?? "#000000",
						cornerRadius: template.style.background.cornerRadius,
						paddingX: template.style.background.paddingX,
						paddingY: template.style.background.paddingY,
						offsetX: template.style.background.offsetX,
						offsetY: template.style.background.offsetY,
					}
				: undefined,
			textAlign: template.style.textAlign,
			fontWeight: template.style.fontWeight,
			fontStyle: template.style.fontStyle,
			textDecoration: template.style.textDecoration,
			letterSpacing: template.style.letterSpacing,
			lineHeight: template.style.lineHeight,
			opacity: template.style.opacity,
			duration,
			transform: {
				scale: DEFAULT_TEXT_TEMPLATE_SCALE,
				position: template.position ?? { x: 0, y: 0 },
				rotate: 0,
			},
		},
		startTime,
	});

	/* Attach animations with unique keyframe IDs */
	if (template.animations) {
		const uniqueAnimations = uniquifyKeyframeIds({
			animations: template.animations,
		});
		(element as Record<string, unknown>).animations = uniqueAnimations;
	}

	return element;
}

/**
 * Replace all keyframe IDs with unique UUIDs so multiple instances
 * of the same template don't share keyframe references.
 */
function uniquifyKeyframeIds({
	animations,
}: {
	animations: NonNullable<TextTemplate["animations"]>;
}): NonNullable<TextTemplate["animations"]> {
	const channels: Record<string, unknown> = {};

	for (const [path, channel] of Object.entries(animations.channels)) {
		if (!channel) continue;
		channels[path] = {
			...channel,
			keyframes: channel.keyframes.map((kf) => ({
				...kf,
				id: generateUUID(),
			})),
		};
	}

	return { channels } as NonNullable<TextTemplate["animations"]>;
}

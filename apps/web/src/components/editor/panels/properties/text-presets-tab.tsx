"use client";

import { useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { TextElement } from "@/types/timeline";
import { useEditor } from "@/hooks/use-editor";
import {
	getAllTextTemplates,
	searchTextTemplates,
} from "@/lib/text/templates";
import type { TextTemplate, TextTemplateCategory } from "@/types/text-templates";
import {
	TEXT_TEMPLATE_CATEGORY_LABELS,
	TEXT_TEMPLATE_CATEGORY_ORDER,
} from "@/types/text-templates";
import { cn } from "@/utils/ui";
import { generateUUID } from "@/utils/id";
import { loadFullFont } from "@/lib/fonts/google-fonts";
import { DEFAULT_TEXT_TEMPLATE_SCALE } from "@/constants/text-constants";

/**
 * Presets tab in the text properties panel.
 * Applies a template's visual style to the currently selected text element
 * without changing its content, position, or timing.
 */
export function TextPresetsTab({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] =
		useState<TextTemplateCategory | "all">("all");

	const handleApplyPreset = useCallback(
		({ template }: { template: TextTemplate }) => {
			const style = template.style;

			/* Ensure the template's font is loaded before rendering */
			if (style.fontFamily) {
				loadFullFont({ family: style.fontFamily });
			}

			/* Apply style overrides while preserving content and timing */
			const updates: Partial<TextElement> = {};

			if (style.fontSize !== undefined) updates.fontSize = style.fontSize;
			if (style.fontFamily !== undefined) updates.fontFamily = style.fontFamily;
			if (style.color !== undefined) updates.color = style.color;
			if (style.textAlign !== undefined) updates.textAlign = style.textAlign;
			if (style.fontWeight !== undefined) updates.fontWeight = style.fontWeight;
			if (style.fontStyle !== undefined) updates.fontStyle = style.fontStyle;
			if (style.textDecoration !== undefined)
				updates.textDecoration = style.textDecoration;
			if (style.letterSpacing !== undefined)
				updates.letterSpacing = style.letterSpacing;
			if (style.lineHeight !== undefined) updates.lineHeight = style.lineHeight;
			if (style.opacity !== undefined) updates.opacity = style.opacity;

			/* Set default template scale */
			updates.transform = {
				...element.transform,
				scale: DEFAULT_TEXT_TEMPLATE_SCALE,
			};

			if (style.background) {
				updates.background = {
					...element.background,
					...(style.background as TextElement["background"]),
				};
			}

			/* Apply animations if template has them, with unique keyframe IDs */
			if (template.animations) {
				const channels: Record<string, unknown> = {};
				for (const [path, channel] of Object.entries(
					template.animations.channels,
				)) {
					if (!channel) continue;
					const ch = channel as { valueKind: string; keyframes: Array<{ id: string; time: number; value: unknown; interpolation: string }> };
					channels[path] = {
						...ch,
						keyframes: ch.keyframes.map((kf) => ({
							...kf,
							id: generateUUID(),
						})),
					};
				}
				(updates as Record<string, unknown>).animations = { channels };
			}

			editor.timeline.updateElements({
				updates: [{ trackId, elementId: element.id, updates }],
			});
		},
		[editor, trackId, element],
	);

	const filteredTemplates = useMemo(() => {
		let templates = searchQuery
			? searchTextTemplates({ query: searchQuery })
			: getAllTextTemplates();

		if (selectedCategory !== "all") {
			templates = templates.filter((t) => t.category === selectedCategory);
		}

		return templates;
	}, [searchQuery, selectedCategory]);

	const groupedTemplates = useMemo(() => {
		if (selectedCategory !== "all") {
			return [{ category: selectedCategory, templates: filteredTemplates }];
		}

		const groups: Array<{
			category: TextTemplateCategory;
			templates: TextTemplate[];
		}> = [];

		for (const category of TEXT_TEMPLATE_CATEGORY_ORDER) {
			const categoryTemplates = filteredTemplates.filter(
				(t) => t.category === category,
			);
			if (categoryTemplates.length > 0) {
				groups.push({ category, templates: categoryTemplates });
			}
		}

		return groups;
	}, [filteredTemplates, selectedCategory]);

	return (
		<div className="flex flex-col gap-2 p-3">
			{/* Search */}
			<Input
				placeholder="Search presets..."
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				className="h-8 text-xs"
			/>

			{/* Category tabs */}
			<div className="scrollbar-thin flex gap-1 overflow-x-auto">
				<CategoryChip
					label="All"
					isActive={selectedCategory === "all"}
					onClick={() => setSelectedCategory("all")}
				/>
				{TEXT_TEMPLATE_CATEGORY_ORDER.map((category) => (
					<CategoryChip
						key={category}
						label={TEXT_TEMPLATE_CATEGORY_LABELS[category]}
						isActive={selectedCategory === category}
						onClick={() => setSelectedCategory(category)}
					/>
				))}
			</div>

			{/* Template grid */}
			<div className="space-y-3">
				{groupedTemplates.map(({ category, templates }) => (
					<div key={category}>
						{selectedCategory === "all" && (
							<h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
								{TEXT_TEMPLATE_CATEGORY_LABELS[category]}
							</h3>
						)}
						<div className="grid grid-cols-2 gap-1.5">
							{templates.map((template) => (
								<PresetCard
									key={template.id}
									template={template}
									onApply={handleApplyPreset}
								/>
							))}
						</div>
					</div>
				))}

				{filteredTemplates.length === 0 && (
					<div className="text-muted-foreground flex items-center justify-center py-8 text-xs">
						No presets found
					</div>
				)}
			</div>
		</div>
	);
}

function CategoryChip({
	label,
	isActive,
	onClick,
}: {
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors",
				isActive
					? "bg-primary text-primary-foreground"
					: "text-muted-foreground hover:bg-accent hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

function PresetCard({
	template,
	onApply,
}: {
	template: TextTemplate;
	onApply: ({ template }: { template: TextTemplate }) => void;
}) {
	const style = template.style;

	const previewStyle: React.CSSProperties = {
		fontFamily: style.fontFamily ?? "Arial",
		fontSize: "clamp(8px, 2.5vw, 14px)",
		fontWeight: style.fontWeight === "bold" ? 700 : 400,
		fontStyle: style.fontStyle === "italic" ? "italic" : "normal",
		color: style.color ?? "#ffffff",
		letterSpacing: style.letterSpacing
			? `${Math.min(style.letterSpacing, 4)}px`
			: undefined,
		textAlign: (style.textAlign ?? "center") as React.CSSProperties["textAlign"],
	};

	const hasBg = style.background?.enabled;
	const bgStyle: React.CSSProperties | undefined = hasBg
		? {
				backgroundColor: style.background?.color ?? "#000000",
				borderRadius: style.background?.cornerRadius
					? `${Math.min(style.background.cornerRadius, 20)}px`
					: undefined,
				padding: "2px 6px",
			}
		: undefined;

	return (
		<button
			type="button"
			onClick={() => onApply({ template })}
			className="bg-zinc-900 hover:bg-zinc-800 hover:ring-primary/50 flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-md transition-all hover:ring-1"
			title={`Apply "${template.name}" preset`}
		>
			<span
				className="max-w-full select-none truncate px-1 leading-tight"
				style={previewStyle}
			>
				{hasBg ? (
					<span style={bgStyle}>{style.content ?? template.name}</span>
				) : (
					(style.content ?? template.name)
				)}
			</span>
		</button>
	);
}

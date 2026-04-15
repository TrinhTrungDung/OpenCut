"use client";

import { useCallback, useMemo, useState } from "react";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Input } from "@/components/ui/input";
import { useManagers } from "@/hooks/editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { buildTextElement } from "@/lib/timeline/element-utils";
import {
	getAllTextTemplates,
	searchTextTemplates,
	applyTextTemplate,
} from "@/lib/text/templates";
import type { TextTemplate, TextTemplateCategory } from "@/types/text-templates";
import {
	TEXT_TEMPLATE_CATEGORY_LABELS,
	TEXT_TEMPLATE_CATEGORY_ORDER,
} from "@/types/text-templates";
import { cn } from "@/utils/ui";
import { loadFullFont } from "@/lib/fonts/google-fonts";

export function TextView() {
	const { playback, timeline, scenes } = useManagers("playback", "timeline", "scenes");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] =
		useState<TextTemplateCategory | "all">("all");

	const handleAddDefaultText = useCallback(
		({ currentTime }: { currentTime: number }) => {
			const activeScene = scenes.getActiveScene();
			if (!activeScene) return;

			const element = buildTextElement({
				raw: DEFAULT_TEXT_ELEMENT,
				startTime: currentTime,
			});

			timeline.insertElement({
				element,
				placement: { mode: "auto" },
			});
		},
		[scenes, timeline],
	);

	const handleApplyTemplate = useCallback(
		({ template }: { template: TextTemplate }) => {
			const activeScene = scenes.getActiveScene();
			if (!activeScene) return;

			/* Ensure the template's font is loaded before rendering */
			if (template.style.fontFamily) {
				loadFullFont({ family: template.style.fontFamily });
			}

			const currentTime = playback.getCurrentTime();
			const element = applyTextTemplate({ template, startTime: currentTime });

			timeline.insertElement({
				element,
				placement: { mode: "auto" },
			});
		},
		[scenes, timeline],
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

	/* Group templates by category for display */
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
		<PanelView title="Text">
			{/* Default text element */}
			<div className="mb-3">
				<DraggableItem
					name="Default text"
					preview={
						<div className="bg-accent flex size-full items-center justify-center rounded">
							<span className="text-xs select-none">Default text</span>
						</div>
					}
					dragData={{
						id: "temp-text-id",
						type: DEFAULT_TEXT_ELEMENT.type,
						name: DEFAULT_TEXT_ELEMENT.name,
						content: DEFAULT_TEXT_ELEMENT.content,
					}}
					aspectRatio={1}
					onAddToTimeline={handleAddDefaultText}
					shouldShowLabel={false}
				/>
			</div>

			{/* Search bar */}
			<div className="mb-2 px-1">
				<Input
					placeholder="Search templates..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="h-8 text-xs"
				/>
			</div>

			{/* Category tabs */}
			<div className="scrollbar-thin mb-2 flex gap-1 overflow-x-auto px-1">
				<CategoryTab
					label="All"
					isActive={selectedCategory === "all"}
					onClick={() => setSelectedCategory("all")}
				/>
				{TEXT_TEMPLATE_CATEGORY_ORDER.map((category) => (
					<CategoryTab
						key={category}
						label={TEXT_TEMPLATE_CATEGORY_LABELS[category]}
						isActive={selectedCategory === category}
						onClick={() => setSelectedCategory(category)}
					/>
				))}
			</div>

			{/* Template grid grouped by category */}
			<div className="space-y-3 px-1 pb-4">
				{groupedTemplates.map(({ category, templates }) => (
					<div key={category}>
						{selectedCategory === "all" && (
							<h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
								{TEXT_TEMPLATE_CATEGORY_LABELS[category]}
							</h3>
						)}
						<div className="grid grid-cols-2 gap-1.5">
							{templates.map((template) => (
								<TemplateCard
									key={template.id}
									template={template}
									onApply={handleApplyTemplate}
								/>
							))}
						</div>
					</div>
				))}

				{filteredTemplates.length === 0 && (
					<div className="text-muted-foreground flex items-center justify-center py-8 text-xs">
						No templates found
					</div>
				)}
			</div>
		</PanelView>
	);
}

function CategoryTab({
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

function TemplateCard({
	template,
	onApply,
}: {
	template: TextTemplate;
	onApply: ({ template }: { template: TextTemplate }) => void;
}) {
	const style = template.style;

	/* Inline preview that approximates the template's look */
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
		textDecoration:
			style.textDecoration === "underline"
				? "underline"
				: style.textDecoration === "line-through"
					? "line-through"
					: "none",
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
			className="bg-zinc-900 hover:bg-zinc-800 hover:ring-primary/50 group flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-md transition-all hover:ring-1"
			title={template.name}
		>
			<div className="flex flex-col items-center gap-0.5 p-1">
				<span
					className="max-w-full select-none truncate leading-tight"
					style={previewStyle}
				>
					{hasBg ? (
						<span style={bgStyle}>
							{style.content ?? template.name}
						</span>
					) : (
						(style.content ?? template.name)
					)}
				</span>
				<span className="text-muted-foreground text-[9px] opacity-0 transition-opacity group-hover:opacity-100">
					{template.name}
				</span>
			</div>
		</button>
	);
}

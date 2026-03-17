import type { TextTemplate, TextTemplateCategory } from "@/types/text-templates";
import { BUILT_IN_TEXT_TEMPLATES } from "./built-in-templates";

/** All registered text templates (built-in + user-added in the future) */
const templates: TextTemplate[] = [...BUILT_IN_TEXT_TEMPLATES];

/** Get all available text templates */
export function getAllTextTemplates(): TextTemplate[] {
	return templates;
}

/** Get a single template by ID */
export function getTextTemplate({
	templateId,
}: {
	templateId: string;
}): TextTemplate | undefined {
	return templates.find((t) => t.id === templateId);
}

/** Get templates filtered by category */
export function getTextTemplatesByCategory({
	category,
}: {
	category: TextTemplateCategory;
}): TextTemplate[] {
	return templates.filter((t) => t.category === category);
}

/** Search templates by name (case-insensitive substring match) */
export function searchTextTemplates({
	query,
}: {
	query: string;
}): TextTemplate[] {
	const lowerQuery = query.toLowerCase().trim();
	if (!lowerQuery) return templates;
	return templates.filter((t) => t.name.toLowerCase().includes(lowerQuery));
}

/** Get unique categories that have at least one template */
export function getAvailableCategories(): TextTemplateCategory[] {
	const seen = new Set<TextTemplateCategory>();
	for (const t of templates) {
		seen.add(t.category);
	}
	return [...seen];
}

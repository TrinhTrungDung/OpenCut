import type { TransitionDefinition } from "@/types/transitions";

const transitionDefinitions = new Map<string, TransitionDefinition>();

export function registerTransition({
	definition,
}: {
	definition: TransitionDefinition;
}): void {
	transitionDefinitions.set(definition.type, definition);
}

export function hasTransition({
	transitionType,
}: {
	transitionType: string;
}): boolean {
	return transitionDefinitions.has(transitionType);
}

export function getTransition({
	transitionType,
}: {
	transitionType: string;
}): TransitionDefinition {
	const definition = transitionDefinitions.get(transitionType);
	if (!definition) {
		throw new Error(`Unknown transition type: ${transitionType}`);
	}
	return definition;
}

export function getAllTransitions(): TransitionDefinition[] {
	return Array.from(transitionDefinitions.values());
}

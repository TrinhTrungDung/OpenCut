import { hasEffect, registerEffect } from "../registry";
import { backgroundRemovalEffectDefinition } from "./background-removal";
import { blurEffectDefinition } from "./blur";
import { colorCorrectionEffectDefinition } from "./color-correction";

const defaultEffects = [
	blurEffectDefinition,
	colorCorrectionEffectDefinition,
	backgroundRemovalEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (hasEffect({ effectType: definition.type })) {
			continue;
		}
		registerEffect({ definition });
	}
}

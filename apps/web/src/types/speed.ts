/** Bezier control point for speed ramping curves */
export interface SpeedCurvePoint {
	/** Normalized position within element (0-1) */
	position: number;
	/** Speed multiplier at this point (0.1-100) */
	speed: number;
	/** Bezier handle in (relative offset) */
	controlIn?: { x: number; y: number };
	/** Bezier handle out (relative offset) */
	controlOut?: { x: number; y: number };
}

export const DEFAULT_SPEED = 1.0;
export const MIN_SPEED = 0.1;
export const MAX_SPEED = 100;

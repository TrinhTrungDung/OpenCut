/**
 * Pre-computed lookup table for speed curve evaluation.
 * Integrates the speed curve to build a source-time mapping table,
 * enabling fast binary search at render time.
 */

import type { SpeedCurvePoint } from "@/types/speed";
import { MIN_SPEED } from "@/types/speed";
import { cubicBezier, solveCubicBezierX } from "./bezier";

const LUT_RESOLUTION = 256;

export class SpeedCurveLUT {
	/** Maps normalized position (index/RESOLUTION) -> cumulative source fraction */
	private sourceTimeTable: Float32Array;
	/** Speed values at each sample point */
	private speedTable: Float32Array;
	/** Total integrated speed (used to normalize) */
	private totalIntegral: number;

	constructor(curvePoints: SpeedCurvePoint[]) {
		this.sourceTimeTable = new Float32Array(LUT_RESOLUTION + 1);
		this.speedTable = new Float32Array(LUT_RESOLUTION + 1);
		this.totalIntegral = 0;
		this.buildTable(curvePoints);
	}

	/** Get the source time fraction (0-1) for a given normalized timeline position */
	getSourceFraction(normalizedPos: number): number {
		if (normalizedPos <= 0) return 0;
		if (normalizedPos >= 1) return 1;

		// Binary search in the sourceTimeTable
		const target = normalizedPos * this.totalIntegral;
		let lo = 0;
		let hi = LUT_RESOLUTION;

		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (this.sourceTimeTable[mid] < target) {
				lo = mid + 1;
			} else {
				hi = mid;
			}
		}

		// Linearly interpolate between lo-1 and lo
		if (lo === 0) return 0;

		const prevVal = this.sourceTimeTable[lo - 1];
		const currVal = this.sourceTimeTable[lo];
		const range = currVal - prevVal;

		const frac = range > 0 ? (target - prevVal) / range : 0;
		const index = (lo - 1 + frac) / LUT_RESOLUTION;

		return Math.max(0, Math.min(1, index));
	}

	/** Get the interpolated speed at a normalized position */
	getSpeedAt(normalizedPos: number): number {
		if (normalizedPos <= 0) return this.speedTable[0];
		if (normalizedPos >= 1) return this.speedTable[LUT_RESOLUTION];

		const exactIndex = normalizedPos * LUT_RESOLUTION;
		const lo = Math.floor(exactIndex);
		const hi = Math.min(lo + 1, LUT_RESOLUTION);
		const frac = exactIndex - lo;

		return this.speedTable[lo] * (1 - frac) + this.speedTable[hi] * frac;
	}

	/** Average speed across the entire curve */
	averageSpeed(): number {
		return this.totalIntegral;
	}

	private buildTable(points: SpeedCurvePoint[]): void {
		if (points.length === 0) {
			// No points: constant speed of 1
			for (let i = 0; i <= LUT_RESOLUTION; i++) {
				this.speedTable[i] = 1;
				this.sourceTimeTable[i] = i / LUT_RESOLUTION;
			}
			this.totalIntegral = 1;
			return;
		}

		// Sort points by position
		const sorted = [...points].sort((a, b) => a.position - b.position);

		// Sample speed at each LUT position
		for (let i = 0; i <= LUT_RESOLUTION; i++) {
			const pos = i / LUT_RESOLUTION;
			this.speedTable[i] = Math.max(MIN_SPEED, this.sampleSpeed(pos, sorted));
		}

		// Integrate using trapezoidal rule
		this.sourceTimeTable[0] = 0;
		for (let i = 1; i <= LUT_RESOLUTION; i++) {
			const dt = 1 / LUT_RESOLUTION;
			const avgSpeed = (this.speedTable[i - 1] + this.speedTable[i]) / 2;
			this.sourceTimeTable[i] = this.sourceTimeTable[i - 1] + avgSpeed * dt;
		}

		this.totalIntegral = this.sourceTimeTable[LUT_RESOLUTION];
	}

	/** Sample speed at a normalized position by interpolating between curve points */
	private sampleSpeed(pos: number, points: SpeedCurvePoint[]): number {
		if (points.length === 1) return points[0].speed;

		// Before first point: use first point's speed
		if (pos <= points[0].position) return points[0].speed;

		// After last point: use last point's speed
		if (pos >= points[points.length - 1].position) {
			return points[points.length - 1].speed;
		}

		// Find surrounding points
		let leftIdx = 0;
		for (let i = 0; i < points.length - 1; i++) {
			if (pos >= points[i].position && pos <= points[i + 1].position) {
				leftIdx = i;
				break;
			}
		}

		const left = points[leftIdx];
		const right = points[leftIdx + 1];
		const segmentRange = right.position - left.position;

		if (segmentRange <= 0) return left.speed;

		const localT = (pos - left.position) / segmentRange;

		// If control handles exist, use bezier interpolation for speed
		if (left.controlOut && right.controlIn) {
			const cx1 = Math.max(0, Math.min(1, left.controlOut.x));
			const cx2 = Math.max(0, Math.min(1, 1 + right.controlIn.x));
			const t = solveCubicBezierX(localT, cx1, cx2);
			const cy1 = left.speed + (left.controlOut.y ?? 0);
			const cy2 = right.speed + (right.controlIn.y ?? 0);
			return cubicBezier(t, left.speed, cy1, cy2, right.speed);
		}

		// Linear interpolation fallback
		return left.speed + (right.speed - left.speed) * localT;
	}
}

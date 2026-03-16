/**
 * Cubic bezier evaluation utilities for speed curves.
 * Used to interpolate speed values between control points.
 */

/** Evaluate a cubic bezier at parameter t (0-1) */
export function cubicBezier(
	t: number,
	p0: number,
	p1: number,
	p2: number,
	p3: number,
): number {
	const mt = 1 - t;
	return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

/**
 * Find the bezier parameter t for a given x value using Newton-Raphson iteration.
 * x1, x2 are the x-coordinates of the two interior control points (p0.x=0, p3.x=1).
 */
export function solveCubicBezierX(
	x: number,
	x1: number,
	x2: number,
	epsilon = 1e-6,
): number {
	// Clamp input
	if (x <= 0) return 0;
	if (x >= 1) return 1;

	let t = x; // Initial guess

	// Newton-Raphson iterations
	for (let i = 0; i < 12; i++) {
		const currentX = cubicBezier(t, 0, x1, x2, 1);
		const error = currentX - x;

		if (Math.abs(error) < epsilon) return t;

		// Derivative of cubic bezier with respect to t
		const mt = 1 - t;
		const dx = 3 * mt * mt * x1 + 6 * mt * t * (x2 - x1) + 3 * t * t * (1 - x2);

		if (Math.abs(dx) < 1e-10) break;

		t -= error / dx;
		t = Math.max(0, Math.min(1, t));
	}

	// Fallback: bisection search
	let lo = 0;
	let hi = 1;
	t = x;

	while (hi - lo > epsilon) {
		const currentX = cubicBezier(t, 0, x1, x2, 1);
		if (currentX < x) {
			lo = t;
		} else {
			hi = t;
		}
		t = (lo + hi) / 2;
	}

	return t;
}

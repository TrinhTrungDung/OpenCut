/**
 * CPU-side 4x4 color matrix builder for color correction.
 * Returns a 16-element column-major array (mat4 for WebGL).
 *
 * Combined matrix: M = Exposure * Contrast * Saturation
 * Brightness is applied as an offset in the translation column.
 */

// BT.709 luminance weights
const LUM_R = 0.2126;
const LUM_G = 0.7152;
const LUM_B = 0.0722;

/** Multiply two 4x4 column-major matrices: result = A * B */
function mul4(a: number[], b: number[]): number[] {
	const r = new Array<number>(16).fill(0);
	for (let col = 0; col < 4; col++) {
		for (let row = 0; row < 4; row++) {
			r[col * 4 + row] =
				a[row] * b[col * 4] +
				a[4 + row] * b[col * 4 + 1] +
				a[8 + row] * b[col * 4 + 2] +
				a[12 + row] * b[col * 4 + 3];
		}
	}
	return r;
}

// prettier-ignore
const IDENTITY: number[] = [
	1, 0, 0, 0,
	0, 1, 0, 0,
	0, 0, 1, 0,
	0, 0, 0, 1,
];

function saturationMatrix(saturation: number): number[] {
	// saturation: -100..100 -> factor 0..2
	const s = 1 + saturation / 100;
	const sr = (1 - s) * LUM_R;
	const sg = (1 - s) * LUM_G;
	const sb = (1 - s) * LUM_B;
	// prettier-ignore
	return [
		sr + s, sr,     sr,     0,
		sg,     sg + s, sg,     0,
		sb,     sb,     sb + s, 0,
		0,      0,      0,      1,
	];
}

function contrastMatrix(contrast: number): number[] {
	// contrast: -100..100 -> scale factor; offset to keep 0.5 midpoint
	const c = 1 + contrast / 100;
	const t = 0.5 * (1 - c);
	// prettier-ignore
	return [
		c, 0, 0, 0,
		0, c, 0, 0,
		0, 0, c, 0,
		t, t, t, 1,
	];
}

function exposureMatrix(exposure: number): number[] {
	const e = Math.pow(2, exposure / 100);
	// prettier-ignore
	return [
		e, 0, 0, 0,
		0, e, 0, 0,
		0, 0, e, 0,
		0, 0, 0, 1,
	];
}

export function buildColorMatrix({
	brightness,
	contrast,
	exposure,
	saturation,
}: {
	brightness: number;
	contrast: number;
	exposure: number;
	saturation: number;
}): number[] {
	const b = brightness / 100;

	let m = IDENTITY;
	m = mul4(m, saturationMatrix(saturation));
	m = mul4(m, contrastMatrix(contrast));
	m = mul4(m, exposureMatrix(exposure));

	// Apply brightness as offset in translation column (column 3, rows 0-2)
	m[12] += b;
	m[13] += b;
	m[14] += b;

	return m;
}

"use client";

export function SpeedBadge({ speed }: { speed?: number }) {
	if (!speed || speed === 1) return null;

	const label =
		speed >= 10
			? `${Math.round(speed)}x`
			: speed >= 1
				? `${speed.toFixed(1)}x`
				: `${speed.toFixed(2)}x`;

	return (
		<span className="absolute top-1 right-1 px-1 py-0.5 text-[10px] font-medium bg-blue-500/80 text-white rounded-sm leading-none">
			{label}
		</span>
	);
}

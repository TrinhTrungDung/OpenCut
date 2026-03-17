import { useEffect, useState } from "react";
import {
	hasProxy,
	isGeneratingProxy,
	onProxyProgress,
} from "@/services/proxy/proxy-cache";

/**
 * Returns proxy generation progress for a media asset.
 * - null: not a video / no proxy needed
 * - 0-99: generating
 * - 100: ready
 */
export function useProxyProgress({
	mediaAssetId,
}: {
	mediaAssetId: string | null;
}): number | null {
	const [progress, setProgress] = useState<number | null>(() => {
		if (!mediaAssetId) return null;
		if (hasProxy({ mediaAssetId })) return 100;
		if (isGeneratingProxy({ mediaAssetId })) return 0;
		return null;
	});

	useEffect(() => {
		if (!mediaAssetId) return;

		// Check if already done
		if (hasProxy({ mediaAssetId })) {
			setProgress(100);
			return;
		}

		if (!isGeneratingProxy({ mediaAssetId })) {
			setProgress(null);
			return;
		}

		setProgress(0);

		const unsubscribe = onProxyProgress({
			mediaAssetId,
			listener: (p) => {
				setProgress(p);
				if (p >= 100) {
					setProgress(100);
				}
			},
		});

		return unsubscribe;
	}, [mediaAssetId]);

	return progress;
}

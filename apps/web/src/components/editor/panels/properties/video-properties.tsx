import type {
	ImageElement,
	StickerElement,
	VideoElement,
} from "@/types/timeline";
import { BlendingSection, TransformSection } from "./sections";
import { SpeedSection } from "./sections/speed";
import { ColorCorrectionSection } from "./sections/color-correction";

export function VideoProperties({
	element,
	trackId,
}: {
	element: VideoElement | ImageElement | StickerElement;
	trackId: string;
}) {
	return (
		<div className="flex h-full flex-col">
			<TransformSection
				element={element}
				trackId={trackId}
				showTopBorder={false}
			/>
			<BlendingSection element={element} trackId={trackId} />
			{element.type === "video" && (
				<SpeedSection element={element} trackId={trackId} />
			)}
			{(element.type === "video" || element.type === "image") && (
				<ColorCorrectionSection element={element} trackId={trackId} />
			)}
		</div>
	);
}

import type { TimelineTrack, VideoTrack } from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import { RootNode } from "./nodes/root-node";
import { VideoNode } from "./nodes/video-node";
import { ImageNode } from "./nodes/image-node";
import { TextNode } from "./nodes/text-node";
import { StickerNode } from "./nodes/sticker-node";
import { ColorNode } from "./nodes/color-node";
import { CompositeEffectNode } from "./nodes/composite-effect-node";
import { EffectLayerNode } from "./nodes/effect-layer-node";
import { TransitionNode } from "./nodes/transition-node";
import type { BaseNode } from "./nodes/base-node";
import type { VisualNode } from "./nodes/visual-node";
import type { TBackground, TCanvasSize } from "@/types/project";
import { DEFAULT_BLUR_INTENSITY } from "@/constants/project-constants";
import { isMainTrack } from "@/lib/timeline";
import { getProxyFile } from "@/services/proxy/proxy-cache";

const PREVIEW_MAX_IMAGE_SIZE = 2048;
const BLUR_BACKGROUND_ZOOM_SCALE = 1.4;

function getVisibleSortedElements({
	track,
}: {
	track: TimelineTrack;
}) {
	return track.elements
		.filter((element) => !("hidden" in element && element.hidden))
		.slice()
		.sort((a, b) => {
			if (a.startTime !== b.startTime) return a.startTime - b.startTime;
			return a.id.localeCompare(b.id);
		});
}

function buildVisualNodeForElement({
	element,
	mediaMap,
	canvasSize,
	isPreview,
}: {
	element: ReturnType<typeof getVisibleSortedElements>[number];
	mediaMap: Map<string, MediaAsset>;
	canvasSize: TCanvasSize;
	isPreview?: boolean;
}): VisualNode | null {
	if (element.type !== "video" && element.type !== "image") return null;

	const mediaAsset = mediaMap.get(element.mediaId);
	if (!mediaAsset?.file || !mediaAsset?.url) return null;

	if (mediaAsset.type === "video") {
		// Use proxy file for preview (540p, fast decode) — original for export
		const proxyFile = isPreview
			? getProxyFile({ mediaAssetId: mediaAsset.id })
			: null;
		const useProxy = !!proxyFile;

		return new VideoNode({
			mediaId: useProxy ? `${mediaAsset.id}:proxy` : mediaAsset.id,
			url: mediaAsset.url,
			file: useProxy ? proxyFile : mediaAsset.file,
			duration: element.duration,
			timeOffset: element.startTime,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			transform: element.transform,
			animations: element.animations,
			opacity: element.opacity,
			blendMode: element.blendMode,
			effects: element.effects,
			speed: element.speed,
			speedCurve: element.type === "video" ? element.speedCurve : undefined,
			elementId: element.id,
			sourceDuration: element.sourceDuration,
		});
	}

	if (mediaAsset.type === "image") {
		return new ImageNode({
			url: mediaAsset.url,
			duration: element.duration,
			timeOffset: element.startTime,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			transform: element.transform,
			animations: element.animations,
			opacity: element.opacity,
			blendMode: element.blendMode,
			effects: element.effects,
			speed: element.speed,
			elementId: element.id,
			sourceDuration: element.sourceDuration,
			...(isPreview && { maxSourceSize: PREVIEW_MAX_IMAGE_SIZE }),
		});
	}

	return null;
}

function buildTrackNodes({
	tracks,
	mediaMap,
	canvasSize,
	isPreview,
}: {
	tracks: TimelineTrack[];
	mediaMap: Map<string, MediaAsset>;
	canvasSize: TCanvasSize;
	isPreview?: boolean;
}): BaseNode[] {
	const nodes: BaseNode[] = [];

	for (const track of tracks) {
		const elements = getVisibleSortedElements({ track });

		// Build a map of element ID -> transition for this track
		const transitions =
			track.type === "video"
				? (track as VideoTrack).transitions ?? []
				: [];

		// Set of element IDs that participate in a transition (handled by TransitionNode)
		const transitionHandledIds = new Set<string>();

		// Pre-build visual nodes keyed by element ID for transition pairing
		const visualNodeMap = new Map<string, VisualNode>();
		if (transitions.length > 0) {
			for (const element of elements) {
				if (element.type === "video" || element.type === "image") {
					const node = buildVisualNodeForElement({
						element,
						mediaMap,
						canvasSize,
						isPreview,
					});
					if (node) {
						visualNodeMap.set(element.id, node);
					}
				}
			}

			// Create TransitionNodes for each transition
			for (const transition of transitions) {
				const nodeA = visualNodeMap.get(transition.elementAId);
				const nodeB = visualNodeMap.get(transition.elementBId);
				const elementA = elements.find(
					(e) => e.id === transition.elementAId,
				);

				if (nodeA && nodeB && elementA) {
					const elementAEnd =
						elementA.startTime + elementA.duration;
					nodes.push(
						new TransitionNode({
							transition,
							elementAEnd,
							nodeA,
							nodeB,
						}),
					);
					transitionHandledIds.add(transition.elementAId);
					transitionHandledIds.add(transition.elementBId);
				}
			}
		}

		for (const element of elements) {
			if (element.type === "effect") {
				nodes.push(
					new EffectLayerNode({
						effectType: element.effectType,
						effectParams: element.params,
						timeOffset: element.startTime,
						duration: element.duration,
					}),
				);
				continue;
			}

			// Skip elements already handled by TransitionNode
			if (transitionHandledIds.has(element.id)) {
				continue;
			}

			if (element.type === "video" || element.type === "image") {
				const node = buildVisualNodeForElement({
					element,
					mediaMap,
					canvasSize,
					isPreview,
				});
				if (node) {
					nodes.push(node);
				}
			}

			if (element.type === "text") {
				nodes.push(
					new TextNode({
						...element,
						canvasCenter: { x: canvasSize.width / 2, y: canvasSize.height / 2 },
						canvasHeight: canvasSize.height,
						textBaseline: "middle",
						effects: element.effects,
					}),
				);
			}

			if (element.type === "sticker") {
				nodes.push(
					new StickerNode({
						stickerId: element.stickerId,
						duration: element.duration,
						timeOffset: element.startTime,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						transform: element.transform,
						animations: element.animations,
						opacity: element.opacity,
						blendMode: element.blendMode,
						effects: element.effects,
					}),
				);
			}
		}
	}

	return nodes;
}

export type BuildSceneParams = {
	canvasSize: TCanvasSize;
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	background: TBackground;
	isPreview?: boolean;
};

export function buildScene({
	canvasSize,
	tracks,
	mediaAssets,
	duration,
	background,
	isPreview,
}: BuildSceneParams) {
	const rootNode = new RootNode({ duration });
	const mediaMap = new Map(mediaAssets.map((m) => [m.id, m]));

	const visibleTracks = tracks.filter(
		(track) => !("hidden" in track && track.hidden),
	);

	const orderedTracksTopToBottom = [
		...visibleTracks.filter((track) => !isMainTrack(track)),
		...visibleTracks.filter((track) => isMainTrack(track)),
	];

	const orderedTracksBottomToTop = orderedTracksTopToBottom.slice().reverse();

	const allNodes = buildTrackNodes({
		tracks: orderedTracksBottomToTop,
		mediaMap,
		canvasSize,
		isPreview,
	});

	if (background.type === "blur") {
		rootNode.add(
			new CompositeEffectNode({
				contentNodes: allNodes.filter(
					(node) => !(node instanceof EffectLayerNode),
				),
				effectType: "blur",
				effectParams: {
					intensity:
						background.blurIntensity ?? DEFAULT_BLUR_INTENSITY,
				},
				scale: BLUR_BACKGROUND_ZOOM_SCALE,
			}),
		);
	} else if (background.type === "color" && background.color !== "transparent") {
		rootNode.add(new ColorNode({ color: background.color }));
	}

	for (const node of allNodes) {
		rootNode.add(node);
	}

	return rootNode;
}

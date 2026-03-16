"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { MediaDragOverlay } from "@/components/editor/panels/assets/drag-overlay";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { useEditor } from "@/hooks/use-editor";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRevealItem } from "@/hooks/use-reveal-item";
import { processMediaAssets } from "@/lib/media/processing";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import { setDragData, clearDragData } from "@/lib/drag-data";
import {
	type MediaSortKey,
	type MediaSortOrder,
	type MediaViewMode,
	useAssetsPanelStore,
} from "@/stores/assets-panel-store";
import { useMediaPreviewStore } from "@/stores/media-preview-store";
import type { MediaAsset } from "@/types/assets";
import { cn } from "@/utils/ui";
import {
	CloudUploadIcon,
	GridViewIcon,
	LeftToRightListDashIcon,
	SortingOneNineIcon,
	Image02Icon,
	MusicNote03Icon,
	Video01Icon,
	PauseIcon,
	PlayIcon,
	Cancel01Icon,
	PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useEffect, useRef } from "react";

export function MediaView() {
	const editor = useEditor();
	const mediaFiles = editor.media.getAssets();
	const activeProject = editor.project.getActive();

	const {
		mediaViewMode,
		setMediaViewMode,
		highlightMediaId,
		clearHighlight,
		mediaSortBy,
		mediaSortOrder,
		setMediaSort,
	} = useAssetsPanelStore();
	const { highlightedId, registerElement } = useRevealItem(
		highlightMediaId,
		clearHighlight,
	);

	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);

	const processFiles = async ({ files }: { files: FileList }) => {
		if (!files || files.length === 0) return;
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		try {
			const processedAssets = await processMediaAssets({
				files,
				onProgress: (progress: { progress: number }) =>
					setProgress(progress.progress),
			});
			for (const asset of processedAssets) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
			}
		} catch (error) {
			console.error("Error processing files:", error);
			toast.error("Failed to process files");
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	const { isDragOver, dragProps, openFilePicker, fileInputProps } =
		useFileUpload({
			accept: "image/*,video/*,audio/*",
			multiple: true,
			onFilesSelected: (files) => processFiles({ files }),
		});

	const handleRemove = async ({
		event,
		id,
	}: {
		event: React.MouseEvent;
		id: string;
	}) => {
		event.stopPropagation();

		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		await editor.media.removeMediaAsset({
			projectId: activeProject.metadata.id,
			id,
		});
	};

	const handleSort = ({ key }: { key: MediaSortKey }) => {
		if (mediaSortBy === key) {
			setMediaSort(key, mediaSortOrder === "asc" ? "desc" : "asc");
		} else {
			setMediaSort(key, "asc");
		}
	};

	const setPreviewAsset = useMediaPreviewStore((s) => s.setPreviewAsset);

	const handlePreview = useCallback(
		({ asset }: { asset: MediaAsset }) => {
			if (asset.type === "video" && asset.url) {
				setPreviewAsset({ asset });
			}
		},
		[setPreviewAsset],
	);

	const filteredMediaItems = useMemo(() => {
		const filtered = mediaFiles.filter((item) => !item.ephemeral);

		filtered.sort((a, b) => {
			let valueA: string | number;
			let valueB: string | number;

			switch (mediaSortBy) {
				case "name":
					valueA = a.name.toLowerCase();
					valueB = b.name.toLowerCase();
					break;
				case "type":
					valueA = a.type;
					valueB = b.type;
					break;
				case "duration":
					valueA = a.duration || 0;
					valueB = b.duration || 0;
					break;
				case "size":
					valueA = a.file.size;
					valueB = b.file.size;
					break;
				default:
					return 0;
			}

			if (valueA < valueB) return mediaSortOrder === "asc" ? -1 : 1;
			if (valueA > valueB) return mediaSortOrder === "asc" ? 1 : -1;
			return 0;
		});

		return filtered;
	}, [mediaFiles, mediaSortBy, mediaSortOrder]);

	return (
		<>
			<input {...fileInputProps} />

			<PanelView
				title="Assets"
				actions={
					<MediaActions
						mediaViewMode={mediaViewMode}
						setMediaViewMode={setMediaViewMode}
						isProcessing={isProcessing}
						sortBy={mediaSortBy}
						sortOrder={mediaSortOrder}
						onSort={handleSort}
						onImport={openFilePicker}
					/>
				}
				className={cn(isDragOver && "bg-accent/30")}
				{...dragProps}
			>
				{isDragOver || filteredMediaItems.length === 0 ? (
					<MediaDragOverlay
						isVisible={true}
						isProcessing={isProcessing}
						progress={progress}
						onClick={openFilePicker}
					/>
				) : (
					<>
						<MediaMiniPlayer />
						<MediaItemList
							items={filteredMediaItems}
							mode={mediaViewMode}
							onRemove={handleRemove}
							onPreview={handlePreview}
							highlightedId={highlightedId}
							registerElement={registerElement}
						/>
					</>
				)}
			</PanelView>
		</>
	);
}

function MediaAssetDraggable({
	item,
	preview,
	isHighlighted,
	variant,
	isRounded,
	onPreview,
}: {
	item: MediaAsset;
	preview: React.ReactNode;
	isHighlighted: boolean;
	variant: "card" | "compact";
	isRounded?: boolean;
	onPreview?: ({ asset }: { asset: MediaAsset }) => void;
}) {
	const editor = useEditor();

	const addElementAtTime = ({
		asset,
		startTime,
	}: {
		asset: MediaAsset;
		startTime: number;
	}) => {
		const duration =
			asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		const element = buildElementFromMedia({
			mediaId: asset.id,
			mediaType: asset.type,
			name: asset.name,
			duration,
			startTime,
		});
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	const handleClick = useCallback(() => {
		if (item.type === "video" && onPreview) {
			onPreview({ asset: item });
		}
	}, [item, onPreview]);

	const wrappedPreview =
		item.type === "video" ? (
			<div className="relative size-full" onClick={handleClick}>
				{preview}
			</div>
		) : (
			preview
		);

	return (
		<DraggableItem
			name={item.name}
			preview={wrappedPreview}
			dragData={{
				id: item.id,
				type: "media",
				mediaType: item.type,
				name: item.name,
				...(item.type !== "audio" && {
					targetElementTypes: ["video", "image"] as const,
				}),
			}}
			shouldShowPlusOnDrag={false}
			onAddToTimeline={({ currentTime }) =>
				addElementAtTime({ asset: item, startTime: currentTime })
			}
			variant={variant}
			isRounded={isRounded}
			isHighlighted={isHighlighted}
		/>
	);
}

function MediaItemWithContextMenu({
	item,
	children,
	onRemove,
}: {
	item: MediaAsset;
	children: React.ReactNode;
	onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem>Export clips</ContextMenuItem>
				<ContextMenuItem
					variant="destructive"
					onClick={(event) => onRemove({ event, id: item.id })}
				>
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function MediaItemList({
	items,
	mode,
	onRemove,
	onPreview,
	highlightedId,
	registerElement,
}: {
	items: MediaAsset[];
	mode: MediaViewMode;
	onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
	onPreview: ({ asset }: { asset: MediaAsset }) => void;
	highlightedId: string | null;
	registerElement: (id: string, element: HTMLElement | null) => void;
}) {
	const isGrid = mode === "grid";

	return (
		<div
			className={cn(isGrid ? "grid gap-2" : "flex flex-col gap-1")}
			style={
				isGrid ? { gridTemplateColumns: "repeat(auto-fill, 160px)" } : undefined
			}
		>
			{items.map((item) => (
				<div key={item.id} ref={(element) => registerElement(item.id, element)}>
					<MediaItemWithContextMenu item={item} onRemove={onRemove}>
						<MediaAssetDraggable
							item={item}
							preview={
								<MediaPreview
									item={item}
									variant={isGrid ? "grid" : "compact"}
								/>
							}
							variant={isGrid ? "card" : "compact"}
							isRounded={isGrid ? false : undefined}
							isHighlighted={highlightedId === item.id}
							onPreview={onPreview}
						/>
					</MediaItemWithContextMenu>
				</div>
			))}
		</div>
	);
}

export function formatDuration({ duration }: { duration: number }) {
	const min = Math.floor(duration / 60);
	const sec = Math.floor(duration % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function MediaDurationBadge({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white">
			{formatDuration({ duration })}
		</div>
	);
}

function MediaDurationLabel({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<span className="text-xs opacity-70">{formatDuration({ duration })}</span>
	);
}

function MediaTypePlaceholder({
	icon,
	label,
	duration,
	variant,
}: {
	icon: IconSvgElement;
	label: string;
	duration?: number;
	variant: "muted" | "bordered";
}) {
	const iconClassName = cn("size-6", variant === "bordered" && "mb-1");

	return (
		<div
			className={cn(
				"text-muted-foreground flex size-full flex-col items-center justify-center rounded",
				variant === "muted" ? "bg-muted/30" : "border",
			)}
		>
			<HugeiconsIcon icon={icon} className={iconClassName} />
			<span className="text-xs">{label}</span>
			<MediaDurationLabel duration={duration} />
		</div>
	);
}

function MediaVideoPreview({
	item,
	shouldShowDurationBadge,
}: {
	item: MediaAsset;
	shouldShowDurationBadge: boolean;
}) {
	if (item.thumbnailUrl) {
		return (
			<div className="relative size-full">
				<Image
					src={item.thumbnailUrl}
					alt={item.name}
					fill
					sizes="100vw"
					className="rounded object-cover"
					loading="lazy"
					unoptimized
				/>
				{shouldShowDurationBadge ? (
					<MediaDurationBadge duration={item.duration} />
				) : null}
			</div>
		);
	}

	return (
		<MediaTypePlaceholder
			icon={Video01Icon}
			label="Video"
			duration={item.duration}
			variant="muted"
		/>
	);
}

function MediaPreview({
	item,
	variant = "grid",
}: {
	item: MediaAsset;
	variant?: "grid" | "compact";
}) {
	const shouldShowDurationBadge = variant === "grid";

	if (item.type === "image") {
		return (
			<div className="relative flex size-full items-center justify-center">
				<Image
					src={item.url ?? ""}
					alt={item.name}
					fill
					sizes="100vw"
					className="object-cover"
					loading="lazy"
					unoptimized
				/>
			</div>
		);
	}

	if (item.type === "video") {
		return (
			<MediaVideoPreview
				item={item}
				shouldShowDurationBadge={shouldShowDurationBadge}
			/>
		);
	}

	if (item.type === "audio") {
		return (
			<MediaTypePlaceholder
				icon={MusicNote03Icon}
				label="Audio"
				duration={item.duration}
				variant="bordered"
			/>
		);
	}

	return (
		<MediaTypePlaceholder icon={Image02Icon} label="Unknown" variant="muted" />
	);
}

function MediaActions({
	mediaViewMode,
	setMediaViewMode,
	isProcessing,
	sortBy,
	sortOrder,
	onSort,
	onImport,
}: {
	mediaViewMode: MediaViewMode;
	setMediaViewMode: (mode: MediaViewMode) => void;
	isProcessing: boolean;
	sortBy: MediaSortKey;
	sortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
	onImport: () => void;
}) {
	return (
		<div className="flex gap-1.5">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							size="icon"
							variant="ghost"
							onClick={() =>
								setMediaViewMode(mediaViewMode === "grid" ? "list" : "grid")
							}
							disabled={isProcessing}
							className="items-center justify-center"
						>
							{mediaViewMode === "grid" ? (
								<HugeiconsIcon icon={LeftToRightListDashIcon} />
							) : (
								<HugeiconsIcon icon={GridViewIcon} />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>
							{mediaViewMode === "grid"
								? "Switch to list view"
								: "Switch to grid view"}
						</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<DropdownMenu>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									disabled={isProcessing}
									className="items-center justify-center"
								>
									<HugeiconsIcon icon={SortingOneNineIcon} />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<DropdownMenuContent align="end">
							<SortMenuItem
								label="Name"
								sortKey="name"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Type"
								sortKey="type"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Duration"
								sortKey="duration"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="File size"
								sortKey="size"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
					<TooltipContent>
						<p>
							Sort by {sortBy} (
							{sortOrder === "asc" ? "ascending" : "descending"})
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<Button
				variant="outline"
				onClick={onImport}
				disabled={isProcessing}
				size="sm"
				className="items-center justify-center gap-1.5"
			>
				<HugeiconsIcon icon={CloudUploadIcon} />
				Import
			</Button>
		</div>
	);
}

function SortMenuItem({
	label,
	sortKey,
	currentSortBy,
	currentSortOrder,
	onSort,
}: {
	label: string;
	sortKey: MediaSortKey;
	currentSortBy: MediaSortKey;
	currentSortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
}) {
	const isActive = currentSortBy === sortKey;
	const arrow = isActive ? (currentSortOrder === "asc" ? "↑" : "↓") : "";

	return (
		<DropdownMenuItem onClick={() => onSort({ key: sortKey })}>
			{label} {arrow}
		</DropdownMenuItem>
	);
}

/** Mini video player shown at top of media panel when a video is selected */
function MediaMiniPlayer() {
	const {
		previewAsset,
		trimStart,
		trimEnd,
		setTrimRange,
		closePreview,
	} = useMediaPreviewStore();
	const editor = useEditor();
	const videoRef = useRef<HTMLVideoElement>(null);
	const seekBarRef = useRef<HTMLDivElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [videoDuration, setVideoDuration] = useState(0);
	const [dragging, setDragging] = useState<"start" | "end" | null>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		const onTime = () => setCurrentTime(video.currentTime);
		const onMeta = () => setVideoDuration(video.duration);
		const onPlay = () => setIsPlaying(true);
		const onPause = () => setIsPlaying(false);
		video.addEventListener("timeupdate", onTime);
		video.addEventListener("loadedmetadata", onMeta);
		video.addEventListener("play", onPlay);
		video.addEventListener("pause", onPause);
		return () => {
			video.removeEventListener("timeupdate", onTime);
			video.removeEventListener("loadedmetadata", onMeta);
			video.removeEventListener("play", onPlay);
			video.removeEventListener("pause", onPause);
		};
	}, [previewAsset]);

	/* Trim handle drag */
	const trimStateRef = useRef({ trimStart, trimEnd });
	trimStateRef.current = { trimStart, trimEnd };

	useEffect(() => {
		if (!dragging) return;
		const bar = seekBarRef.current;
		if (!bar) return;

		const onMove = (e: MouseEvent) => {
			const rect = bar.getBoundingClientRect();
			const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
			const time = ratio * videoDuration;
			const { trimStart: s, trimEnd: en } = trimStateRef.current;
			if (dragging === "start") {
				setTrimRange({ start: Math.max(0, Math.min(time, en - 0.1)), end: en });
			} else {
				setTrimRange({ start: s, end: Math.min(videoDuration, Math.max(time, s + 0.1)) });
			}
		};
		const onUp = () => setDragging(null);
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
		return () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
	}, [dragging, videoDuration, setTrimRange]);

	if (!previewAsset || previewAsset.type !== "video" || !previewAsset.url) {
		return null;
	}

	const togglePlay = () => {
		const video = videoRef.current;
		if (!video) return;
		video.paused ? video.play() : video.pause();
	};

	const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
		const bar = seekBarRef.current;
		const video = videoRef.current;
		if (!bar || !video || videoDuration === 0) return;
		const rect = bar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		video.currentTime = ratio * videoDuration;
	};

	const handleAddToTimeline = () => {
		const trimmedDuration = trimEnd - trimStart;
		const element = buildElementFromMedia({
			mediaId: previewAsset.id,
			mediaType: previewAsset.type,
			name: previewAsset.name,
			duration: trimmedDuration,
			startTime: editor.playback.getCurrentTime(),
		});
		if ("trimStart" in element) {
			(element as { trimStart: number }).trimStart = trimStart;
		}
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	const progress = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
	const trimStartPct = videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0;
	const trimEndPct = videoDuration > 0 ? (trimEnd / videoDuration) * 100 : 100;

	return (
		<div className="border-b mb-2 pb-2">
			{/* Video */}
			<div className="relative aspect-video w-full overflow-hidden rounded bg-black">
				<video
					ref={videoRef}
					src={previewAsset.url}
					className="size-full object-contain"
					onClick={togglePlay}
				/>
				{/* Close button */}
				<button
					type="button"
					className="absolute top-1 right-1 rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
					onClick={closePreview}
				>
					<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
				</button>
			</div>

			{/* Seek bar with trim handles */}
			<div className="mt-1.5 px-1">
				<div
					ref={seekBarRef}
					className="relative h-5 w-full cursor-pointer rounded bg-white/10"
					onClick={handleSeek}
				>
					{/* Dimmed outside trim */}
					{trimStartPct > 0 && (
						<div
							className="absolute top-0 left-0 h-full rounded-l bg-black/40"
							style={{ width: `${trimStartPct}%` }}
						/>
					)}
					{trimEndPct < 100 && (
						<div
							className="absolute top-0 right-0 h-full rounded-r bg-black/40"
							style={{ width: `${100 - trimEndPct}%` }}
						/>
					)}

					{/* Trim region — draggable to timeline */}
					<div
						className="bg-primary/20 absolute top-0 h-full cursor-grab active:cursor-grabbing"
						style={{
							left: `${trimStartPct}%`,
							width: `${trimEndPct - trimStartPct}%`,
						}}
						draggable
						onDragStart={(e) => {
							e.stopPropagation();
							setDragData({
								dataTransfer: e.dataTransfer,
								dragData: {
									id: previewAsset.id,
									type: "media",
									mediaType: "video",
									name: previewAsset.name,
									targetElementTypes: ["video", "image"],
									trimStart,
									trimEnd,
								},
							});
							e.dataTransfer.effectAllowed = "copy";
						}}
						onDragEnd={() => clearDragData()}
						onClick={(e) => e.stopPropagation()}
						title="Drag trimmed clip to timeline"
					/>

					{/* Progress */}
					<div
						className="bg-primary/60 absolute top-0 left-0 h-full rounded"
						style={{ width: `${Math.min(progress, trimEndPct)}%` }}
					/>

					{/* Playhead */}
					<div
						className="bg-primary absolute top-0 h-full w-0.5"
						style={{ left: `${progress}%` }}
					/>

					{/* Trim start handle */}
					<div
						className="bg-primary absolute top-0 h-full w-1.5 cursor-col-resize rounded-l hover:w-2"
						style={{ left: `${trimStartPct}%` }}
						onMouseDown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setDragging("start");
						}}
					/>

					{/* Trim end handle */}
					<div
						className="bg-primary absolute top-0 h-full w-1.5 cursor-col-resize rounded-r hover:w-2"
						style={{ left: `${trimEndPct}%`, transform: "translateX(-100%)" }}
						onMouseDown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setDragging("end");
						}}
					/>
				</div>
			</div>

			{/* Controls */}
			<div className="mt-1 flex items-center justify-between px-1">
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="text-muted-foreground hover:text-foreground rounded p-0.5"
						onClick={togglePlay}
					>
						<HugeiconsIcon
							icon={isPlaying ? PauseIcon : PlayIcon}
							className="size-3.5"
						/>
					</button>
					<span className="text-muted-foreground font-mono text-[10px]">
						{formatDuration({ duration: currentTime })}
						{" / "}
						{formatDuration({ duration: videoDuration })}
					</span>
				</div>

				{/* Trim info */}
				{(trimStart > 0.01 || (videoDuration > 0 && trimEnd < videoDuration - 0.01)) && (
					<span className="text-muted-foreground text-[10px]">
						{formatDuration({ duration: trimStart })} - {formatDuration({ duration: trimEnd })}
					</span>
				)}

				<button
					type="button"
					className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 rounded p-0.5 text-[10px]"
					onClick={handleAddToTimeline}
				>
					<HugeiconsIcon icon={PlusSignIcon} className="size-3" />
					Add
				</button>
			</div>
		</div>
	);
}

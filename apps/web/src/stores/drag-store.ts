import { create } from "zustand";
import type { ElementDragState, DropTarget } from "@/types/timeline";

const initialDragState: ElementDragState = {
	isDragging: false,
	elementId: null,
	trackId: null,
	startMouseX: 0,
	startMouseY: 0,
	startElementTime: 0,
	clickOffsetTime: 0,
	currentTime: 0,
	currentMouseY: 0,
};

interface DragStore {
	dragState: ElementDragState;
	dragDropTarget: DropTarget | null;
	setDrag: (
		dragState: ElementDragState,
		dragDropTarget: DropTarget | null,
	) => void;
	setDragState: (dragState: ElementDragState) => void;
	setDragDropTarget: (target: DropTarget | null) => void;
	endDrag: () => void;
}

export const useDragStore = create<DragStore>((set) => ({
	dragState: initialDragState,
	dragDropTarget: null,
	setDrag: (dragState, dragDropTarget) => set({ dragState, dragDropTarget }),
	setDragState: (dragState) => set({ dragState }),
	setDragDropTarget: (dragDropTarget) => set({ dragDropTarget }),
	endDrag: () => set({ dragState: initialDragState, dragDropTarget: null }),
}));

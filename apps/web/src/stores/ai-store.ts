import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
	AIAnalysisResult,
	AIAnalysisStatus,
	AIChatStatus,
	AIMessage,
	AIModel,
} from "@/types/ai";

interface AIStore {
	/* Settings (persisted) */
	apiKey: string;
	setApiKey: (key: string) => void;
	model: AIModel;
	setModel: (model: AIModel) => void;
	isKeyValid: boolean | null;
	setKeyValid: (valid: boolean | null) => void;

	/* Chat (ephemeral) */
	messages: AIMessage[];
	chatStatus: AIChatStatus;
	addMessage: (msg: AIMessage) => void;
	updateLastAssistantMessage: (content: string) => void;
	setChatStatus: (status: AIChatStatus) => void;
	clearMessages: () => void;

	/* Analysis (ephemeral) */
	analysisResult: AIAnalysisResult | null;
	analysisStatus: AIAnalysisStatus;
	setAnalysisResult: (result: AIAnalysisResult | null) => void;
	setAnalysisStatus: (status: AIAnalysisStatus) => void;
}

export const useAIStore = create<AIStore>()(
	persist(
		(set) => ({
			apiKey: "",
			setApiKey: (key) => set({ apiKey: key, isKeyValid: null }),
			model: "gemini-2.5-flash",
			setModel: (model) => set({ model }),
			isKeyValid: null,
			setKeyValid: (valid) => set({ isKeyValid: valid }),

			messages: [],
			chatStatus: "idle",
			addMessage: (msg) =>
				set((state) => ({ messages: [...state.messages, msg] })),
			updateLastAssistantMessage: (content) =>
				set((state) => {
					const msgs = [...state.messages];
					const lastIdx = msgs.findLastIndex((m) => m.role === "assistant");
					if (lastIdx !== -1) {
						msgs[lastIdx] = { ...msgs[lastIdx], content };
					}
					return { messages: msgs };
				}),
			setChatStatus: (status) => set({ chatStatus: status }),
			clearMessages: () => set({ messages: [], chatStatus: "idle" }),

			analysisResult: null,
			analysisStatus: "idle",
			setAnalysisResult: (result) => set({ analysisResult: result }),
			setAnalysisStatus: (status) => set({ analysisStatus: status }),
		}),
		{
			name: "ai-settings",
			partialize: (state) => ({
				apiKey: state.apiKey,
				model: state.model,
			}),
		},
	),
);

// src/store/ui/Reducer.ts
export const UiSetAiThinkingType = "UI_SET_AI_THINKING";

export interface UiSetAiThinkingPayload {
  isThinking: boolean;
  threadId: string | null;
}

export interface UiAction {
  type: string;
  payload: UiSetAiThinkingPayload;
}

export interface UiState {
  isAiThinking: boolean;
  thinkingThreadId: string | null;
}

const initialState: UiState = {
  isAiThinking: false,
  thinkingThreadId: null,
};

export const UiReducer = (
  state: UiState = initialState,
  action: UiAction
): UiState => {
  switch (action.type) {
    case UiSetAiThinkingType:
      return {
        isAiThinking: action.payload.isThinking,
        thinkingThreadId: action.payload.threadId,
      };
    default:
      return state;
  }
};
import {
  PayloadAction,
  createListenerMiddleware,
  createSlice,
  isAnyOf,
} from '@reduxjs/toolkit';
import { setLocalApiKey, setLocalRecentDocs } from './preferenceApi';
import { RootState } from '../store';
import { ActiveState, Doc } from '../models/misc';

export interface Preference {
  apiKey: string;
  prompt: { name: string; id: string; type: string };
  chunks: string;
  token_limit: number;
  selectedDocs: Doc | null;
  selectedGuideDocs: Doc | null;
  sourceDocs: Doc[] | null;
  sourceGuideDocs: Doc[] | null;
  conversations: {
    data: { name: string; id: string }[] | null;
    loading: boolean;
  };
  modalState: ActiveState;
  paginatedDocuments: Doc[] | null;
}

const initialState: Preference = {
  apiKey: 'xxx',
  prompt: { name: 'default', id: 'default', type: 'public' },
  chunks: '2',
  token_limit: 2000,
  selectedDocs: {
    id: 'default',
    name: 'default',
    type: 'remote',
    date: 'default',
    docLink: 'default',
    model: 'openai_text-embedding-ada-002',
    retriever: 'classic',
  } as Doc,
  selectedGuideDocs: {
    id: 'default',
    name: 'default',
    type: 'remote',
    date: 'default',
    docLink: 'default',
    model: 'openai_text-embedding-ada-002',
    retriever: 'classic',
  } as Doc,
  sourceDocs: null,
  sourceGuideDocs: null,
  conversations: {
    data: null,
    loading: false,
  },
  modalState: 'INACTIVE',
  paginatedDocuments: null,
};

export const prefSlice = createSlice({
  name: 'preference',
  initialState,
  reducers: {
    setApiKey: (state, action) => {
      state.apiKey = action.payload;
    },
    setSelectedDocs: (state, action) => {
      state.selectedDocs = action.payload;
    },
    setSelectedGuideDocs: (state, action) => {
      state.selectedGuideDocs = action.payload;
    },
    setSourceDocs: (state, action) => {
      state.sourceDocs = action.payload;
    },
    setSourceGuideDocs: (state, action) => {
      state.sourceGuideDocs = action.payload;
    },
    setPaginatedDocuments: (state, action) => {
      state.paginatedDocuments = action.payload;
    },
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    setPrompt: (state, action) => {
      state.prompt = action.payload;
    },
    setChunks: (state, action) => {
      state.chunks = action.payload;
    },
    setTokenLimit: (state, action) => {
      state.token_limit = action.payload;
    },
    setModalStateDeleteConv: (state, action: PayloadAction<ActiveState>) => {
      state.modalState = action.payload;
    },
  },
});

export const {
  setApiKey,
  setSelectedDocs,
  setSelectedGuideDocs,
  setSourceDocs,
  setSourceGuideDocs,
  setConversations,
  setPrompt,
  setChunks,
  setTokenLimit,
  setModalStateDeleteConv,
  setPaginatedDocuments,
} = prefSlice.actions;
export default prefSlice.reducer;

export const prefListenerMiddleware = createListenerMiddleware();
prefListenerMiddleware.startListening({
  matcher: isAnyOf(setApiKey),
  effect: (action, listenerApi) => {
    setLocalApiKey((listenerApi.getState() as RootState).preference.apiKey);
  },
});

prefListenerMiddleware.startListening({
  matcher: isAnyOf(setSelectedDocs),
  effect: (action, listenerApi) => {
    setLocalRecentDocs(
      (listenerApi.getState() as RootState).preference.selectedDocs ?? null,
    );
  },
});

prefListenerMiddleware.startListening({
  matcher: isAnyOf(setPrompt),
  effect: (action, listenerApi) => {
    localStorage.setItem(
      'DocsGPTPrompt',
      JSON.stringify((listenerApi.getState() as RootState).preference.prompt),
    );
  },
});

prefListenerMiddleware.startListening({
  matcher: isAnyOf(setChunks),
  effect: (action, listenerApi) => {
    localStorage.setItem(
      'DocsGPTChunks',
      JSON.stringify((listenerApi.getState() as RootState).preference.chunks),
    );
  },
});

prefListenerMiddleware.startListening({
  matcher: isAnyOf(setTokenLimit),
  effect: (action, listenerApi) => {
    localStorage.setItem(
      'DocsGPTTokenLimit',
      JSON.stringify(
        (listenerApi.getState() as RootState).preference.token_limit,
      ),
    );
  },
});

export const selectApiKey = (state: RootState) => state.preference.apiKey;
export const selectApiKeyStatus = (state: RootState) =>
  !!state.preference.apiKey;
export const selectSelectedDocsStatus = (state: RootState) =>
  !!state.preference.selectedDocs;
export const selectSelectedGuideDocsStatus = (state: RootState) =>
  !!state.preference.selectedGuideDocs;
export const selectSourceDocs = (state: RootState) =>
  state.preference.sourceDocs?.filter((doc) => doc['doc_type'] === 'user');
export const selectGuideSourceDocs = (state: RootState) => {
  const allDocs = state.preference.sourceDocs;
  const filteredDocs = state.preference.sourceDocs?.filter(
    (doc) => doc['doc_type'] === 'guide',
  );
  allDocs?.forEach((doc) => {
    console.log('Doc type:  ' + doc.doc_type);
  });
  return filteredDocs;
};
export const selectModalStateDeleteConv = (state: RootState) =>
  state.preference.modalState;
export const selectSelectedDocs = (state: RootState) =>
  state.preference.selectedDocs;
export const selectSelectedGuideDocs = (state: RootState) =>
  state.preference.selectedGuideDocs;
export const selectConversations = (state: RootState) =>
  state.preference.conversations;
export const selectConversationId = (state: RootState) =>
  state.conversation.conversationId;
export const selectPrompt = (state: RootState) => state.preference.prompt;
export const selectChunks = (state: RootState) => state.preference.chunks;
export const selectTokenLimit = (state: RootState) =>
  state.preference.token_limit;
export const selectPaginatedDocuments = (state: RootState) =>
  state.preference.paginatedDocuments;

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { getConversations } from '../preferences/preferenceApi';
import { setConversations } from '../preferences/preferenceSlice';
import store from '../store';
import {
  handleFetchAnswer,
  handleFetchAnswerSteaming,
} from './conversationHandlers';
import { Answer, ConversationState, Query, Status } from './conversationModels';

const initialState: ConversationState = {
  queries: [],
  status: 'idle',
  conversationId: null,
};

const API_STREAMING = import.meta.env.VITE_API_STREAMING === 'true';

let abortController: AbortController | null = null;
export function handleAbort() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

export const fetchAnswer = createAsyncThunk<
  Answer,
  { question: string; indx?: number }
>('fetchAnswer', async ({ question, indx }, { dispatch, getState }) => {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const { signal } = abortController;

  let isSourceUpdated = false;
  const state = getState() as RootState;
  if (state.preference) {
    if (API_STREAMING) {
      await handleFetchAnswerSteaming(
        question,
        signal,
        state.preference.selectedDocs!,
        state.conversation.queries,
        state.conversation.conversationId,
        state.preference.prompt.id,
        state.preference.chunks,
        state.preference.token_limit,
        (event) => {
          const data = JSON.parse(event.data);

          if (data.type === 'end') {
            dispatch(conversationSlice.actions.setStatus('idle'));
            getConversations()
              .then((fetchedConversations) => {
                dispatch(setConversations(fetchedConversations));
              })
              .catch((error) => {
                console.error('Failed to fetch conversations: ', error);
              });
            if (!isSourceUpdated) {
              dispatch(
                updateStreamingSource({
                  index: indx ?? state.conversation.queries.length - 1,
                  query: { sources: [] },
                }),
              );
            }
          } else if (data.type === 'id') {
            dispatch(
              updateConversationId({
                query: { conversationId: data.id },
              }),
            );
          } else if (data.type === 'source') {
            isSourceUpdated = true;
            dispatch(
              updateStreamingSource({
                index: indx ?? state.conversation.queries.length - 1,
                query: { sources: data.source ?? [] },
              }),
            );
          } else if (data.type === 'error') {
            // set status to 'failed'
            dispatch(conversationSlice.actions.setStatus('failed'));
            dispatch(
              conversationSlice.actions.raiseError({
                index: indx ?? state.conversation.queries.length - 1,
                message: data.error,
              }),
            );
          } else {
            const result = data.answer;
            dispatch(
              updateStreamingQuery({
                index: indx ?? state.conversation.queries.length - 1,
                query: { response: result },
              }),
            );
          }
        },
        indx,
      );
    } else {
      const answer = await handleFetchAnswer(
        question,
        signal,
        state.preference.selectedDocs!,
        state.preference.selectedGuideDocs!,
        state.conversation.queries,
        state.conversation.conversationId,
        state.preference.prompt.id,
        state.preference.chunks,
        state.preference.token_limit,
      );
      if (answer) {
        let sourcesPrepped = [];
        sourcesPrepped = answer.sources.map((source: { title: string }) => {
          if (source && source.title) {
            const titleParts = source.title.split('/');
            return {
              ...source,
              title: titleParts[titleParts.length - 1],
            };
          }
          return source;
        });

        dispatch(
          updateQuery({
            index: indx ?? state.conversation.queries.length - 1,
            query: { response: answer.answer, sources: sourcesPrepped },
          }),
        );
        dispatch(
          updateConversationId({
            query: { conversationId: answer.conversationId },
          }),
        );
        dispatch(conversationSlice.actions.setStatus('idle'));
        getConversations()
          .then((fetchedConversations) => {
            dispatch(setConversations(fetchedConversations));
          })
          .catch((error) => {
            console.error('Failed to fetch conversations: ', error);
          });
      }
    }
  }
  return {
    conversationId: null,
    title: null,
    answer: '',
    query: question,
    result: '',
    sources: [],
  };
});

export const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    addQuery(state, action: PayloadAction<Query>) {
      state.queries.push(action.payload);
    },
    setConversation(state, action: PayloadAction<Query[]>) {
      state.queries = action.payload;
    },
    resendQuery(
      state,
      action: PayloadAction<{ index: number; prompt: string; query?: Query }>,
    ) {
      state.queries = [
        ...state.queries.splice(0, action.payload.index),
        action.payload,
      ];
    },
    updateStreamingQuery(
      state,
      action: PayloadAction<{ index: number; query: Partial<Query> }>,
    ) {
      if (state.status === 'idle') return;
      const { index, query } = action.payload;
      if (query.response != undefined) {
        state.queries[index].response =
          (state.queries[index].response || '') + query.response;
      } else {
        state.queries[index] = {
          ...state.queries[index],
          ...query,
        };
      }
    },
    updateConversationId(
      state,
      action: PayloadAction<{ query: Partial<Query> }>,
    ) {
      state.conversationId = action.payload.query.conversationId ?? null;
      state.status = 'idle';
    },
    updateStreamingSource(
      state,
      action: PayloadAction<{ index: number; query: Partial<Query> }>,
    ) {
      const { index, query } = action.payload;
      if (!state.queries[index].sources) {
        state.queries[index].sources = query?.sources;
      } else {
        state.queries[index].sources!.push(query.sources![0]);
      }
    },
    updateQuery(
      state,
      action: PayloadAction<{ index: number; query: Partial<Query> }>,
    ) {
      const { index, query } = action.payload;
      state.queries[index] = {
        ...state.queries[index],
        ...query,
      };
    },
    setStatus(state, action: PayloadAction<Status>) {
      state.status = action.payload;
    },
    raiseError(
      state,
      action: PayloadAction<{ index: number; message: string }>,
    ) {
      const { index, message } = action.payload;
      state.queries[index].error = message;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchAnswer.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAnswer.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.status = 'idle';
          return state;
        }
        state.status = 'failed';
        state.queries[state.queries.length - 1].error =
          'Something went wrong. Please check your internet connection.';
      });
  },
});

type RootState = ReturnType<typeof store.getState>;

export const selectQueries = (state: RootState) => state.conversation.queries;

export const selectStatus = (state: RootState) => state.conversation.status;

export const {
  addQuery,
  updateQuery,
  resendQuery,
  updateStreamingQuery,
  updateConversationId,
  updateStreamingSource,
  setConversation,
} = conversationSlice.actions;
export default conversationSlice.reducer;

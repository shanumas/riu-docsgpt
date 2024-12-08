import conversationService from '../api/services/conversationService';
import userService from '../api/services/userService';
import { Doc, GetDocsResponse } from '../models/misc';

//Fetches all JSON objects from the source. We only use the objects with the "model" property in SelectDocsModal.tsx. Hopefully can clean up the source file later.
export async function getDocs(): Promise<Doc[] | null> {
  try {
    const response = await userService.getDocs();
    const data = await response.json();

    const docs: Doc[] = [];
    data.forEach((doc: object) => {
      docs.push(doc as Doc);
    });

    return docs;
  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function getDocsWithPagination(
  sort = 'date',
  order = 'desc',
  pageNumber = 1,
  rowsPerPage = 10,
  searchTerm = '',
): Promise<GetDocsResponse | null> {
  try {
    const query = `sort=${sort}&order=${order}&page=${pageNumber}&rows=${rowsPerPage}&search=${searchTerm}`;
    const response = await userService.getDocsWithPagination(query);
    const data = await response.json();
    const docs: Doc[] = [];
    Array.isArray(data.paginated) &&
      data.paginated.forEach((doc: Doc) => {
        docs.push(doc as Doc);
      });
    return {
      docs: docs,
      totalDocuments: data.total,
      totalPages: data.totalPages,
      nextCursor: data.nextCursor,
    };
  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function getConversations(): Promise<{
  data: { name: string; id: string }[] | null;
  loading: boolean;
}> {
  try {
    const response = await conversationService.getConversations();
    const data = await response.json();

    const conversations: { name: string; id: string }[] = [];

    data.forEach((conversation: object) => {
      conversations.push(conversation as { name: string; id: string });
    });

    return { data: conversations, loading: false };
  } catch (error) {
    console.log(error);
    return { data: null, loading: false };
  }
}

export function getLocalApiKey(): string | null {
  const key = localStorage.getItem('DocsGPTApiKey');
  return key;
}

export function getLocalRecentDocs(): string | null {
  const doc = localStorage.getItem('DocsGPTRecentDocs');
  return doc;
}

export function getLocalPrompt(): string | null {
  const prompt = localStorage.getItem('DocsGPTPrompt');
  return prompt;
}

export function setLocalApiKey(key: string): void {
  localStorage.setItem('DocsGPTApiKey', key);
}

export function setLocalPrompt(prompt: string): void {
  localStorage.setItem('DocsGPTPrompt', prompt);
}

export function setLocalRecentDocs(
  doc: Doc | null,
  guidedoc: Doc | null,
): void {
  localStorage.setItem('DocsGPTRecentDocs', JSON.stringify(doc));
  localStorage.setItem('DocsGPTRecentGuideDocs', JSON.stringify(guidedoc));

  let docPath = 'default';
  if (doc?.type === 'local') {
    docPath = 'local' + '/' + doc.name + '/';
  }
  userService
    .checkDocs({
      docs: docPath,
    })
    .then((response) => response.json());
}

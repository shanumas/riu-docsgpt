from application.retriever.base import BaseRetriever
from application.core.settings import settings
from application.vectorstore.vector_creator import VectorCreator
from application.llm.llm_creator import LLMCreator

from application.utils import num_tokens_from_string


class ClassicRAG(BaseRetriever):

    def __init__(
        self,
        question,
        source,
        chat_history=None,
        prompt="",
        chunks=2,
        token_limit=150,
        gpt_model="docsgpt",
        user_api_key=None,
    ):
        self.question = question
        self.primary_vectorstore = source.get('active_docs', None)
        self.chat_history = chat_history if chat_history else []
        self.prompt = prompt
        self.chunks = chunks
        self.gpt_model = gpt_model
        self.token_limit = (
            token_limit
            if token_limit
            < settings.MODEL_TOKEN_LIMITS.get(
                self.gpt_model, settings.DEFAULT_MAX_HISTORY
            )
            else settings.MODEL_TOKEN_LIMITS.get(
                self.gpt_model, settings.DEFAULT_MAX_HISTORY
            )
        )
        self.user_api_key = user_api_key

        # Initialize the additional vector store internally
        self.additional_vectorstore = "674d48ccc3527214d3b90d6f"

    def _get_data_from_vectorstore(self, vectorstore, k):
        if k == 0 or not vectorstore:
            return []
        docs_temp = vectorstore.search(self.question, k=k)
        docs = [
            {
                "title": i.metadata.get(
                    "title", i.metadata.get("post_title", i.page_content)
                ).split("/")[-1],
                "text": i.page_content,
                "source": i.metadata.get("source", "local"),
            }
            for i in docs_temp
        ]
        return docs

    def _retrieve_guidelines(self):
        """
        Retrieve the exact guidelines from the additional vector store using the LLM.
        """
        if not self.additional_vectorstore:
            print("Additional vector store not initialized.")
            return ""

        # Retrieve relevant documents from the additional vector store
        guidelines_docs = self._get_data_from_vectorstore(self.additional_vectorstore, k=2)  # Assuming k=2 for exact guidelines

        if not guidelines_docs:
            print("No guidelines found in the additional vector store.")
            return ""

        # Extract the text from the retrieved document
        guidelines_text = guidelines_docs[0]["text"]

        # Optionally, you can perform additional processing or validation here

        return guidelines_text

    def _get_data(self, guidelines_text):
        """
        Retrieve documents from the primary vector store and combine with guidelines.
        """
        if not self.primary_vectorstore:
            print("Primary vector store not initialized.")
            return []

        # Retrieve documents from the primary vector store
        primary_docs = self._get_data_from_vectorstore(self.primary_vectorstore, self.chunks)

        # Combine primary documents with guidelines
        # Here, we include the guidelines as an additional document
        combined_docs = primary_docs.copy()
        if guidelines_text:
            combined_docs.append({
                "title": "Emission_Guidelines",
                "text": guidelines_text,
                "source": "guidelines"
            })

        # Optionally, remove duplicates based on title
        combined_docs_dict = {doc['title']: doc for doc in combined_docs}
        combined_docs = list(combined_docs_dict.values())

        return combined_docs

    def gen(self):
        # Step 1: Retrieve guidelines from the additional vector store
        guidelines_text = self._retrieve_guidelines()

        # Step 2: Retrieve primary documents and combine with guidelines
        docs = self._get_data(guidelines_text)

        # Join all page_content together with a newline
        docs_together = "\n".join([doc["text"] for doc in docs])
        p_chat_combine = self.prompt.replace("{summaries}", docs_together)
        messages_combine = [{"role": "system", "content": p_chat_combine}]
        
        # Yield sources
        for doc in docs:
            yield {"source": doc}

        if len(self.chat_history) > 1:
            tokens_current_history = 0
            # Count tokens in history
            for i in self.chat_history:
                if "prompt" in i and "response" in i:
                    tokens_batch = num_tokens_from_string(i["prompt"]) + num_tokens_from_string(
                        i["response"]
                    )
                    if tokens_current_history + tokens_batch < self.token_limit:
                        tokens_current_history += tokens_batch
                        messages_combine.append(
                            {"role": "user", "content": i["prompt"]}
                        )
                        messages_combine.append(
                            {"role": "system", "content": i["response"]}
                        )
        messages_combine.append({"role": "user", "content": self.question})

        # Step 3: Make the second LLM call with combined context
        llm = LLMCreator.create_llm(
            settings.LLM_NAME, api_key=settings.API_KEY, user_api_key=self.user_api_key
        )
        completion = llm.gen_stream(model=self.gpt_model, messages=messages_combine)
        for line in completion:
            yield {"answer": str(line)}

    def search(self):
        # This method can be adjusted based on specific needs
        # For now, it retrieves combined data
        guidelines_text = self._retrieve_guidelines()
        return self._get_data(guidelines_text)
    
    def get_params(self):
        return {
            "question": self.question,
            "source": self.primary_vectorstore,
            # No need to pass additional_source as it's handled internally
            "chat_history": self.chat_history,
            "prompt": self.prompt,
            "chunks": self.chunks,
            "token_limit": self.token_limit,
            "gpt_model": self.gpt_model,
            "user_api_key": self.user_api_key
        }

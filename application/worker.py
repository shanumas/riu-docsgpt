import logging
import os
import shutil
import string
import zipfile
from collections import Counter
from urllib.parse import urljoin

import requests
from bson.objectid import ObjectId

from application.core.mongo_db import MongoDB
from application.core.settings import settings
from application.parser.file.bulk import SimpleDirectoryReader
from application.parser.open_ai_func import call_openai_api
from application.parser.remote.remote_creator import RemoteCreator
from application.parser.schema.base import Document
from application.parser.token_func import group_split
from application.utils import count_tokens_docs

mongo = MongoDB.get_client()
db = mongo["docsgpt"]
sources_collection = db["sources"]

# Constants
MIN_TOKENS = 150
MAX_TOKENS = 1250
RECURSION_DEPTH = 2

# Define a function to extract metadata from a given filename.
def metadata_from_filename(title):
    return {"title": title}

# Define a function to generate a random string of a given length.
def generate_random_string(length):
    return "".join([string.ascii_letters[i % 52] for i in range(length)])

current_dir = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

def extract_zip_recursive(zip_path, extract_to, current_depth=0, max_depth=5):
    """
    Recursively extract zip files with a limit on recursion depth.

    Args:
        zip_path (str): Path to the zip file to be extracted.
        extract_to (str): Destination path for extracted files.
        current_depth (int): Current depth of recursion.
        max_depth (int): Maximum allowed depth of recursion to prevent infinite loops.
    """
    if current_depth > max_depth:
        logging.warning(f"Reached maximum recursion depth of {max_depth}")
        return

    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extract_to)
        os.remove(zip_path)  # Remove the zip file after extracting
    except Exception as e:
        logging.error(f"Error extracting zip file {zip_path}: {e}")
        return

    # Check for nested zip files and extract them
    for root, dirs, files in os.walk(extract_to):
        for file in files:
            if file.endswith(".zip"):
                # If a nested zip file is found, extract it recursively
                file_path = os.path.join(root, file)
                extract_zip_recursive(file_path, root, current_depth + 1, max_depth)

def download_file(url, params, dest_path):
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(response.content)
    except requests.RequestException as e:
        logging.error(f"Error downloading file: {e}")
        raise

def upload_index(full_path, file_data):
    try:
        if settings.VECTOR_STORE == "faiss":
            files = {
                "file_faiss": open(full_path + "/index.faiss", "rb"),
                "file_pkl": open(full_path + "/index.pkl", "rb"),
            }
            response = requests.post(
                urljoin(settings.API_URL, "/api/upload_index"), files=files, data=file_data
            )
        else:
            response = requests.post(
                urljoin(settings.API_URL, "/api/upload_index"), data=file_data
            )
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Error uploading index: {e}")
        raise
    finally:
        if settings.VECTOR_STORE == "faiss":
            for file in files.values():
                file.close()

# Define the main function for ingesting and processing documents.
def ingest_worker(
    self, directory, formats, name_job, filename, user, doc_type, retriever="classic"
):
    """
    Ingest and process documents.

    Args:
        self: Reference to the instance of the task.
        directory (str): Specifies the directory for ingesting ('inputs' or 'temp').
        formats (list of str): List of file extensions to consider for ingestion (e.g., [".rst", ".md"]).
        name_job (str): Name of the job for this ingestion task.
        filename (str): Name of the file to be ingested.
        user (str): Identifier for the user initiating the ingestion.
        retriever (str): Type of retriever to use for processing the documents.

    Returns:
        dict: Information about the completed ingestion task, including input parameters and a "limited" flag.
    """
    input_files = None
    recursive = True
    limit = None
    exclude = True
    sample = False
    token_check = True
    full_path = os.path.join(directory, user, name_job)

    logging.info(f"Ingest file: {full_path}", extra={"user": user, "job": name_job})
    file_data = {"name": name_job, "file": filename, "user": user}

    if not os.path.exists(full_path):
        os.makedirs(full_path)
    download_file(urljoin(settings.API_URL, "/api/download"), file_data, os.path.join(full_path, filename))

    # check if file is .zip and extract it
    if filename.endswith(".zip"):
        extract_zip_recursive(
            os.path.join(full_path, filename), full_path, 0, RECURSION_DEPTH
        )

    self.update_state(state="PROGRESS", meta={"current": 1})

    raw_docs = SimpleDirectoryReader(
        input_dir=full_path,
        input_files=input_files,
        recursive=recursive,
        required_exts=formats,
        num_files_limit=limit,
        exclude_hidden=exclude,
        file_metadata=metadata_from_filename,
    ).load_data()
    raw_docs = group_split(
        documents=raw_docs,
        min_tokens=MIN_TOKENS,
        max_tokens=MAX_TOKENS,
        token_check=token_check,
    )

    docs = [Document.to_langchain_format(raw_doc) for raw_doc in raw_docs]
    id = ObjectId()

    call_openai_api(docs, full_path, id, self)
    tokens = count_tokens_docs(docs)
    self.update_state(state="PROGRESS", meta={"current": 100})

    if sample:
        for i in range(min(5, len(raw_docs))):
            logging.info(f"Sample document {i}: {raw_docs[i]}")

    file_data.update({
        "tokens": tokens,
        "retriever": retriever,
        "id": str(id),
        "doc_type": doc_type,  # New field to indicate the document type
        "type": "local",
    })
    upload_index(full_path, file_data)

    # delete local
    shutil.rmtree(full_path)

    return {
        "directory": directory,
        "formats": formats,
        "name_job": name_job,
        "filename": filename,
        "user": user,
        "limited": False,
    }

def remote_worker(
    self,
    source_data,
    name_job,
    user,
    loader,
    directory="temp",
    retriever="classic",
    sync_frequency="never",
    operation_mode="upload",
    doc_id=None,
):
    token_check = True
    full_path = os.path.join(directory, user, name_job)

    if not os.path.exists(full_path):
        os.makedirs(full_path)
    self.update_state(state="PROGRESS", meta={"current": 1})
    logging.info(
        f"Remote job: {full_path}",
        extra={"user": user, "job": name_job, "source_data": source_data},
    )

    remote_loader = RemoteCreator.create_loader(loader)
    raw_docs = remote_loader.load_data(source_data)

    docs = group_split(
        documents=raw_docs,
        min_tokens=MIN_TOKENS,
        max_tokens=MAX_TOKENS,
        token_check=token_check,
    )
    tokens = count_tokens_docs(docs)
    if operation_mode == "upload":
        id = ObjectId()
        call_openai_api(docs, full_path, id, self)
    elif operation_mode == "sync":
        if not doc_id or not ObjectId.is_valid(doc_id):
            raise ValueError("doc_id must be provided for sync operation.")
        id = ObjectId(doc_id)
        call_openai_api(docs, full_path, id, self)
    self.update_state(state="PROGRESS", meta={"current": 100})

    file_data = {
        "name": name_job,
        "user": user,
        "tokens": tokens,
        "retriever": retriever,
        "id": str(id),
        "type": loader,
        "remote_data": source_data,
        "sync_frequency": sync_frequency,
    }
    upload_index(full_path, file_data)

    shutil.rmtree(full_path)

    return {"urls": source_data, "name_job": name_job, "user": user, "limited": False}

def sync(
    self,
    source_data,
    name_job,
    user,
    loader,
    sync_frequency,
    retriever,
    doc_id=None,
    directory="temp",
):
    try:
        remote_worker(
            self,
            source_data,
            name_job,
            user,
            loader,
            directory,
            retriever,
            sync_frequency,
            "sync",
            doc_id,
        )
    except Exception as e:
        logging.error(f"Error during sync: {e}")
        return {"status": "error", "error": str(e)}
    return {"status": "success"}

def sync_worker(self, frequency):
    sync_counts = Counter()
    sources = sources_collection.find()
    for doc in sources:
        if doc.get("sync_frequency") == frequency:
            name = doc.get("name")
            user = doc.get("user")
            source_type = doc.get("type")
            source_data = doc.get("remote_data")
            retriever = doc.get("retriever")
            doc_id = str(doc.get("_id"))
            resp = sync(
                self, source_data, name, user, source_type, frequency, retriever, doc_id
            )
            sync_counts["total_sync_count"] += 1
            sync_counts[
                "sync_success" if resp["status"] == "success" else "sync_failure"
            ] += 1

    return {
        key: sync_counts[key]
        for key in ["total_sync_count", "sync_success", "sync_failure"]
    }

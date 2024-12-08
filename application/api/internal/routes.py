import os
import datetime
from flask import Blueprint, request, send_from_directory
from werkzeug.utils import secure_filename
from bson.objectid import ObjectId

from application.core.mongo_db import MongoDB
from application.core.settings import settings

mongo = MongoDB.get_client()
db = mongo["docsgpt"]
conversations_collection = db["conversations"]
sources_collection = db["sources"]

current_dir = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)


internal = Blueprint("internal", __name__)


@internal.route("/api/download", methods=["get"])
def download_file():
    user = secure_filename(request.args.get("user"))
    job_name = secure_filename(request.args.get("name"))
    filename = secure_filename(request.args.get("file"))
    save_dir = os.path.join(current_dir, settings.UPLOAD_FOLDER, user, job_name)
    return send_from_directory(save_dir, filename, as_attachment=True)


@internal.route("/api/upload_index", methods=["POST"])
def upload_index_files():
    """Upload two files(index.faiss, index.pkl) to the user's folder."""
    if "user" not in request.form:
        return {"status": "no user"}
    user = secure_filename(request.form["user"])
    if "name" not in request.form:
        return {"status": "no name"}
    job_name = secure_filename(request.form["name"])
    tokens = secure_filename(request.form["tokens"])
    retriever = secure_filename(request.form["retriever"])
    id = secure_filename(request.form["id"])
    type = secure_filename(request.form["type"])
    remote_data = request.form["remote_data"] if "remote_data" in request.form else None
    sync_frequency = secure_filename(request.form["sync_frequency"]) if "sync_frequency" in request.form else None
    doc_type = request.form["doc_type"]

    save_dir = os.path.join(current_dir, "indexes", str(id))
    if settings.VECTOR_STORE == "faiss":
        if "file_faiss" not in request.files:
            print("No file part")
            return {"status": "no file"}
        file_faiss = request.files["file_faiss"]
        if file_faiss.filename == "":
            return {"status": "no file name"}
        if "file_pkl" not in request.files:
            print("No file part")
            return {"status": "no file"}
        file_pkl = request.files["file_pkl"]
        if file_pkl.filename == "":
            return {"status": "no file name"}
        # saves index files

        if not os.path.exists(save_dir):
            os.makedirs(save_dir)
        file_faiss.save(os.path.join(save_dir, "index.faiss"))
        file_pkl.save(os.path.join(save_dir, "index.pkl"))

    existing_entry = sources_collection.find_one({"_id": ObjectId(id)})
    if existing_entry:
        sources_collection.update_one(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "user": user,
                    "name": job_name,
                    "language": job_name,
                    "date": datetime.datetime.now(),
                    "model": settings.EMBEDDINGS_NAME,
                    "type": type,
                    "tokens": tokens,
                    "retriever": retriever,
                    "remote_data": remote_data,
                    "sync_frequency": sync_frequency,
                    "doc_type": doc_type,
                }
            },
        )
    else:
        sources_collection.insert_one(
            {
                "_id": ObjectId(id),
                "user": user,
                "name": job_name,
                "language": job_name,
                "date": datetime.datetime.now(),
                "model": settings.EMBEDDINGS_NAME,
                "type": type,
                "tokens": tokens,
                "retriever": retriever,
                "remote_data": remote_data,
                "sync_frequency": sync_frequency,
                "doc_type": doc_type,
            }
        )
    return {"status": "ok"}

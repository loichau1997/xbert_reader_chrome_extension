from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import traceback
import os
import re
import zipfile
from datetime import datetime

app = Flask(__name__)
CORS(app)

SAVE_FOLDER = "saved_tasks"
DB_NAME = "tasks.db"

os.makedirs(SAVE_FOLDER, exist_ok=True)


def safe_filename(text):
    return re.sub(r'[<>:"/\\|?*]', '_', text)


def get_task_id(url):
    match = re.search(r'/work-list/(\d+)', url)

    if not match:
        return "unknown_task"

    return match.group(1)


def init_db():

    conn = sqlite3.connect(DB_NAME)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT,
            title TEXT,
            page_type TEXT,
            zip_path TEXT,
            created_at TEXT
        )
    """)

    conn.execute("""
        ALTER TABLE tasks
        ADD COLUMN page_type TEXT;
    """)

    

    conn.commit()
    conn.close()


init_db()


@app.route("/save", methods=["POST"])
def save_zip():

    try:

        uploaded_file = request.files.get("file")
        url = request.form.get("url")
        title = request.form.get("title")
        page_type = request.form.get("page_type")

        if not uploaded_file:
            raise Exception("Missing uploaded file")

        if not url:
            raise Exception("Missing url")

        if not title:
            raise Exception("Missing title")

        if not page_type:
            raise Exception("Missing page_type")

        task_id = get_task_id(url)

        safe_title = safe_filename(title)

        task_folder = os.path.join(
            SAVE_FOLDER,
            task_id,
            page_type
        )

        os.makedirs(task_folder, exist_ok=True)

        zip_path = os.path.join(
            task_folder,
            f"{safe_title}.zip"
        )

        uploaded_file.save(zip_path)

        conn = sqlite3.connect(DB_NAME)

        conn.execute("""
            INSERT INTO tasks (
                task_id,
                title,
                page_type,
                zip_path,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            task_id,
            title,
            page_type,
            zip_path,
            datetime.now().isoformat()
        ))

        conn.commit()
        conn.close()

        print("\n================ SUCCESS ================")
        print("TASK ID:", task_id)
        print("TITLE:", title)
        print("TYPE:", page_type)
        print("ZIP:", zip_path)
        print("=========================================\n")

        return jsonify({
            "success": True,
            "task_id": task_id,
            "zip_path": zip_path
        })

    except Exception as error:

        print("\n================ ERROR ================")
        traceback.print_exc()
        print("=======================================\n")

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False
    )
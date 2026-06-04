import asyncio
import base64
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import textwrap
import uuid
from datetime import UTC, datetime
from pathlib import Path

import fitz
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageDraw, ImageFont

from app.prompts.documents import DOCUMENT_VISION_PROMPT
from app.schemas.documents import (
    DocumentCreateRequest,
    DocumentDetail,
    DocumentParagraph,
    DocumentParagraphInput,
    DocumentSummary,
    DocumentUpdateRequest,
)
from app.services.llm_client import RuntimeModelConfig, call_vision_model


STORAGE_ROOT = Path(__file__).resolve().parents[1] / "storage" / "documents"
ORIGINAL_DIR = STORAGE_ROOT / "originals"
WORK_DIR = STORAGE_ROOT / "work"
DB_PATH = STORAGE_ROOT / "documents.sqlite3"
SUPPORTED_EXTENSIONS = {"txt", "md", "doc", "docx", "pdf", "ppt", "pptx"}


def now_utc() -> datetime:
    return datetime.now(UTC)


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def normalize_paragraph_type(value: str) -> str:
    if value in {"title", "heading", "paragraph", "list", "table"}:
        return value
    return "paragraph"


def normalize_paragraph_level(value: int, paragraph_type: str) -> int:
    if paragraph_type == "title":
        return 0
    if paragraph_type == "heading":
        return max(1, min(4, int(value or 1)))
    return max(0, min(4, int(value or 0)))


def strip_page_comments(content: str) -> str:
    return "\n".join(line for line in content.replace("\r\n", "\n").split("\n") if not line.strip().startswith("<!-- 第"))


def infer_block_type(block: str, current_level: int) -> tuple[str, int, str]:
    stripped = block.strip()
    if not stripped:
        return "paragraph", current_level, ""
    if stripped.startswith("#"):
        marker, _, text = stripped.partition(" ")
        if marker and set(marker) == {"#"} and text.strip():
            level = len(marker)
            if level == 1:
                return "title", 0, text.strip()
            return "heading", max(1, min(4, level - 1)), text.strip()
    if "\n" in stripped and all(line.strip().startswith("|") for line in stripped.splitlines() if line.strip()):
        return "table", current_level, stripped
    if all(re.match(r"^\s*([-*+]|\d+\.)\s+", line) for line in stripped.splitlines() if line.strip()):
        return "list", current_level, stripped
    return "paragraph", current_level, stripped


def markdown_to_paragraph_inputs(markdown: str, title: str = "") -> list[DocumentParagraphInput]:
    text = strip_page_comments(markdown or "").strip()
    blocks = [block.strip() for block in text.split("\n\n") if block.strip()]
    paragraphs: list[DocumentParagraphInput] = []
    current_level = 0
    for block in blocks:
        paragraph_type, level, content = infer_block_type(block, current_level)
        if paragraph_type == "heading":
            current_level = level
        elif paragraph_type == "title":
            current_level = 0
        paragraphs.append(DocumentParagraphInput(type=paragraph_type, level=level, content=content))

    if title.strip() and not any(paragraph.type == "title" for paragraph in paragraphs):
        paragraphs.insert(0, DocumentParagraphInput(type="title", level=0, content=title.strip()))
    if not paragraphs:
        paragraphs.append(DocumentParagraphInput(type="title", level=0, content=title.strip() or "无标题文档"))
        paragraphs.append(DocumentParagraphInput(type="paragraph", level=0, content=""))
    elif len(paragraphs) == 1 and paragraphs[0].type == "title":
        paragraphs.append(DocumentParagraphInput(type="paragraph", level=0, content=""))
    return paragraphs


def paragraph_to_markdown(paragraph: DocumentParagraph | DocumentParagraphInput) -> str:
    content = paragraph.content or ""
    if paragraph.type == "title":
        return f"# {content}".strip()
    if paragraph.type == "heading":
        level = max(1, min(4, paragraph.level)) + 1
        return f"{'#' * level} {content}".strip()
    return content


def paragraphs_to_markdown(paragraphs: list[DocumentParagraph] | list[DocumentParagraphInput], include_title: bool = False) -> str:
    parts: list[str] = []
    for paragraph in paragraphs:
        if paragraph.type == "title" and not include_title:
            continue
        text = paragraph_to_markdown(paragraph).strip()
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def ensure_storage() -> None:
    ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                rag_status TEXT NOT NULL,
                last_saved_at TEXT NOT NULL,
                last_indexed_at TEXT,
                glossary_json TEXT NOT NULL DEFAULT '[]'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS document_paragraphs (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                paragraph_index INTEGER NOT NULL,
                type TEXT NOT NULL,
                level INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(documents)").fetchall()}
        if "glossary_json" not in columns:
            conn.execute("ALTER TABLE documents ADD COLUMN glossary_json TEXT NOT NULL DEFAULT '[]'")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS knowledge_conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                document_ids_json TEXT NOT NULL,
                messages_json TEXT NOT NULL,
                search_results_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS document_assistant_messages (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        migrate_legacy_document_paragraphs(conn)
        conn.commit()


def connect() -> sqlite3.Connection:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrate_legacy_document_paragraphs(conn: sqlite3.Connection) -> None:
    rows = conn.execute("SELECT * FROM documents ORDER BY last_saved_at ASC").fetchall()
    for row in rows:
        count = conn.execute("SELECT COUNT(*) AS count FROM document_paragraphs WHERE document_id = ?", (row["id"],)).fetchone()["count"]
        if count:
            continue
        timestamp = row["last_saved_at"] or now_utc().isoformat()
        paragraphs = markdown_to_paragraph_inputs(row["content"] or "", row["title"])
        for index, paragraph in enumerate(paragraphs):
            paragraph_id = uuid.uuid4().hex
            paragraph_type = normalize_paragraph_type(paragraph.type)
            level = normalize_paragraph_level(paragraph.level, paragraph_type)
            conn.execute(
                """
                INSERT INTO document_paragraphs
                (id, document_id, paragraph_index, type, level, content, content_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    paragraph_id,
                    row["id"],
                    index,
                    paragraph_type,
                    level,
                    paragraph.content,
                    content_hash(paragraph.content),
                    timestamp,
                    timestamp,
                ),
            )


def fetch_paragraphs(conn: sqlite3.Connection, document_id: str) -> list[DocumentParagraph]:
    rows = conn.execute(
        """
        SELECT * FROM document_paragraphs
        WHERE document_id = ?
        ORDER BY paragraph_index ASC
        """,
        (document_id,),
    ).fetchall()
    return [
        DocumentParagraph(
            id=row["id"],
            document_id=row["document_id"],
            paragraph_index=row["paragraph_index"],
            type=normalize_paragraph_type(row["type"]),
            level=normalize_paragraph_level(row["level"], normalize_paragraph_type(row["type"])),
            content=row["content"],
            content_hash=row["content_hash"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None,
        )
        for row in rows
    ]


def title_from_paragraphs(paragraphs: list[DocumentParagraph] | list[DocumentParagraphInput], fallback: str = "无标题文档") -> str:
    for paragraph in paragraphs:
        if paragraph.type == "title" and paragraph.content.strip():
            return paragraph.content.strip()
    return fallback.strip() or "无标题文档"


def replace_document_paragraphs(
    conn: sqlite3.Connection,
    document_id: str,
    paragraphs: list[DocumentParagraphInput],
    timestamp: str,
) -> list[DocumentParagraph]:
    existing_rows = conn.execute("SELECT id, created_at FROM document_paragraphs WHERE document_id = ?", (document_id,)).fetchall()
    existing_created_at = {row["id"]: row["created_at"] for row in existing_rows}
    seen_ids: set[str] = set()
    saved: list[DocumentParagraph] = []

    for index, paragraph in enumerate(paragraphs):
        paragraph_id = paragraph.id if paragraph.id and paragraph.id in existing_created_at else uuid.uuid4().hex
        seen_ids.add(paragraph_id)
        paragraph_type = normalize_paragraph_type(paragraph.type)
        level = normalize_paragraph_level(paragraph.level, paragraph_type)
        content = paragraph.content or ""
        created_at = existing_created_at.get(paragraph_id, timestamp)
        conn.execute(
            """
            INSERT INTO document_paragraphs
            (id, document_id, paragraph_index, type, level, content, content_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                paragraph_index = excluded.paragraph_index,
                type = excluded.type,
                level = excluded.level,
                content = excluded.content,
                content_hash = excluded.content_hash,
                updated_at = excluded.updated_at
            """,
            (
                paragraph_id,
                document_id,
                index,
                paragraph_type,
                level,
                content,
                content_hash(content),
                created_at,
                timestamp,
            ),
        )
        saved.append(
            DocumentParagraph(
                id=paragraph_id,
                document_id=document_id,
                paragraph_index=index,
                type=paragraph_type,
                level=level,
                content=content,
                content_hash=content_hash(content),
                created_at=datetime.fromisoformat(created_at),
                updated_at=datetime.fromisoformat(timestamp),
            )
        )

    if seen_ids:
        placeholders = ",".join("?" for _ in seen_ids)
        conn.execute(
            f"DELETE FROM document_paragraphs WHERE document_id = ? AND id NOT IN ({placeholders})",
            (document_id, *seen_ids),
        )
    else:
        conn.execute("DELETE FROM document_paragraphs WHERE document_id = ?", (document_id,))
    return saved


def row_to_summary(row: sqlite3.Row) -> DocumentSummary:
    return DocumentSummary(
        id=row["id"],
        title=row["title"],
        content_hash=row["content_hash"],
        rag_status=row["rag_status"],
        last_saved_at=datetime.fromisoformat(row["last_saved_at"]),
        last_indexed_at=datetime.fromisoformat(row["last_indexed_at"]) if row["last_indexed_at"] else None,
    )


def row_to_detail(row: sqlite3.Row, paragraphs: list[DocumentParagraph] | None = None) -> DocumentDetail:
    try:
        glossary = json.loads(row["glossary_json"] or "[]")
    except json.JSONDecodeError:
        glossary = []
    paragraph_list = paragraphs or []
    content = paragraphs_to_markdown(paragraph_list) if paragraph_list else row["content"]
    return DocumentDetail(**row_to_summary(row).model_dump(), content=content, paragraphs=paragraph_list, glossary=glossary)


def list_documents() -> list[DocumentSummary]:
    ensure_storage()
    with connect() as conn:
        rows = conn.execute("SELECT * FROM documents ORDER BY last_saved_at DESC").fetchall()
    return [row_to_summary(row) for row in rows]


def get_document(document_id: str) -> DocumentDetail:
    ensure_storage()
    with connect() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        paragraphs = fetch_paragraphs(conn, document_id) if row else []
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row_to_detail(row, paragraphs)


def delete_document(document_id: str) -> None:
    ensure_storage()
    get_document(document_id)
    from app.services.rag_service import delete_document_index

    delete_document_index(document_id)
    with connect() as conn:
        conn.execute("DELETE FROM document_paragraphs WHERE document_id = ?", (document_id,))
        conn.execute("DELETE FROM document_assistant_messages WHERE document_id = ?", (document_id,))
        if conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'document_translation_states'").fetchone():
            conn.execute("DELETE FROM document_translation_states WHERE document_id = ?", (document_id,))
        conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        conn.commit()

    for path in ORIGINAL_DIR.glob(f"{document_id}.*"):
        path.unlink(missing_ok=True)
    work_dir = WORK_DIR / document_id
    if work_dir.exists():
        shutil.rmtree(work_dir)


def create_document(payload: DocumentCreateRequest) -> DocumentDetail:
    ensure_storage()
    document_id = uuid.uuid4().hex
    timestamp = now_utc().isoformat()
    paragraphs = markdown_to_paragraph_inputs(payload.content or "", payload.title)
    title = title_from_paragraphs(paragraphs, payload.title)
    content = paragraphs_to_markdown(paragraphs)
    glossary_json = json.dumps([entry.model_dump() for entry in payload.glossary], ensure_ascii=False)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO documents (id, title, content, content_hash, rag_status, last_saved_at, last_indexed_at, glossary_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, title, content, content_hash(content), "not_indexed", timestamp, None, glossary_json),
        )
        replace_document_paragraphs(conn, document_id, paragraphs, timestamp)
        conn.commit()
    return get_document(document_id)


def update_document(document_id: str, payload: DocumentUpdateRequest) -> DocumentDetail:
    current = get_document(document_id)
    next_title = payload.title if payload.title is not None else current.title
    next_content = payload.content if payload.content is not None else current.content
    next_glossary = payload.glossary if payload.glossary is not None else current.glossary
    if payload.content is not None:
        next_paragraphs = markdown_to_paragraph_inputs(next_content, next_title)
        next_title = title_from_paragraphs(next_paragraphs, next_title)
        next_content = paragraphs_to_markdown(next_paragraphs)
    else:
        next_paragraphs = None
    glossary_json = json.dumps([entry.model_dump() for entry in next_glossary], ensure_ascii=False)
    next_hash = content_hash(next_content)
    next_status = current.rag_status

    if next_hash != current.content_hash:
        if current.rag_status == "not_indexed":
            next_status = "not_indexed"
        elif current.rag_status in {"indexed", "outdated", "failed"}:
            next_status = "outdated"

    timestamp = now_utc().isoformat()
    with connect() as conn:
        conn.execute(
            """
            UPDATE documents
            SET title = ?, content = ?, content_hash = ?, rag_status = ?, last_saved_at = ?, glossary_json = ?
            WHERE id = ?
            """,
            (next_title.strip() or "无标题文档", next_content, next_hash, next_status, timestamp, glossary_json, document_id),
        )
        if next_paragraphs is not None:
            replace_document_paragraphs(conn, document_id, next_paragraphs, timestamp)
        conn.commit()
    return get_document(document_id)


def update_document_paragraphs(document_id: str, paragraphs: list[DocumentParagraphInput]) -> DocumentDetail:
    current = get_document(document_id)
    timestamp = now_utc().isoformat()
    normalized = paragraphs or [DocumentParagraphInput(type="title", level=0, content=current.title), DocumentParagraphInput(type="paragraph", level=0, content="")]
    next_title = title_from_paragraphs(normalized, current.title)
    next_content = paragraphs_to_markdown(normalized)
    next_hash = content_hash(next_content)
    next_status = current.rag_status
    if next_hash != current.content_hash:
        if current.rag_status == "not_indexed":
            next_status = "not_indexed"
        elif current.rag_status in {"indexed", "outdated", "failed"}:
            next_status = "outdated"

    with connect() as conn:
        replace_document_paragraphs(conn, document_id, normalized, timestamp)
        conn.execute(
            """
            UPDATE documents
            SET title = ?, content = ?, content_hash = ?, rag_status = ?, last_saved_at = ?
            WHERE id = ?
            """,
            (next_title, next_content, next_hash, next_status, timestamp, document_id),
        )
        conn.commit()
    return get_document(document_id)


def mark_document_indexing(document_id: str) -> DocumentDetail:
    get_document(document_id)
    with connect() as conn:
        conn.execute("UPDATE documents SET rag_status = ? WHERE id = ?", ("indexing", document_id))
        conn.commit()
    return get_document(document_id)


def mark_document_index_failed(document_id: str) -> DocumentDetail:
    get_document(document_id)
    with connect() as conn:
        conn.execute("UPDATE documents SET rag_status = ? WHERE id = ?", ("failed", document_id))
        conn.commit()
    return get_document(document_id)


def complete_document_index(document_id: str, indexed_hash: str) -> DocumentDetail:
    current = get_document(document_id)
    status = "indexed" if indexed_hash == current.content_hash else "outdated"
    indexed_at = now_utc().isoformat() if status == "indexed" else current.last_indexed_at.isoformat() if current.last_indexed_at else None
    with connect() as conn:
        conn.execute(
            "UPDATE documents SET rag_status = ?, last_indexed_at = ? WHERE id = ?",
            (status, indexed_at, document_id),
        )
        conn.commit()
    return get_document(document_id)


def infer_title(filename: str, content: str = "") -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or Path(filename).stem
    return Path(filename).stem or "无标题文档"


async def save_upload(file: UploadFile, document_id: str) -> tuple[Path, str]:
    filename = file.filename or "upload"
    suffix = Path(filename).suffix.lower().lstrip(".")
    if suffix in {"xls", "xlsx"}:
        raise HTTPException(status_code=400, detail="暂不支持上传 Excel 文件")
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式：{suffix or 'unknown'}")

    target = ORIGINAL_DIR / f"{document_id}.{suffix}"
    target.write_bytes(await file.read())
    return target, suffix


def image_to_data_url(image_path: Path) -> str:
    encoded = base64.b64encode(image_path.read_bytes()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


def pdf_to_images(pdf_path: Path, output_dir: Path, dpi: int = 120) -> list[str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    data_urls: list[str] = []
    for page_index in range(doc.page_count):
        page = doc[page_index]
        pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72))
        mode = "RGBA" if pix.alpha else "RGB"
        image = Image.frombytes(mode, (pix.width, pix.height), pix.samples).convert("RGB")
        image_path = output_dir / f"page_{page_index + 1}.jpg"
        image.save(image_path, format="JPEG", quality=82, optimize=True)
        data_urls.append(image_to_data_url(image_path))
    doc.close()
    return data_urls


def find_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simsun.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def text_to_images(text_path: Path, output_dir: Path) -> list[str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    text = text_path.read_text(encoding="utf-8", errors="ignore")
    font = find_font(22)
    line_height = 34
    lines: list[str] = []
    for raw_line in text.splitlines() or [""]:
        wrapped = textwrap.wrap(raw_line, width=42) or [""]
        lines.extend(wrapped)

    lines_per_page = 36
    data_urls: list[str] = []
    for page_index in range(0, len(lines), lines_per_page):
        image = Image.new("RGB", (1240, 1754), "white")
        draw = ImageDraw.Draw(image)
        y = 80
        for line in lines[page_index : page_index + lines_per_page]:
            draw.text((90, y), line, fill="#111827", font=font)
            y += line_height
        image_path = output_dir / f"page_{len(data_urls) + 1}.jpg"
        image.save(image_path, format="JPEG", quality=88, optimize=True)
        data_urls.append(image_to_data_url(image_path))
    return data_urls


def libreoffice_command() -> str:
    env_path = os.getenv("LIBREOFFICE_PATH")
    candidates = [
        env_path,
        shutil.which("libreoffice"),
        shutil.which("soffice"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    raise HTTPException(status_code=500, detail="未找到 LibreOffice，无法转换 Word/PPT 为图片")


def office_to_pdf(input_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    command = libreoffice_command()
    try:
        subprocess.run(
            [command, "--headless", "--convert-to", "pdf", str(input_path), "--outdir", str(output_dir)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=500, detail=f"文件转换失败：{exc.stderr or exc.stdout}") from exc

    pdf_path = output_dir / f"{input_path.stem}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=500, detail="文件转换失败：未生成 PDF")
    return pdf_path


def file_to_image_urls(file_path: Path, file_type: str, document_id: str) -> list[str]:
    output_dir = WORK_DIR / document_id
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if file_type in {"txt", "md"}:
        return text_to_images(file_path, output_dir)
    if file_type == "pdf":
        return pdf_to_images(file_path, output_dir)
    if file_type in {"doc", "docx", "ppt", "pptx"}:
        pdf_path = office_to_pdf(file_path, output_dir)
        return pdf_to_images(pdf_path, output_dir)
    raise HTTPException(status_code=400, detail=f"不支持的文件格式：{file_type}")


async def recognize_pages(image_urls: list[str], model_config: RuntimeModelConfig, max_concurrency: int = 4) -> str:
    semaphore = asyncio.Semaphore(max_concurrency)
    results: list[str | None] = [None] * len(image_urls)

    async def recognize(index: int, image_url: str) -> None:
        async with semaphore:
            results[index] = await call_vision_model(image_url, DOCUMENT_VISION_PROMPT, model_config)

    await asyncio.gather(*(recognize(index, image_url) for index, image_url in enumerate(image_urls)))
    return "\n\n".join(
        f"<!-- 第{index + 1}页 -->\n{content}"
        for index, content in enumerate(results)
        if content and content.strip()
    )


async def upload_and_parse_document(file: UploadFile, model_config: RuntimeModelConfig) -> DocumentDetail:
    ensure_storage()
    document_id = uuid.uuid4().hex
    file_path, file_type = await save_upload(file, document_id)
    image_urls = file_to_image_urls(file_path, file_type, document_id)
    content = await recognize_pages(image_urls, model_config)
    title = infer_title(file.filename or file_path.name, content)
    paragraphs = markdown_to_paragraph_inputs(content, title)
    title = title_from_paragraphs(paragraphs, title)
    content = paragraphs_to_markdown(paragraphs)
    timestamp = now_utc().isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO documents (id, title, content, content_hash, rag_status, last_saved_at, last_indexed_at, glossary_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, title, content, content_hash(content), "not_indexed", timestamp, None, "[]"),
        )
        replace_document_paragraphs(conn, document_id, paragraphs, timestamp)
        conn.commit()
    return get_document(document_id)

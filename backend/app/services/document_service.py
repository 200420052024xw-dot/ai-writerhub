import asyncio
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import textwrap
import uuid
from datetime import UTC, datetime
from pathlib import Path

import fitz
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageDraw, ImageFont

from app.core.database import _ConnectionCtx, mysql_datetime, parse_database_datetime
from app.services.auth_service import current_user_id
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


SUPPORTED_EXTENSIONS = {"txt", "md", "doc", "docx", "pdf", "ppt", "pptx"}

STORAGE_ROOT = Path(__file__).resolve().parents[1] / "storage" / "documents"
ORIGINAL_DIR = STORAGE_ROOT / "originals"
WORK_DIR = STORAGE_ROOT / "work"


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


def detect_document_language(text: str) -> str:
    chinese_count = len(re.findall(r"[\u3400-\u9fff]", text or ""))
    latin_count = len(re.findall(r"[A-Za-z]", text or ""))
    return "zh" if chinese_count >= max(1, latin_count * 0.2) else "en"


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


def _get_original_dir() -> Path:
    ensure_storage()
    return ORIGINAL_DIR


def _get_work_dir() -> Path:
    ensure_storage()
    return WORK_DIR


def connect():
    return _ConnectionCtx()


def fetch_paragraphs(conn, document_id: str) -> list[DocumentParagraph]:
    rows = conn.execute(
        """
        SELECT * FROM document_paragraphs
        WHERE document_id = %s
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
            created_at=parse_database_datetime(row["created_at"]) if row["created_at"] else None,
            updated_at=parse_database_datetime(row["updated_at"]) if row["updated_at"] else None,
        )
        for row in rows
    ]


def title_from_paragraphs(paragraphs: list[DocumentParagraph] | list[DocumentParagraphInput], fallback: str = "无标题文档") -> str:
    for paragraph in paragraphs:
        if paragraph.type == "title" and paragraph.content.strip():
            return paragraph.content.strip()
    return fallback.strip() or "无标题文档"


def replace_document_paragraphs(
    conn,
    document_id: str,
    paragraphs: list[DocumentParagraphInput],
    timestamp: str,
) -> list[DocumentParagraph]:
    existing_rows = conn.execute("SELECT id, created_at FROM document_paragraphs WHERE document_id = %s", (document_id,)).fetchall()
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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                paragraph_index = VALUES(paragraph_index),
                type = VALUES(type),
                level = VALUES(level),
                content = VALUES(content),
                content_hash = VALUES(content_hash),
                updated_at = VALUES(updated_at)
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
                created_at=parse_database_datetime(created_at),
                updated_at=parse_database_datetime(timestamp),
            )
        )

    if seen_ids:
        placeholders = ",".join("%s" for _ in seen_ids)
        conn.execute(
            f"DELETE FROM document_paragraphs WHERE document_id = %s AND id NOT IN ({placeholders})",
            (document_id, *seen_ids),
        )
    else:
        conn.execute("DELETE FROM document_paragraphs WHERE document_id = %s", (document_id,))
    return saved


def row_to_summary(row) -> DocumentSummary:
    return DocumentSummary(
        id=row["id"],
        title=row["title"],
        content_hash=row["content_hash"],
        rag_status=row["rag_status"],
        language=row["language"] if row["language"] in {"zh", "en"} else "zh",
        last_saved_at=parse_database_datetime(row["last_saved_at"]),
        last_indexed_at=parse_database_datetime(row["last_indexed_at"]) if row["last_indexed_at"] else None,
        deleted_at=parse_database_datetime(row["deleted_at"]) if row["deleted_at"] else None,
    )


def row_to_detail(row, paragraphs: list[DocumentParagraph] | None = None) -> DocumentDetail:
    try:
        glossary = json.loads(row["glossary_json"] or "[]")
    except json.JSONDecodeError:
        glossary = []
    paragraph_list = paragraphs or []
    content = paragraphs_to_markdown(paragraph_list) if paragraph_list else row["content"]
    return DocumentDetail(**row_to_summary(row).model_dump(), content=content, paragraphs=paragraph_list, glossary=glossary)


_SUMMARY_COLUMNS = (
    "id, title, content_hash, rag_status, language, last_saved_at, last_indexed_at, deleted_at"
)


def list_documents() -> list[DocumentSummary]:
    ensure_storage()
    user_id = current_user_id()
    with connect() as conn:
        rows = conn.execute(
            f"SELECT {_SUMMARY_COLUMNS} FROM documents WHERE user_id = %s AND deleted_at IS NULL ORDER BY last_saved_at DESC",
            (user_id,),
        ).fetchall()
    return [row_to_summary(row) for row in rows]


def get_document(document_id: str, include_trashed: bool = False) -> DocumentDetail:
    ensure_storage()
    user_id = current_user_id()
    with connect() as conn:
        if include_trashed:
            row = conn.execute(
                "SELECT * FROM documents WHERE id = %s AND user_id = %s",
                (document_id, user_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM documents WHERE id = %s AND user_id = %s AND deleted_at IS NULL",
                (document_id, user_id),
            ).fetchone()
        paragraphs = fetch_paragraphs(conn, document_id) if row else []
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row_to_detail(row, paragraphs)


def delete_document(document_id: str) -> None:
    """Hard delete — removes document and all related data permanently."""
    ensure_storage()
    get_document(document_id)
    from app.services.rag_service import delete_document_index

    delete_document_index(document_id)
    with connect() as conn:
        conn.execute("DELETE FROM document_paragraphs WHERE document_id = %s", (document_id,))
        conn.execute("DELETE FROM document_assistant_messages WHERE document_id = %s", (document_id,))
        conn.execute("DELETE FROM document_translation_versions WHERE document_id = %s", (document_id,))
        conn.execute("DELETE FROM translation_jobs WHERE document_id = %s", (document_id,))
        conn.execute("DELETE FROM documents WHERE id = %s", (document_id,))


    for path in _get_original_dir().glob(f"{document_id}.*"):
        path.unlink(missing_ok=True)
    work_dir = _get_work_dir() / document_id
    if work_dir.exists():
        shutil.rmtree(work_dir)


def trash_document(document_id: str) -> None:
    """Soft delete — move document to trash by setting deleted_at."""
    ensure_storage()
    get_document(document_id)
    from app.services.rag_service import delete_document_index

    delete_document_index(document_id)
    timestamp = mysql_datetime()
    with connect() as conn:
        conn.execute("UPDATE documents SET deleted_at = %s, rag_status = 'not_indexed' WHERE id = %s", (timestamp, document_id))



def restore_document(document_id: str) -> None:
    """Restore a trashed document."""
    ensure_storage()
    get_document(document_id, include_trashed=True)
    with connect() as conn:
        row = conn.execute("SELECT deleted_at FROM documents WHERE id = %s", (document_id,)).fetchone()
        if not row or not row["deleted_at"]:
            raise HTTPException(status_code=400, detail="文档不在回收站中")
        conn.execute("UPDATE documents SET deleted_at = NULL WHERE id = %s", (document_id,))



def permanent_delete_document(document_id: str) -> None:
    """Permanently delete a trashed document."""
    ensure_storage()
    doc = get_document(document_id, include_trashed=True)
    if not doc.deleted_at:
        raise HTTPException(status_code=400, detail="文档不在回收站中，请使用普通删除")
    delete_document(document_id)


def list_trashed_documents() -> list[DocumentSummary]:
    """List all documents in trash."""
    ensure_storage()
    with connect() as conn:
        rows = conn.execute(
            f"SELECT {_SUMMARY_COLUMNS} FROM documents WHERE user_id = %s AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
            (current_user_id(),),
        ).fetchall()
    return [row_to_summary(row) for row in rows]


def purge_expired_trash(max_age_days: int = 15) -> int:
    """Permanently delete trashed documents older than max_age_days. Returns count purged."""
    ensure_storage()
    from app.services.rag_service import delete_document_index

    cutoff = datetime.now(UTC).timestamp() - max_age_days * 86400
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, deleted_at FROM documents WHERE user_id = %s AND deleted_at IS NOT NULL",
            (current_user_id(),),
        ).fetchall()
        expired_ids: list[str] = []
        for row in rows:
            try:
                deleted_ts = parse_database_datetime(row["deleted_at"]).timestamp()
                if deleted_ts < cutoff:
                    expired_ids.append(row["id"])
            except (ValueError, TypeError):
                continue

    for doc_id in expired_ids:
        try:
            delete_document_index(doc_id)
            delete_document(doc_id)
        except Exception:
            continue
    return len(expired_ids)


def create_document(payload: DocumentCreateRequest) -> DocumentDetail:
    ensure_storage()
    document_id = uuid.uuid4().hex
    timestamp = mysql_datetime()
    paragraphs = markdown_to_paragraph_inputs(payload.content or "", payload.title)
    title = title_from_paragraphs(paragraphs, payload.title)
    content = paragraphs_to_markdown(paragraphs)
    glossary_json = json.dumps([entry.model_dump() for entry in payload.glossary], ensure_ascii=False)
    language = payload.language or detect_document_language(f"{title}\n{content}")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO documents
            (id, user_id, title, content, content_hash, rag_status, language, last_saved_at, last_indexed_at, glossary_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                document_id,
                current_user_id(),
                title,
                content,
                content_hash(content),
                "not_indexed",
                language,
                timestamp,
                None,
                glossary_json,
            ),
        )
        replace_document_paragraphs(conn, document_id, paragraphs, timestamp)

    return get_document(document_id)


def update_document(document_id: str, payload: DocumentUpdateRequest) -> DocumentDetail:
    current = get_document(document_id)
    next_title = payload.title if payload.title is not None else current.title
    next_content = payload.content if payload.content is not None else current.content
    next_glossary = payload.glossary if payload.glossary is not None else current.glossary
    next_language = payload.language if payload.language is not None else current.language
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

    timestamp = mysql_datetime()
    with connect() as conn:
        conn.execute(
            """
            UPDATE documents
            SET title = %s, content = %s, content_hash = %s, rag_status = %s, language = %s, last_saved_at = %s, glossary_json = %s
            WHERE id = %s
            """,
            (
                next_title.strip() or "无标题文档",
                next_content,
                next_hash,
                next_status,
                next_language,
                timestamp,
                glossary_json,
                document_id,
            ),
        )
        if next_paragraphs is not None:
            replace_document_paragraphs(conn, document_id, next_paragraphs, timestamp)

    return get_document(document_id)


def update_document_paragraphs(document_id: str, paragraphs: list[DocumentParagraphInput]) -> DocumentDetail:
    current = get_document(document_id)
    timestamp = mysql_datetime()
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
            SET title = %s, content = %s, content_hash = %s, rag_status = %s, last_saved_at = %s
            WHERE id = %s
            """,
            (next_title, next_content, next_hash, next_status, timestamp, document_id),
        )

    return get_document(document_id)


def mark_document_indexing(document_id: str) -> DocumentDetail:
    get_document(document_id)
    with connect() as conn:
        conn.execute("UPDATE documents SET rag_status = %s WHERE id = %s", ("indexing", document_id))

    return get_document(document_id)


def mark_document_index_failed(document_id: str) -> DocumentDetail:
    get_document(document_id)
    with connect() as conn:
        conn.execute("UPDATE documents SET rag_status = %s WHERE id = %s", ("failed", document_id))

    return get_document(document_id)


def complete_document_index(document_id: str, indexed_hash: str) -> DocumentDetail:
    current = get_document(document_id)
    status = "indexed" if indexed_hash == current.content_hash else "outdated"
    indexed_at = mysql_datetime() if status == "indexed" else mysql_datetime(current.last_indexed_at) if current.last_indexed_at else None
    with connect() as conn:
        conn.execute(
            "UPDATE documents SET rag_status = %s, last_indexed_at = %s WHERE id = %s",
            (status, indexed_at, document_id),
        )

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

    target = _get_original_dir() / f"{document_id}.{suffix}"
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
    output_dir = _get_work_dir() / document_id
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


def _find_original_file(document_id: str) -> tuple[Path, str]:
    """查找已保存的原始文件，返回 (路径, 文件类型)"""
    for ext in SUPPORTED_EXTENSIONS:
        path = _get_original_dir() / f"{document_id}.{ext}"
        if path.exists():
            return path, ext
    raise HTTPException(status_code=404, detail="未找到原始文件")


async def quick_upload_document(file: UploadFile) -> DocumentDetail:
    """快速上传：保存文件，创建 DB 记录（recognizing 状态），立即返回"""
    ensure_storage()
    document_id = uuid.uuid4().hex
    file_path, file_type = await save_upload(file, document_id)
    filename = file.filename or file_path.name
    stem = Path(filename).stem or "无标题文档"
    title = stem
    timestamp = mysql_datetime()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO documents
            (id, user_id, title, content, content_hash, rag_status, language, last_saved_at, last_indexed_at, glossary_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                document_id,
                current_user_id(),
                title,
                "",
                content_hash(""),
                "recognizing",
                "zh",
                timestamp,
                None,
                "[]",
            ),
        )

    return get_document(document_id)


async def recognize_document(document_id: str, model_config: RuntimeModelConfig) -> DocumentDetail:
    """视觉识别：对已保存的文件执行图片转换 + 视觉模型识别，更新文档内容"""
    get_document(document_id)
    file_path, file_type = _find_original_file(document_id)
    image_urls = file_to_image_urls(file_path, file_type, document_id)
    content = await recognize_pages(image_urls, model_config)
    title = infer_title(file_path.name, content)
    paragraphs = markdown_to_paragraph_inputs(content, title)
    title = title_from_paragraphs(paragraphs, title)
    content = paragraphs_to_markdown(paragraphs)
    language = detect_document_language(f"{title}\n{content}")
    timestamp = mysql_datetime()
    with connect() as conn:
        conn.execute(
            "UPDATE documents SET title = %s, content = %s, content_hash = %s, rag_status = %s, language = %s, last_saved_at = %s WHERE id = %s",
            (title, content, content_hash(content), "not_indexed", language, timestamp, document_id),
        )
        replace_document_paragraphs(conn, document_id, paragraphs, timestamp)

    return get_document(document_id)


async def upload_and_parse_document(file: UploadFile, model_config: RuntimeModelConfig) -> DocumentDetail:
    """完整上传解析流程（保持兼容）"""
    doc = await quick_upload_document(file, model_config)
    return await recognize_document(doc.id, model_config)

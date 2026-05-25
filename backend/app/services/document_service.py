import asyncio
import base64
import hashlib
import os
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
from app.schemas.documents import DocumentCreateRequest, DocumentDetail, DocumentSummary, DocumentUpdateRequest
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
                last_indexed_at TEXT
            )
            """
        )
        conn.commit()


def connect() -> sqlite3.Connection:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_summary(row: sqlite3.Row) -> DocumentSummary:
    return DocumentSummary(
        id=row["id"],
        title=row["title"],
        content_hash=row["content_hash"],
        rag_status=row["rag_status"],
        last_saved_at=datetime.fromisoformat(row["last_saved_at"]),
        last_indexed_at=datetime.fromisoformat(row["last_indexed_at"]) if row["last_indexed_at"] else None,
    )


def row_to_detail(row: sqlite3.Row) -> DocumentDetail:
    return DocumentDetail(**row_to_summary(row).model_dump(), content=row["content"])


def list_documents() -> list[DocumentSummary]:
    ensure_storage()
    with connect() as conn:
        rows = conn.execute("SELECT * FROM documents ORDER BY last_saved_at DESC").fetchall()
    return [row_to_summary(row) for row in rows]


def get_document(document_id: str) -> DocumentDetail:
    ensure_storage()
    with connect() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row_to_detail(row)


def delete_document(document_id: str) -> None:
    ensure_storage()
    get_document(document_id)
    from app.services.rag_service import delete_document_index

    delete_document_index(document_id)
    with connect() as conn:
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
    title = payload.title.strip() or "无标题文档"
    content = payload.content or ""
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO documents (id, title, content, content_hash, rag_status, last_saved_at, last_indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, title, content, content_hash(content), "not_indexed", timestamp, None),
        )
        conn.commit()
    return get_document(document_id)


def update_document(document_id: str, payload: DocumentUpdateRequest) -> DocumentDetail:
    current = get_document(document_id)
    next_title = payload.title if payload.title is not None else current.title
    next_content = payload.content if payload.content is not None else current.content
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
            SET title = ?, content = ?, content_hash = ?, rag_status = ?, last_saved_at = ?
            WHERE id = ?
            """,
            (next_title.strip() or "无标题文档", next_content, next_hash, next_status, timestamp, document_id),
        )
        conn.commit()
    return get_document(document_id)


def mark_document_indexing(document_id: str) -> DocumentDetail:
    get_document(document_id)
    with connect() as conn:
        conn.execute("UPDATE documents SET rag_status = ? WHERE id = ?", ("indexing", document_id))
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
    timestamp = now_utc().isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO documents (id, title, content, content_hash, rag_status, last_saved_at, last_indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, title, content, content_hash(content), "not_indexed", timestamp, None),
        )
        conn.commit()
    return get_document(document_id)

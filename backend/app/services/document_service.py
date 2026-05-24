import asyncio
import base64
import json
import os
import shutil
import subprocess
import textwrap
import uuid
from datetime import UTC, datetime
from pathlib import Path

import fitz
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageDraw, ImageFont

from app.prompts.documents import DOCUMENT_VISION_PROMPT
from app.schemas.documents import DocumentCreateRequest, DocumentDetail, DocumentFileType, DocumentSummary
from app.services.llm_client import RuntimeModelConfig, call_vision_model


STORAGE_ROOT = Path(__file__).resolve().parents[1] / "storage" / "documents"
ORIGINAL_DIR = STORAGE_ROOT / "originals"
RECORD_DIR = STORAGE_ROOT / "records"
WORK_DIR = STORAGE_ROOT / "work"
INDEX_PATH = STORAGE_ROOT / "index.json"
SUPPORTED_EXTENSIONS = {"txt", "md", "doc", "docx", "pdf", "ppt", "pptx"}


def ensure_storage() -> None:
    ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    RECORD_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    if not INDEX_PATH.exists():
        INDEX_PATH.write_text("[]", encoding="utf-8")


def now_utc() -> datetime:
    return datetime.now(UTC)


def read_index() -> list[dict]:
    ensure_storage()
    try:
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_index(items: list[dict]) -> None:
    ensure_storage()
    INDEX_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def infer_title(filename: str, content: str = "") -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or Path(filename).stem
    return Path(filename).stem or "无标题文档"


def summary_from_record(record: dict) -> DocumentSummary:
    return DocumentSummary(
        id=record["id"],
        title=record["title"],
        filename=record["filename"],
        file_type=record["file_type"],
        uploaded_at=datetime.fromisoformat(record["uploaded_at"]),
        updated_at=datetime.fromisoformat(record["updated_at"]),
        parse_method=record["parse_method"],
    )


def list_documents() -> list[DocumentSummary]:
    records = sorted(read_index(), key=lambda item: item["updated_at"], reverse=True)
    return [summary_from_record(record) for record in records]


def get_document(document_id: str) -> DocumentDetail:
    for record in read_index():
        if record["id"] == document_id:
            content_path = RECORD_DIR / f"{document_id}.txt"
            content = content_path.read_text(encoding="utf-8") if content_path.exists() else ""
            return DocumentDetail(**summary_from_record(record).model_dump(), content=content)
    raise HTTPException(status_code=404, detail="document not found")


def save_record(record: dict, content: str) -> DocumentDetail:
    ensure_storage()
    content_path = RECORD_DIR / f"{record['id']}.txt"
    content_path.write_text(content, encoding="utf-8")
    records = [item for item in read_index() if item["id"] != record["id"]]
    records.append(record)
    write_index(records)
    return get_document(record["id"])


def create_document(payload: DocumentCreateRequest) -> DocumentDetail:
    document_id = uuid.uuid4().hex
    timestamp = now_utc().isoformat()
    title = payload.title.strip() or "无标题文档"
    record = {
        "id": document_id,
        "title": title,
        "filename": f"{title}.md",
        "file_type": "new",
        "uploaded_at": timestamp,
        "updated_at": timestamp,
        "parse_method": "manual",
    }
    return save_record(record, payload.content)


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
    document_id = uuid.uuid4().hex
    file_path, file_type = await save_upload(file, document_id)
    image_urls = file_to_image_urls(file_path, file_type, document_id)
    content = await recognize_pages(image_urls, model_config)
    timestamp = now_utc().isoformat()
    record = {
        "id": document_id,
        "title": infer_title(file.filename or file_path.name, content),
        "filename": file.filename or file_path.name,
        "file_type": file_type,
        "uploaded_at": timestamp,
        "updated_at": timestamp,
        "parse_method": "vision",
    }
    return save_record(record, content)

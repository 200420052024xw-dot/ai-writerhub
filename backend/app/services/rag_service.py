import asyncio
import hashlib
import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import AsyncGenerator

import httpx
from fastapi import HTTPException

from app.core.config import get_settings
from app.schemas.documents import DocumentDetail
from app.schemas.rag import RagRuntimeConfig, RagSearchResult
from app.services.auth_service import current_user_id
from app.services.document_service import connect, get_document
from app.services.llm_client import RuntimeModelConfig, stream_chat_model


CHROMA_DIR = Path(__file__).resolve().parents[1] / "storage" / "chroma"
COLLECTION_NAME = "writerhub_documents"
TARGET_CHUNK_SIZE = 520
OVERLAP_SIZE = 100
VECTOR_TOP_K = 12
FINAL_TOP_K = 5


def embeddings_url(base_url: str) -> str:
    url = base_url.strip().rstrip("/} \t\r\n")
    if url.endswith("/embeddings") or url.endswith("/embeddings/multimodal"):
        return url
    return f"{url}/embeddings"


def provider_base_url(base_url: str) -> str:
    url = base_url.strip().rstrip("/} \t\r\n")
    for suffix in ("/embeddings/multimodal", "/embeddings"):
        if url.endswith(suffix):
            return url[: -len(suffix)]
    return url


def runtime_rag_config(config: RagRuntimeConfig | None = None) -> RagRuntimeConfig:
    if config:
        if config.use_system_model:
            return with_system_rag_credentials(config)
        return config
    settings = get_settings()
    return RagRuntimeConfig(
        embedding_source="api" if settings.rag_embedding_source == "api" else "local",
        local_model_path=settings.rag_local_model_path,
        api_key=settings.rag_api_key,
        base_url=settings.rag_base_url,
        model=settings.rag_model,
        recall_strategy="vector" if settings.rag_recall_strategy == "vector" else "hybrid",
        enable_rerank=settings.rag_enable_rerank,
        rerank_model_path=settings.rag_rerank_model_path,
    )


def _get_system_rag_setting(key: str) -> str:
    from app.core.database import _ConnectionCtx
    with _ConnectionCtx() as conn:
        row = conn.execute(
            "SELECT setting_value FROM system_settings WHERE setting_key = %s",
            (key,),
        ).fetchone()
    return row["setting_value"] if row else ""


def require_system_rag_member() -> None:
    from app.core.database import _ConnectionCtx
    with _ConnectionCtx() as conn:
        row = conn.execute(
            "SELECT is_member FROM users WHERE id = %s",
            (current_user_id(),),
        ).fetchone()
    if not row or not row["is_member"]:
        raise HTTPException(status_code=403, detail="需要会员权限")


def with_system_rag_credentials(config: RagRuntimeConfig) -> RagRuntimeConfig:
    """Fill member-only system RAG credentials without exposing keys to the frontend."""
    if config.embedding_source != "api":
        return config
    require_system_rag_member()
    return config.model_copy(
        update={
            "api_key": config.api_key.strip() or _get_system_rag_setting("system_rag_api_key"),
            "base_url": config.base_url.strip() or _get_system_rag_setting("system_rag_base_url"),
            "model": config.model.strip() or _get_system_rag_setting("system_rag_model"),
            "rerank_model_path": config.rerank_model_path.strip() or _get_system_rag_setting("system_rag_rerank_model_path"),
        }
    )


@lru_cache(maxsize=2)
def load_local_embedding_model(model_path: str):
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="未安装 sentence-transformers，请先安装后端依赖") from exc
    return SentenceTransformer(model_path)


def collection_name_for_config(config: RagRuntimeConfig | None = None) -> str:
    if config is None:
        return COLLECTION_NAME
    signature = "|".join(
        [
            config.embedding_source.strip(),
            config.base_url.strip().rstrip("/} \t\r\n"),
            config.model.strip(),
            config.local_model_path.strip(),
        ]
    )
    digest = hashlib.sha256(signature.encode("utf-8")).hexdigest()[:16]
    return f"{COLLECTION_NAME}_{digest}"


def chroma_collection(config: RagRuntimeConfig | None = None):
    try:
        import chromadb
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="未安装 chromadb，请先安装后端依赖") from exc
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(name=collection_name_for_config(config), metadata={"hnsw:space": "cosine"})


async def embed_texts(texts: list[str], config: RagRuntimeConfig) -> list[list[float]]:
    if config.embedding_source == "api":
        if not config.api_key.strip() or not config.base_url.strip() or not config.model.strip():
            raise HTTPException(status_code=400, detail="API embedding 配置不完整")

        base_url = config.base_url.strip().rstrip("/} \t\r\n")

        # 火山方舟使用不同的端点和格式
        if "volces.com" in base_url:
            url = base_url if base_url.endswith("/embeddings/multimodal") else f"{base_url}/embeddings/multimodal"
            headers = {"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}
            # 火山方舟需要将文本包装为多模态格式
            input_items = [{"type": "text", "text": text} for text in texts]
            payload = {"model": config.model, "input": input_items, "encoding_format": "float"}
        else:
            # 轨迹流动 (SiliconFlow) 和其他 OpenAI 兼容接口
            url = embeddings_url(base_url)
            headers = {"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}
            payload = {"model": config.model, "input": texts}

        try:
            async with httpx.AsyncClient(timeout=None) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"Embedding provider returned {exc.response.status_code}: {exc.response.text}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Embedding provider request failed: {exc}") from exc
        data = response.json()

        # 火山方舟返回格式不同
        if "volces.com" in base_url:
            # 火山方舟返回 data.embedding 或 data[0].embedding
            embedding_data = data.get("data", {})
            if isinstance(embedding_data, dict):
                return [embedding_data.get("embedding", [])]
            elif isinstance(embedding_data, list):
                return [item.get("embedding", []) for item in embedding_data]
            return []

        return [item["embedding"] for item in data["data"]]

    model = load_local_embedding_model(config.local_model_path)
    embeddings = await asyncio.to_thread(
        model.encode,
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return embeddings.tolist()


async def test_embedding_model(config: RagRuntimeConfig) -> None:
    test_config = runtime_rag_config(config).model_copy(update={"embedding_source": "api"})
    vectors = await embed_texts(["Hello, world!"], test_config)
    if not vectors or not vectors[0]:
        raise HTTPException(status_code=502, detail="Embedding provider returned an empty vector")


def clean_document_content(content: str) -> str:
    text = re.sub(r"<!--\s*第\d+页\s*-->", "\n", content)
    text = re.sub(r"<[^>]+>", "", text)
    return text.replace("\r\n", "\n").strip()


def overlap_prefix(previous: str) -> str:
    compact = previous.strip()
    if len(compact) <= OVERLAP_SIZE:
        return compact
    return compact[-OVERLAP_SIZE:]


def split_document_chunks(content: str) -> list[str]:
    text = clean_document_content(content)
    if not text:
        return []

    blocks: list[str] = []
    current: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            if current:
                blocks.append("\n".join(current).strip())
                current = []
            continue
        if stripped.startswith("#") and current:
            blocks.append("\n".join(current).strip())
            current = [stripped]
        else:
            current.append(stripped)
    if current:
        blocks.append("\n".join(current).strip())

    chunks: list[str] = []
    current_chunk = ""
    for block in blocks:
        candidate = f"{current_chunk}\n\n{block}".strip() if current_chunk else block
        if len(candidate) <= TARGET_CHUNK_SIZE:
            current_chunk = candidate
            continue
        if current_chunk:
            chunks.append(current_chunk)
            prefix = overlap_prefix(current_chunk)
            current_chunk = f"{prefix}\n\n{block}".strip() if prefix else block
        else:
            current_chunk = block
        while len(current_chunk) > TARGET_CHUNK_SIZE + OVERLAP_SIZE:
            chunks.append(current_chunk[:TARGET_CHUNK_SIZE].strip())
            current_chunk = current_chunk[TARGET_CHUNK_SIZE - OVERLAP_SIZE :].strip()
    if current_chunk:
        chunks.append(current_chunk)
    return chunks


def paragraph_to_rag_text(content: str, paragraph_type: str, level: int) -> str:
    if paragraph_type == "heading":
        return f"{'#' * max(2, min(5, level + 1))} {content}".strip()
    return content


def split_document_paragraph_chunks(document: DocumentDetail) -> list[tuple[str | None, int | None, str]]:
    if not document.paragraphs:
        return []

    chunks: list[tuple[str | None, int | None, str]] = []
    current_heading = ""
    for paragraph in document.paragraphs:
        if paragraph.type == "title":
            current_heading = paragraph.content.strip()
            continue
        text = paragraph_to_rag_text(paragraph.content, paragraph.type, paragraph.level)
        if not text.strip():
            continue
        if paragraph.type == "heading":
            current_heading = paragraph.content.strip()
            chunks.append((paragraph.id, paragraph.paragraph_index, text))
            continue
        source = f"{current_heading}\n\n{text}".strip() if current_heading else text
        for chunk in split_document_chunks(source):
            chunks.append((paragraph.id, paragraph.paragraph_index, chunk))
    return chunks


def delete_document_index(document_id: str, config: RagRuntimeConfig | None = None) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM rag_chunks WHERE document_id = %s", (document_id,))
    try:
        chroma_collection(config).delete(where={"document_id": document_id})
    except Exception:
        pass


async def index_document_chunks(document: DocumentDetail, config: RagRuntimeConfig | None = None) -> int:
    rag_config = runtime_rag_config(config)
    delete_document_index(document.id, rag_config)
    paragraph_chunks = split_document_paragraph_chunks(document)
    if not paragraph_chunks:
        return 0
    chunks = [chunk for _, _, chunk in paragraph_chunks]

    embeddings = await embed_texts(chunks, rag_config)
    ids = [f"{document.id}:{index}" for index in range(len(chunks))]
    metadatas = [
        {
            "document_id": document.id,
            "user_id": current_user_id(),
            "document_title": document.title,
            "paragraph_id": paragraph_id or "",
            "paragraph_index": paragraph_index if paragraph_index is not None else -1,
            "chunk_index": index,
            "content_hash": document.content_hash,
        }
        for index, (paragraph_id, paragraph_index, _) in enumerate(paragraph_chunks)
    ]
    chroma_collection(rag_config).add(ids=ids, documents=chunks, metadatas=metadatas, embeddings=embeddings)

    with connect() as conn:
        for chunk_id, chunk, metadata in zip(ids, chunks, metadatas):
            conn.execute(
                """
                REPLACE INTO rag_chunks
                (chunk_id, document_id, document_title, paragraph_id, paragraph_index, chunk_index, content, content_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    chunk_id,
                    document.id,
                    document.title,
                    metadata["paragraph_id"],
                    metadata["paragraph_index"],
                    metadata["chunk_index"],
                    chunk,
                    document.content_hash,
                ),
            )
    return len(chunks)


def normalize_scores(items: list[RagSearchResult]) -> list[RagSearchResult]:
    if not items:
        return items
    scores = [item.score for item in items]
    low, high = min(scores), max(scores)
    if math.isclose(low, high):
        return [item.model_copy(update={"score": 1.0}) for item in items]
    return [item.model_copy(update={"score": (item.score - low) / (high - low)}) for item in items]


async def vector_search(question: str, document_ids: list[str], config: RagRuntimeConfig) -> list[RagSearchResult]:
    query_embedding = (await embed_texts([question], config))[0]
    where = {
        "$and": [
            {"user_id": current_user_id()},
            {"document_id": {"$in": document_ids}},
        ]
    }
    result = chroma_collection(config).query(
        query_embeddings=[query_embedding],
        n_results=VECTOR_TOP_K,
        where=where,
    )
    ids = result.get("ids", [[]])[0]
    docs = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    items: list[RagSearchResult] = []
    for chunk_id, content, metadata, distance in zip(ids, docs, metadatas, distances):
        items.append(
            RagSearchResult(
                chunk_id=chunk_id,
                document_id=metadata["document_id"],
                document_title=metadata["document_title"],
                paragraph_id=str(metadata.get("paragraph_id") or "") or None,
                paragraph_index=int(metadata["paragraph_index"]) if int(metadata.get("paragraph_index", -1)) >= 0 else None,
                chunk_index=int(metadata["chunk_index"]),
                content=content,
                score=max(0.0, 1.0 - float(distance)),
                source="vector",
            )
        )
    return items


def fts_query_text(question: str) -> str:
    words = re.findall(r"[\w\u4e00-\u9fff]+", question)
    return " ".join(f"+{w}*" for w in words[:12]) or question


def fts_search(question: str, document_ids: list[str]) -> list[RagSearchResult]:
    query_text = fts_query_text(question)
    doc_filter = ""
    args: list[object] = [query_text, query_text, current_user_id()]
    if document_ids:
        placeholders = ",".join("%s" for _ in document_ids)
        doc_filter = f" AND r.document_id IN ({placeholders})"
        args.extend(document_ids)
    args.append(VECTOR_TOP_K)
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT
                r.chunk_id,
                r.document_id,
                r.document_title,
                r.paragraph_id,
                r.paragraph_index,
                r.content,
                MATCH(r.content, r.document_title) AGAINST(%s IN BOOLEAN MODE) AS rank
            FROM rag_chunks r
            JOIN documents d ON d.id = r.document_id
            WHERE MATCH(r.content, r.document_title) AGAINST(%s IN BOOLEAN MODE)
              AND d.user_id = %s{doc_filter}
            ORDER BY rank DESC
            LIMIT %s
            """,
            args,
        ).fetchall()
    items = [
        RagSearchResult(
            chunk_id=row["chunk_id"],
            document_id=row["document_id"],
            document_title=row["document_title"],
            paragraph_id=row["paragraph_id"] or None,
            paragraph_index=row["paragraph_index"],
            chunk_index=int(str(row["chunk_id"]).split(":")[-1]),
            content=row["content"],
            score=float(row["rank"]),
            source="fulltext",
        )
        for row in rows
    ]
    return normalize_scores(items)


def merge_results(vector_items: list[RagSearchResult], fts_items: list[RagSearchResult]) -> list[RagSearchResult]:
    merged: dict[str, RagSearchResult] = {}
    for item in normalize_scores(vector_items):
        merged[item.chunk_id] = item
    for item in normalize_scores(fts_items):
        if item.chunk_id in merged:
            current = merged[item.chunk_id]
            merged[item.chunk_id] = current.model_copy(update={"score": max(current.score, item.score), "source": "hybrid"})
        else:
            merged[item.chunk_id] = item
    return sorted(merged.values(), key=lambda item: item.score, reverse=True)


async def api_rerank(question: str, items: list[RagSearchResult], config: RagRuntimeConfig) -> list[RagSearchResult]:
    """\u4f7f\u7528 SiliconFlow Reranker API \u8fdb\u884c\u91cd\u6392\u5e8f"""
    if not config.api_key.strip() or not config.rerank_model_path.strip():
        # \u56de\u9000\u5230\u672c\u5730 rerank
        return local_rerank(question, items)

    url = f"{provider_base_url(config.base_url)}/rerank"
    headers = {"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}
    payload = {
        "model": config.rerank_model_path,
        "query": question,
        "documents": [item.content for item in items],
        "top_n": len(items),
        "return_documents": False,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        data = response.json()
        results = data.get("results", [])

        # \u6784\u5efa\u7d22\u5f15\u5230\u7ed3\u679c\u7684\u6620\u5c04
        reranked_map = {r["index"]: r["relevance_score"] for r in results}
        reranked = []
        for i, item in enumerate(items):
            score = reranked_map.get(i, item.score)
            reranked.append(item.model_copy(update={"score": score}))
        return sorted(reranked, key=lambda x: x.score, reverse=True)
    except Exception:
        # API \u8c03\u7528\u5931\u8d25\u65f6\u56de\u9000\u5230\u672c\u5730 rerank
        return local_rerank(question, items)


def local_rerank(question: str, items: list[RagSearchResult]) -> list[RagSearchResult]:
    """\u672c\u5730\u8bcd\u6cd5\u5339\u914d rerank"""
    query_terms = set(re.findall(r"[\w\u4e00-\u9fff]+", question.lower()))
    if not query_terms:
        return items
    reranked: list[RagSearchResult] = []
    for item in items:
        content_terms = set(re.findall(r"[\w\u4e00-\u9fff]+", item.content.lower()))
        lexical = len(query_terms & content_terms) / max(1, len(query_terms))
        reranked.append(item.model_copy(update={"score": item.score * 0.7 + lexical * 0.3}))
    return sorted(reranked, key=lambda result: result.score, reverse=True)


async def maybe_rerank(question: str, items: list[RagSearchResult], config: RagRuntimeConfig) -> list[RagSearchResult]:
    if not config.enable_rerank or not items:
        return items

    # \u5982\u679c\u4f7f\u7528 API embedding \u4e14\u6709 reranker \u6a21\u578b\uff0c\u4f7f\u7528 API rerank
    if config.embedding_source == "api" and config.rerank_model_path.strip():
        return await api_rerank(question, items, config)

    # \u5426\u5219\u4f7f\u7528\u672c\u5730 rerank
    return local_rerank(question, items)


async def retrieve(question: str, document_ids: list[str], config: RagRuntimeConfig | None = None) -> list[RagSearchResult]:
    rag_config = runtime_rag_config(config)
    if not document_ids:
        return []
    for document_id in set(document_ids):
        get_document(document_id)
    vector_items = await vector_search(question, document_ids, rag_config)
    if rag_config.recall_strategy == "hybrid":
        items = merge_results(vector_items, fts_search(question, document_ids))
    else:
        items = normalize_scores(vector_items)
    items = await maybe_rerank(question, items, rag_config)
    return items[:FINAL_TOP_K]


def build_rag_messages(question: str, contexts: list[RagSearchResult]) -> list[dict[str, str]]:
    context_text = "\n\n".join(
        f"[{index}] 来源：{item.document_title}，片段 {item.chunk_index + 1}\n{item.content}"
        for index, item in enumerate(contexts, start=1)
    )
    return [
        {
            "role": "system",
            "content": (
                "你是文枢 AI WriterHub 的知识库问答助手。只根据给定参考片段回答。"
                "回答中必须用 [1]、[2] 形式标注来源；如果资料不足，明确说明无法从当前文档确认。"
                "只使用纯文本输出，不要使用 Markdown 标题、表格、代码块、粗体、引用块或其他 Markdown 包装。"
                "保持段落清晰；如需分点，请使用普通编号或短句换行。"
            ),
        },
        {"role": "user", "content": f"参考片段：\n{context_text}\n\n问题：{question}"},
    ]


async def stream_rag_answer(
    question: str,
    document_ids: list[str],
    rag_config: RagRuntimeConfig | None,
    chat_config: RuntimeModelConfig,
) -> AsyncGenerator[str, None]:
    contexts = await retrieve(question, document_ids, rag_config)
    yield f"data: {json.dumps({'type': 'retrieval', 'results': [item.model_dump() for item in contexts]}, ensure_ascii=False)}\n\n"
    if not contexts:
        yield f"data: {json.dumps({'type': 'chunk', 'content': '未找到可用的检索结果，请先选择并解析文档。'}, ensure_ascii=False)}\n\n"
        yield "data: {\"type\":\"complete\"}\n\n"
        return
    buffer = ""
    async for chunk in stream_chat_model(build_rag_messages(question, contexts), chat_config):
        buffer += chunk.decode("utf-8", errors="ignore")
        parts = buffer.split("\n\n")
        buffer = parts.pop() or ""
        for part in parts:
            for line in part.splitlines():
                if not line.startswith("data:"):
                    continue
                data = line.removeprefix("data:").strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choice = parsed.get("choices", [{}])[0]
                delta = choice.get("delta", {}).get("content") or choice.get("message", {}).get("content")
                if delta:
                    yield f"data: {json.dumps({'type': 'chunk', 'content': delta}, ensure_ascii=False)}\n\n"
    yield "data: {\"type\":\"complete\"}\n\n"

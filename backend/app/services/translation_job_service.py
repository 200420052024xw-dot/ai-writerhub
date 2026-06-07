import asyncio
import json
import uuid

from app.core.database import mysql_datetime, parse_database_datetime
from app.services.auth_service import current_user_id
from app.schemas.translation import (
    TranslationChunk,
    TranslationGranularity,
    TranslationJob,
    TranslationJobCreate,
    TranslationOptions,
    TranslationPair,
    TranslationSourceParagraph,
)
from app.services.document_service import connect, get_document
from app.services.llm_client import RuntimeModelConfig
from app.services.translation_service import (
    build_sentence_units,
    chunk_structured_units,
    paragraph_pairs_from_sentence_pairs,
    sentence_pairs_from_structured_units,
    should_use_long_text_strategy,
    source_text_from_paragraphs,
    summarize_for_context,
    translate_structured_unit_chunk,
)
from app.services.translation_state_service import (
    save_translation_version,
    source_hash_for_document,
)


ACTIVE_TASKS: dict[str, asyncio.Task] = {}
MAX_CONCURRENCY = 3
MAX_ATTEMPTS = 3


def _now() -> str:
    return mysql_datetime()


def _row_to_job(row) -> TranslationJob:
    return TranslationJob(
        id=row["id"],
        document_id=row["document_id"],
        direction=row["direction"],
        granularity=row["granularity"],
        status=row["status"],
        total_chunks=row["total_chunks"],
        completed_chunks=row["completed_chunks"],
        error=row["error"],
        created_at=parse_database_datetime(row["created_at"]),
        updated_at=parse_database_datetime(row["updated_at"]),
        completed_at=parse_database_datetime(row["completed_at"]) if row["completed_at"] else None,
    )


def mark_interrupted_jobs() -> None:
    timestamp = _now()
    with connect() as conn:
        conn.execute(
            """
            UPDATE translation_jobs
            SET status = 'interrupted', error = 'Backend restarted before completion', updated_at = %s
            WHERE status IN ('queued', 'running')
            """,
            (timestamp,),
        )


def get_translation_job(job_id: str) -> TranslationJob | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT j.* FROM translation_jobs j
            JOIN documents d ON d.id = j.document_id
            WHERE j.id = %s AND d.user_id = %s
            """,
            (job_id, current_user_id()),
        ).fetchone()
    return _row_to_job(row) if row else None


def list_translation_jobs(document_id: str | None = None, active_only: bool = False) -> list[TranslationJob]:
    clauses: list[str] = ["d.user_id = %s"]
    params: list[str] = [current_user_id()]
    if document_id:
        get_document(document_id)
        clauses.append("j.document_id = %s")
        params.append(document_id)
    if active_only:
        clauses.append("j.status IN ('queued', 'running')")
    where = f"WHERE {' AND '.join(clauses)}"
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT j.* FROM translation_jobs j
            JOIN documents d ON d.id = j.document_id
            {where}
            ORDER BY j.created_at DESC
            """,
            params,
        ).fetchall()
    return [_row_to_job(row) for row in rows]


def _set_job(
    job_id: str,
    *,
    status: str | None = None,
    total_chunks: int | None = None,
    completed_chunks: int | None = None,
    error: str | None = None,
    completed: bool = False,
) -> None:
    assignments = ["updated_at = %s"]
    params: list[object] = [_now()]
    if status is not None:
        assignments.append("status = %s")
        params.append(status)
    if total_chunks is not None:
        assignments.append("total_chunks = %s")
        params.append(total_chunks)
    if completed_chunks is not None:
        assignments.append("completed_chunks = %s")
        params.append(completed_chunks)
    if error is not None:
        assignments.append("error = %s")
        params.append(error)
    if completed:
        assignments.append("completed_at = %s")
        params.append(_now())
    params.append(job_id)
    with connect() as conn:
        conn.execute(f"UPDATE translation_jobs SET {', '.join(assignments)} WHERE id = %s", params)


async def _translate_with_retry(
    unit_chunk: list[dict],
    direction: str,
    options: TranslationOptions,
    context_summary: str,
    glossary,
    model_config: RuntimeModelConfig,
) -> dict[str, str]:
    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            return await translate_structured_unit_chunk(
                unit_chunk,
                direction,
                options,
                context_summary,
                glossary,
                model_config,
            )
        except Exception as exc:
            last_error = exc
            if attempt < MAX_ATTEMPTS - 1:
                await asyncio.sleep(1.5 * (attempt + 1))
    if last_error:
        raise last_error
    raise RuntimeError("Translation chunk failed")


async def _run_translation_job(
    job_id: str,
    document_id: str,
    payload: TranslationJobCreate,
    model_config: RuntimeModelConfig,
) -> None:
    try:
        document = get_document(document_id)
        paragraphs = [
            TranslationSourceParagraph(id=item.id, type=item.type, level=item.level, content=item.content)
            for item in document.paragraphs
            if item.content.strip()
        ]
        source_text = source_text_from_paragraphs(paragraphs)
        source_hash = source_hash_for_document(document)
        # Sentence IDs are the canonical model contract. Paragraph results are
        # assembled from the same translated sentence pairs so both views stay
        # available after one translation job.
        units = build_sentence_units(paragraphs)
        unit_chunks = chunk_structured_units(units)
        _set_job(job_id, status="running", total_chunks=len(unit_chunks), completed_chunks=0, error="")

        use_context = should_use_long_text_strategy(source_text)
        context_summary = (
            await summarize_for_context(
                source_text,
                payload.direction,
                payload.options,
                payload.glossary or None,
                model_config,
            )
            if use_context
            else ""
        )

        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
        completed_count = 0
        count_lock = asyncio.Lock()
        completed_translations: dict[str, str] = {}
        completed_parts: dict[int, tuple[list[dict], dict[str, str]]] = {}

        def build_chunk(index: int, unit_chunk: list[dict], translated: dict[str, str]) -> TranslationChunk:
            sentence_pairs = sentence_pairs_from_structured_units(unit_chunk, translated)
            paragraph_ids = {unit["paragraph_id"] for unit in unit_chunk}
            paragraph_pairs = paragraph_pairs_from_sentence_pairs(
                [paragraph for paragraph in paragraphs if paragraph.id in paragraph_ids],
                sentence_pairs,
            )
            return TranslationChunk(
                index=index,
                source="\n\n".join(unit["text"] for unit in unit_chunk),
                target="\n\n".join(translated.get(unit["id"], "") for unit in unit_chunk),
                paragraph_pairs=paragraph_pairs,
                sentence_pairs=sentence_pairs,
            )

        async def translate_one(index: int, unit_chunk: list[dict]):
            nonlocal completed_count
            async with semaphore:
                translated = await _translate_with_retry(
                    unit_chunk,
                    payload.direction,
                    payload.options,
                    context_summary,
                    payload.glossary or None,
                    model_config,
                )
            async with count_lock:
                completed_count += 1
                completed_translations.update(translated)
                completed_parts[index] = (unit_chunk, translated)

                # Persist every completed chunk. Workspace polling can therefore
                # render both paragraph and sentence views while the job runs.
                sentence_pairs = sentence_pairs_from_structured_units(units, completed_translations)
                paragraph_pairs = paragraph_pairs_from_sentence_pairs(paragraphs, sentence_pairs)
                partial_chunks = [
                    build_chunk(chunk_index, chunk_units, chunk_translated)
                    for chunk_index, (chunk_units, chunk_translated) in sorted(completed_parts.items())
                ]
                save_translation_version(
                    document_id=document_id,
                    direction=payload.direction,
                    granularity=payload.granularity,
                    source_text=source_text,
                    source_hash=source_hash,
                    target_text="\n\n".join(pair.target for pair in paragraph_pairs if pair.target.strip()),
                    context_summary=context_summary,
                    used_context_summary=use_context,
                    chunks=partial_chunks,
                    paragraph_pairs=paragraph_pairs,
                    sentence_pairs=sentence_pairs,
                    options=payload.options,
                )
                _set_job(job_id, completed_chunks=completed_count)
            return index, unit_chunk, translated

        translated_parts = await asyncio.gather(
            *(translate_one(index, chunk) for index, chunk in enumerate(unit_chunks, start=1))
        )
        translated_parts.sort(key=lambda item: item[0])

        all_translated: dict[str, str] = {}
        chunks: list[TranslationChunk] = []
        for index, unit_chunk, translated in translated_parts:
            all_translated.update(translated)
            chunks.append(build_chunk(index, unit_chunk, translated))

        sentence_pairs = sentence_pairs_from_structured_units(units, all_translated)
        paragraph_pairs = paragraph_pairs_from_sentence_pairs(paragraphs, sentence_pairs)
        target_text = "\n\n".join(pair.target for pair in paragraph_pairs if pair.target.strip())

        save_translation_version(
            document_id=document_id,
            direction=payload.direction,
            granularity=payload.granularity,
            source_text=source_text,
            source_hash=source_hash,
            target_text=target_text,
            context_summary=context_summary,
            used_context_summary=use_context,
            chunks=chunks,
            paragraph_pairs=paragraph_pairs,
            sentence_pairs=sentence_pairs,
            options=payload.options,
        )
        _set_job(
            job_id,
            status="completed",
            completed_chunks=len(unit_chunks),
            error="",
            completed=True,
        )
    except Exception as exc:
        _set_job(job_id, status="failed", error=str(exc), completed=True)
    finally:
        ACTIVE_TASKS.pop(job_id, None)


def create_translation_job(document_id: str, payload: TranslationJobCreate) -> TranslationJob:
    get_document(document_id)
    existing = next(
        (
            job
            for job in list_translation_jobs(document_id, active_only=True)
            if job.direction == payload.direction
        ),
        None,
    )
    if existing:
        return existing

    job_id = uuid.uuid4().hex
    timestamp = _now()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO translation_jobs
            (id, document_id, direction, granularity, status, total_chunks, completed_chunks,
             error, created_at, updated_at, completed_at)
            VALUES (%s, %s, %s, %s, 'queued', 0, 0, '', %s, %s, NULL)
            """,
            (job_id, document_id, payload.direction, payload.granularity, timestamp, timestamp),
        )
    model_config = RuntimeModelConfig(
        api_key=payload.ai_config.api_key,
        base_url=payload.ai_config.base_url,
        model=payload.ai_config.model,
    )
    task = asyncio.create_task(_run_translation_job(job_id, document_id, payload, model_config))
    ACTIVE_TASKS[job_id] = task
    job = get_translation_job(job_id)
    if job is None:
        raise RuntimeError("Translation job creation failed")
    return job

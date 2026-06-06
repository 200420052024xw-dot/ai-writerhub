import pymysql
from pymysql.cursors import DictCursor

from app.core.config import get_settings


def _connection_params(database: str | None = None) -> dict:
    s = get_settings()
    return dict(
        host=s.db_host,
        port=s.db_port,
        user=s.db_user,
        password=s.db_password,
        database=database or s.db_name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True,
    )


def ensure_database() -> None:
    """确保数据库存在"""
    s = get_settings()
    params = _connection_params(database=None)
    params.pop("database")
    conn = pymysql.connect(**params)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{s.db_name}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        conn.close()


def get_connection() -> pymysql.Connection:
    """获取数据库连接（DictCursor，autocommit）"""
    ensure_database()
    return pymysql.connect(**_connection_params())


class _CursorWrapper:
    """包装 pymysql Cursor，使 conn.execute/fetchall/fetchone 等 sqlite3 风格调用可用"""

    def __init__(self, conn: pymysql.Connection):
        self._conn = conn
        self._cur = conn.cursor()

    def execute(self, query: str, args=None):
        self._cur.execute(query, args)
        return self

    def fetchall(self):
        return self._cur.fetchall()

    def fetchone(self):
        return self._cur.fetchone()

    def commit(self):
        pass  # autocommit

    def close(self):
        try:
            self._cur.close()
        except Exception:
            pass
        self._conn.close()


class _ConnectionCtx:
    """让 connect() 支持 with 语句的上下文管理器"""

    def __init__(self):
        self._conn = get_connection()

    def __enter__(self) -> _CursorWrapper:
        return _CursorWrapper(self._conn)

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._conn.close()
        return False


def ensure_tables() -> None:
    """确保所有表存在"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # documents
            cur.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id VARCHAR(64) PRIMARY KEY,
                    title TEXT NOT NULL,
                    content LONGTEXT NOT NULL,
                    content_hash VARCHAR(128) NOT NULL,
                    rag_status VARCHAR(32) NOT NULL,
                    language VARCHAR(8) NOT NULL DEFAULT 'zh',
                    last_saved_at DATETIME(6) NOT NULL,
                    last_indexed_at DATETIME(6) NULL,
                    glossary_json TEXT NOT NULL,
                    deleted_at DATETIME(6) NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # document_paragraphs
            cur.execute("""
                CREATE TABLE IF NOT EXISTS document_paragraphs (
                    id VARCHAR(64) PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    paragraph_index INT NOT NULL,
                    type VARCHAR(32) NOT NULL,
                    level INT NOT NULL,
                    content TEXT NOT NULL,
                    content_hash VARCHAR(128) NOT NULL,
                    created_at DATETIME(6) NOT NULL,
                    updated_at DATETIME(6) NOT NULL,
                    INDEX idx_document_id (document_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # knowledge_conversations
            cur.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_conversations (
                    id VARCHAR(64) PRIMARY KEY,
                    title TEXT NOT NULL,
                    document_ids_json TEXT NOT NULL,
                    messages_json LONGTEXT NOT NULL,
                    search_results_json LONGTEXT NOT NULL,
                    turn_search_results_json LONGTEXT NOT NULL,
                    created_at DATETIME(6) NOT NULL,
                    updated_at DATETIME(6) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # document_assistant_messages
            cur.execute("""
                CREATE TABLE IF NOT EXISTS document_assistant_messages (
                    id VARCHAR(64) PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    role VARCHAR(32) NOT NULL,
                    content LONGTEXT NOT NULL,
                    created_at DATETIME(6) NOT NULL,
                    INDEX idx_document_id (document_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # document_translation_versions
            cur.execute("""
                CREATE TABLE IF NOT EXISTS document_translation_versions (
                    document_id VARCHAR(64) NOT NULL,
                    direction VARCHAR(32) NOT NULL,
                    granularity VARCHAR(32) NOT NULL,
                    source_text LONGTEXT NOT NULL,
                    source_hash VARCHAR(128) NOT NULL,
                    target_text LONGTEXT NOT NULL,
                    context_summary TEXT NOT NULL,
                    used_context_summary TINYINT NOT NULL,
                    chunks_json LONGTEXT NOT NULL,
                    paragraph_pairs_json LONGTEXT NOT NULL,
                    sentence_pairs_json LONGTEXT NOT NULL,
                    options_json TEXT NOT NULL,
                    updated_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (document_id, direction, granularity)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # translation_jobs
            cur.execute("""
                CREATE TABLE IF NOT EXISTS translation_jobs (
                    id VARCHAR(64) PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    direction VARCHAR(32) NOT NULL,
                    granularity VARCHAR(32) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    total_chunks INT NOT NULL,
                    completed_chunks INT NOT NULL,
                    error TEXT NOT NULL,
                    created_at DATETIME(6) NOT NULL,
                    updated_at DATETIME(6) NOT NULL,
                    completed_at DATETIME(6) NULL,
                    INDEX idx_document_id (document_id),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # rag_chunks
            cur.execute("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    chunk_id VARCHAR(64) PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    document_title TEXT NOT NULL,
                    paragraph_id VARCHAR(64) NULL,
                    paragraph_index INT NULL,
                    chunk_index INT NOT NULL,
                    content TEXT NOT NULL,
                    content_hash VARCHAR(128) NOT NULL,
                    INDEX idx_document_id (document_id),
                    FULLTEXT INDEX ft_content (content, document_title)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
    finally:
        conn.close()

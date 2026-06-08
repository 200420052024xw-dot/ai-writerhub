from datetime import UTC, datetime
from pathlib import Path

import pymysql
from dbutils.pooled_db import PooledDB
from pymysql.cursors import DictCursor

from app.core.config import get_settings

_SCHEMA_SQL = Path(__file__).resolve().parent / "schema.sql"

_pool: PooledDB | None = None


def mysql_datetime(value: datetime | None = None) -> str:
    """Format a UTC datetime for MySQL DATETIME columns."""
    current = value or datetime.now(UTC)
    if current.tzinfo is not None:
        current = current.astimezone(UTC).replace(tzinfo=None)
    return current.strftime("%Y-%m-%d %H:%M:%S")


def parse_database_datetime(value: datetime | str) -> datetime:
    """Accept both PyMySQL datetime values and legacy ISO strings."""
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


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


def _get_pool() -> PooledDB:
    global _pool
    if _pool is None:
        _pool = PooledDB(
            creator=pymysql,
            maxconnections=20,
            mincached=2,
            maxcached=10,
            blocking=True,
            **_connection_params(),
        )
    return _pool


def ensure_database() -> None:
    """确保数据库存在（仅启动时调用）"""
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


def get_connection():
    """从连接池获取数据库连接"""
    return _get_pool().connection()


class _CursorWrapper:
    """包装 pymysql Cursor，使 conn.execute/fetchall/fetchone 等 sqlite3 风格调用可用"""

    def __init__(self, conn):
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
        self._conn.close()  # 连接池的 close 是归还，不是真正关闭


class _ConnectionCtx:
    """让 connect() 支持 with 语句的上下文管理器"""

    def __init__(self):
        self._conn = get_connection()

    def __enter__(self) -> _CursorWrapper:
        return _CursorWrapper(self._conn)

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._conn.close()  # 归还到连接池
        return False


def ensure_tables() -> None:
    """从 schema.sql 读取建表语句并执行"""
    sql = _SCHEMA_SQL.read_text(encoding="utf-8")
    sql = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    params = _connection_params()
    conn = pymysql.connect(**params)
    try:
        with conn.cursor() as cur:
            for stmt in statements:
                cur.execute(stmt)
    finally:
        conn.close()


def _column_exists(cur, table: str, column: str) -> bool:
    settings = get_settings()
    cur.execute(
        """
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s
        """,
        (settings.db_name, table, column),
    )
    return cur.fetchone() is not None


def _index_exists(cur, table: str, index: str) -> bool:
    settings = get_settings()
    cur.execute(
        """
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND INDEX_NAME = %s
        """,
        (settings.db_name, table, index),
    )
    return cur.fetchone() is not None


def run_user_isolation_migration() -> bool:
    """Clear legacy business data and add ownership columns exactly once."""
    migration_key = "2026_06_07_user_isolation_v1"
    params = _connection_params()
    conn = pymysql.connect(**params)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM schema_migrations WHERE migration_key = %s", (migration_key,))
            if cur.fetchone():
                return False

            for table in (
                "rag_chunks",
                "translation_jobs",
                "document_translation_versions",
                "document_assistant_messages",
                "document_paragraphs",
                "knowledge_conversations",
                "documents",
            ):
                cur.execute(f"DELETE FROM `{table}`")

            if not _column_exists(cur, "documents", "user_id"):
                cur.execute("ALTER TABLE documents ADD COLUMN user_id VARCHAR(64) NOT NULL AFTER id")
            if not _index_exists(cur, "documents", "idx_documents_user_id"):
                cur.execute("CREATE INDEX idx_documents_user_id ON documents (user_id)")

            if not _column_exists(cur, "knowledge_conversations", "user_id"):
                cur.execute("ALTER TABLE knowledge_conversations ADD COLUMN user_id VARCHAR(64) NOT NULL AFTER id")
            if not _index_exists(cur, "knowledge_conversations", "idx_knowledge_conversations_user_id"):
                cur.execute(
                    "CREATE INDEX idx_knowledge_conversations_user_id ON knowledge_conversations (user_id)"
                )

            cur.execute(
                "INSERT INTO schema_migrations (migration_key, applied_at) VALUES (%s, %s)",
                (migration_key, mysql_datetime()),
            )
        return True
    finally:
        conn.close()


def run_add_email_migration() -> bool:
    """Add email column to users table."""
    migration_key = "2026_06_07_add_email_v1"
    params = _connection_params()
    conn = pymysql.connect(**params)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM schema_migrations WHERE migration_key = %s", (migration_key,))
            if cur.fetchone():
                return False

            if not _column_exists(cur, "users", "email"):
                cur.execute("ALTER TABLE users ADD COLUMN email VARCHAR(191) NULL DEFAULT NULL AFTER nickname")
            if not _index_exists(cur, "users", "uq_users_email"):
                cur.execute("CREATE UNIQUE INDEX uq_users_email ON users (email)")

            if not _index_exists(cur, "documents", "idx_documents_list"):
                cur.execute("CREATE INDEX idx_documents_list ON documents (user_id, deleted_at, last_saved_at)")

            cur.execute(
                "INSERT INTO schema_migrations (migration_key, applied_at) VALUES (%s, %s)",
                (migration_key, mysql_datetime()),
            )
        return True
    finally:
        conn.close()

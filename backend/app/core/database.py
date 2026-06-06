from pathlib import Path

import pymysql
from pymysql.cursors import DictCursor

from app.core.config import get_settings

_SCHEMA_SQL = Path(__file__).resolve().parent / "schema.sql"


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
    """从 schema.sql 读取建表语句并执行"""
    sql = _SCHEMA_SQL.read_text(encoding="utf-8")
    statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for stmt in statements:
                cur.execute(stmt)
    finally:
        conn.close()

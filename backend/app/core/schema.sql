-- WriterHub MySQL Schema
-- 后端启动时自动执行，也可手动运行

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(24) NOT NULL,
    username_normalized VARCHAR(24) NOT NULL,
    nickname VARCHAR(32) NOT NULL,
    email VARCHAR(191) NULL DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE INDEX uq_users_username_normalized (username_normalized),
    UNIQUE INDEX uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    INDEX idx_user_sessions_user_id (user_id),
    INDEX idx_user_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_key VARCHAR(128) PRIMARY KEY,
    applied_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    content LONGTEXT NOT NULL,
    content_hash VARCHAR(128) NOT NULL,
    rag_status VARCHAR(32) NOT NULL,
    language VARCHAR(8) NOT NULL DEFAULT 'zh',
    last_saved_at DATETIME(6) NOT NULL,
    last_indexed_at DATETIME(6) NULL,
    glossary_json TEXT NOT NULL,
    deleted_at DATETIME(6) NULL,
    INDEX idx_documents_user_id (user_id),
    INDEX idx_documents_list (user_id, deleted_at, last_saved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_conversations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    document_ids_json TEXT NOT NULL,
    messages_json LONGTEXT NOT NULL,
    search_results_json LONGTEXT NOT NULL,
    turn_search_results_json LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    INDEX idx_knowledge_conversations_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_assistant_messages (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    INDEX idx_document_id (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

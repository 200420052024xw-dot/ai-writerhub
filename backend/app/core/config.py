from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ai_provider: str = Field(default="deepseek", alias="AI_PROVIDER")
    ai_api_key: str = Field(default="", alias="AI_API_KEY")
    ai_base_url: str = Field(default="https://api.deepseek.com", alias="AI_BASE_URL")
    ai_default_model: str = Field(default="deepseek-chat", alias="AI_DEFAULT_MODEL")
    ai_timeout_seconds: int = Field(default=60, alias="AI_TIMEOUT_SECONDS")
    rag_embedding_source: str = Field(default="local", alias="RAG_EMBEDDING_SOURCE")
    rag_local_model_path: str = Field(default=r"F:\hf_cache\model", alias="RAG_LOCAL_MODEL_PATH")
    rag_api_key: str = Field(default="", alias="RAG_API_KEY")
    rag_base_url: str = Field(default="", alias="RAG_BASE_URL")
    rag_model: str = Field(default="", alias="RAG_MODEL")
    rag_recall_strategy: str = Field(default="vector", alias="RAG_RECALL_STRATEGY")
    rag_enable_rerank: bool = Field(default=False, alias="RAG_ENABLE_RERANK")
    rag_rerank_model_path: str = Field(
      default=r"F:\hf_cache\models--Qwen--Qwen3-Reranker-0.6B\snapshots\e61197ed45024b0ed8a2d74b80b4d909f1255473",
      alias="RAG_RERANK_MODEL_PATH",
    )

    # MySQL
    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=3306, alias="DB_PORT")
    db_user: str = Field(default="root", alias="DB_USER")
    db_password: str = Field(default="root", alias="DB_PASSWORD")
    db_name: str = Field(default="writerhub", alias="DB_NAME")

    model_config = SettingsConfigDict(
      env_file=".env",
      env_file_encoding="utf-8",
      extra="ignore",
    )

    @property
    def has_ai_key(self) -> bool:
        return bool(self.ai_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()

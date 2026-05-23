from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ai_provider: str = Field(default="deepseek", alias="AI_PROVIDER")
    ai_api_key: str = Field(default="", alias="AI_API_KEY")
    ai_base_url: str = Field(default="https://api.deepseek.com", alias="AI_BASE_URL")
    ai_default_model: str = Field(default="deepseek-chat", alias="AI_DEFAULT_MODEL")
    ai_timeout_seconds: int = Field(default=60, alias="AI_TIMEOUT_SECONDS")

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

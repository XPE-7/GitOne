import json
import logging
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    CEREBRAS_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    REPO_CACHE_DIR: str = "/tmp/gitone_repos"
    CORS_ORIGINS: str = "http://localhost:3000"
    MAX_ITERATIONS: int = 6
    MAX_REFINE_ITERATIONS: int = 2

    @property
    def cors_origins_list(self) -> List[str]:
        value = self.CORS_ORIGINS.strip()
        if not value:
            return ["http://localhost:3000"]
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    INVESTIGATOR_MODEL: str = "gpt-oss-120b"
    CRITIC_MODEL: str = "gpt-oss-120b"

    @field_validator("GITHUB_TOKEN")
    @classmethod
    def github_token_required(cls, v: str) -> str:
        if not v:
            logger.warning("GITHUB_TOKEN not set — GitHub API rate limit will be 60 req/hour")
        return v

    @field_validator("CEREBRAS_API_KEY")
    @classmethod
    def cerebras_key_required(cls, v: str) -> str:
        if not v:
            logger.warning("CEREBRAS_API_KEY not set — LLM calls will fail")
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

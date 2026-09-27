import json
import logging
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    # Tried Gemini (free tier promised much higher TPM than Groq) but hit three
    # separate integration blockers in testing: deprecated model IDs, a 20/day hard
    # cap on the plain "flash" tier, and a message-turn-ordering error from
    # langchain-google-genai on multi-turn tool calls that wasn't a quick fix.
    # Reverted to Groq, which is proven working end-to-end. Revisit only if Groq's
    # 8,000 TPM cap becomes a real bottleneck, and budget time to debug the
    # message-ordering issue if so.
    GEMINI_API_KEY: str = ""  # legacy/optional — kept for local fallback, unused if GROQ_API_KEY is set
    CEREBRAS_API_KEY: str = ""  # legacy/optional — kept for local fallback, unused if GROQ_API_KEY is set
    GITHUB_TOKEN: str = ""
    REPO_CACHE_DIR: str = "/tmp/gitone_repos"
    CORS_ORIGINS: str = "http://localhost:3000"
    MAX_ITERATIONS: int = 4
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

    # gpt-oss-120b is capped at 8,000 tokens/min on Groq's free tier, which this
    # app's multi-step investigation transcripts can exceed. gpt-oss-20b is smaller
    # (lower per-request token cost) and gets a higher free-tier TPM cap, while still
    # supporting tool-calling. Verify available models for your key at
    # https://api.groq.com/openai/v1/models if this ever 404s again.
    INVESTIGATOR_MODEL: str = "openai/gpt-oss-20b"
    CRITIC_MODEL: str = "openai/gpt-oss-20b"

    @field_validator("GITHUB_TOKEN")
    @classmethod
    def github_token_required(cls, v: str) -> str:
        if not v:
            logger.warning("GITHUB_TOKEN not set — GitHub API rate limit will be 60 req/hour")
        return v

    @field_validator("GROQ_API_KEY")
    @classmethod
    def groq_key_required(cls, v: str) -> str:
        if not v:
            logger.warning("GROQ_API_KEY not set — LLM calls will fail")
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

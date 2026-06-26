import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.REPO_CACHE_DIR, exist_ok=True)
    logger.info("GitOne backend started. Cache: %s", settings.REPO_CACHE_DIR)
    yield
    logger.info("GitOne backend shutting down.")


app = FastAPI(
    title="GitOne API",
    version="0.1.0",
    lifespan=lifespan,
    # Disable docs in production by setting DOCS_ENABLED=false in env
    docs_url="/docs" if os.getenv("DOCS_ENABLED", "true").lower() != "false" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(router, prefix="/api")


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok", "version": "0.1.0"}

"""
Application settings loaded from environment variables.
"""
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Study Assistant configuration."""

    # ── Application ──
    APP_NAME: str = "Study Assistant"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    DEMO_MODE: bool = False

    # ── Server ──
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ALLOWED_ORIGINS: str = "http://localhost:5169,http://localhost:8000"

    # ── Database ──
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/study_assistant"
    DATABASE_SYNC_URL: str = "postgresql://postgres:postgres@localhost:5432/study_assistant"

    # ── Session ──
    SESSION_SECRET: str = "change-me-in-production-32-characters-minimum"
    SESSION_EXPIRE_HOURS: int = 8
    SESSION_COOKIE_NAME: str = "sa_session"
    SESSION_COOKIE_SECURE: bool = False  # True for HTTPS in production

    # ── Storage ──
    STORAGE_ROOT: Path = Path(__file__).resolve().parents[3] / "data"
    UPLOAD_DIR: str = "uploads"
    MAX_PDF_SIZE_MB: int = 50
    MAX_PAGES_PER_DOC: int = 1000
    MAX_DOCS_PER_CHAT: int = 5
    MAX_UPLOAD_QUOTA_MB: int = 512

    # ── Chroma ──
    CHROMA_HOST: str = "127.0.0.1"
    CHROMA_PORT: int = 8001
    CHROMA_COLLECTION: str = "textbook_chunks_minilm_v1"

    # ── Ollama ──
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    LLM_MODEL: str = "qwen3:4b"
    LLM_CONTEXT_TOKENS: int = 8192
    LLM_MAX_OUTPUT_TOKENS: int = 4096
    LLM_TEMPERATURE: float = 0.2
    
    # ── Hybrid RAG / Reranker ──
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RERANKER_ENABLED: bool = True          # kill-switch: fall back to semantic-only
    BM25_ENABLED: bool = True              # kill-switch: disable BM25 leg
    SEMANTIC_TOP_K: int = 20              # ChromaDB candidates per query
    BM25_TOP_K: int = 20                   # BM25 candidates per query
    RERANKER_TOP_N: int = 8               # final chunks after reranking
    BM25_MAX_CHUNKS: int = 5000           # degrade BM25 if corpus exceeds this

    # ── Embeddings ──
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cpu"
    EMBEDDING_BATCH_SIZE: int = 16
    EMBEDDING_DIMENSIONS: int = 384

    # ── OCR ──
    OCR_LANGUAGES: str = "eng"
    TESSDATA_PREFIX: Path = Path(__file__).resolve().parents[3] / "data" / "tessdata"

    # ── Worker ──
    AI_WORKER_CONCURRENCY: int = 1
    WORKER_HEARTBEAT_SECONDS: int = 30
    WORKER_LEASE_SECONDS: int = 120
    MAX_JOB_ATTEMPTS: int = 3

    # ── Rate Limits ──
    LOGIN_RATE_LIMIT: int = 10  # attempts per minute
    MAX_MESSAGE_LENGTH: int = 4000
    MAX_QUEUE_SIZE: int = 50
    RETRIEVAL_MAX_DISTANCE: float = 1.05
    MODEL_TIMEOUT_SECONDS: int = 900
    FRONTEND_DIST: Path = Path(__file__).resolve().parents[3] / "frontend" / "dist"

    # ── SMTP ──
    SMTP_SERVER: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None

    @field_validator("STORAGE_ROOT", "TESSDATA_PREFIX", "FRONTEND_DIST", mode="after")
    @classmethod
    def absolute_project_path(cls, value):
        return (value if value.is_absolute() else PROJECT_ROOT / value).resolve()

    model_config = {
        "env_file": PROJECT_ROOT / ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()

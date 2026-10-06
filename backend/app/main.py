"""
FastAPI application entry point.
"""
from contextlib import asynccontextmanager
from pathlib import Path
import re
from uuid import uuid4

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # ── Startup ──
    from app.core.database import engine  # noqa: F401
    from app.core.dynamic_settings import sync_settings_to_global
    import asyncio
    sync_task = asyncio.create_task(sync_settings_to_global())
    yield
    # ── Shutdown ──
    sync_task.cancel()
    from app.core.database import engine as db_engine
    await db_engine.dispose()


def create_app() -> FastAPI:
    """Application factory."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        lifespan=lifespan,
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
    )

    # ── CORS ──
    origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security(request: Request, call_next):
        request.state.request_id = str(uuid4())
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if (origin and origin not in origins) or request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"code": "INVALID_ORIGIN", "message": "Request origin is not allowed.", "retryable": False}, status_code=403)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail), "retryable": False}
        return JSONResponse({**detail, "request_id": request.state.request_id}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse({"code": "VALIDATION_ERROR", "message": "Check the submitted fields and try again.",
            "retryable": False, "request_id": request.state.request_id}, status_code=422)

    @app.exception_handler(Exception)
    async def unhandled_error(request, exc):
        import traceback, logging
        logging.getLogger("study.api").error("Unhandled %s: %s\n%s", type(exc).__name__, exc, traceback.format_exc())
        return JSONResponse({"code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again.",
            "retryable": True, "request_id": getattr(request.state, "request_id", "?")}, status_code=500)

    from app.api.routes import router
    app.include_router(router)

    dist = settings.FRONTEND_DIST
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        asset = (dist / path).resolve()
        if path and asset.is_relative_to(dist.resolve()) and asset.is_file():
            return FileResponse(asset)
        if re.fullmatch(r"(?:|login|register|app(?:/chats(?:/[0-9a-fA-F-]+(?:/(?:topics|quiz))?)?|/documents|/profile(?:/.*)?|/admin(?:/.*)?)?\/?)", path) and (dist / "index.html").is_file():
            return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})
        raise HTTPException(404, "Not found")

    return app


app = create_app()

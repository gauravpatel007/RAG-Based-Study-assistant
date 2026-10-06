"""
Session management — token creation, hashing, cookie handling.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.models.models import Session, User


def _hash_token(token: str) -> str:
    """SHA-256 hash of the session token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(db: AsyncSession, user_id: UUID, response: Response,
                         ip_address: str | None = None, user_agent: str | None = None) -> str:
    """Create a new session and set the cookie."""
    token = secrets.token_urlsafe(48)
    token_hash = _hash_token(token)
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_EXPIRE_HOURS)

    session = Session(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(session)
    await db.flush()

    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.SESSION_COOKIE_SECURE,
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        path="/",
    )
    return token


async def get_current_user(request: Request, db: AsyncSession) -> User | None:
    """Validate session cookie and return the authenticated user or None."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        return None

    token_hash = _hash_token(token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Session)
        .where(
            Session.token_hash == token_hash,
            Session.expires_at > now,
            Session.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return None

    user_result = await db.execute(
        select(User).where(User.id == session.user_id, User.is_active.is_(True))
    )
    return user_result.scalar_one_or_none()


async def revoke_session(request: Request, db: AsyncSession, response: Response) -> None:
    """Revoke the current session and clear the cookie."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if token:
        token_hash = _hash_token(token)
        result = await db.execute(
            select(Session).where(Session.token_hash == token_hash)
        )
        session = result.scalar_one_or_none()
        if session:
            session.revoked_at = datetime.now(timezone.utc)

    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
    )

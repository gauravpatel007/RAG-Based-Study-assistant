"""Audit log helper — write security-sensitive events to audit_logs."""
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import AuditLog

async def log_action(
    db: AsyncSession,
    *,
    actor_id=None,
    actor_username: str | None = None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    target_label: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
):
    entry = AuditLog(
        id=uuid4(),
        actor_id=actor_id,
        actor_username=actor_username,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        target_label=target_label,
        metadata_=metadata,
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    # Flush but don't commit — caller commits

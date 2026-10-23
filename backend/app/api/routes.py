"""Authenticated application API. Ownership is checked before all resource access."""
import asyncio
import hashlib
import json
import shutil
import time
import random
from collections import defaultdict, deque
from datetime import datetime, date, timezone, timedelta
from pathlib import Path
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL

# pyrefly: ignore [missing-import]
import httpx
import pymupdf
from app import providers
# pyrefly: ignore [missing-import]
from argon2 import PasswordHasher
# pyrefly: ignore [missing-import]
from argon2.exceptions import VerificationError
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Query
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from fastapi.encoders import jsonable_encoder
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse, StreamingResponse
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func, update, delete, or_
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, async_session_factory
from app.core.sessions import create_session, get_current_user, revoke_session
from app.core.settings import settings
from app.topic_generation import PROMPT_VERSION
from app.models.models import User, Chat, Message, Document, DocumentPage, DocumentChunk, MessageSource, Job, TopicSet, Topic, QuizSet, QuizQuestion, UserProfile, UserPreferences, FlashcardSet, Flashcard, FlashcardReview, ConceptEdge, utcnow, FailedLoginAttempt, AuditLog, Note, Session, AiUsageLog, VerificationCode, PresentationSet, PresentationSlide
from app.schemas.schemas import LoginRequest, RegisterRequest, ChatCreateRequest, ChatRenameRequest, SendMessageRequest, CreateTopicSetRequest, MessageFeedbackRequest, CreateQuizSetRequest, AdminUserCreateRequest, AdminUserUpdateRequest, AdminDocumentUpdateRequest, UserProfileUpdateRequest, UserPreferencesUpdateRequest, ChangePasswordRequest, AddDocumentToChatRequest, CreateNoteRequest, UpdateNoteRequest, NoteAiActionRequest, DeleteAccountRequest, VerifyEmailRequest, ForgotPasswordRequest, ResetPasswordRequest, CreatePresentationSetRequest
from app.core.email import send_email
from app.schemas.flashcards import FlashcardOut, FlashcardReviewOut, SubmitReviewRequest, GenerateFlashcardsRequest
from app.core.audit import log_action
from app.schemas import schemas
from app.core.srs import calculate_sm2
from app.core.static_responses import get_static_response

router = APIRouter(prefix="/api/v1")
passwords = PasswordHasher()
login_attempts = defaultdict(deque)
TERMINAL = {"complete", "failed", "cancelled", "interrupted"}


def fail(status, code, message, retryable=False):
    raise HTTPException(status, detail={"code": code, "message": message, "retryable": retryable})


async def user_dep(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        fail(401, "UNAUTHENTICATED", "Please sign in.")
    return user


async def admin_dep(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user or user.username != "admin":
        fail(403, "FORBIDDEN", "Admin access required.")
    return user


async def owned_chat(db, user, chat_id, lock=False):
    query = select(Chat).where(Chat.id == chat_id, Chat.user_id == user.id, Chat.deleted_at.is_(None))
    if lock:
        query = query.with_for_update()
    chat = await db.scalar(query)
    if not chat:
        fail(404, "NOT_FOUND", "Chat not found.")
    return chat


async def owned_doc(db, user, document_id):
    doc = await db.scalar(select(Document).join(Chat, Document.chat_id == Chat.id).where(
        Document.id == document_id, Document.user_id == user.id, Chat.user_id == user.id,
        Document.deleted_at.is_(None), Chat.deleted_at.is_(None)))
    if not doc:
        fail(404, "NOT_FOUND", "Document not found.")
    return doc


async def owned_job(db, user, job_id):
    job = await db.scalar(select(Job).join(Chat).where(Job.id == job_id, Job.user_id == user.id,
        Chat.user_id == user.id, Chat.deleted_at.is_(None)))
    if not job:
        fail(404, "NOT_FOUND", "Job not found.")
    return job


def fields(obj, *names):
    return {name: getattr(obj, name) for name in names}


def document_json(doc):
    return fields(doc, "id", "original_filename", "byte_size", "page_count", "status", "created_at", "error_code")


async def message_json(db, message):
    sources = []
    for source in (await db.scalars(select(MessageSource).where(MessageSource.message_id == message.id))).all():
        doc = await db.get(Document, source.document_id) if source.document_id else None
        active = doc and not doc.deleted_at and source.source_status == "active"
        sources.append({"citation_label": source.citation_label, "page_number": source.page_number,
            "document_id": source.document_id if active else None,
            "original_filename": doc.original_filename if active else "Source removed",
            "excerpt": source.excerpt if active else "", "source_status": "active" if active else "unavailable"})
    return {**fields(message, "id", "role", "content", "status", "feedback", "created_at", "updated_at"), "sources": sources}


async def enqueue(db, user_id, chat_id, kind, **kwargs):
    count = await db.scalar(select(func.count()).select_from(Job).where(Job.status.in_(["pending", "running"])))
    if count >= settings.MAX_QUEUE_SIZE and not kind.startswith("cleanup"):
        fail(429, "QUEUE_FULL", "The processing queue is full. Try again shortly.", True)
    job = Job(user_id=user_id, chat_id=chat_id, type=kind, **kwargs)
    db.add(job)
    await db.flush()
    return job


async def ready_scope(db, user, chat_id, document_ids=None):
    docs = list((await db.scalars(select(Document).where(Document.chat_id == chat_id,
        Document.user_id == user.id, Document.deleted_at.is_(None), Document.status == "ready"))).all())
    if document_ids is not None:
        wanted = set(document_ids)
        if not wanted or not wanted.issubset({d.id for d in docs}):
            fail(422, "INVALID_SCOPE", "Select ready documents from this chat.")
        docs = [d for d in docs if d.id in wanted]
    return docs


async def auth_response_json(db: AsyncSession, user: User) -> dict:
    profile = await ensure_profile(db, user)
    prefs = await ensure_preferences(db, user)
    avatar_url = f"/api/v1/users/me/avatar?v={profile.avatar_version}" if profile.avatar_key else None
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": profile.display_name,
        "avatar_url": avatar_url,
        "theme": prefs.theme,
        "accent_color": prefs.accent_color,
    }


async def generate_and_send_code(db: AsyncSession, user: User, purpose: str):
    code = f"{random.randint(0, 999999):06d}"
    code_hash = await asyncio.to_thread(passwords.hash, code)
    
    # Delete old codes for this purpose
    await db.execute(delete(VerificationCode).where(VerificationCode.user_id == user.id, VerificationCode.purpose == purpose))
    
    vcode = VerificationCode(
        user_id=user.id,
        code_hash=code_hash,
        purpose=purpose,
        expires_at=utcnow() + timedelta(minutes=15)
    )
    db.add(vcode)
    await db.flush()
    
    subject = "Verify your email" if purpose == "registration" else "Reset your password"
    body = f"Your 6-digit verification code is: {code}\\nThis code expires in 15 minutes."
    
    html_body = f"""
    <div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 40px 20px; border-radius: 12px;">
        <div style="background-color: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); text-align: center;">
            <div style="margin-bottom: 24px;">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                </svg>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 24px; font-weight: 700;">Study Assistant</h2>
            <p style="color: #4b5563; font-size: 16px; margin-bottom: 30px;">
                Here is your verification code. Enter this to continue:
            </p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 30px;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb;">{code}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 30px;">
                This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px 0;">
            <div style="color: #9ca3af; font-size: 13px; line-height: 1.6;">
                <p style="margin: 0;">Your Private AI Study Partner.</p>
                <p style="margin: 0;">100% Local. Zero API Costs. Complete Privacy.</p>
                <p style="margin: 0;">Upload PDFs, ask questions, and get cited answers.</p>
            </div>
        </div>
    </div>
    """
    
    await send_email(user.email, subject, body, html_body=html_body)

@router.post("/auth/login")
async def login(body: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    key = request.client.host if request.client else "local"
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    attempts = login_attempts[key]
    now = time.monotonic()
    while attempts and attempts[0] < now - 60:
        attempts.popleft()
    if len(attempts) >= settings.LOGIN_RATE_LIMIT:
        fail(429, "LOGIN_LIMIT", "Too many attempts. Wait a minute.", True)
    attempts.append(now)
    
    login_str = body.email.strip().lower()
    user = await db.scalar(
        select(User).where(
            or_(
                func.lower(User.email) == login_str,
                func.lower(User.username) == login_str,
            ),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    valid = False
    if user:
        try:
            valid = await asyncio.to_thread(passwords.verify, user.password_hash, body.password)
        except VerificationError:
            pass
    if not valid:
        db.add(FailedLoginAttempt(
            username_attempted=login_str,
            ip_address=ip,
            user_agent=ua[:500],
        ))
        await db.commit()
        fail(401, "INVALID_CREDENTIALS", "Invalid email or password.")
        
    # Skip email verification if they are logging in with legacy admin/user accounts
    if not user.email_verified and user.username not in ("admin", "user"):
        await generate_and_send_code(db, user, "registration")
        await db.commit()
        fail(403, "UNVERIFIED_EMAIL", "Email not verified. A verification code has been sent.")
        
    await create_session(db, user.id, response, ip_address=ip, user_agent=ua[:500])
    return await auth_response_json(db, user)


@router.post("/auth/register", status_code=202)
async def register(body: RegisterRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    key = request.client.host if request.client else "local"
    attempts = login_attempts[key + "_reg"]
    now = time.monotonic()
    while attempts and attempts[0] < now - 60:
        attempts.popleft()
    if len(attempts) >= settings.LOGIN_RATE_LIMIT:
        fail(429, "REGISTER_LIMIT", "Too many attempts. Wait a minute.", True)
    attempts.append(now)
    
    email = body.email.strip().lower()
    username = body.username.strip()
    existing_user = await db.scalar(select(User).where(User.email == email))
    if existing_user:
        if not existing_user.email_verified:
            existing_user.username = username
            existing_user.password_hash = await asyncio.to_thread(passwords.hash, body.password)
            await generate_and_send_code(db, existing_user, "registration")
            await db.commit()
            return {"message": "Verification code sent."}
        fail(409, "EMAIL_TAKEN", "Email is already taken.")
        
    hashed = await asyncio.to_thread(passwords.hash, body.password)
    user = User(username=username, email=email, password_hash=hashed, email_verified=False)
    db.add(user)
    await db.flush()

    db.add(UserProfile(user_id=user.id))
    db.add(UserPreferences(user_id=user.id))
    
    await generate_and_send_code(db, user, "registration")
    await db.commit()
    
    return {"message": "Verification code sent."}


@router.post("/auth/resend-code")
async def resend_code(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    user = await db.scalar(select(User).where(User.email == email))
    if not user:
        fail(404, "NOT_FOUND", "User not found.")
    if user.email_verified:
        return {"message": "Email is already verified."}
    await generate_and_send_code(db, user, "registration")
    await db.commit()
    return {"message": "Verification code sent."}


@router.post("/auth/verify-email")
async def verify_email(body: VerifyEmailRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user:
        fail(404, "NOT_FOUND", "User not found.")
        
    vcode = await db.scalar(select(VerificationCode).where(
        VerificationCode.user_id == user.id, 
        VerificationCode.purpose == "registration"
    ))
    if not vcode or vcode.expires_at < utcnow():
        fail(400, "INVALID_CODE", "Invalid or expired verification code.")
        
    try:
        await asyncio.to_thread(passwords.verify, vcode.code_hash, body.code)
    except VerificationError:
        fail(400, "INVALID_CODE", "Invalid or expired verification code.")
        
    user.email_verified = True
    await db.execute(delete(VerificationCode).where(VerificationCode.user_id == user.id, VerificationCode.purpose == "registration"))
    
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    await create_session(db, user.id, response, ip_address=ip, user_agent=ua[:500])
    await db.commit()
    
    return await auth_response_json(db, user)


@router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user:
        await generate_and_send_code(db, user, "password_reset")
        await db.commit()
    # Always return success to prevent email enumeration
    return {"message": "If the email is registered, a password reset code was sent."}


@router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user:
        fail(400, "INVALID_CODE", "Invalid or expired verification code.")
        
    vcode = await db.scalar(select(VerificationCode).where(
        VerificationCode.user_id == user.id, 
        VerificationCode.purpose == "password_reset"
    ))
    if not vcode or vcode.expires_at < utcnow():
        fail(400, "INVALID_CODE", "Invalid or expired verification code.")
        
    try:
        await asyncio.to_thread(passwords.verify, vcode.code_hash, body.code)
    except VerificationError:
        fail(400, "INVALID_CODE", "Invalid or expired verification code.")
        
    hashed = await asyncio.to_thread(passwords.hash, body.new_password)
    user.password_hash = hashed
    
    await db.execute(delete(VerificationCode).where(VerificationCode.user_id == user.id, VerificationCode.purpose == "password_reset"))
    
    # Revoke all existing sessions
    await db.execute(update(Session).where(Session.user_id == user.id).values(revoked_at=utcnow()))
    await db.commit()
    
    return {"message": "Password reset successfully."}


@router.get("/auth/me")
async def me(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    return await auth_response_json(db, user)


@router.post("/auth/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    await revoke_session(request, db, response)


@router.get("/health/live")
async def live():
    return {"status": "ok", "version": settings.APP_VERSION}


@router.get("/health/ready")
async def ready(db: AsyncSession = Depends(get_db)):
    await db.execute(select(1))
    available = False
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            response = await client.get(settings.OLLAMA_BASE_URL + "/api/tags")
            active_model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
            available = any(m["name"] == active_model for m in response.json().get("models", []))
    except (httpx.HTTPError, ValueError):
        active_model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
        pass
    return {"status": "ok", "database": True, "model_available": available, "model": active_model}


@router.post("/chats", status_code=201)
async def create_chat(body: ChatCreateRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    title = (body.title or "New Chat").strip()
    if not title or len(title) > 200:
        fail(422, "INVALID_TITLE", "Use a title between 1 and 200 characters.")
    chat = Chat(user_id=user.id, title=title)
    db.add(chat)
    await db.flush()
    return fields(chat, "id", "title", "created_at", "updated_at")


@router.get("/chats")
async def chats(search: str = "", cursor: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    query = select(Chat).where(Chat.user_id == user.id, Chat.deleted_at.is_(None))
    if search:
        query = query.where(Chat.title.icontains(search, autoescape=True))
    rows = (await db.scalars(query.order_by(Chat.updated_at.desc(), Chat.id).offset(cursor).limit(limit + 1))).all()
    items = []
    for chat in rows[:limit]:
        doc_count = await db.scalar(select(func.count()).select_from(Document).where(Document.chat_id == chat.id, Document.deleted_at.is_(None)))
        msg_count = await db.scalar(select(func.count()).select_from(Message).where(Message.chat_id == chat.id))
        items.append({**fields(chat, "id", "title", "created_at", "updated_at"), "document_count": doc_count, "message_count": msg_count})
    return {"items": items, "next_cursor": str(cursor + limit) if len(rows) > limit else None}


@router.get("/chats/{chat_id}")
async def chat_detail(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id)
    docs = (await db.scalars(select(Document).where(Document.chat_id == chat.id, Document.deleted_at.is_(None)))).all()
    active = await db.scalar(select(Job.id).where(Job.chat_id == chat.id, Job.type == "generate_answer", Job.status.in_(["pending", "running"])))
    return {**fields(chat, "id", "title"), "documents": [document_json(d) for d in docs], "active_job": active}


@router.patch("/chats/{chat_id}")
async def rename(chat_id: UUID, body: ChatRenameRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id, lock=True)
    if not body.title.strip():
        fail(422, "INVALID_TITLE", "A title is required.")
    chat.title = body.title.strip()
    return fields(chat, "id", "title")


@router.get("/chats/{chat_id}/messages")
async def messages(chat_id: UUID, cursor: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100),
                   db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    rows = (await db.scalars(select(Message).where(Message.chat_id == chat_id, Message.sequence_no > cursor)
        .order_by(Message.sequence_no).limit(limit + 1))).all()
    return {"items": [await message_json(db, m) for m in rows[:limit]],
            "next_cursor": str(rows[limit - 1].sequence_no) if len(rows) > limit else None}


@router.post("/chats/{chat_id}/messages", status_code=202)
async def send(chat_id: UUID, body: SendMessageRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id, lock=True)
    if not body.content.strip():
        fail(422, "EMPTY_MESSAGE", "Enter a question.")
    request_id = body.client_request_id or uuid4()
    old = await db.scalar(select(Message).where(Message.chat_id == chat_id, Message.client_request_id == request_id))
    if old:
        job = await db.scalar(select(Job).where(Job.chat_id == chat_id, Job.payload["request_id"].as_string() == str(request_id)))
        if job:
            return {"message_id": job.message_id, "job_id": job.id}
    busy = await db.scalar(select(Job.id).where(Job.chat_id == chat_id, Job.type == "generate_answer", Job.status.in_(["pending", "running"])))
    if busy:
        fail(409, "CHAT_BUSY", "Wait for the current answer or stop it.")
    docs = await ready_scope(db, user, chat_id, body.document_ids)
    seq = (await db.scalar(select(func.max(Message.sequence_no)).where(Message.chat_id == chat_id)) or 0)
    db.add(Message(chat_id=chat_id, role="user", content=body.content.strip(), sequence_no=seq + 1, client_request_id=request_id))
    
    static_answer = get_static_response(body.content.strip())
    if static_answer:
        answer = Message(chat_id=chat_id, role="assistant", content=static_answer, status="complete", sequence_no=seq + 2,
                         corpus_version=chat.corpus_version, model_name="static")
        db.add(answer)
        chat.updated_at = datetime.now(timezone.utc)
        if chat.title == "New Chat":
            chat.title = body.content.strip()[:80]
        await db.flush()
        return {"message_id": answer.id, "job_id": None}

    active_model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
    answer = Message(chat_id=chat_id, role="assistant", content="", status="queued", sequence_no=seq + 2,
                     corpus_version=chat.corpus_version, model_name=active_model)
    db.add(answer)
    await db.flush()
    job = await enqueue(db, user.id, chat_id, "generate_answer", message_id=answer.id, priority=10,
        payload={"question": body.content.strip(), "document_ids": [str(d.id) for d in docs],
                 "versions": [str(d.active_index_version) for d in docs], "corpus_version": chat.corpus_version,
                 "request_id": str(request_id)})
    chat.updated_at = datetime.now(timezone.utc)
    if chat.title == "New Chat":
        chat.title = body.content.strip()[:80]
    return {"message_id": answer.id, "job_id": job.id}


@router.delete("/chats/{chat_id}/messages/{message_id}")
async def delete_message(chat_id: UUID, message_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id, lock=True)
    msg = await db.scalar(select(Message).where(Message.id == message_id, Message.chat_id == chat_id))
    if not msg:
        fail(404, "NOT_FOUND", "Message not found.")
    
    if msg.role == "user":
        next_msg = await db.scalar(select(Message).where(Message.chat_id == chat_id, Message.sequence_no == msg.sequence_no + 1))
        if next_msg and next_msg.role == "assistant":
            await db.delete(next_msg)
            
    await db.delete(msg)
    await db.commit()
    return {"status": "ok"}


@router.put("/chats/{chat_id}/messages/{message_id}")
async def edit_message(chat_id: UUID, message_id: UUID, body: SendMessageRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id, lock=True)
    if not body.content.strip():
        fail(422, "EMPTY_MESSAGE", "Enter a question.")
        
    msg = await db.scalar(select(Message).where(Message.id == message_id, Message.chat_id == chat_id))
    if not msg or msg.role != "user":
        fail(400, "BAD_REQUEST", "Only user messages can be edited.")
        
    busy = await db.scalar(select(Job.id).where(Job.chat_id == chat_id, Job.type == "generate_answer", Job.status.in_(["pending", "running"])))
    if busy:
        fail(409, "CHAT_BUSY", "Wait for the current answer or stop it.")
        
    msg.content = body.content.strip()
    
    # Delete all subsequent messages to effectively truncate the chat at this edit point
    subsequent_msgs = (await db.scalars(select(Message).where(Message.chat_id == chat_id, Message.sequence_no > msg.sequence_no))).all()
    for m in subsequent_msgs:
        await db.delete(m)
    await db.flush()
        
    # Create the new queued assistant message
    seq = msg.sequence_no
    active_model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
    answer = Message(chat_id=chat_id, role="assistant", content="", status="queued", sequence_no=seq + 1,
                     corpus_version=chat.corpus_version, model_name=active_model)
    db.add(answer)
    await db.flush()
    
    docs = await ready_scope(db, user, chat_id, body.document_ids)
    
    job = await enqueue(db, user.id, chat_id, "generate_answer", message_id=answer.id, priority=10,
        payload={"question": body.content.strip(), "document_ids": [str(d.id) for d in docs],
                 "versions": [str(d.active_index_version) for d in docs], "corpus_version": chat.corpus_version,
                 "request_id": str(uuid4())})
                 
    chat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message_id": answer.id, "job_id": job.id}


@router.post("/chats/{chat_id}/messages/{message_id}/feedback")
async def message_feedback(chat_id: UUID, message_id: UUID, body: MessageFeedbackRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    message = await db.scalar(select(Message).where(Message.id == message_id, Message.chat_id == chat_id))
    if not message:
        fail(404, "NOT_FOUND", "Message not found.")
    message.feedback = body.feedback
    await db.commit()
    return {"status": "ok", "feedback": message.feedback}


@router.get("/chats/{chat_id}/documents")
async def chat_docs(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    docs = (await db.scalars(select(Document).where(Document.chat_id == chat_id, Document.deleted_at.is_(None))
                            .order_by(Document.created_at))).all()
    return {"items": [document_json(d) for d in docs]}


@router.post("/chats/{chat_id}/documents", status_code=202)
async def upload(chat_id: UUID, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    # Serialize quota changes for one user and document changes for the chat.
    await db.scalar(select(User).where(User.id == user.id).with_for_update())
    await owned_chat(db, user, chat_id, lock=True)
    count = await db.scalar(select(func.count()).select_from(Document).where(Document.chat_id == chat_id, Document.deleted_at.is_(None)))
    if count >= settings.MAX_DOCS_PER_CHAT:
        fail(422, "DOCUMENT_LIMIT", "This chat has reached its document limit.")
    used = await db.scalar(select(func.coalesce(func.sum(Document.byte_size), 0)).where(Document.user_id == user.id, Document.deleted_at.is_(None)))
    doc_id = uuid4()
    folder = settings.STORAGE_ROOT / "uploads" / str(user.id) / str(chat_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{doc_id}.pdf"
    size, digest = 0, hashlib.sha256()
    try:
        with path.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.MAX_PDF_SIZE_MB * 1024**2 or used + size > settings.MAX_UPLOAD_QUOTA_MB * 1024**2:
                    fail(413, "UPLOAD_LIMIT", "PDF size or account storage quota exceeded.")
                digest.update(chunk)
                target.write(chunk)
        with path.open("rb") as source:
            if not source.read(1024).lstrip().startswith(b"%PDF-"):
                fail(422, "INVALID_PDF", "Upload a valid PDF file.")
        try:
            with pymupdf.open(path) as pdf:
                if pdf.needs_pass:
                    fail(422, "ENCRYPTED_PDF", "Remove the PDF password before uploading.")
                pages = pdf.page_count
                if not 1 <= pages <= settings.MAX_PAGES_PER_DOC:
                    fail(422, "PAGE_LIMIT", "PDF page count is outside the supported limit.")
        except (pymupdf.FileDataError, RuntimeError):
            fail(422, "INVALID_PDF", "This PDF is damaged or unreadable.")
        duplicate = await db.scalar(select(Document).where(Document.chat_id == chat_id, Document.sha256 == digest.hexdigest(), Document.deleted_at.is_(None)))
        if duplicate:
            path.unlink(missing_ok=True)
            old_job = await db.scalar(select(Job).where(Job.document_id == duplicate.id, Job.type == "ingest_document").order_by(Job.created_at.desc()))
            return {"document_id": duplicate.id, "job_id": old_job.id, "duplicate": True}
        doc = Document(id=doc_id, user_id=user.id, chat_id=chat_id, original_filename=Path((file.filename or "textbook.pdf").replace("\\", "/")).name[:500],
            storage_key=str(path.relative_to(settings.STORAGE_ROOT)), sha256=digest.hexdigest(), byte_size=size, page_count=pages)
        db.add(doc)
        job = await enqueue(db, user.id, chat_id, "ingest_document", document_id=doc_id, payload={"index_version": str(uuid4())})
        await db.commit()
        return {"document_id": doc.id, "job_id": job.id}
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@router.get("/documents")
async def inventory(status: str | None = None, chat_id: UUID | None = None,
                    db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    query = select(Document, Chat.title).join(Chat, Document.chat_id == Chat.id).where(Document.user_id == user.id,
        Document.deleted_at.is_(None), Chat.deleted_at.is_(None))
    if status:
        query = query.where(Document.status == status)
    if chat_id:
        await owned_chat(db, user, chat_id)
        query = query.where(Document.chat_id == chat_id)
    return {"items": [{**document_json(d), "chat_id": d.chat_id, "chat_title": title}
        for d, title in (await db.execute(query.order_by(Document.created_at.desc()).limit(500))).all()]}


@router.get("/documents/{document_id}")
async def document_detail(document_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    doc = await owned_doc(db, user, document_id)
    jobs = (await db.scalars(select(Job).where(Job.document_id == doc.id).order_by(Job.created_at.desc()))).all()
    return {**document_json(doc), "jobs": [fields(j, "id", "type", "status", "progress", "error_code") for j in jobs]}


def safe_file(key):
    root = settings.STORAGE_ROOT.resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root):
        fail(404, "NOT_FOUND", "File not found.")
    return path


@router.get("/documents/{document_id}/file")
async def document_file(document_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    doc = await owned_doc(db, user, document_id)
    path = safe_file(doc.storage_key)
    if not path.is_file():
        fail(404, "NOT_FOUND", "File not found.")
    return FileResponse(path, media_type="application/pdf", filename=doc.original_filename,
        content_disposition_type="inline", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.get("/documents/{document_id}/pages/{page_number}")
async def page(document_id: UUID, page_number: int, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_doc(db, user, document_id)
    row = await db.scalar(select(DocumentPage).where(DocumentPage.document_id == document_id, DocumentPage.page_number == page_number))
    if not row:
        fail(404, "NOT_FOUND", "Page not processed yet.")
    return fields(row, "page_number", "page_label", "clean_text", "extraction_method", "quality_flags")


async def invalidate(db, chat):
    chat.corpus_version += 1
    chat.memory_summary = None
    chat.summary_through_message_id = None
    await db.execute(update(Job).where(Job.chat_id == chat.id, Job.type.in_(["generate_answer", "extract_topics", "extract_quiz"]),
        Job.status.in_(["pending", "running"])).values(cancel_requested=True))
    await db.execute(update(TopicSet).where(TopicSet.chat_id == chat.id).values(status="stale"))


async def tombstone_doc(db, user, doc):
    doc.deleted_at = datetime.now(timezone.utc)
    doc.status = "deleting"
    await db.execute(update(Job).where(Job.document_id == doc.id, Job.status.in_(["pending", "running"])).values(cancel_requested=True))
    await db.execute(update(MessageSource).where(MessageSource.document_id == doc.id).values(excerpt=None, source_status="unavailable"))
    return await enqueue(db, user.id, doc.chat_id, "cleanup_document", document_id=doc.id, priority=20)


@router.post("/documents/{document_id}/add-to-chat", status_code=202)
async def add_document_to_chat(document_id: UUID, body: AddDocumentToChatRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await db.scalar(select(User).where(User.id == user.id).with_for_update())
    source_doc = await owned_doc(db, user, document_id)
    target_chat = await owned_chat(db, user, body.chat_id, lock=True)

    count = await db.scalar(select(func.count()).select_from(Document).where(Document.chat_id == target_chat.id, Document.deleted_at.is_(None)))
    if count >= settings.MAX_DOCS_PER_CHAT:
        fail(422, "DOCUMENT_LIMIT", "This chat has reached its document limit.")

    existing = await db.scalar(select(Document).where(
        Document.chat_id == target_chat.id,
        Document.sha256 == source_doc.sha256,
        Document.deleted_at.is_(None)
    ))
    if existing:
        fail(409, "ALREADY_EXISTS", f"This document is already in '{target_chat.title}'.")

    used = await db.scalar(select(func.coalesce(func.sum(Document.byte_size), 0)).where(Document.user_id == user.id, Document.deleted_at.is_(None)))
    if used + source_doc.byte_size > settings.MAX_UPLOAD_QUOTA_MB * 1024**2:
        fail(413, "UPLOAD_LIMIT", "Account storage quota exceeded.")

    src_path = safe_file(source_doc.storage_key)
    if not src_path.is_file():
        fail(404, "NOT_FOUND", "Source document file not found.")

    # Snapshot all scalar values BEFORE any try/except so they survive db.rollback()
    new_doc_id = uuid4()
    new_version = uuid4()
    user_id = user.id
    chat_id = target_chat.id
    chat_title = target_chat.title
    src_doc_id = source_doc.id
    src_filename = source_doc.original_filename
    src_storage_key = source_doc.storage_key
    src_sha256 = source_doc.sha256
    src_byte_size = source_doc.byte_size
    src_page_count = source_doc.page_count
    src_status = source_doc.status
    src_index_version = source_doc.active_index_version
    src_extraction_version = source_doc.extraction_version

    doc_kwargs = dict(id=new_doc_id, user_id=user_id, chat_id=chat_id,
        original_filename=src_filename, storage_key=src_storage_key,
        sha256=src_sha256, byte_size=src_byte_size, page_count=src_page_count)

    job = None
    # If the source is fully processed, clone everything inline so
    # the document is ready instantly — no worker round-trip needed.
    if src_status == "ready" and src_index_version:
        try:
            new_doc = Document(**doc_kwargs, status="ready",
                active_index_version=new_version, extraction_version=src_extraction_version)
            db.add(new_doc)
            await db.flush()

            # Clone pages
            pages = (await db.scalars(select(DocumentPage).where(
                DocumentPage.document_id == src_doc_id))).all()
            for p in pages:
                db.add(DocumentPage(
                    document_id=new_doc_id, page_number=p.page_number,
                    page_label=p.page_label, raw_text=p.raw_text,
                    clean_text=p.clean_text, extraction_method=p.extraction_method,
                    quality_flags=p.quality_flags))

            # Clone chunks + ChromaDB vectors
            src_chunks = (await db.scalars(select(DocumentChunk).where(
                DocumentChunk.document_id == src_doc_id,
                DocumentChunk.index_version == src_index_version
            ))).all()

            if src_chunks:
                src_vector_ids = [c.vector_id for c in src_chunks if c.vector_id]
                # Snapshot chunk data before touching ChromaDB
                chunk_data = [(c.page_number, c.chunk_index, c.text,
                    c.start_offset, c.end_offset, c.token_count) for c in src_chunks]

                index = await asyncio.to_thread(providers.collection)
                stored = await asyncio.to_thread(
                    index.get, ids=src_vector_ids, include=["embeddings"])

                if stored and stored.get("embeddings") is not None and len(stored["embeddings"]) == len(chunk_data):
                    new_ids = [
                        str(uuid5(NAMESPACE_URL,
                            f"{new_doc_id}:{new_version}:{pg - 1}:{ci % 10000}"))
                        for pg, ci, *_ in chunk_data]

                    await asyncio.to_thread(
                        index.upsert, ids=new_ids,
                        embeddings=stored["embeddings"],
                        documents=[text for _, _, text, *_ in chunk_data],
                        metadatas=[{
                            "user_id": str(user_id), "chat_id": str(chat_id),
                            "document_id": str(new_doc_id), "page_number": pg,
                            "index_version": str(new_version), "chunk_index": ci,
                        } for pg, ci, *_ in chunk_data])

                    for i, (pg, ci, text, so, eo, tc) in enumerate(chunk_data):
                        db.add(DocumentChunk(
                            id=UUID(new_ids[i]), document_id=new_doc_id,
                            index_version=new_version, chunk_index=ci,
                            page_number=pg, vector_id=new_ids[i],
                            text=text, start_offset=so, end_offset=eo,
                            token_count=tc))
                else:
                    raise RuntimeError("EMBEDDING_MISMATCH")

            await db.execute(update(Chat).where(Chat.id == chat_id).values(
                corpus_version=Chat.corpus_version + 1, memory_summary=None))
            await db.execute(update(TopicSet).where(
                TopicSet.chat_id == chat_id).values(status="stale"))

            await db.commit()
            return {"document_id": str(new_doc_id), "job_id": None,
                    "chat_id": str(chat_id), "chat_title": chat_title}
        except Exception as clone_err:
            import logging
            logging.getLogger("study.api").warning("Inline clone failed, falling back to worker: %s", clone_err)
            await db.rollback()

    # Fallback: queue for the worker (also used when source isn't ready)
    new_doc = Document(**doc_kwargs)
    db.add(new_doc)
    job = await enqueue(db, user_id, chat_id, "ingest_document",
                        document_id=new_doc_id,
                        payload={"index_version": str(new_version)})
    await db.commit()
    return {"document_id": str(new_doc_id), "job_id": str(job.id),
            "chat_id": str(chat_id), "chat_title": chat_title}


@router.delete("/documents/{document_id}", status_code=202)
async def delete_document(document_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    doc = await owned_doc(db, user, document_id)
    chat = await owned_chat(db, user, doc.chat_id, lock=True)
    await invalidate(db, chat)
    job = await tombstone_doc(db, user, doc)
    return {"job_id": job.id}


@router.delete("/chats/{chat_id}", status_code=202)
async def delete_chat(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id, lock=True)
    await invalidate(db, chat)
    chat.deleted_at = datetime.now(timezone.utc)
    docs = (await db.scalars(select(Document).where(Document.chat_id == chat_id, Document.deleted_at.is_(None)))).all()
    for doc in docs:
        await tombstone_doc(db, user, doc)
    job = await enqueue(db, user.id, chat_id, "cleanup_chat", priority=-10)
    return {"job_id": job.id}


@router.get("/chats/{chat_id}/jobs")
async def chat_jobs(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id)
    jobs = (await db.scalars(select(Job).where(Job.chat_id == chat.id).order_by(Job.created_at.desc()))).all()
    return {"items": [fields(j, "id", "type", "status", "progress", "error_code", "payload", "created_at", "updated_at") for j in jobs]}


@router.get("/jobs/{job_id}")
async def job_detail(job_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    job = await owned_job(db, user, job_id)
    return fields(job, "id", "type", "status", "progress", "error_code", "message_id")


@router.post("/jobs/{job_id}/cancel")
async def cancel(job_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    job = await owned_job(db, user, job_id)
    if job.type.startswith("cleanup"):
        fail(409, "CLEANUP_REQUIRED", "Deletion cleanup cannot be cancelled.")
    # Serialize cancellation with result publication, which also locks the chat.
    await owned_chat(db, user, job.chat_id, lock=True)
    await db.refresh(job)
    if job.status not in TERMINAL:
        job.cancel_requested = True
        job.status, job.error_code = "cancelled", "CANCELLED"
        job.updated_at = datetime.now(timezone.utc)
        # The heartbeat closes an active model stream even before its first token.
    if job.type == "extract_quiz":
        item = await db.get(QuizSet, UUID(job.payload["quiz_set_id"]))
        if item and item.status != "stale" and job.status in TERMINAL:
            item.status = job.status
    elif job.type == "extract_topics":
        item = await db.get(TopicSet, UUID(job.payload["topic_set_id"]))
        if item and item.status != "stale" and job.status in TERMINAL:
            item.status = job.status
    if job.type == "ingest_document" and job.status == "cancelled":
        doc = await db.get(Document, job.document_id)
        if doc:
            doc.status, doc.error_code = "cancelled", "CANCELLED"
    if job.message_id and job.status == "cancelled":
        message = await db.get(Message, job.message_id)
        if message:
            message.status = "stopped"
    return {"status": job.status}



@router.post("/jobs/{job_id}/retry", status_code=202)
async def retry(job_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    job = await owned_job(db, user, job_id)
    if job.status not in {"failed", "cancelled", "interrupted"}:
        fail(409, "NOT_RETRYABLE", "This job is not ready for retry.")
    if job.type == "generate_answer":
        fail(409, "RESUBMIT_QUESTION", "Send the question again to create a new answer.")
    if job.document_id:
        doc = await owned_doc(db, user, job.document_id)
        doc.status, doc.error_code = "queued", None
    job.status, job.attempts, job.cancel_requested, job.error_code = "pending", 0, False, None
    return {"job_id": job.id}


@router.get("/jobs/{job_id}/events")
async def events(job_id: UUID, request: Request, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_job(db, user, job_id)
    await db.commit()
    async def stream():
        previous = None
        while not await request.is_disconnected():
            async with async_session_factory() as session:
                current = await get_current_user(request, session)
                if not current:
                    yield 'event: expired\ndata: {}\n\n'
                    return
                try:
                    job = await owned_job(session, current, job_id)
                except HTTPException:
                    yield 'event: removed\ndata: {}\n\n'
                    return
                message = await session.get(Message, job.message_id) if job.message_id else None
                chat = await session.get(Chat, job.chat_id)
                stale = message and message.corpus_version != chat.corpus_version
                data = {"job_id": str(job.id), "status": job.status, "progress": job.progress,
                    "error_code": job.error_code, "message": await message_json(session, message) if message and not stale else None}
                payload = json.dumps(jsonable_encoder(data))
                if payload != previous:
                    yield f"event: snapshot\ndata: {payload}\n\n"
                    previous = payload
                else:
                    yield ': heartbeat\n\n'
                if job.status in TERMINAL or stale:
                    return
            await asyncio.sleep(0.35)
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/chats/{chat_id}/topic-sets", status_code=202)
async def create_topics(chat_id: UUID, body: CreateTopicSetRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id, lock=True)
    docs = await ready_scope(db, user, chat_id, body.document_ids)
    page_range = body.page_range
    if page_range and (set(page_range) != {"start", "end"} or not all(isinstance(v, int) and not isinstance(v, bool) for v in page_range.values())
                       or not 1 <= page_range["start"] <= page_range["end"] <= max(d.page_count for d in docs)):
        fail(422, "INVALID_RANGE", "Use a valid start and end PDF page number.")
    scope = {"document_ids": sorted(str(d.id) for d in docs), "page_range": page_range, "count": body.count}
    if body.topic:
        scope["topic"] = body.topic
    active_model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
    existing = (await db.scalars(select(TopicSet).where(TopicSet.chat_id == chat_id, TopicSet.corpus_version == chat.corpus_version,
        TopicSet.status.in_(["pending", "running", "complete"]), TopicSet.model_name == active_model,
        TopicSet.prompt_version == PROMPT_VERSION))).all()
    for item in existing:
        if item.scope == scope:
            job = await db.scalar(select(Job).where(Job.chat_id == chat_id, Job.payload["topic_set_id"].as_string() == str(item.id)))
            if job:
                return {"topic_set_id": item.id, "job_id": job.id}
    total_pages = sum(max(0, min(d.page_count, page_range["end"]) - page_range["start"] + 1)
                      if page_range else d.page_count for d in docs)
    topic_set = TopicSet(chat_id=chat_id, scope=scope, corpus_version=chat.corpus_version,
        model_name=active_model, prompt_version=PROMPT_VERSION, covered_pages={"processed": 0, "total": total_pages})
    db.add(topic_set)
    await db.flush()
    payload = {"topic_set_id": str(topic_set.id), "corpus_version": chat.corpus_version}
    if body.topic:
        payload["topic"] = body.topic
    job = await enqueue(db, user.id, chat_id, "extract_topics", payload=payload)
    return {"topic_set_id": topic_set.id, "job_id": job.id}


async def topic_json(db, item):
    topics = (await db.scalars(select(Topic).where(Topic.topic_set_id == item.id).order_by(Topic.rank))).all()
    job = await db.scalar(select(Job).where(Job.chat_id == item.chat_id, Job.payload["topic_set_id"].as_string() == str(item.id)))
    return {**fields(item, "id", "status", "covered_pages", "created_at", "scope"), "job_id": job.id if job else None,
        "job_status": job.status if job else None, "progress": job.progress if job else None,
        "error_code": job.error_code if job else None, "heartbeat_at": job.heartbeat_at if job else None,
        "completed_at": job.updated_at if job and job.status in ("complete", "failed", "cancelled") else None,
        "topics": [fields(t, "id", "title", "description", "importance_reason", "rank", "sources_json") for t in topics]}


@router.get("/chats/{chat_id}/topic-sets")
async def topic_sets(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    rows = (await db.scalars(select(TopicSet).where(TopicSet.chat_id == chat_id).order_by(TopicSet.created_at.desc()).limit(50))).all()
    return {"items": [await topic_json(db, row) for row in rows]}


@router.get("/topic-sets/{topic_set_id}")
async def topic_set_detail(topic_set_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    row = await db.get(TopicSet, topic_set_id)
    if not row:
        fail(404, "NOT_FOUND", "Topics not found.")
    await owned_chat(db, user, row.chat_id)
    return await topic_json(db, row)


@router.post("/chats/{chat_id}/quiz-sets", status_code=202)
async def create_quiz(chat_id: UUID, body: CreateQuizSetRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id, lock=True)
    docs = await ready_scope(db, user, chat_id, body.document_ids)
    page_range = body.page_range
    if page_range and (set(page_range) != {"start", "end"} or not all(isinstance(v, int) and not isinstance(v, bool) for v in page_range.values())
                       or not 1 <= page_range["start"] <= page_range["end"] <= max(d.page_count for d in docs)):
        fail(422, "INVALID_RANGE", "Use a valid start and end PDF page number.")
    scope = {"document_ids": sorted(str(d.id) for d in docs), "page_range": page_range}
    
    total_pages = sum(max(0, min(d.page_count, page_range["end"]) - page_range["start"] + 1)
                      if page_range else d.page_count for d in docs)
    quiz_set = QuizSet(chat_id=chat_id, scope=scope, corpus_version=chat.corpus_version,
        question_count=body.count, difficulty=body.difficulty, covered_pages={"processed": 0, "total": total_pages})
    db.add(quiz_set)
    await db.flush()
    payload = {"quiz_set_id": str(quiz_set.id), "corpus_version": chat.corpus_version}
    if body.topic:
        payload["topic"] = body.topic
    job = await enqueue(db, user.id, chat_id, "extract_quiz", payload=payload)
    return {"quiz_set_id": quiz_set.id, "job_id": job.id}


async def quiz_json(db, item):
    questions = (await db.scalars(select(QuizQuestion).where(QuizQuestion.quiz_set_id == item.id).order_by(QuizQuestion.rank))).all()
    job = await db.scalar(select(Job).where(Job.chat_id == item.chat_id, Job.payload["quiz_set_id"].as_string() == str(item.id)))
    return {**fields(item, "id", "status", "covered_pages", "created_at", "scope", "difficulty"), "job_id": job.id if job else None,
        "status": (job.status if job and job.status in TERMINAL and item.status != "stale" else item.status),
        "job_status": job.status if job else None, "progress": job.progress if job else None,
        "error_code": job.error_code if job else None, "heartbeat_at": job.heartbeat_at if job else None,
        "completed_at": job.updated_at if job and job.status in ("complete", "failed", "cancelled") else None,
        "questions": [fields(q, "id", "question", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation", "rank", "sources_json") for q in questions]}


@router.get("/chats/{chat_id}/quiz-sets")
async def quiz_sets(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    rows = (await db.scalars(select(QuizSet).where(QuizSet.chat_id == chat_id).order_by(QuizSet.created_at.desc()).limit(50))).all()
    return {"items": [await quiz_json(db, row) for row in rows]}


@router.get("/quiz-sets/{quiz_set_id}")
async def quiz_set_detail(quiz_set_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    row = await db.get(QuizSet, quiz_set_id)
    if not row:
        fail(404, "NOT_FOUND", "Quiz not found.")
    await owned_chat(db, user, row.chat_id)
    return await quiz_json(db, row)


# ──────────────────────────────────────────────
#  Presentations (PPT Maker)
# ──────────────────────────────────────────────

@router.post("/chats/{chat_id}/presentations", status_code=202)
async def create_presentation(chat_id: UUID, body: CreatePresentationSetRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id, lock=True)
    
    # We always create the PresentationSet row
    presentation_set = PresentationSet(
        chat_id=chat_id, 
        topic=body.topic, 
        slide_count=body.slide_count, 
        source_mix=body.source_mix, 
        corpus_version=chat.corpus_version
    )
    db.add(presentation_set)
    await db.flush()
    
    payload = {
        "presentation_set_id": str(presentation_set.id), 
        "corpus_version": chat.corpus_version,
        "topic": body.topic,
        "slide_count": body.slide_count,
        "source_mix": body.source_mix,
        "document_ids": [str(d) for d in body.document_ids] if body.document_ids else None
    }
    
    job = await enqueue(db, user.id, chat_id, "generate_presentation", payload=payload)
    return {"presentation_set_id": presentation_set.id, "job_id": job.id}


async def presentation_json(db, item):
    slides = (await db.scalars(select(PresentationSlide).where(PresentationSlide.presentation_set_id == item.id).order_by(PresentationSlide.rank))).all()
    job = await db.scalar(select(Job).where(Job.chat_id == item.chat_id, Job.payload["presentation_set_id"].as_string() == str(item.id)))
    return {**fields(item, "id", "topic", "slide_count", "source_mix", "status", "created_at"), "job_id": job.id if job else None,
        "status": (job.status if job and job.status in TERMINAL and item.status != "stale" else item.status),
        "job_status": job.status if job else None, "progress": job.progress if job else None,
        "error_code": job.error_code if job else None,
        "completed_at": job.updated_at if job and job.status in ("complete", "failed", "cancelled") else None,
        "slides": [fields(s, "id", "rank", "title", "bullet_points", "speaker_notes") for s in slides]}


@router.get("/chats/{chat_id}/presentations")
async def get_presentations(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    rows = (await db.scalars(select(PresentationSet).where(PresentationSet.chat_id == chat_id).order_by(PresentationSet.created_at.desc()).limit(50))).all()
    return {"items": [await presentation_json(db, row) for row in rows]}


@router.get("/presentations/{presentation_set_id}")
async def presentation_set_detail(presentation_set_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    row = await db.get(PresentationSet, presentation_set_id)
    if not row:
        fail(404, "NOT_FOUND", "Presentation not found.")
    await owned_chat(db, user, row.chat_id)
    return await presentation_json(db, row)


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat_ids = select(Chat.id).where(Chat.user_id == user.id, Chat.deleted_at.is_(None))
    docs = select(Document).where(Document.chat_id.in_(chat_ids), Document.deleted_at.is_(None), Document.status == "ready")
    ready_docs = (await db.scalars(docs)).all()
    recent = (await db.scalars(select(Chat).where(Chat.id.in_(chat_ids)).order_by(Chat.updated_at.desc()).limit(5))).all()
    topic_count = await db.scalar(select(func.count()).select_from(Topic).join(TopicSet).where(TopicSet.chat_id.in_(chat_ids), TopicSet.status == "complete"))
    return {"total_chats": await db.scalar(select(func.count()).select_from(Chat).where(Chat.id.in_(chat_ids))),
        "ready_documents": len(ready_docs), "indexed_pages": sum(d.page_count or 0 for d in ready_docs),
        "saved_topics": topic_count, "recent_chats": [fields(c, "id", "title", "updated_at") for c in recent]}


@router.get("/admin/users")
async def get_all_users(db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    users = (await db.scalars(select(User).order_by(User.created_at.desc()))).all()
    return {"users": [fields(u, "id", "username", "is_active", "created_at") for u in users]}


@router.post("/admin/users", status_code=201)
async def create_user(body: AdminUserCreateRequest, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    email = body.email.strip().lower()
    username = body.username.strip()
    existing_user = await db.scalar(select(User).where(User.email == email))
    if existing_user:
        fail(409, "EMAIL_TAKEN", "Email is already taken.")
        
    hashed = await asyncio.to_thread(passwords.hash, body.password)
    user = User(username=username, email=email, password_hash=hashed, email_verified=True)
    db.add(user)
    await db.flush()
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="USER_CREATED", target_type="user",
                     target_id=str(user.id), target_label=email,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"id": user.id}


@router.put("/admin/users/{user_id}")
async def update_user(user_id: UUID, body: AdminUserUpdateRequest, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    if user_id == admin.id and body.is_active is False:
        fail(400, "BAD_REQUEST", "You cannot deactivate your own admin account.")
        
    user = await db.get(User, user_id)
    if not user:
        fail(404, "NOT_FOUND", "User not found.")
        
    if body.email is not None:
        new_email = body.email.strip().lower()
        if new_email != user.email:
            existing = await db.scalar(select(User).where(User.email == new_email))
            if existing:
                fail(409, "EMAIL_TAKEN", "Email is already taken.")
            user.email = new_email
            
    if body.username is not None:
        user.username = body.username.strip()
            
    if body.password is not None and body.password.strip():
        user.password_hash = await asyncio.to_thread(passwords.hash, body.password)
        
    if body.is_active is not None:
        user.is_active = body.is_active
        
    if body.storage_quota_bytes is not None:
        user.storage_quota_bytes = body.storage_quota_bytes if body.storage_quota_bytes > 0 else None
        
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="USER_UPDATED", target_type="user",
                     target_id=str(user.id), target_label=user.username,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.delete("/admin/users/{user_id}", status_code=204)
async def delete_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    if user_id == admin.id:
        fail(400, "BAD_REQUEST", "You cannot delete your own admin account.")
        
    user = await db.get(User, user_id)
    if not user:
        fail(404, "NOT_FOUND", "User not found.")
        
    username = user.username
    await db.delete(user)
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="USER_DELETED", target_type="user",
                     target_id=str(user_id), target_label=username,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return None


@router.get("/admin/users/{user_id}/detail")
async def get_user_detail(user_id: UUID, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    user = await db.get(User, user_id)
    if not user: fail(404, "NOT_FOUND", "User not found.")
    
    profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    
    doc_count = await db.scalar(select(func.count(Document.id)).where(Document.user_id==user_id, Document.deleted_at.is_(None)))
    chat_count = await db.scalar(select(func.count(Chat.id)).where(Chat.user_id==user_id))
    query_count = await db.scalar(select(func.count(Message.id)).where(Message.role=='user').join(Chat).where(Chat.user_id==user_id))
    storage_used = await db.scalar(select(func.coalesce(func.sum(Document.byte_size),0)).where(Document.user_id==user_id, Document.deleted_at.is_(None)))
    
    last_session = await db.scalar(select(Session.created_at).where(Session.user_id==user_id).order_by(Session.created_at.desc()).limit(1))
    
    quota = user.storage_quota_bytes or (settings.MAX_UPLOAD_QUOTA_MB * 1024**2)
    
    usage_rows = (await db.execute(
        select(func.date(Message.created_at).label('d'), func.count(Message.id).label('n'))
        .join(Chat).where(Chat.user_id==user_id, Message.role=='assistant')
        .group_by(func.date(Message.created_at))
        .order_by(func.date(Message.created_at).desc()).limit(30)
    )).all()
    
    active_sessions = (await db.scalars(select(Session).where(
        Session.user_id==user_id, Session.revoked_at.is_(None), Session.expires_at > utcnow()
    ))).all()
    
    avatar_url = f"/api/v1/admin/users/{user_id}/avatar?v={profile.avatar_version}" if (profile and profile.avatar_key) else None

    return {
        "id": str(user.id), "username": user.username, "is_active": user.is_active,
        "created_at": user.created_at.isoformat(), "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "display_name": profile.display_name if profile else None,
        "email": user.email,
        "avatar_url": avatar_url,
        "last_active": last_session.isoformat() if last_session else None,
        "stats": {"documents": doc_count, "chats": chat_count, "queries": query_count,
                  "storage_used_bytes": storage_used, "storage_quota_bytes": quota},
        "ai_usage": [{"date": str(r.d), "queries": r.n} for r in reversed(usage_rows)],
        "active_sessions": len(active_sessions),
        "storage_quota_bytes": user.storage_quota_bytes,
    }


@router.get("/admin/users/{user_id}/avatar")
async def get_user_avatar_admin(user_id: UUID, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if not profile or not profile.avatar_key:
        fail(404, "NOT_FOUND", "No avatar set.")

    full_path = settings.STORAGE_ROOT / profile.avatar_key
    if not full_path.is_file() or not full_path.resolve().is_relative_to(settings.STORAGE_ROOT.resolve()):
        fail(404, "NOT_FOUND", "Avatar file not found.")

    return FileResponse(
        full_path,
        media_type="image/webp",
        headers={
            "Cache-Control": "private, max-age=86400",
            "ETag": f'"av-{profile.avatar_version}"',
        },
    )


@router.post("/admin/users/{user_id}/force-logout")
async def admin_force_logout(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    user = await db.get(User, user_id)
    if not user: fail(404, "NOT_FOUND", "User not found.")
    
    now = utcnow()
    sessions = (await db.scalars(select(Session).where(Session.user_id==user_id, Session.revoked_at.is_(None)))).all()
    for s in sessions:
        s.revoked_at = now
    
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="USER_FORCE_LOGOUT", target_type="user", target_id=str(user_id),
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.post("/admin/users/{user_id}/reset-quota")
async def admin_reset_quota(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    user = await db.get(User, user_id)
    if not user: fail(404, "NOT_FOUND", "User not found.")
    
    user.storage_quota_bytes = None
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="USER_QUOTA_RESET", target_type="user", target_id=str(user_id),
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.get("/admin/analytics/rag")
async def get_admin_rag_analytics(db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    from app.models.models import RagQueryLog
    
    # KPIs
    total_queries = await db.scalar(select(func.count(RagQueryLog.id))) or 0
    
    if total_queries == 0:
        return {
            "total_queries": 0,
            "avg_docs_retrieved": 0,
            "semantic_success": 0,
            "bm25_success": 0,
            "avg_latency": 0,
            "pipeline": {
                "embed_ms": 0, "vector_search_ms": 0, "bm25_ms": 0,
                "rrf_ms": 0, "rerank_ms": 0, "llm_ms": 0, "total_ms": 0
            },
            "citations": {
                "success_rate": 0,
                "repair_rate": 0,
                "no_context_rate": 0,
                "avg_sources": 0
            },
            "recent_queries": []
        }

    # Avg retrieved
    avg_docs = await db.scalar(select(func.avg(RagQueryLog.doc_count))) or 0
    
    # Semantic vs BM25 success (queries where that method returned > 0 results)
    sem_success = await db.scalar(select(func.count(RagQueryLog.id)).where(RagQueryLog.semantic_results > 0)) or 0
    bm25_success = await db.scalar(select(func.count(RagQueryLog.id)).where(RagQueryLog.bm25_results > 0)) or 0

    # Pipeline Averages
    pipeline = await db.execute(select(
        func.avg(RagQueryLog.embed_ms),
        func.avg(RagQueryLog.vector_search_ms),
        func.avg(RagQueryLog.bm25_ms),
        func.avg(RagQueryLog.rrf_ms),
        func.avg(RagQueryLog.rerank_ms),
        func.avg(RagQueryLog.llm_ms),
        func.avg(RagQueryLog.total_ms)
    ).where(RagQueryLog.total_ms.is_not(None)))
    p_row = pipeline.first()
    
    # Citations
    c_used = await db.scalar(select(func.avg(RagQueryLog.citations_used))) or 0
    repairs = await db.scalar(select(func.count(RagQueryLog.id)).where(RagQueryLog.citation_repair_triggered.is_(True))) or 0
    no_ctx = await db.scalar(select(func.count(RagQueryLog.id)).where(RagQueryLog.no_context_found.is_(True))) or 0
    avg_chunks = await db.scalar(select(func.avg(RagQueryLog.merged_results))) or 0
    
    # Recent queries
    recent = (await db.execute(
        select(RagQueryLog, User.username)
        .join(User, RagQueryLog.user_id == User.id)
        .order_by(RagQueryLog.created_at.desc())
        .limit(20)
    )).all()

    return {
        "total_queries": total_queries,
        "avg_docs_retrieved": float(avg_docs),
        "semantic_success": round((sem_success / total_queries) * 100) if total_queries else 0,
        "bm25_success": round((bm25_success / total_queries) * 100) if total_queries else 0,
        "avg_latency": float(p_row[6] or 0),
        "pipeline": {
            "embed_ms": float(p_row[0] or 0),
            "vector_search_ms": float(p_row[1] or 0),
            "bm25_ms": float(p_row[2] or 0),
            "rrf_ms": float(p_row[3] or 0),
            "rerank_ms": float(p_row[4] or 0),
            "llm_ms": float(p_row[5] or 0),
            "total_ms": float(p_row[6] or 0)
        },
        "citations": {
            "success_rate": round(((total_queries - no_ctx - repairs) / total_queries) * 100) if total_queries else 0,
            "repair_rate": round((repairs / total_queries) * 100) if total_queries else 0,
            "no_context_rate": round((no_ctx / total_queries) * 100) if total_queries else 0,
            "avg_sources": float(c_used),
            "avg_context_chunks": float(avg_chunks)
        },
        "recent_queries": [{
            "id": str(r.id),
            "username": u,
            "preview": r.question_preview,
            "total_ms": r.total_ms,
            "sources": r.final_sources,
            "created_at": r.created_at.isoformat()
        } for r, u in recent]
    }


@router.get("/admin/analytics/rag/queries")
async def get_admin_rag_queries_list(
    page: int = 1,
    limit: int = 10,
    user_search: str = None,
    keyword: str = None,
    date_from: str = None,
    date_to: str = None,
    db: AsyncSession = Depends(get_db),
    admin=Depends(admin_dep)
):
    from app.models.models import RagQueryLog, User
    from datetime import datetime

    
    query = select(RagQueryLog, User.username).join(User, RagQueryLog.user_id == User.id)
    
    if user_search:
        query = query.where(User.username.ilike(f"%{user_search}%"))
    if keyword:
        query = query.where(RagQueryLog.question_preview.ilike(f"%{keyword}%"))
    if date_from:
        try:
            df = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            query = query.where(RagQueryLog.created_at >= df)
        except: pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            query = query.where(RagQueryLog.created_at <= dt)
        except: pass
        
    count_query = select(func.count()).select_from(query.subquery())
    total_count = await db.scalar(count_query) or 0
    
    query = query.order_by(RagQueryLog.created_at.desc()).offset((page - 1) * limit).limit(limit)
    results = (await db.execute(query)).all()
    
    return {
        "items": [{
            "id": str(r.id),
            "username": u,
            "preview": r.question_preview,
            "total_ms": r.total_ms,
            "sources": r.final_sources,
            "created_at": r.created_at.isoformat()
        } for r, u in results],
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if limit > 0 else 0
    }


@router.get("/admin/analytics/rag/{log_id}")
async def get_admin_rag_query_detail(log_id: UUID, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    from app.models.models import RagQueryLog, User, UserProfile, Message, Document
    
    log = await db.get(RagQueryLog, log_id)
    if not log:
        fail(404, "NOT_FOUND", "Log not found")
        
    user = await db.get(User, log.user_id)
    if not user:
        fail(404, "NOT_FOUND", "User not found")
        
    profile = await db.get(UserProfile, log.user_id)
    email = user.email
    
    question = None
    answer = None
    docs = []
    
    if log.message_id:
        assistant_msg = await db.get(Message, log.message_id)
        if assistant_msg:
            answer = assistant_msg.content
            
            q_res = await db.execute(
                select(Message)
                .where(Message.chat_id == assistant_msg.chat_id, Message.sequence_no < assistant_msg.sequence_no, Message.role == "user")
                .order_by(Message.sequence_no.desc())
                .limit(1)
            )
            q_msg = q_res.scalar_one_or_none()
            if q_msg:
                question = q_msg.content
            
            docs_res = await db.execute(
                select(Document).where(Document.chat_id == assistant_msg.chat_id)
            )
            for d in docs_res.scalars():
                docs.append({
                    "id": str(d.id),
                    "chat_id": str(d.chat_id),
                    "filename": d.original_filename,
                    "byte_size": d.byte_size,
                    "page_count": d.page_count
                })

    return {
        "id": str(log.id),
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": email,
        },
        "question": question or log.question_preview,
        "answer": answer,
        "documents": docs,
        "metrics": {
            "total_ms": log.total_ms,
            "sources": log.final_sources,
            "embed_ms": log.embed_ms,
            "vector_search_ms": log.vector_search_ms,
            "bm25_ms": log.bm25_ms,
            "rerank_ms": log.rerank_ms,
            "llm_ms": log.llm_ms,
            "rrf_ms": log.rrf_ms,
            "semantic_results": log.semantic_results,
            "bm25_results": log.bm25_results,
            "merged_results": log.merged_results,
            "reranked_results": log.reranked_results
        },
        "created_at": log.created_at.isoformat()
    }


@router.post("/admin/users/{user_id}/soft-delete")
async def admin_soft_delete(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    if user_id == admin.id:
        fail(400, "BAD_REQUEST", "You cannot delete your own admin account.")
        
    user = await db.get(User, user_id)
    if not user: fail(404, "NOT_FOUND", "User not found.")
    
    now = utcnow()
    user.deleted_at = now
    user.is_active = False
    
    sessions = (await db.scalars(select(Session).where(Session.user_id==user_id, Session.revoked_at.is_(None)))).all()
    for s in sessions:
        s.revoked_at = now
        
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="USER_SOFT_DELETED", target_type="user", target_id=str(user_id),
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.post("/admin/users/{user_id}/restore")
async def admin_restore_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    user = await db.get(User, user_id)
    if not user: fail(404, "NOT_FOUND", "User not found.")
    
    user.deleted_at = None
    user.is_active = True
    
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="USER_RESTORED", target_type="user", target_id=str(user_id),
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.get("/admin/documents")
async def get_all_documents(
    status_filter: str | None = Query(None),
    db: AsyncSession = Depends(get_db), 
    admin=Depends(admin_dep)
):
    query = select(Document, User.username, Chat.title).join(User, Document.user_id == User.id).join(Chat, Document.chat_id == Chat.id)

    ocr_subquery = select(DocumentPage.document_id).where(
        DocumentPage.extraction_method.in_(["ocr", "mixed"])
    ).distinct()

    if status_filter == "deleted":
        query = query.where(Document.deleted_at.is_not(None))
    elif status_filter == "ocr_required":
        query = query.where(
            Document.deleted_at.is_(None),
            Document.status == "ready",
            Document.id.in_(ocr_subquery)
        )
    elif status_filter == "processing":
        query = query.where(
            Document.deleted_at.is_(None),
            Document.status.in_(["queued", "extracting", "indexing"])
        )
    elif status_filter and status_filter != "all":
        query = query.where(
            Document.deleted_at.is_(None),
            Document.status == status_filter
        )
    else:  # "all" or None
        query = query.where(Document.deleted_at.is_(None))

    rows = (await db.execute(query.order_by(Document.created_at.desc()))).all()

    # Fast counts for the filter tabs
    c_all = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None))) or 0
    c_ready = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None), Document.status == "ready")) or 0
    c_processing = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None), Document.status.in_(["queued", "extracting", "indexing"]))) or 0
    c_failed = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None), Document.status == "failed")) or 0
    c_ocr = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None), Document.status == "ready", Document.id.in_(ocr_subquery))) or 0
    c_deleted = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_not(None))) or 0

    return {
        "documents": [{
            **document_json(doc),
            "username": username,
            "chat_id": str(doc.chat_id),
            "chat_title": title,
            "deleted_at": doc.deleted_at.isoformat() if doc.deleted_at else None,
        } for doc, username, title in rows],
        "counts": {
            "all": c_all,
            "ready": c_ready,
            "processing": c_processing,
            "failed": c_failed,
            "ocr_required": c_ocr,
            "deleted": c_deleted
        }
    }


@router.get("/admin/documents/{document_id}/detail")
async def get_admin_document_detail(document_id: UUID, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc:
        fail(404, "NOT_FOUND", "Document not found.")

    ocr_pages = await db.scalar(select(func.count(DocumentPage.id)).where(
        DocumentPage.document_id == doc.id,
        DocumentPage.extraction_method.in_(["ocr", "mixed"])
    )) or 0

    chunk_count = await db.scalar(select(func.count(DocumentChunk.id)).where(
        DocumentChunk.document_id == doc.id
    )) or 0

    owner = await db.get(User, doc.user_id)
    chat = await db.get(Chat, doc.chat_id)

    latest_job = await db.scalar(select(Job).where(
        Job.document_id == doc.id,
        Job.type == "ingest_document"
    ).order_by(Job.created_at.desc()).limit(1))

    return {
        "id": str(doc.id),
        "original_filename": doc.original_filename,
        "owner_username": owner.username if owner else "Unknown",
        "owner_id": str(doc.user_id),
        "chat_id": str(doc.chat_id),
        "chat_title": chat.title if chat else "Unknown",
        "byte_size": doc.byte_size,
        "page_count": doc.page_count,
        "status": doc.status,
        "error_code": doc.error_code,
        "ocr_page_count": ocr_pages,
        "chunk_count": chunk_count,
        "index_version": str(doc.active_index_version) if doc.active_index_version else None,
        "extraction_version": doc.extraction_version,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        "deleted_at": doc.deleted_at.isoformat() if doc.deleted_at else None,
        "latest_job_error": latest_job.error_code if latest_job and latest_job.status == "failed" else None
    }


@router.post("/admin/documents/{document_id}/reprocess", status_code=202)
async def admin_reprocess_document(document_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at:
        fail(404, "NOT_FOUND", "Document not found or is deleted.")
    await db.execute(update(Job).where(Job.document_id == doc.id,
        Job.status.in_(["pending", "running"])).values(cancel_requested=True))
    doc.status = "queued"
    doc.error_code = None
    doc.active_index_version = None
    await db.flush()
    job = await enqueue(db, doc.user_id, doc.chat_id, "ingest_document",
        document_id=doc.id, payload={"force": True, "index_version": str(uuid4())})
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="DOCUMENT_REPROCESSED", target_type="document",
                     target_id=str(doc.id), target_label=doc.original_filename,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"job_id": str(job.id)}


@router.post("/admin/documents/{document_id}/reindex", status_code=202)
async def admin_reindex_document(document_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at:
        fail(404, "NOT_FOUND", "Document not found or is deleted.")
    await db.execute(update(Job).where(Job.document_id == doc.id,
        Job.status.in_(["pending", "running"])).values(cancel_requested=True))
    doc.status = "queued"
    doc.error_code = None
    doc.active_index_version = None
    await db.flush()
    job = await enqueue(db, doc.user_id, doc.chat_id, "ingest_document",
        document_id=doc.id, payload={"force": True, "skip_extraction": True, "index_version": str(uuid4())})
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="DOCUMENT_REINDEXED", target_type="document",
                     target_id=str(doc.id), target_label=doc.original_filename,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"job_id": str(job.id)}


@router.post("/admin/documents/{document_id}/restore")
async def restore_admin_document(document_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc or not doc.deleted_at:
        fail(404, "NOT_FOUND", "Document not found or is not deleted.")
    doc.deleted_at = None
    doc.status = "queued"
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="DOCUMENT_RESTORED", target_type="document",
                     target_id=str(doc.id), target_label=doc.original_filename,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.delete("/admin/documents/{document_id}/permanent", status_code=200)
async def admin_hard_delete_document(document_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc:
        fail(404, "NOT_FOUND", "Document not found.")

    doc_filename = doc.original_filename
    doc_key = doc.storage_key

    # Remove vectors from chroma
    try:
        index = await asyncio.to_thread(providers.collection)
        await asyncio.to_thread(index.delete, where={"document_id": str(document_id)})
    except Exception:
        pass

    # Remove physical file if no other non-deleted document uses it
    if doc_key:
        try:
            path = (settings.STORAGE_ROOT / doc_key).resolve()
            in_use = await db.scalar(select(Document.id).where(Document.storage_key == doc_key, Document.id != doc.id, Document.deleted_at.is_(None)).limit(1))
            if not in_use and path.is_file():
                path.unlink(missing_ok=True)
        except Exception:
            pass

    # Clean up related records
    await db.execute(update(MessageSource).where(MessageSource.document_id == document_id).values(chunk_id=None, document_id=None, excerpt=None, source_status="unavailable"))
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
    await db.execute(delete(DocumentPage).where(DocumentPage.document_id == document_id))
    await db.execute(delete(Job).where(Job.document_id == document_id))

    await db.delete(doc)
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="DOCUMENT_PERMANENTLY_DELETED", target_type="document",
                     target_id=str(document_id), target_label=doc_filename,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.put("/admin/documents/{document_id}")
async def update_document(document_id: UUID, body: AdminDocumentUpdateRequest, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at:
        fail(404, "NOT_FOUND", "Document not found.")
    old_name = doc.original_filename
    doc.original_filename = body.original_filename.strip()
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="DOCUMENT_RENAMED", target_type="document",
                     target_id=str(doc.id), target_label=doc.original_filename,
                     metadata={"old_name": old_name},
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}


@router.delete("/admin/documents/{document_id}", status_code=202)
async def delete_admin_document(document_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at:
        fail(404, "NOT_FOUND", "Document not found.")
    chat = await db.get(Chat, doc.chat_id)
    if chat:
        await invalidate(db, chat)
    job = await tombstone_doc(db, User(id=doc.user_id), doc)
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="DOCUMENT_DELETED", target_type="document",
                     target_id=str(doc.id), target_label=doc.original_filename,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"job_id": job.id}


@router.get("/admin/documents/{document_id}/file")
async def admin_document_file(document_id: UUID, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at:
        fail(404, "NOT_FOUND", "Document not found.")
    path = safe_file(doc.storage_key)
    if not path.is_file():
        fail(404, "NOT_FOUND", "File not found.")
    return FileResponse(path, media_type="application/pdf", filename=doc.original_filename,
        content_disposition_type="inline", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.get("/admin/dashboard")
async def admin_dashboard(db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    import shutil
    now_ts = datetime.now(timezone.utc)
    today_start = now_ts.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    seven_days_ago = now_ts - timedelta(days=7)

    # Users
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_today = await db.scalar(select(func.count(func.distinct(Session.user_id))).where(Session.created_at >= today_start)) or 0
    active_week = await db.scalar(select(func.count(func.distinct(Session.user_id))).where(Session.created_at >= week_start)) or 0
    new_month = await db.scalar(select(func.count(User.id)).where(User.created_at >= month_start)) or 0

    # Documents
    docs = (await db.execute(select(Document.status, func.count(Document.id)).where(Document.deleted_at.is_(None)).group_by(Document.status))).all()
    doc_stats = {row[0]: row[1] for row in docs}
    total_docs = sum(doc_stats.values())

    # Queries
    total_queries = await db.scalar(select(func.count(Message.id)).where(Message.role == 'user')) or 0
    queries_today = await db.scalar(select(func.count(Message.id)).where(Message.role == 'user', Message.created_at >= today_start)) or 0
    queries_7d = await db.scalar(select(func.count(Message.id)).where(Message.role == 'user', Message.created_at >= seven_days_ago)) or 0
    avg_queries = round(total_queries / total_users, 1) if total_users else 0

    # Storage
    storage_used_bytes = await db.scalar(select(func.coalesce(func.sum(Document.byte_size), 0)).where(Document.deleted_at.is_(None))) or 0
    pdf_storage = storage_used_bytes
    disk_usage = shutil.disk_usage(settings.STORAGE_ROOT)

    # Jobs
    jobs_rows = (await db.execute(select(Job.status, func.count(Job.id)).group_by(Job.status))).all()
    job_stats = {row[0]: row[1] for row in jobs_rows}
    jobs_complete_today = await db.scalar(select(func.count(Job.id)).where(Job.status == "complete", Job.updated_at >= today_start)) or 0

    # System Status
    ollama_status = "Online"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code != 200: ollama_status = "Error"
    except Exception:
        ollama_status = "Offline"

    chroma_status = "Online"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"http://{settings.CHROMA_HOST}:{settings.CHROMA_PORT}/api/v2/heartbeat")
            if resp.status_code != 200: chroma_status = "Error"
    except Exception:
        chroma_status = "Offline"

    active_worker = await db.scalar(
        select(Job.id).where(Job.status == "running", Job.heartbeat_at >= now_ts - timedelta(minutes=2)).limit(1)
    )
    worker_status = "Online" if active_worker else "Idle"

    # Recent activity
    recent_users_list = (await db.scalars(select(User).order_by(User.created_at.desc()).limit(5))).all()
    recent_docs_list = (await db.scalars(select(Document).where(Document.deleted_at.is_(None)).order_by(Document.created_at.desc()).limit(5))).all()
    doc_users = {}
    for d in recent_docs_list:
        if d.user_id not in doc_users:
            u = await db.get(User, d.user_id)
            doc_users[d.user_id] = u.username if u else "Unknown"

    return {
        "users": {"total": total_users, "active_today": active_today, "active_week": active_week, "new_month": new_month},
        "documents": {"total": total_docs, "ready": doc_stats.get("ready", 0), "processing": doc_stats.get("processing", 0), "failed": doc_stats.get("failed", 0), "ocr_processed": 0},
        "queries": {"total": total_queries, "today": queries_today, "last_7d": queries_7d, "avg_per_user": avg_queries},
        "storage": {"pdf_bytes": pdf_storage, "chroma_bytes": 0, "db_bytes": 0, "disk_free_bytes": disk_usage.free, "disk_total_bytes": disk_usage.total},
        "jobs": {"running": job_stats.get("running", 0), "queued": job_stats.get("pending", 0), "failed": job_stats.get("failed", 0), "complete_today": jobs_complete_today},
        "system": {"ollama": ollama_status, "chroma": chroma_status, "postgres": "Online", "worker": worker_status},
        "total_users": total_users,
        "total_documents": total_docs,
        "total_ai_queries": total_queries,
        "storage_used_bytes": storage_used_bytes,
        "recent_users": [{"id": str(u.id), "username": u.username, "created_at": u.created_at.isoformat()} for u in recent_users_list],
        "recent_documents": [{"id": str(d.id), "original_filename": d.original_filename, "username": doc_users.get(d.user_id, "Unknown"), "created_at": d.created_at.isoformat()} for d in recent_docs_list]
    }


@router.get("/admin/analytics/ai-usage")
async def admin_analytics_ai_usage(
    range: str = "30d",
    db: AsyncSession = Depends(get_db), 
    admin=Depends(admin_dep)
):
    from sqlalchemy import case, func
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    if range == "24h":
        start_time = now - timedelta(hours=24)
        date_col = func.date_trunc('hour', AiUsageLog.created_at)
    elif range == "7d":
        start_time = now - timedelta(days=7)
        date_col = func.date(AiUsageLog.created_at)
    elif range == "90d":
        start_time = now - timedelta(days=90)
        date_col = func.date(AiUsageLog.created_at)
    else:
        start_time = now - timedelta(days=30)
        date_col = func.date(AiUsageLog.created_at)
    
    kpi_row = (await db.execute(
        select(
            func.count(AiUsageLog.id).label("total_queries"),
            func.sum(AiUsageLog.input_tokens).label("input_tokens"),
            func.sum(AiUsageLog.output_tokens).label("output_tokens"),
            func.avg(AiUsageLog.duration_ms).label("avg_response_time"),
            func.sum(case((AiUsageLog.is_successful == False, 1), else_=0)).label("failed_generations")
        ).where(AiUsageLog.created_at >= start_time)
    )).fetchone()
    
    total_queries = kpi_row.total_queries or 0
    input_tokens = kpi_row.input_tokens or 0
    output_tokens = kpi_row.output_tokens or 0
    avg_response_time = float(kpi_row.avg_response_time or 0) / 1000.0
    failed_generations = kpi_row.failed_generations or 0
    avg_tokens_per_query = ((input_tokens + output_tokens) / total_queries) if total_queries else 0

    kpis = {
        "total_queries": total_queries,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "avg_response_time": avg_response_time,
        "avg_tokens_per_query": round(avg_tokens_per_query),
        "failed_generations": failed_generations
    }

    ts_rows = (await db.execute(
        select(
            date_col.label("date"),
            func.count(AiUsageLog.id).label("queries"),
            func.sum(AiUsageLog.input_tokens).label("input"),
            func.sum(AiUsageLog.output_tokens).label("output")
        )
        .where(AiUsageLog.created_at >= start_time)
        .group_by(date_col)
        .order_by(date_col.desc())
        .limit(100)
    )).all()
    
    daily = []
    for r in reversed(ts_rows):
        d_str = str(r.date)
        if range == "24h" and len(d_str) > 13:
            # PostgreSQL date_trunc('hour') returns 'YYYY-MM-DD HH:MM:SS'
            # Format to 'YYYY-MM-DD HH:00'
            d_str = d_str[:13] + ":00"
        daily.append({"date": d_str, "queries": r.queries, "input": r.input or 0, "output": r.output or 0})

    user_rows = (await db.execute(
        select(
            User.id,
            User.username,
            func.count(AiUsageLog.id).label("queries"),
            func.sum(AiUsageLog.input_tokens).label("input"),
            func.sum(AiUsageLog.output_tokens).label("output"),
            func.avg(AiUsageLog.duration_ms).label("avg_latency")
        )
        .join(User, AiUsageLog.user_id == User.id)
        .where(AiUsageLog.created_at >= start_time)
        .group_by(User.id, User.username)
        .order_by(func.count(AiUsageLog.id).desc())
        .limit(20)
    )).all()
    
    by_user = [{
        "user_id": r.id,
        "username": r.username,
        "queries": r.queries,
        "input_tokens": r.input or 0,
        "output_tokens": r.output or 0,
        "avg_latency_ms": round(float(r.avg_latency or 0))
    } for r in user_rows]

    type_rows = (await db.execute(
        select(
            AiUsageLog.query_type,
            func.count(AiUsageLog.id).label("count")
        )
        .where(AiUsageLog.created_at >= start_time)
        .group_by(AiUsageLog.query_type)
    )).all()
    
    by_type = []
    for r in type_rows:
        percentage = round((r.count / total_queries) * 100) if total_queries else 0
        by_type.append({"type": r.query_type, "count": r.count, "percentage": percentage})
        
    legacy_usage = [{"date": d["date"], "tokens_used": d["input"] + d["output"], "active_users": 1} for d in daily]

    return {
        "kpis": kpis,
        "time_series": {"daily": daily},
        "by_user": by_user,
        "by_type": by_type,
        "usage": legacy_usage
    }


# ────────────────────────────────────────────────
#  Storage Administration
# ────────────────────────────────────────────────

def _get_dir_size(path: Path) -> int:
    """Recursively sum file sizes in a directory."""
    try:
        if not path.exists():
            return 0
        return sum(f.stat().st_size for f in path.rglob('*') if f.is_file())
    except Exception as e:
        import logging
        logging.getLogger("study.api").error(f"Error calculating dir size {path}: {e}")
        return 0

@router.get("/admin/storage/stats")
async def get_admin_storage_stats(
    db: AsyncSession = Depends(get_db),
    admin=Depends(admin_dep)
):
    """Get disk usage and database statistics."""
    from sqlalchemy import text
    from app.providers import collection
    
    # 1. Folder Sizes
    chroma_path = settings.STORAGE_ROOT / "chroma"
    uploads_path = settings.STORAGE_ROOT / settings.UPLOAD_DIR
    
    chroma_size = _get_dir_size(chroma_path)
    
    # Differentiate PDFs vs other files in uploads
    pdf_size = 0
    temp_size = 0
    if uploads_path.exists():
        for f in uploads_path.rglob('*'):
            if f.is_file():
                if f.suffix.lower() == '.pdf':
                    pdf_size += f.stat().st_size
                else:
                    temp_size += f.stat().st_size
                    
    # Postgres is harder to guess exactly without querying. 
    # Use pg_database_size to get exactly what PostgreSQL sees.
    try:
        postgres_size = await db.scalar(text("SELECT pg_database_size(current_database())"))
    except Exception:
        postgres_size = 0
        
    total_size = chroma_size + pdf_size + temp_size + (postgres_size or 0)
    
    # 2. Chroma stats
    try:
        col = await asyncio.to_thread(collection)
        vector_count = await asyncio.to_thread(col.count)
    except Exception:
        vector_count = 0
        
    # 3. PostgreSQL counts
    try:
        users = await db.scalar(select(func.count(User.id)))
        chats = await db.scalar(select(func.count(Chat.id)))
        messages = await db.scalar(select(func.count(Message.id)))
        documents = await db.scalar(select(func.count(Document.id)))
        jobs = await db.scalar(select(func.count(Job.id)))
        audit = await db.scalar(select(func.count(AuditLog.id)))
    except Exception:
        users, chats, messages, documents, jobs, audit = 0, 0, 0, 0, 0, 0

    return {
        "overview": {
            "pdf_size_bytes": pdf_size,
            "chroma_size_bytes": chroma_size,
            "postgres_size_bytes": postgres_size,
            "temp_size_bytes": temp_size,
            "total_size_bytes": total_size
        },
        "chromadb": {
            "collections_count": 1, # We only use one main collection typically
            "vector_count": vector_count,
            "index_size_bytes": chroma_size,
            "embedding_dimension": 384, # usually miniLM
            "orphaned_vectors": 0 # Not practically calculable dynamically without full scan
        },
        "postgres": {
            "database_size_bytes": postgres_size,
            "counts": {
                "users": users,
                "chats": chats,
                "messages": messages,
                "documents": documents,
                "jobs": jobs,
                "audit_entries": audit
            }
        }
    }


@router.post("/admin/storage/cleanup/temp")
async def admin_cleanup_temp(
    admin=Depends(admin_dep)
):
    """Delete non-PDF files in the uploads directory."""
    uploads_path = settings.STORAGE_ROOT / settings.UPLOAD_DIR
    deleted_count = 0
    freed_bytes = 0
    if uploads_path.exists():
        for f in uploads_path.rglob('*'):
            if f.is_file() and f.suffix.lower() != '.pdf':
                try:
                    size = f.stat().st_size
                    f.unlink()
                    deleted_count += 1
                    freed_bytes += size
                except Exception:
                    pass
    return {"message": "Success", "deleted_files": deleted_count, "freed_bytes": freed_bytes}


@router.post("/admin/storage/cleanup/expired-jobs")
async def admin_cleanup_jobs(
    db: AsyncSession = Depends(get_db),
    admin=Depends(admin_dep)
):
    """Delete jobs older than 7 days."""
    threshold = utcnow() - timedelta(days=7)
    res = await db.execute(delete(Job).where(Job.created_at < threshold))
    await db.commit()
    return {"message": "Success", "deleted_jobs": res.rowcount}


@router.post("/admin/storage/cleanup/orphaned-docs")
async def admin_cleanup_orphans(
    db: AsyncSession = Depends(get_db),
    admin=Depends(admin_dep)
):
    """Delete document files from disk that do not exist in the database."""
    docs = await db.execute(select(Document.id))
    valid_ids = {str(r[0]) for r in docs.all()}
    
    uploads_path = settings.STORAGE_ROOT / settings.UPLOAD_DIR
    deleted_count = 0
    freed_bytes = 0
    if uploads_path.exists():
        for f in uploads_path.rglob('*.pdf'):
            if f.stem not in valid_ids:
                try:
                    size = f.stat().st_size
                    f.unlink()
                    deleted_count += 1
                    freed_bytes += size
                except Exception:
                    pass
                    
    return {"message": "Success", "deleted_files": deleted_count, "freed_bytes": freed_bytes}


class CleanupSoftDeletedRequest(BaseModel):
    days_old: int = 30

@router.post("/admin/storage/cleanup/soft-deleted")
async def admin_cleanup_soft_deleted(
    req: CleanupSoftDeletedRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(admin_dep)
):
    """Permanently delete records that were soft-deleted X days ago."""
    threshold = utcnow() - timedelta(days=req.days_old)
    
    c1 = await db.execute(delete(Chat).where(Chat.deleted_at < threshold))
    c2 = await db.execute(delete(Document).where(Document.deleted_at < threshold))
    # Add other tables with deleted_at as needed
    
    await db.commit()
    return {"message": "Success", "deleted_chats": c1.rowcount, "deleted_docs": c2.rowcount}


# ────────────────────────────────────────────────
#  User Profile & Preferences
# ────────────────────────────────────────────────

async def ensure_profile(db: AsyncSession, user: User) -> UserProfile:
    """Get or create a profile row for the authenticated user."""
    profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.flush()
    return profile


async def ensure_preferences(db: AsyncSession, user: User) -> UserPreferences:
    """Get or create a preferences row for the authenticated user."""
    prefs = await db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
    if not prefs:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        await db.flush()
    return prefs


def compute_age(dob: date | None) -> int | None:
    """Calculate age from date of birth, handling birthday boundary."""
    if not dob:
        return None
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age if age >= 0 else None


def profile_json(user: User, profile: UserProfile) -> dict:
    avatar_url = None
    if profile.avatar_key:
        avatar_url = f"/api/v1/users/me/avatar?v={profile.avatar_version}"
    return {
        "username": user.username,
        "display_name": profile.display_name,
        "email": user.email,
        "phone_number": profile.phone_number,
        "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
        "age": compute_age(profile.date_of_birth),
        "bio": profile.bio,
        "institution": profile.institution,
        "course": profile.course,
        "avatar_url": avatar_url,
        "member_since": user.created_at.isoformat(),
        "version": profile.version,
    }


def preferences_json(prefs: UserPreferences) -> dict:
    return {
        "theme": prefs.theme,
        "accent_color": prefs.accent_color,
        "response_length": prefs.response_length,
        "explanation_level": prefs.explanation_level,
        "not_in_docs_behavior": prefs.not_in_docs_behavior,
        "citation_style": prefs.citation_style,
        "default_search_scope": prefs.default_search_scope,
        "follow_up_suggestions": prefs.follow_up_suggestions,
        "simplify_difficult_concepts": prefs.simplify_difficult_concepts,
        "external_knowledge": prefs.external_knowledge,
        "answer_format": getattr(prefs, "answer_format", "paragraph") or "paragraph",
        "version": prefs.version,
    }


@router.get("/users/me/profile")
async def get_profile(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    profile = await ensure_profile(db, user)
    return profile_json(user, profile)


@router.patch("/users/me/profile")
async def update_profile(body: UserProfileUpdateRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    profile = await ensure_profile(db, user)
    if body.version != profile.version:
        fail(409, "EDIT_CONFLICT", "Profile was modified. Please refresh and try again.")

    update_data = body.model_dump(exclude={"version"}, exclude_unset=True)

    if "username" in update_data:
        new_username = update_data.pop("username")
        if new_username is not None:
            new_username = new_username.strip()
            if new_username and new_username != user.username:
                existing = await db.scalar(select(User).where(User.username == new_username, User.id != user.id))
                if existing:
                    fail(409, "USERNAME_TAKEN", "Username is already taken.")
                user.username = new_username

    # Validate date_of_birth if provided
    if "date_of_birth" in update_data and update_data["date_of_birth"] is not None:
        dob = update_data["date_of_birth"]
        today = date.today()
        if dob > today:
            fail(422, "INVALID_DOB", "Date of birth cannot be in the future.")
        from dateutil.relativedelta import relativedelta
        if dob < today - relativedelta(years=120):
            fail(422, "INVALID_DOB", "Date of birth is too far in the past.")

    # Normalize blank strings to None for optional fields
    for key in ["display_name", "phone_number", "bio", "institution", "course"]:
        if key in update_data and isinstance(update_data[key], str) and not update_data[key].strip():
            update_data[key] = None
        elif key in update_data and isinstance(update_data[key], str):
            update_data[key] = update_data[key].strip()

    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.version += 1
    profile.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return profile_json(user, profile)


@router.get("/users/me/preferences")
async def get_preferences(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    prefs = await ensure_preferences(db, user)
    return preferences_json(prefs)


@router.patch("/users/me/preferences")
async def update_preferences(body: UserPreferencesUpdateRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    prefs = await ensure_preferences(db, user)
    if body.version != prefs.version:
        fail(409, "EDIT_CONFLICT", "Preferences were modified. Please refresh and try again.")

    update_data = body.model_dump(exclude={"version"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(prefs, key, value)

    prefs.version += 1
    prefs.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return preferences_json(prefs)


@router.put("/users/me/avatar")
async def upload_avatar(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    # Validate content type
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        fail(415, "UNSUPPORTED_MEDIA", "Only JPEG, PNG, and WebP images are allowed.")

    # Read and validate size (10 MB limit)
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        fail(413, "FILE_TOO_LARGE", "Avatar must be under 10 MB.")

    # Process image: strip metadata, apply orientation, save as high-quality WebP
    try:
        # pyrefly: ignore [missing-import]
        from PIL import Image, ImageOps
        import io
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # Apply EXIF orientation
        img = img.convert("RGB")

        output = io.BytesIO()
        img.save(output, format="WEBP", quality=100)
        processed_data = output.getvalue()
    except Exception:
        fail(422, "INVALID_IMAGE", "Could not process the uploaded image.")

    profile = await ensure_profile(db, user)
    old_key = profile.avatar_key

    # Generate new avatar path
    avatar_id = str(uuid4())
    relative_key = f"avatars/{user.id}/{avatar_id}.webp"
    full_path = settings.STORAGE_ROOT / relative_key
    full_path.parent.mkdir(parents=True, exist_ok=True)

    # Write new file
    full_path.write_bytes(processed_data)

    # Update database
    profile.avatar_key = relative_key
    profile.avatar_version += 1
    profile.version += 1
    profile.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # Remove old avatar file
    if old_key:
        old_path = settings.STORAGE_ROOT / old_key
        if old_path.is_file():
            old_path.unlink(missing_ok=True)

    return profile_json(user, profile)


@router.get("/users/me/avatar")
async def get_avatar(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    profile = await ensure_profile(db, user)
    if not profile.avatar_key:
        fail(404, "NOT_FOUND", "No avatar set.")

    full_path = settings.STORAGE_ROOT / profile.avatar_key
    if not full_path.is_file() or not full_path.resolve().is_relative_to(settings.STORAGE_ROOT.resolve()):
        fail(404, "NOT_FOUND", "Avatar file not found.")

    return FileResponse(
        full_path,
        media_type="image/webp",
        headers={
            "Cache-Control": "private, max-age=86400",
            "ETag": f'"av-{profile.avatar_version}"',
        },
    )


@router.delete("/users/me/avatar", status_code=200)
async def delete_avatar(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    profile = await ensure_profile(db, user)
    if not profile.avatar_key:
        return profile_json(user, profile)

    old_path = settings.STORAGE_ROOT / profile.avatar_key
    profile.avatar_key = None
    profile.avatar_version += 1
    profile.version += 1
    profile.updated_at = datetime.now(timezone.utc)
    await db.flush()

    if old_path.is_file():
        old_path.unlink(missing_ok=True)

    return profile_json(user, profile)


@router.post("/users/me/password", status_code=204)
async def change_password(body: ChangePasswordRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    # Verify current password
    try:
        valid = await asyncio.to_thread(passwords.verify, user.password_hash, body.current_password)
    except VerificationError:
        valid = False
    if not valid:
        fail(401, "INVALID_PASSWORD", "Current password is incorrect.")

    # Hash and set new password
    new_hash = await asyncio.to_thread(passwords.hash, body.new_password)
    user.password_hash = new_hash

    # Revoke all other sessions (keep current)
    current_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if current_token:
        from app.core.sessions import _hash_token
        current_hash = _hash_token(current_token)
        from app.models.models import Session
        other_sessions = (await db.scalars(
            select(Session).where(
                Session.user_id == user.id,
                Session.revoked_at.is_(None),
                Session.token_hash != current_hash,
            )
        )).all()
        now = datetime.now(timezone.utc)
        for s in other_sessions:
            s.revoked_at = now

    await db.flush()


@router.post("/users/me/sessions/revoke-others", status_code=204)
async def revoke_other_sessions(request: Request, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    current_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not current_token:
        return

    from app.core.sessions import _hash_token
    current_hash = _hash_token(current_token)
    from app.models.models import Session
    other_sessions = (await db.scalars(
        select(Session).where(
            Session.user_id == user.id,
            Session.revoked_at.is_(None),
            Session.token_hash != current_hash,
        )
    )).all()
    now = datetime.now(timezone.utc)
    for s in other_sessions:
        s.revoked_at = now
    await db.flush()


# ── Comparisons ──
@router.post("/chats/{chat_id}/compare")
async def create_comparison(chat_id: UUID, body: schemas.CompareRequest, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id)
    doc_ids = [str(d) for d in body.document_ids]
    
    docs = []
    versions = []
    for d_id in doc_ids:
        doc = await db.get(Document, UUID(d_id))
        if not doc or doc.chat_id != chat.id or doc.status != "ready" or doc.deleted_at:
            fail(400, "INVALID_DOCUMENT", f"Document {d_id} is not ready or not found.")
        docs.append(doc)
        versions.append(str(doc.active_index_version))
        
    from app import providers
    from app.models.models import DocumentChunk, Comparison
    vector = (await asyncio.to_thread(providers.embed, [body.query]))[0]
    index = await asyncio.to_thread(providers.collection)
    
    evidence_text = ""
    sources_metadata = []
    
    for doc, version in zip(docs, versions):
        scope = {"$and": [
            {"user_id": str(user.id)}, 
            {"chat_id": str(chat.id)},
            {"document_id": str(doc.id)}, 
            {"index_version": version}
        ]}
        result = await asyncio.to_thread(index.query, query_embeddings=[vector], where=scope, n_results=2, include=["distances"])
        
        doc_evidence = []
        if result and result.get("ids") and result["ids"][0]:
            retrieval_max_distance = await dyn_settings.get("RETRIEVAL_MAX_DISTANCE", settings.RETRIEVAL_MAX_DISTANCE)
            for chunk_id, distance in zip(result["ids"][0], result["distances"][0]):
                if distance > retrieval_max_distance:
                    continue
                chunk = await db.get(DocumentChunk, UUID(chunk_id))
                if chunk:
                    doc_evidence.append(chunk)
                    
        if doc_evidence:
            doc_evidence.sort(key=lambda c: (c.page_number, c.chunk_index))
            for chunk in doc_evidence:
                citation = f"[{doc.original_filename} · PDF page {chunk.page_number}]"
                evidence_text += f"[SOURCE]\nDocument: {doc.original_filename}\nPage: {chunk.page_number}\nContent: {chunk.text}\nCitation: {citation}\n\n"
                sources_metadata.append({
                    "citation_label": citation,
                    "document_id": str(doc.id),
                    "page_number": chunk.page_number,
                    "excerpt": chunk.text,
                    "original_filename": doc.original_filename
                })
        else:
            evidence_text += f"[SOURCE]\nDocument: {doc.original_filename}\nContent: Not found in this document.\n\n"

    system_prompt = (
        "You are an AI study assistant. The user wants to compare how a specific topic is explained across multiple documents. "
        "Using ONLY the provided sources, generate a structured comparison in JSON format. "
        "Strictly adhere to the provided JSON schema. "
        "IMPORTANT RAG RULES:\n"
        "- SIMILARITY: Both documents explicitly support approximately the same idea.\n"
        "- DIFFERENCE: The documents describe the concept differently.\n"
        "- UNIQUE INFORMATION: Only one source contains that information.\n"
        "- MISSING INFORMATION: There is insufficient evidence from one document.\n"
        "- Do not call something a contradiction simply because one PDF contains more detail.\n"
        "- EVERY factual point MUST include a citation exactly as provided (e.g. '[DocName.pdf · PDF page 7]'). "
        "If a document lacks information on an aspect, explicitly state 'Not found in this document.'\n\n"
        "Return the output matching this exact JSON schema:\n"
        "{\n"
        '  "aspects": [{"aspect_name": "Definition", "document_points": {"DocName.pdf": "explanation... [DocName.pdf · PDF page X]"}}],\n'
        '  "similarities": ["point 1 [citation]"],\n'
        '  "differences": ["point 1 [citation]"],\n'
        '  "unique_points": {"DocName.pdf": ["point 1 [citation]"]}\n'
        "}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Topic: {body.query}\n\nSources:\n{evidence_text}\n\nCompare the sources based on the above information."}
    ]
    
    import time
    start_time = time.time()
    
    try:
        response_text = await providers.complete(messages, structured=True)
        comparison_data = json.loads(response_text)
    except Exception as e:
        fail(500, "GENERATION_FAILED", f"Failed to generate comparison. {e}")
        
    full_result = {
        "topic": body.query,
        "documents": [d.original_filename for d in docs],
        "aspects": comparison_data.get("aspects", []),
        "similarities": comparison_data.get("similarities", []),
        "differences": comparison_data.get("differences", []),
        "unique_points": comparison_data.get("unique_points", {}),
        "citations": sources_metadata,
        "processing_time_s": int(time.time() - start_time)
    }
    
    comp = Comparison(
        user_id=user.id,
        chat_id=chat.id,
        query=body.query,
        document_ids=[str(d.id) for d in docs],
        generated_comparison=full_result
    )
    db.add(comp)
    await db.commit()
    await db.refresh(comp)
    
    return schemas.CompareResponse(
        id=comp.id,
        query=comp.query,
        document_ids=[UUID(d) for d in comp.document_ids],
        generated_comparison=comp.generated_comparison,
        created_at=comp.created_at
    )

@router.get("/chats/{chat_id}/comparisons", response_model=schemas.CompareListResponse)
async def list_comparisons(chat_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    chat = await owned_chat(db, user, chat_id)
    from app.models.models import Comparison
    comps = (await db.scalars(select(Comparison).where(Comparison.chat_id == chat.id).order_by(Comparison.created_at.desc()))).all()
    
    return schemas.CompareListResponse(
        items=[schemas.CompareResponse(
            id=c.id, query=c.query, document_ids=[UUID(d) for d in c.document_ids],
            generated_comparison=c.generated_comparison, created_at=c.created_at
        ) for c in comps]
    )

@router.get("/chats/{chat_id}/flashcards", response_model=list[FlashcardOut])
async def get_chat_flashcards(chat_id: UUID, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    chat = await owned_chat(db, user, chat_id)
    query = (
        select(Flashcard)
        .join(FlashcardSet, Flashcard.flashcard_set_id == FlashcardSet.id)
        .where(FlashcardSet.chat_id == chat.id)
        .order_by(Flashcard.next_review_at.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/chats/{chat_id}/flashcards/generate")
async def generate_flashcards(chat_id: UUID, req: GenerateFlashcardsRequest, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    chat = await owned_chat(db, user, chat_id)
    doc_ids = [str(d) for d in req.document_ids]
    
    fs = FlashcardSet(chat_id=chat.id, user_id=user.id, corpus_version=chat.corpus_version, scope={"document_ids": doc_ids, "count": req.count})
    db.add(fs)
    await db.flush()
    
    payload = {"flashcard_set_id": str(fs.id), "corpus_version": chat.corpus_version}
    if req.topic:
        payload["topic"] = req.topic
    job = Job(user_id=user.id, chat_id=chat.id, type="generate_flashcards", payload=payload)
    db.add(job)
    await db.commit()
    
    return {"flashcard_set_id": fs.id, "job_id": job.id}


@router.get("/chats/{chat_id}/flashcards/stats")
async def get_flashcard_stats(chat_id: UUID, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    chat = await owned_chat(db, user, chat_id)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = (
        select(FlashcardReview)
        .join(Flashcard, FlashcardReview.flashcard_id == Flashcard.id)
        .join(FlashcardSet, Flashcard.flashcard_set_id == FlashcardSet.id)
        .where(FlashcardSet.chat_id == chat.id, FlashcardReview.user_id == user.id)
        .order_by(FlashcardReview.reviewed_at.desc())
    )
    reviews = (await db.scalars(query)).all()
    
    reviewed_today = [r for r in reviews if r.reviewed_at >= today_start]
    
    recent_reviews = reviews[:50]
    if recent_reviews:
        correct_count = sum(1 for r in recent_reviews if r.rating in ("good", "easy"))
        recent_accuracy = round((correct_count / len(recent_reviews)) * 100)
    else:
        recent_accuracy = None
        
    return {
        "reviewed_today": len(reviewed_today),
        "recent_accuracy": recent_accuracy,
        "total_reviews": len(reviews)
    }

@router.post("/chats/{chat_id}/topic_sets/{topic_set_id}/mindmap/generate")
async def generate_concept_map(chat_id: UUID, topic_set_id: UUID, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    chat = await owned_chat(db, user, chat_id)
    topic_set = await db.get(TopicSet, topic_set_id)
    if not topic_set or topic_set.chat_id != chat.id:
        fail(404, "NOT_FOUND", "Topic set not found.")
        
    job = Job(user_id=user.id, chat_id=chat.id, type="generate_concept_map", payload={"topic_set_id": str(topic_set.id), "corpus_version": chat.corpus_version})
    db.add(job)
    await db.commit()
    
    return {"job_id": job.id}

@router.get("/chats/{chat_id}/topic_sets/{topic_set_id}/mindmap")
async def get_concept_map(chat_id: UUID, topic_set_id: UUID, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    chat = await owned_chat(db, user, chat_id)
    topic_set = await db.get(TopicSet, topic_set_id)
    if not topic_set or topic_set.chat_id != chat.id:
        fail(404, "NOT_FOUND", "Topic set not found.")
        
    query = select(ConceptEdge).where(ConceptEdge.topic_set_id == topic_set.id)
    edges = (await db.scalars(query)).all()
    
    return [{"id": str(e.id), "source_topic_id": str(e.source_topic_id), "target_topic_id": str(e.target_topic_id), "relationship_type": e.relationship_type} for e in edges]

@router.post("/chats/{chat_id}/topic_sets/{topic_set_id}/topics/{topic_id}/expand")
async def expand_concept_map_branch(chat_id: UUID, topic_set_id: UUID, topic_id: UUID, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    chat = await owned_chat(db, user, chat_id)
    topic_set = await db.get(TopicSet, topic_set_id)
    if not topic_set or topic_set.chat_id != chat.id:
        fail(404, "NOT_FOUND", "Topic set not found.")
        
    topic = await db.get(Topic, topic_id)
    if not topic or topic.topic_set_id != topic_set_id:
        fail(404, "NOT_FOUND", "Topic not found.")

    job = Job(user_id=user.id, chat_id=chat.id, type="expand_topic_branch", payload={"topic_set_id": str(topic_set.id), "topic_id": str(topic.id), "corpus_version": chat.corpus_version})
    db.add(job)
    await db.commit()
    
    return {"job_id": job.id}

@router.post("/flashcards/{flashcard_id}/review", response_model=FlashcardReviewOut)
async def review_flashcard(flashcard_id: UUID, req: SubmitReviewRequest, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    card = await db.scalar(select(Flashcard).where(Flashcard.id == flashcard_id, Flashcard.user_id == user.id))
    if not card:
        fail(404, "NOT_FOUND", "Flashcard not found.")
        
    res = calculate_sm2(req.rating, card.repetitions, card.review_interval, card.ease_factor)
    
    # Save the review log
    review = FlashcardReview(
        flashcard_id=card.id,
        user_id=user.id,
        rating=req.rating,
        previous_interval=card.review_interval,
        new_interval=res["interval"]
    )
    db.add(review)
    
    # Update flashcard state
    card.difficulty = res["difficulty"]
    card.repetitions = res["repetitions"]
    card.review_interval = res["interval"]
    card.ease_factor = res["ease_factor"]
    card.next_review_at = res["next_review_at"]
    card.last_reviewed_at = utcnow()
    card.review_count += 1
    
    await db.commit()
    await db.refresh(review)
    return review

@router.delete("/flashcards/{flashcard_id}", status_code=204)
async def delete_flashcard(flashcard_id: UUID, user: User = Depends(user_dep), db: AsyncSession = Depends(get_db)):
    card = await db.scalar(select(Flashcard).where(Flashcard.id == flashcard_id, Flashcard.user_id == user.id))
    if not card:
        fail(404, "NOT_FOUND", "Flashcard not found.")
        
    await db.delete(card)
    await db.commit()

# ──────────────────────────────────────────────
#  Admin Configuration (Models & Inference)
# ──────────────────────────────────────────────

from app.core.dynamic_settings import dyn_settings
from pydantic import BaseModel
from typing import Dict, Any

class SystemConfigsUpdate(BaseModel):
    configs: Dict[str, Any]

@router.get("/admin/models/configs")
async def get_model_configs(admin: User = Depends(admin_dep), db: AsyncSession = Depends(get_db)):
    configs = await dyn_settings.get_all()
    configs["OLLAMA_BASE_URL"] = settings.OLLAMA_BASE_URL
    configs["EMBEDDING_MODEL"] = settings.EMBEDDING_MODEL
    return configs

ALLOWED_CONFIG_KEYS = {
    "LLM_MODEL", "LLM_CONTEXT_TOKENS", "LLM_MAX_OUTPUT_TOKENS", "LLM_TEMPERATURE",
    "RETRIEVAL_MAX_DISTANCE", "CHUNK_SIZE", "CHUNK_OVERLAP", "TOP_K",
    "RERANKER_ENABLED", "BM25_ENABLED", "SEMANTIC_TOP_K", "BM25_TOP_K", "RERANKER_TOP_N",
}

@router.put("/admin/models/configs")
async def update_model_configs(req: SystemConfigsUpdate, request: Request, admin: User = Depends(admin_dep), db: AsyncSession = Depends(get_db)):
    invalid_keys = set(req.configs.keys()) - ALLOWED_CONFIG_KEYS
    if invalid_keys:
        fail(422, "INVALID_CONFIG_KEY", f"Unknown config keys: {', '.join(invalid_keys)}")
    for k, v in req.configs.items():
        await dyn_settings.set(k, v, admin.id)
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="CONFIG_UPDATED", target_type="config",
                     metadata=req.configs,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    return {"status": "ok"}

@router.post("/admin/models/pull")
async def pull_model(req: dict, request: Request, admin: User = Depends(admin_dep), db: AsyncSession = Depends(get_db)):
    model_name = req.get("model")
    if not model_name:
        fail(400, "BAD_REQUEST", "model name required")
    
    await log_action(db, actor_id=admin.id, actor_username=admin.username,
                     action="MODEL_PULLED", target_type="model",
                     target_id=model_name, target_label=model_name,
                     ip_address=request.client.host if request.client else None)
    await db.commit()
    
    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0)) as client:
                async with client.stream("POST", f"{settings.OLLAMA_BASE_URL}/api/pull", json={"model": model_name, "stream": True}) as response:
                    async for chunk in response.aiter_bytes():
                        yield chunk
        except Exception as e:
            yield json.dumps({"error": str(e)}).encode("utf-8")
    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@router.post("/admin/models/benchmark")
async def benchmark_model(req: dict, admin: User = Depends(admin_dep), db: AsyncSession = Depends(get_db)):
    prompt = req.get("prompt", "Why is the sky blue? Explain in exactly one short sentence.")
    model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
    
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.0, "num_ctx": 4096}
            })
            resp.raise_for_status()
            data = resp.json()
            
            end_time = time.time()
            latency = end_time - start_time
            tokens = data.get("eval_count", 0)
            tps = tokens / latency if latency > 0 else 0
            
            return {
                "latency_sec": round(latency, 2),
                "tokens_per_sec": round(tps, 2),
                "response": data.get("message", {}).get("content", ""),
                "model": model,
                "eval_count": tokens,
            }
    except httpx.HTTPStatusError as e:
        err_msg = str(e)
        try:
            err_msg = e.response.json().get("error", str(e))
        except:
            pass
        fail(500, "BENCHMARK_ERROR", f"Ollama error: {err_msg}")
    except httpx.TimeoutException:
        fail(500, "BENCHMARK_ERROR", "Ollama request timed out (model generation took over 5 minutes).")
    except httpx.RequestError as e:
        fail(500, "BENCHMARK_ERROR", f"Ollama connection error: {type(e).__name__} - {str(e)}")
    except Exception as e:
        fail(500, "BENCHMARK_ERROR", f"Unexpected error: {str(e)}")

@router.get("/admin/models/ollama-status")
async def ollama_status(admin: User = Depends(admin_dep)):
    """Real-time check of Ollama connectivity and available models."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            model_names = [m["name"] for m in data.get("models", [])]
            active_model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
            return {
                "connected": True,
                "base_url": settings.OLLAMA_BASE_URL,
                "models": model_names,
                "active_model_available": active_model in model_names,
                "active_model": active_model,
            }
    except Exception as e:
        return {
            "connected": False,
            "base_url": settings.OLLAMA_BASE_URL,
            "models": [],
            "active_model_available": False,
            "active_model": await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL),
            "error": str(e),
        }

# ──────────────────────────────────────────────
#  Admin Audit & Security
# ──────────────────────────────────────────────



@router.get("/admin/audit-logs")
async def get_audit_logs(db: AsyncSession = Depends(get_db), admin=Depends(admin_dep), limit: int = Query(100)):
    logs = (await db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))).all()
    return {"items": [{
        "id": log.id,
        "actor_id": log.actor_id,
        "actor_username": log.actor_username,
        "action": log.action,
        "target_type": log.target_type,
        "target_id": log.target_id,
        "target_label": log.target_label,
        "metadata": log.metadata_,
        "ip_address": log.ip_address,
        "created_at": log.created_at
    } for log in logs]}

@router.get("/admin/sessions")
async def get_all_sessions(db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    from app.models.models import Session
    query = select(Session, User.username).join(User, Session.user_id == User.id).where(Session.revoked_at.is_(None), Session.expires_at > utcnow()).order_by(Session.created_at.desc())
    rows = (await db.execute(query)).all()
    return {"items": [{**fields(s, "id", "user_id", "ip_address", "user_agent", "created_at", "expires_at"), "username": u} for s, u in rows]}

@router.delete("/admin/sessions/{session_id}", status_code=204)
async def admin_revoke_session(session_id: UUID, request: Request, db: AsyncSession = Depends(get_db), admin=Depends(admin_dep)):
    from app.models.models import Session
    session = await db.get(Session, session_id)
    if not session or session.revoked_at:
        fail(404, "NOT_FOUND", "Session not found or already revoked.")
    session.revoked_at = utcnow()
    await log_action(db, actor_id=admin.id, actor_username=admin.username, action="SESSION_REVOKED", target_type="session", target_id=str(session.id), ip_address=request.client.host if request.client else None)
    await db.commit()
    return None

@router.get("/admin/failed-logins")
async def get_failed_logins(db: AsyncSession = Depends(get_db), admin=Depends(admin_dep), limit: int = Query(50)):
    rows = (await db.scalars(select(FailedLoginAttempt).order_by(FailedLoginAttempt.created_at.desc()).limit(limit))).all()
    return {"items": [fields(r, "id", "username_attempted", "ip_address", "user_agent", "created_at") for r in rows]}


# ── User Profile & Data Management ──

@router.get("/users/me/storage")
async def get_user_storage(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    """Returns per-category storage breakdown for the authenticated user."""
    from sqlalchemy import func

    # PDF storage (sum of byte_size for non-deleted documents)
    pdf_bytes = await db.scalar(
        select(func.coalesce(func.sum(Document.byte_size), 0))
        .where(Document.user_id == user.id, Document.deleted_at.is_(None))
    )
    doc_count = await db.scalar(
        select(func.count(Document.id))
        .where(Document.user_id == user.id, Document.deleted_at.is_(None))
    )
    indexed_count = await db.scalar(
        select(func.count(Document.id))
        .where(Document.user_id == user.id, Document.deleted_at.is_(None), Document.status == "ready")
    )

    # Vector data estimate: chunks * (384 floats * 4 bytes + ~300 bytes metadata)
    chunk_count = await db.scalar(
        select(func.count(DocumentChunk.id))
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(Document.user_id == user.id, Document.deleted_at.is_(None))
    )
    vector_bytes = (chunk_count or 0) * 1836  # 384*4 + 300 bytes estimated per chunk

    # Chat data: approximate as sum of message content lengths
    chat_count = await db.scalar(
        select(func.count(Chat.id))
        .where(Chat.user_id == user.id, Chat.deleted_at.is_(None))
    )
    msg_bytes = await db.scalar(
        select(func.coalesce(func.sum(func.length(Message.content)), 0))
        .join(Chat, Message.chat_id == Chat.id)
        .where(Chat.user_id == user.id, Chat.deleted_at.is_(None))
    )

    # Study data: flashcards + quizzes (approximate)
    flashcard_count = await db.scalar(
        select(func.count(Flashcard.id))
        .where(Flashcard.user_id == user.id)
    )
    quiz_count = await db.scalar(
        select(func.count(QuizQuestion.id))
        .join(QuizSet, QuizQuestion.quiz_set_id == QuizSet.id)
        .join(Chat, QuizSet.chat_id == Chat.id)
        .where(Chat.user_id == user.id)
    )
    study_bytes = (flashcard_count or 0) * 500 + (quiz_count or 0) * 800  # rough estimate

    quota = user.storage_quota_bytes or (settings.MAX_UPLOAD_QUOTA_MB * 1024**2)
    total_used = (pdf_bytes or 0) + vector_bytes + (msg_bytes or 0) + study_bytes

    return {
        "quota_bytes": quota,
        "total_used_bytes": total_used,
        "pdf_bytes": pdf_bytes or 0,
        "vector_bytes": vector_bytes,
        "chat_bytes": msg_bytes or 0,
        "study_bytes": study_bytes,
        "doc_count": doc_count or 0,
        "indexed_doc_count": indexed_count or 0,
        "chat_count": chat_count or 0,
        "flashcard_count": flashcard_count or 0,
        "quiz_count": quiz_count or 0,
        "chunk_count": chunk_count or 0,
    }

@router.get("/users/me/analytics/ai-usage")
async def get_user_analytics_ai_usage(
    range: str = "7d",
    start_date: str = None,
    end_date: str = None,
    db: AsyncSession = Depends(get_db), 
    user=Depends(user_dep)
):
    from sqlalchemy import case, func, and_
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    
    if start_date and end_date:
        start_time = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        date_col = func.date(AiUsageLog.created_at)
        time_filter = and_(AiUsageLog.created_at >= start_time, AiUsageLog.created_at <= end_time)
    else:
        if range == "24h":
            start_time = now - timedelta(hours=24)
            date_col = func.date_trunc('hour', AiUsageLog.created_at)
        elif range == "7d":
            start_time = now - timedelta(days=7)
            date_col = func.date(AiUsageLog.created_at)
        elif range == "90d":
            start_time = now - timedelta(days=90)
            date_col = func.date(AiUsageLog.created_at)
        else:
            start_time = now - timedelta(days=30)
            date_col = func.date(AiUsageLog.created_at)
        time_filter = AiUsageLog.created_at >= start_time

    ts_rows = (await db.execute(
        select(
            date_col.label("date"),
            func.count(AiUsageLog.id).label("queries"),
            func.sum(AiUsageLog.input_tokens).label("input"),
            func.sum(AiUsageLog.output_tokens).label("output")
        )
        .where(AiUsageLog.user_id == user.id, time_filter)
        .group_by(date_col)
        .order_by(date_col.desc())
        .limit(100)
    )).all()
    
    daily = []
    for r in reversed(ts_rows):
        d_str = str(r.date)
        if (range == "24h" and not start_date) and len(d_str) > 13:
            d_str = d_str[:13] + ":00"
        daily.append({"date": d_str, "queries": r.queries, "input_tokens": r.input or 0, "output_tokens": r.output or 0})

    return {"time_series": daily}


@router.get("/users/me/analytics/documents")
async def get_user_analytics_documents(
    range: str = "7d",
    start_date: str = None,
    end_date: str = None,
    db: AsyncSession = Depends(get_db), 
    user=Depends(user_dep)
):
    from sqlalchemy import func, and_
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    
    if start_date and end_date:
        start_time = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        date_col = func.date(Document.created_at)
        time_filter = and_(Document.created_at >= start_time, Document.created_at <= end_time)
    else:
        if range == "24h":
            start_time = now - timedelta(hours=24)
            date_col = func.date_trunc('hour', Document.created_at)
        elif range == "7d":
            start_time = now - timedelta(days=7)
            date_col = func.date(Document.created_at)
        elif range == "90d":
            start_time = now - timedelta(days=90)
            date_col = func.date(Document.created_at)
        else:
            start_time = now - timedelta(days=30)
            date_col = func.date(Document.created_at)
        time_filter = Document.created_at >= start_time

    ts_rows = (await db.execute(
        select(
            date_col.label("date"),
            func.count(Document.id).label("docs"),
            func.sum(Document.page_count).label("pages")
        )
        .where(Document.user_id == user.id, time_filter)
        .group_by(date_col)
        .order_by(date_col.desc())
        .limit(100)
    )).all()
    
    daily = []
    for r in reversed(ts_rows):
        d_str = str(r.date)
        if (range == "24h" and not start_date) and len(d_str) > 13:
            d_str = d_str[:13] + ":00"
        daily.append({"date": d_str, "docs_processed": r.docs or 0, "pages_processed": r.pages or 0})

    return {"time_series": daily}

@router.delete("/users/me/chats", status_code=204)
async def clear_chat_history(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    """Soft-delete all chats for the user."""
    now = utcnow()
    chats = (await db.scalars(
        select(Chat).where(Chat.user_id == user.id, Chat.deleted_at.is_(None))
    )).all()
    for chat in chats:
        chat.deleted_at = now
    # Cancel any pending/running jobs
    await db.execute(
        update(Job).where(Job.user_id == user.id, Job.status.in_(["pending", "running"]))
        .values(cancel_requested=True)
    )
    await db.commit()

@router.delete("/users/me/study-data", status_code=204)
async def reset_study_data(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    """Delete all flashcards and quiz data for the user."""
    # Flashcard reviews cascade from flashcard delete
    flashcards = (await db.scalars(
        select(Flashcard).where(Flashcard.user_id == user.id)
    )).all()
    for card in flashcards:
        await db.delete(card)
    await db.commit()

@router.get("/users/me/export")
async def export_user_data(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    """Build and stream a ZIP archive of all user data as JSON files."""
    import io, zipfile, json as _json
    from fastapi.responses import StreamingResponse

    profile = await ensure_profile(db, user)

    chats = (await db.scalars(
        select(Chat).where(Chat.user_id == user.id, Chat.deleted_at.is_(None))
    )).all()

    all_messages = []
    for chat in chats:
        msgs = (await db.scalars(
            select(Message).where(Message.chat_id == chat.id).order_by(Message.sequence_no)
        )).all()
        all_messages.append({
            "chat_id": str(chat.id), "title": chat.title,
            "created_at": chat.created_at.isoformat(),
            "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in msgs]
        })

    docs = (await db.scalars(
        select(Document).where(Document.user_id == user.id, Document.deleted_at.is_(None))
    )).all()

    flashcards = (await db.scalars(
        select(Flashcard).where(Flashcard.user_id == user.id)
    )).all()

    quiz_sets = (await db.scalars(
        select(QuizSet).join(Chat, QuizSet.chat_id == Chat.id).where(Chat.user_id == user.id)
    )).all()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("profile.json", _json.dumps({
            "username": user.username,
            "display_name": profile.display_name if profile else None,
            "email": user.email,
            "member_since": user.created_at.isoformat(),
        }, indent=2))
        zf.writestr("chats.json", _json.dumps(all_messages, indent=2))
        zf.writestr("documents.json", _json.dumps([{
            "filename": d.original_filename, "page_count": d.page_count,
            "status": d.status, "uploaded_at": d.created_at.isoformat(),
        } for d in docs], indent=2))
        zf.writestr("flashcards.json", _json.dumps([{
            "question": f.question, "answer": f.answer,
            "difficulty": f.difficulty, "review_count": f.review_count,
        } for f in flashcards], indent=2))
        zf.writestr("quiz_history.json", _json.dumps([{
            "quiz_set_id": str(qs.id), "question_count": qs.question_count,
            "difficulty": qs.difficulty, "created_at": qs.created_at.isoformat(),
        } for qs in quiz_sets], indent=2))

    buf.seek(0)

    def iter_zip():
        yield from iter(lambda: buf.read(65536), b"")

    return StreamingResponse(
        iter_zip(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=study-assistant-export.zip"},
    )

@router.delete("/users/me/account", status_code=204)
async def delete_my_account(
    body: DeleteAccountRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user=Depends(user_dep)
):
    """Soft-delete the authenticated user's own account."""
    from argon2.exceptions import VerificationError
    try:
        valid = await asyncio.to_thread(passwords.verify, user.password_hash, body.confirm_password)
    except VerificationError:
        valid = False
    if not valid:
        fail(401, "INVALID_PASSWORD", "Password is incorrect.")

    now = utcnow()
    user.deleted_at = now
    user.is_active = False

    from app.models.models import Session
    sessions = (await db.scalars(select(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)))).all()
    for s in sessions:
        s.revoked_at = now

    response.delete_cookie(settings.SESSION_COOKIE_NAME)
    await db.commit()

@router.post("/users/me/rebuild-index", status_code=202)
async def rebuild_vector_index(db: AsyncSession = Depends(get_db), user=Depends(user_dep)):
    """Queue background jobs to re-embed all documents for this user."""
    # Since this was added to frontend but not backend plan, I'll add it here for completeness
    docs = (await db.scalars(
        select(Document).where(Document.user_id == user.id, Document.deleted_at.is_(None))
    )).all()
    for doc in docs:
        doc.status = "queued"
        new_version = uuid4()
        doc.active_index_version = new_version
        await enqueue(db, user.id, doc.chat_id, "ingest_document",
                        document_id=doc.id,
                        payload={"index_version": str(new_version)})
    await db.commit()
    return {"status": "queued"}

# ── Notes ──

@router.post("/chats/{chat_id}/notes", status_code=201)
async def create_note(chat_id: UUID, body: CreateNoteRequest,
                      db=Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    note = Note(user_id=user.id, chat_id=chat_id,
                document_id=body.document_id,
                page_number=body.page_number,
                title=body.title,
                selected_text=(body.selected_text or "")[:5000],
                user_note=body.user_note,
                tag=body.tag)
    db.add(note)
    await db.commit()
    return {"id": note.id, "created_at": note.created_at}


@router.get("/chats/{chat_id}/notes")
async def list_notes(chat_id: UUID, db=Depends(get_db), user=Depends(user_dep)):
    await owned_chat(db, user, chat_id)
    rows = (await db.scalars(
        select(Note).where(Note.user_id == user.id, Note.chat_id == chat_id)
        .order_by(Note.is_pinned.desc(), Note.created_at.desc())
    )).all()
    return {"items": [{"id": n.id, "document_id": n.document_id,
                       "page_number": n.page_number,
                       "title": n.title,
                       "selected_text": n.selected_text,
                       "user_note": n.user_note,
                       "tag": n.tag,
                       "is_pinned": n.is_pinned,
                       "created_at": n.created_at,
                       "updated_at": n.updated_at} for n in rows]}


@router.patch("/chats/{chat_id}/notes/{note_id}")
async def update_note(chat_id: UUID, note_id: UUID, body: UpdateNoteRequest,
                      db=Depends(get_db), user=Depends(user_dep)):
    note = await db.scalar(select(Note).where(Note.id == note_id, Note.user_id == user.id))
    if not note:
        fail(404, "NOT_FOUND", "Note not found.")
    if body.user_note is not None:
        note.user_note = body.user_note
    if body.title is not None:
        note.title = body.title
    if body.selected_text is not None:
        note.selected_text = body.selected_text
    if body.tag is not None:
        note.tag = body.tag if body.tag else None
    if body.is_pinned is not None:
        note.is_pinned = body.is_pinned
    await db.commit()
    return {"status": "ok"}


@router.delete("/chats/{chat_id}/notes/{note_id}")
async def delete_note(chat_id: UUID, note_id: UUID, db=Depends(get_db), user=Depends(user_dep)):
    note = await db.scalar(select(Note).where(Note.id == note_id, Note.user_id == user.id))
    if not note:
        fail(404, "NOT_FOUND", "Note not found.")
    await db.delete(note)
    await db.commit()
    return {"status": "ok"}


@router.post("/chats/{chat_id}/notes/{note_id}/ai")
async def note_ai_action(chat_id: UUID, note_id: UUID, body: NoteAiActionRequest,
                         db=Depends(get_db), user=Depends(user_dep)):
    """Run a quick AI action on a note — summarize, explain, convert to flashcard, quiz, or ask."""
    note = await db.scalar(select(Note).where(Note.id == note_id, Note.user_id == user.id))
    if not note:
        fail(404, "NOT_FOUND", "Note not found.")

    text = (note.selected_text or "") + ("\n\n" + note.user_note if note.user_note else "")
    text = text.strip()
    if not text:
        fail(400, "EMPTY_NOTE", "Note has no content to process.")

    action = body.action

    # For flashcard and quiz, redirect to existing tabs with content
    if action == "flashcard":
        return {"type": "redirect", "target": "flashcards", "topic": text[:300]}
    if action == "quiz":
        return {"type": "redirect", "target": "quiz", "topic": text[:300]}
    if action == "ask":
        return {"type": "redirect", "target": "chat", "prompt": f"Regarding this passage:\n\n> {text[:500]}\n\n{body.context or 'Please explain this further.'}"}

    # For summarize/explain, call the LLM inline
    from app import providers
    if action == "summarize":
        prompt = [
            {"role": "system", "content": "You are a study assistant. Summarize the following into exactly 3 concise bullet points. Return only the bullet points, no intro."},
            {"role": "user", "content": text[:3000]}
        ]
    else:  # explain
        prompt = [
            {"role": "system", "content": "You are a patient tutor. Explain the following passage in simple, plain language that a beginner can understand. Use analogies where helpful. Keep it under 150 words."},
            {"role": "user", "content": text[:3000]}
        ]

    content = ""
    metrics = providers.UsageMetrics()
    try:
        import asyncio as _asyncio
        async with _asyncio.timeout(120):
            async for part in providers.generate(prompt, max_tokens=500, metrics=metrics):
                content += part
    except Exception as exc:
        fail(500, "AI_ERROR", f"AI generation failed: {exc}")

    return {"type": "result", "action": action, "content": content.strip()}


@router.get("/chats/{chat_id}/notes/export")
async def export_notes_markdown(chat_id: UUID, db=Depends(get_db), user=Depends(user_dep)):
    """Export all notes as a Markdown study guide."""
    await owned_chat(db, user, chat_id)
    chat = await db.get(Chat, chat_id)
    rows = (await db.scalars(
        select(Note).where(Note.user_id == user.id, Note.chat_id == chat_id)
        .order_by(Note.is_pinned.desc(), Note.created_at.desc())
    )).all()
    docs = (await db.scalars(
        select(Document).where(Document.chat_id == chat_id, Document.user_id == user.id, Document.deleted_at.is_(None))
    )).all()
    doc_map = {d.id: d.original_filename for d in docs}

    lines = [f"# Study Notes — {chat.title or 'Untitled'}\n"]
    lines.append(f"*Exported on {utcnow().strftime('%Y-%m-%d %H:%M UTC')}*\n")
    lines.append(f"**Total notes:** {len(rows)}\n\n---\n")

    tag_labels = {"concept": "🟣 Core Concept", "formula": "🔵 Formula / Definition",
                  "exam": "🟢 Exam High-Yield", "doubt": "🟡 Doubt / Question"}

    for n in rows:
        pin = "📌 " if n.is_pinned else ""
        tag = f" `{tag_labels.get(n.tag, n.tag)}`" if n.tag else ""
        title = n.title or "Untitled Note"
        lines.append(f"## {pin}{title}{tag}\n")
        if n.document_id and n.document_id in doc_map:
            lines.append(f"*Source: {doc_map[n.document_id]}" + (f" — p.{n.page_number}" if n.page_number else "") + "*\n")
        if n.selected_text:
            lines.append(f"\n> {n.selected_text}\n")
        if n.user_note:
            lines.append(f"\n{n.user_note}\n")
        lines.append("\n---\n")

    from fastapi.responses import Response
    md = "\n".join(lines)
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="notes_{chat_id}.md"'}
    )

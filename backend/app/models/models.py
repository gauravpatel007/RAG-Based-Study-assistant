"""
SQLAlchemy ORM models – relational database design from Section 8.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer,
    String, Text, BigInteger, UniqueConstraint, text, ForeignKeyConstraint, JSON,
    Date, CheckConstraint, Float,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base

# SQLite is supported only for isolated tests; production uses PostgreSQL.
JSONB = JSON().with_variant(JSONB(), "postgresql")


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return uuid.uuid4()


# ──────────────────────────────────────────────
#  Users
# ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email = Column(String(254), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    storage_quota_bytes = Column(BigInteger, nullable=True, default=None)
    deleted_at = Column(DateTime(timezone=True), nullable=True, default=None)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="user", cascade="all, delete-orphan")
    flashcard_reviews = relationship("FlashcardReview", back_populates="user", cascade="all, delete-orphan")


ALLOWED_THEMES = ("light", "dark")
ALLOWED_ACCENTS = ("gray", "blue", "green", "yellow", "pink", "orange", "purple", "black")


# ──────────────────────────────────────────────
#  User Profiles
# ──────────────────────────────────────────────
class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name = Column(String(100), nullable=True)
    phone_number = Column(String(16), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    bio = Column(String(300), nullable=True)
    institution = Column(String(150), nullable=True)
    course = Column(String(100), nullable=True)
    avatar_key = Column(String(500), nullable=True)
    avatar_version = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    user = relationship("User", back_populates="profile")


# ──────────────────────────────────────────────
#  User Preferences
# ──────────────────────────────────────────────
class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    theme = Column(String(5), nullable=False, default="light")
    accent_color = Column(String(6), nullable=False, default="black")
    response_length = Column(String(20), nullable=False, default="medium")
    explanation_level = Column(String(50), nullable=False, default="undergraduate")
    not_in_docs_behavior = Column(String(20), nullable=False, default="tell_me")
    citation_style = Column(String(20), nullable=False, default="inline")
    default_search_scope = Column(String(20), nullable=False, default="selected")
    follow_up_suggestions = Column(Boolean, nullable=False, default=True)
    simplify_difficult_concepts = Column(Boolean, nullable=False, default=False)
    external_knowledge = Column(Boolean, nullable=False, default=False)
    answer_format = Column(String(30), nullable=False, default="paragraph")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    __table_args__ = (
        CheckConstraint("theme IN ('light', 'dark')", name="ck_user_preferences_theme"),
        CheckConstraint(
            "accent_color IN ('gray', 'blue', 'green', 'yellow', 'pink', 'orange', 'purple', 'black')",
            name="ck_user_preferences_accent_color",
        ),
        CheckConstraint(
            "answer_format IN ('paragraph', 'bullet_points', 'exam_style', 'step_by_step')",
            name="ck_user_preferences_answer_format",
        ),
    )

    user = relationship("User", back_populates="preferences")


# ──────────────────────────────────────────────
#  Sessions
# ──────────────────────────────────────────────
class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(256), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)

    user = relationship("User", back_populates="sessions")


# ──────────────────────────────────────────────
#  Chats
# ──────────────────────────────────────────────
class Chat(Base):
    __tablename__ = "chats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False, default="New Chat")
    memory_summary = Column(Text, nullable=True)
    summary_through_message_id = Column(UUID(as_uuid=True), nullable=True)
    corpus_version = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Composite unique for ownership check
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_chat_ownership"),
        Index("ix_chat_user_updated", "user_id", "updated_at"),
    )

    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="chat", cascade="all, delete-orphan", foreign_keys="Document.chat_id")
    topic_sets = relationship("TopicSet", back_populates="chat", cascade="all, delete-orphan")
    quiz_sets = relationship("QuizSet", back_populates="chat", cascade="all, delete-orphan")
    comparisons = relationship("Comparison", back_populates="chat", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="chat", cascade="all, delete-orphan")
    flashcard_sets = relationship("FlashcardSet", back_populates="chat", cascade="all, delete-orphan")
    presentation_sets = relationship("PresentationSet", back_populates="chat", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
#  Messages
# ──────────────────────────────────────────────
class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' | 'assistant' | 'system'
    content = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, default="complete")  # complete, generating, failed, stopped, interrupted
    sequence_no = Column(Integer, nullable=False)
    client_request_id = Column(UUID(as_uuid=True), nullable=True)
    model_name = Column(String(100), nullable=True)
    corpus_version = Column(Integer, nullable=True)
    feedback = Column(Integer, nullable=True)  # 1 for Like, -1 for Unlike
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("chat_id", "sequence_no", name="uq_message_sequence"),
        UniqueConstraint("chat_id", "client_request_id", name="uq_message_request"),
        Index("ix_message_chat_seq", "chat_id", "sequence_no"),
    )

    chat = relationship("Chat", back_populates="messages")
    sources = relationship("MessageSource", back_populates="message", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
#  Documents
# ──────────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String(500), nullable=False)
    storage_key = Column(String(500), nullable=False)
    sha256 = Column(String(64), nullable=True)
    byte_size = Column(BigInteger, nullable=False, default=0)
    page_count = Column(Integer, nullable=True)
    status = Column(String(30), nullable=False, default="queued")
    active_index_version = Column(UUID(as_uuid=True), nullable=True)
    extraction_version = Column(String(50), nullable=True)
    error_code = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_doc_chat_status", "chat_id", "status"),
        ForeignKeyConstraint(["chat_id", "user_id"], ["chats.id", "chats.user_id"], name="fk_document_owner"),
    )

    user = relationship("User", back_populates="documents")
    chat = relationship("Chat", back_populates="documents", foreign_keys=[chat_id])
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
#  Document Pages
# ──────────────────────────────────────────────
class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page_number = Column(Integer, nullable=False)
    page_label = Column(String(50), nullable=True)
    raw_text = Column(Text, nullable=True)
    clean_text = Column(Text, nullable=True)
    extraction_method = Column(String(20), nullable=True)  # native, ocr, mixed
    quality_flags = Column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("document_id", "page_number", name="uq_doc_page"),
    )

    document = relationship("Document", back_populates="pages")


# ──────────────────────────────────────────────
#  Document Chunks
# ──────────────────────────────────────────────
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    index_version = Column(UUID(as_uuid=True), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=False)
    start_offset = Column(Integer, nullable=True)
    end_offset = Column(Integer, nullable=True)
    text = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=True)
    heading = Column(String(500), nullable=True)
    vector_id = Column(String(100), nullable=True)

    __table_args__ = (
        UniqueConstraint("document_id", "index_version", "chunk_index", name="uq_chunk_version_index"),
    )

    document = relationship("Document", back_populates="chunks")


# ──────────────────────────────────────────────
#  Message Sources (citations)
# ──────────────────────────────────────────────
class MessageSource(Base):
    __tablename__ = "message_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), nullable=True)
    document_id = Column(UUID(as_uuid=True), nullable=True)
    citation_label = Column(String(20), nullable=True)
    page_number = Column(Integer, nullable=True)
    excerpt = Column(Text, nullable=True)
    source_status = Column(String(30), default="active")  # active, unavailable

    message = relationship("Message", back_populates="sources")


# ──────────────────────────────────────────────
#  Jobs
# ──────────────────────────────────────────────
class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), nullable=True)
    message_id = Column(UUID(as_uuid=True), nullable=True)
    type = Column(String(50), nullable=False)  # ingest_document, generate_answer, extract_topics, cleanup_document
    status = Column(String(30), nullable=False, default="pending")
    priority = Column(Integer, nullable=False, default=0)
    payload = Column(JSONB, nullable=True)
    checkpoint = Column(JSONB, nullable=True)
    progress = Column(JSONB, nullable=True)
    attempts = Column(Integer, default=0, nullable=False)
    lease_until = Column(DateTime(timezone=True), nullable=True)
    heartbeat_at = Column(DateTime(timezone=True), nullable=True)
    cancel_requested = Column(Boolean, default=False, nullable=False)
    error_code = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_job_status_priority", "status", "priority", "created_at"),
    )


# ──────────────────────────────────────────────
#  Topic Sets
# ──────────────────────────────────────────────
class TopicSet(Base):
    __tablename__ = "topic_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    scope = Column(JSONB, nullable=False)  # {document_ids: [], page_range: {start, end}}
    corpus_version = Column(Integer, nullable=False)
    model_name = Column(String(100), nullable=True)
    prompt_version = Column(String(50), nullable=True)
    status = Column(String(30), nullable=False, default="pending")
    covered_pages = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    chat = relationship("Chat", back_populates="topic_sets")
    topics = relationship("Topic", back_populates="topic_set", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
#  Topics
# ──────────────────────────────────────────────
class Topic(Base):
    __tablename__ = "topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    topic_set_id = Column(UUID(as_uuid=True), ForeignKey("topic_sets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    importance_reason = Column(Text, nullable=True)
    rank = Column(Integer, nullable=True)
    sources_json = Column(JSONB, nullable=True)

    topic_set = relationship("TopicSet", back_populates="topics")


# ──────────────────────────────────────────────
#  Quiz Sets
# ──────────────────────────────────────────────
class QuizSet(Base):
    __tablename__ = "quiz_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    scope = Column(JSONB, nullable=False)  # {document_ids: [], page_range: {start, end}}
    corpus_version = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    question_count = Column(Integer, nullable=False)
    difficulty = Column(String(20), nullable=False, default="medium")
    covered_pages = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    chat = relationship("Chat", back_populates="quiz_sets")
    questions = relationship("QuizQuestion", back_populates="quiz_set", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
#  Quiz Questions
# ──────────────────────────────────────────────
class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    quiz_set_id = Column(UUID(as_uuid=True), ForeignKey("quiz_sets.id", ondelete="CASCADE"), nullable=False)
    rank = Column(Integer, nullable=True)
    question = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_option = Column(String(1), nullable=False)
    explanation = Column(Text, nullable=True)
    sources_json = Column(JSONB, nullable=True)

    quiz_set = relationship("QuizSet", back_populates="questions")


# ──────────────────────────────────────────────
#  Comparisons
# ──────────────────────────────────────────────
class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    query = Column(String(500), nullable=False)
    document_ids = Column(JSONB, nullable=False)  # list of UUIDs
    generated_comparison = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    chat = relationship("Chat", back_populates="comparisons")
    user = relationship("User")

# ──────────────────────────────────────────────
#  Concept Map (Mind Map)
# ──────────────────────────────────────────────
class ConceptEdge(Base):
    __tablename__ = "concept_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    topic_set_id = Column(UUID(as_uuid=True), ForeignKey("topic_sets.id", ondelete="CASCADE"), nullable=False)
    source_topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    target_topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    evidence = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    topic_set = relationship("TopicSet")
    source_topic = relationship("Topic", foreign_keys=[source_topic_id])
    target_topic = relationship("Topic", foreign_keys=[target_topic_id])



# ──────────────────────────────────────────────
#  Flashcards
# ──────────────────────────────────────────────
class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scope = Column(JSONB, nullable=False)
    corpus_version = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    chat = relationship("Chat", back_populates="flashcard_sets")
    flashcards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    flashcard_set_id = Column(UUID(as_uuid=True), ForeignKey("flashcard_sets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources_json = Column(JSONB, nullable=True) # Topic/Document relationship
    
    # Spaced Repetition (SM-2 based) fields
    difficulty = Column(String(20), default="learning")
    repetitions = Column(Integer, default=0, nullable=False)
    review_interval = Column(Integer, default=0, nullable=False) # In days
    ease_factor = Column(Float, default=2.5, nullable=False)
    
    next_review_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")
    user = relationship("User", back_populates="flashcards")
    reviews = relationship("FlashcardReview", back_populates="flashcard", cascade="all, delete-orphan")


class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    flashcard_id = Column(UUID(as_uuid=True), ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    rating = Column(String(10), nullable=False) # again, hard, good, easy
    previous_interval = Column(Integer, nullable=False)
    new_interval = Column(Integer, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    flashcard = relationship("Flashcard", back_populates="reviews")
    user = relationship("User", back_populates="flashcard_reviews")


# ──────────────────────────────────────────────
#  System Configs
# ──────────────────────────────────────────────
class SystemConfig(Base):
    __tablename__ = "system_configs"

    key = Column(String(100), primary_key=True)
    value = Column(JSONB, nullable=False)
    description = Column(String(500), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


# ──────────────────────────────────────────────
#  Audit Logs
# ──────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_username = Column(String(100), nullable=True)   # denormalized snapshot
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=True)
    target_id = Column(String(200), nullable=True)
    target_label = Column(String(300), nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_actor_id", "actor_id"),
    )


# ──────────────────────────────────────────────
#  Failed Login Attempts
# ──────────────────────────────────────────────
class FailedLoginAttempt(Base):
    __tablename__ = "failed_login_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    username_attempted = Column(String(100), nullable=False)
    ip_address = Column(String(64), nullable=False)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_failed_login_ip", "ip_address", "created_at"),
        Index("ix_failed_login_username", "username_attempted", "created_at"),
    )

# ──────────────────────────────────────────────
#  Verification Codes
# ──────────────────────────────────────────────
class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash = Column(String(256), nullable=False)
    purpose = Column(String(50), nullable=False) # registration, password_reset
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User")

# ──────────────────────────────────────────────
#  Notes
# ──────────────────────────────────────────────
class Note(Base):
    __tablename__ = "notes"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id       = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    document_id   = Column(UUID(as_uuid=True), nullable=True)   # which PDF
    page_number   = Column(Integer, nullable=True)
    title         = Column(String(200), nullable=True)          # title for standalone notes
    selected_text = Column(Text, nullable=True, default="")     # the highlighted excerpt (empty for standalone)
    user_note     = Column(Text, nullable=True)                 # optional annotation the user types
    tag           = Column(String(30), nullable=True)           # concept | formula | exam | doubt
    is_pinned     = Column(Boolean, default=False, nullable=False)
    created_at    = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at    = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_note_user_chat", "user_id", "chat_id"),
    )

    chat = relationship("Chat", back_populates="notes")

# ──────────────────────────────────────────────
#  AI Usage Analytics
# ──────────────────────────────────────────────
class AiUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    query_type = Column(String(50), nullable=False)
    model_name = Column(String(100), nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    duration_ms = Column(Integer, nullable=False, default=0)
    is_successful = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    __table_args__ = (
        Index("ix_ai_usage_created", "created_at"),
        Index("ix_ai_usage_user", "user_id"),
    )


# ──────────────────────────────────────────────
#  RAG Query Analytics
# ──────────────────────────────────────────────
class RagQueryLog(Base):
    __tablename__ = "rag_query_logs"

    id                        = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    job_id                    = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    message_id                = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    user_id                   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_preview          = Column(String(300), nullable=True)
    doc_count                 = Column(Integer, nullable=False, default=0)
    # Retrieval counts
    semantic_results          = Column(Integer, nullable=False, default=0)
    bm25_results              = Column(Integer, nullable=False, default=0)
    merged_results            = Column(Integer, nullable=False, default=0)
    reranked_results          = Column(Integer, nullable=False, default=0)
    final_sources             = Column(Integer, nullable=False, default=0)
    # Per-stage timing (ms) — nullable so rows recorded before instrumentation are valid
    embed_ms                  = Column(Integer, nullable=True)
    vector_search_ms          = Column(Integer, nullable=True)
    bm25_ms                   = Column(Integer, nullable=True)
    rrf_ms                    = Column(Integer, nullable=True)
    rerank_ms                 = Column(Integer, nullable=True)
    llm_ms                    = Column(Integer, nullable=True)
    total_ms                  = Column(Integer, nullable=True)
    # Citation stats
    citations_used            = Column(Integer, nullable=False, default=0)
    citation_repair_triggered = Column(Boolean, nullable=False, default=False)
    no_context_found          = Column(Boolean, nullable=False, default=False)
    # User feedback mirrored from Message.feedback (1=👍, -1=👎, None=none)
    feedback                  = Column(Integer, nullable=True)
    created_at                = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_rag_query_created", "created_at"),
        Index("ix_rag_query_user", "user_id"),
    )


# ──────────────────────────────────────────────
#  Presentations (PPT Maker)
# ──────────────────────────────────────────────
class PresentationSet(Base):
    __tablename__ = "presentation_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    topic = Column(String(300), nullable=False)
    slide_count = Column(Integer, nullable=False)
    source_mix = Column(String(50), nullable=False) # '100_pdf', '100_llm', '50_50'
    corpus_version = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    covered_pages = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    chat = relationship("Chat", back_populates="presentation_sets")
    slides = relationship("PresentationSlide", back_populates="presentation_set", cascade="all, delete-orphan")


class PresentationSlide(Base):
    __tablename__ = "presentation_slides"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    presentation_set_id = Column(UUID(as_uuid=True), ForeignKey("presentation_sets.id", ondelete="CASCADE"), nullable=False)
    rank = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)
    bullet_points = Column(JSONB, nullable=False) # List of strings
    speaker_notes = Column(Text, nullable=True)

    presentation_set = relationship("PresentationSet", back_populates="slides")

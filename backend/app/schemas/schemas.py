"""
Pydantic schemas for request/response validation.
"""
from datetime import datetime, date
from uuid import UUID
from typing import Optional, Literal
from pydantic import BaseModel, Field, EmailStr


# ── Auth ──
class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=4, max_length=200)


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)


class VerifyEmailRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    code: str = Field(..., min_length=6, max_length=6)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=4, max_length=200)


class UserResponse(BaseModel):
    id: UUID
    username: str

class AdminUserCreateRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=4, max_length=200)

class AdminUserUpdateRequest(BaseModel):
    email: Optional[str] = Field(None, min_length=1, max_length=254)
    username: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = Field(None, min_length=4, max_length=200)
    is_active: Optional[bool] = None
    storage_quota_bytes: Optional[int] = None

class AdminUserResponse(BaseModel):
    id: UUID
    username: str
    is_active: bool
    created_at: datetime

class AdminDocumentUpdateRequest(BaseModel):
    original_filename: str = Field(..., min_length=1, max_length=500)


# ── Chat ──
class ChatCreateRequest(BaseModel):
    title: Optional[str] = None


class ChatRenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class ChatResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatListItem(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    document_count: int = 0
    message_count: int = 0


class ChatDetailResponse(BaseModel):
    id: UUID
    title: str
    documents: list["DocumentBriefResponse"] = []


class ChatListResponse(BaseModel):
    items: list[ChatListItem]
    next_cursor: Optional[str] = None


# ── Message ──
class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    document_ids: Optional[list[UUID]] = None
    client_request_id: Optional[UUID] = None


class SourceResponse(BaseModel):
    citation_label: Optional[str] = None
    page_number: Optional[int] = None
    excerpt: Optional[str] = None
    document_id: Optional[UUID] = None
    original_filename: Optional[str] = None


class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    status: str
    feedback: Optional[int] = None
    sources: list[SourceResponse] = []
    created_at: datetime


class MessageFeedbackRequest(BaseModel):
    feedback: int  # 1 for like, -1 for unlike, 0 for neutral



class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    next_cursor: Optional[str] = None


# ── Document ──
class DocumentBriefResponse(BaseModel):
    id: UUID
    original_filename: str
    status: str


class DocumentResponse(BaseModel):
    id: UUID
    original_filename: str
    byte_size: int
    page_count: Optional[int] = None
    status: str
    created_at: datetime


class DocumentInventoryItem(BaseModel):
    id: UUID
    original_filename: str
    byte_size: int
    page_count: Optional[int] = None
    status: str
    chat_id: UUID
    chat_title: str
    created_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]


class DocumentInventoryResponse(BaseModel):
    items: list[DocumentInventoryItem]


class UploadResponse(BaseModel):
    document_id: UUID
    job_id: UUID


class AddDocumentToChatRequest(BaseModel):
    chat_id: UUID


# ── Dashboard ──
class RecentChatItem(BaseModel):
    id: UUID
    title: str
    updated_at: datetime


class DashboardResponse(BaseModel):
    total_chats: int
    ready_documents: int
    indexed_pages: int
    saved_topics: int
    recent_chats: list[RecentChatItem]


# ── Job ──
class JobResponse(BaseModel):
    id: UUID
    type: str
    status: str
    progress: Optional[dict] = None
    error_code: Optional[str] = None


class SendMessageResponse(BaseModel):
    message_id: UUID
    job_id: UUID


# ── Topic ──
class TopicResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    importance_reason: Optional[str] = None
    rank: Optional[int] = None
    sources_json: Optional[dict] = None


class TopicSetResponse(BaseModel):
    id: UUID
    status: str
    covered_pages: Optional[dict] = None
    created_at: datetime
    topics: list[TopicResponse] = []


class TopicSetListResponse(BaseModel):
    items: list[TopicSetResponse]


class CreateTopicSetRequest(BaseModel):
    document_ids: list[UUID]
    page_range: Optional[dict] = None
    count: int = Field(default=15, ge=1, le=30)
    topic: Optional[str] = None


class CreateTopicSetResponse(BaseModel):
    topic_set_id: UUID
    job_id: UUID


# ── Error ──
class ErrorResponse(BaseModel):
    code: str
    message: str
    retryable: bool = False
    request_id: Optional[str] = None


# ── Health ──
class HealthResponse(BaseModel):
    status: str
    version: str

# ── Comparisons ──
class CompareRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    document_ids: list[UUID] = Field(..., min_items=2, max_items=5)

class CompareResponse(BaseModel):
    id: UUID
    query: str
    document_ids: list[UUID]
    generated_comparison: dict
    created_at: datetime

class CompareListResponse(BaseModel):
    items: list[CompareResponse]

# ── Quiz ──
class QuizQuestionResponse(BaseModel):
    id: UUID
    rank: Optional[int] = None
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: Optional[str] = None
    sources_json: Optional[dict] = None

class QuizSetResponse(BaseModel):
    id: UUID
    status: str
    covered_pages: Optional[dict] = None
    created_at: datetime
    questions: list[QuizQuestionResponse] = []

class QuizSetListResponse(BaseModel):
    items: list[QuizSetResponse]

class CreateQuizSetRequest(BaseModel):
    document_ids: list[UUID]
    page_range: Optional[dict] = None
    count: int = Field(default=10, ge=1, le=50)
    difficulty: str = Field(default="medium")
    topic: Optional[str] = None

class CreateQuizSetResponse(BaseModel):
    quiz_set_id: UUID
    job_id: UUID

class AdminDashboardResponse(BaseModel):
    total_users: int
    total_documents: int
    total_ai_queries: int
    storage_used_bytes: int
    recent_users: list[dict] = []
    recent_documents: list[dict] = []

class DailyAiUsage(BaseModel):
    date: str
    tokens_used: int
    active_users: int

class AdminAiUsageResponse(BaseModel):
    usage: list[DailyAiUsage]


# ── User Profile ──
class UserProfileResponse(BaseModel):
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    institution: Optional[str] = None
    course: Optional[str] = None
    avatar_url: Optional[str] = None
    member_since: datetime
    version: int


class UserProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, max_length=100)
    display_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=16)
    date_of_birth: Optional[date] = None
    bio: Optional[str] = Field(None, max_length=300)
    institution: Optional[str] = Field(None, max_length=150)
    course: Optional[str] = Field(None, max_length=100)
    version: int = Field(..., description="Expected version for optimistic concurrency")


# ── User Preferences ──
THEME_LITERAL = Literal["light", "dark"]
ACCENT_LITERAL = Literal["gray", "blue", "green", "yellow", "pink", "orange", "purple", "black"]
ANSWER_FORMAT_LITERAL = Literal["paragraph", "bullet_points", "exam_style", "step_by_step"]


class UserPreferencesResponse(BaseModel):
    theme: str
    accent_color: str
    response_length: str
    explanation_level: str
    not_in_docs_behavior: str
    citation_style: str
    default_search_scope: str
    follow_up_suggestions: bool
    simplify_difficult_concepts: bool
    external_knowledge: bool
    answer_format: str
    version: int


class UserPreferencesUpdateRequest(BaseModel):
    theme: Optional[THEME_LITERAL] = None
    accent_color: Optional[ACCENT_LITERAL] = None
    response_length: Optional[str] = None
    explanation_level: Optional[str] = None
    not_in_docs_behavior: Optional[str] = None
    citation_style: Optional[str] = None
    default_search_scope: Optional[str] = None
    follow_up_suggestions: Optional[bool] = None
    simplify_difficult_concepts: Optional[bool] = None
    external_knowledge: Optional[bool] = None
    answer_format: Optional[ANSWER_FORMAT_LITERAL] = None
    version: int = Field(..., description="Expected version for optimistic concurrency")


# ── Security ──
class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=4, max_length=200)

class DeleteAccountRequest(BaseModel):
    confirm_password: str

class CreateNoteRequest(BaseModel):
    document_id:   Optional[UUID] = None
    page_number:   Optional[int]  = None
    selected_text: str = Field(..., min_length=1, max_length=2000)
    user_note:     Optional[str] = Field(None, max_length=4000)

class UpdateNoteRequest(BaseModel):
    user_note: Optional[str] = Field(None, max_length=4000)

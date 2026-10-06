from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class FlashcardBase(BaseModel):
    question: str
    answer: str
    sources_json: Optional[Dict[str, Any]] = None


class FlashcardCreate(FlashcardBase):
    pass


class FlashcardOut(FlashcardBase):
    id: UUID
    flashcard_set_id: UUID
    user_id: UUID
    
    difficulty: str
    repetitions: int
    review_interval: int
    ease_factor: float
    next_review_at: datetime
    last_reviewed_at: Optional[datetime] = None
    review_count: int
    created_at: datetime

    class Config:
        orm_mode = True


class SubmitReviewRequest(BaseModel):
    rating: str = Field(..., description="Must be 'again', 'hard', 'good', or 'easy'")


class FlashcardReviewOut(BaseModel):
    id: UUID
    flashcard_id: UUID
    user_id: UUID
    rating: str
    previous_interval: int
    new_interval: int
    reviewed_at: datetime

    class Config:
        orm_mode = True

class GenerateFlashcardsRequest(BaseModel):
    document_ids: List[UUID]
    count: int = Field(default=10, ge=1, le=50)
    topic: Optional[str] = None

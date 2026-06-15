"""
Pydantic schemas used for request validation and response serialization.
Kept separate from ORM models to follow separation-of-concerns /
single-responsibility design.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from .models import AssessmentStatus, AssignmentStatus, Difficulty, GlobalRole


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- User ----------
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: GlobalRole = GlobalRole.CANDIDATE


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: GlobalRole
    is_active: bool

    class Config:
        from_attributes = True


# ---------- Question ----------
class QuestionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    difficulty: Difficulty = Difficulty.MEDIUM
    max_score: float = 10.0


class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[Difficulty] = None
    max_score: Optional[float] = None


class QuestionOut(BaseModel):
    id: int
    assessment_id: int
    title: str
    description: Optional[str] = None
    difficulty: Difficulty
    max_score: float

    class Config:
        from_attributes = True


# ---------- Assessment ----------
class AssessmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    duration_minutes: int = 60


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[AssessmentStatus] = None


class AssessmentOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    created_by_id: int
    duration_minutes: int
    status: AssessmentStatus
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True


# ---------- Assignment ----------
class AssignmentCreate(BaseModel):
    candidate_id: int


class AssignmentStatusUpdate(BaseModel):
    status: AssignmentStatus


class AssignmentOut(BaseModel):
    id: int
    assessment_id: int
    candidate_id: int
    status: AssignmentStatus
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Submission ----------
class SubmissionCreate(BaseModel):
    question_id: int
    code: str
    language: str = "python"


class FeedbackOut(BaseModel):
    id: int
    interviewer_id: int
    score: Optional[float] = None
    comments: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SubmissionOut(BaseModel):
    id: int
    assignment_id: int
    question_id: int
    code: str
    language: str
    created_at: datetime
    feedback_entries: List[FeedbackOut] = []

    class Config:
        from_attributes = True


# ---------- Feedback ----------
class FeedbackCreate(BaseModel):
    score: Optional[float] = None
    comments: Optional[str] = None

"""
ORM models for the Interview Assessment Platform.

Demonstrates Object-Oriented Design through a reusable TimestampMixin
and clearly separated entities: Users, Assessments, Questions,
Assignments (linking candidates to assessments), Submissions, and
Interviewer Feedback.
"""

import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


class TimestampMixin:
    """Reusable mixin that adds created_at / updated_at columns."""

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class GlobalRole(str, enum.Enum):
    """Platform-wide role for a user."""

    ADMIN = "admin"
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"


class AssessmentStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class Difficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class AssignmentStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    EVALUATED = "evaluated"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=True)
    role = Column(Enum(GlobalRole), default=GlobalRole.CANDIDATE, nullable=False)
    is_active = Column(Boolean, default=True)

    created_assessments = relationship(
        "Assessment", back_populates="created_by", foreign_keys="Assessment.created_by_id"
    )
    assignments = relationship("Assignment", back_populates="candidate")


class Assessment(Base, TimestampMixin):
    """A coding assessment created by an interviewer/admin."""

    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    duration_minutes = Column(Integer, default=60)
    status = Column(Enum(AssessmentStatus), default=AssessmentStatus.DRAFT, nullable=False)

    created_by = relationship(
        "User", back_populates="created_assessments", foreign_keys=[created_by_id]
    )
    questions = relationship(
        "Question", back_populates="assessment", cascade="all, delete-orphan"
    )
    assignments = relationship(
        "Assignment", back_populates="assessment", cascade="all, delete-orphan"
    )


class Question(Base, TimestampMixin):
    """A single coding question that belongs to an assessment."""

    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(Enum(Difficulty), default=Difficulty.MEDIUM, nullable=False)
    max_score = Column(Float, default=10.0)

    assessment = relationship("Assessment", back_populates="questions")
    submissions = relationship(
        "Submission", back_populates="question", cascade="all, delete-orphan"
    )


class Assignment(Base, TimestampMixin):
    """Links a candidate to an assessment they need to complete."""

    __tablename__ = "assignments"
    __table_args__ = (
        UniqueConstraint("assessment_id", "candidate_id", name="uq_assignment"),
    )

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(AssignmentStatus), default=AssignmentStatus.ASSIGNED, nullable=False)

    assessment = relationship("Assessment", back_populates="assignments")
    candidate = relationship("User", back_populates="assignments")
    submissions = relationship(
        "Submission", back_populates="assignment", cascade="all, delete-orphan"
    )


class Submission(Base, TimestampMixin):
    """A candidate's code submission for one question within an assignment."""

    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    code = Column(Text, nullable=False)
    language = Column(String(50), default="python")

    assignment = relationship("Assignment", back_populates="submissions")
    question = relationship("Question", back_populates="submissions")
    feedback_entries = relationship(
        "Feedback", back_populates="submission", cascade="all, delete-orphan"
    )


class Feedback(Base, TimestampMixin):
    """Interviewer feedback on a candidate's submission."""

    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    interviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=True)
    comments = Column(Text, nullable=True)

    submission = relationship("Submission", back_populates="feedback_entries")
    interviewer = relationship("User", foreign_keys=[interviewer_id])

"""
User-related routes: current user profile and staff user listing.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user, require_staff
from ..models import Submission, Assignment, Assessment, AssessmentStatus, AssignmentStatus, GlobalRole, User

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db), _: models.User = Depends(require_staff)
):
    """Admin/Interviewer only: list all registered users (e.g. to find candidate IDs)."""
    return db.query(models.User).all()


@router.get("/stats", tags=["Stats"])
def get_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_staff),
):
    """Dashboard stats for admin/interviewer."""
    total_assessments = db.query(models.Assessment).count()
    published_assessments = db.query(models.Assessment).filter(
        models.Assessment.status == models.AssessmentStatus.PUBLISHED
    ).count()
    total_candidates = db.query(models.User).filter(
        models.User.role == models.GlobalRole.CANDIDATE
    ).count()
    total_submissions = db.query(models.Submission).count()
    total_assignments = db.query(models.Assignment).count()
    evaluated = db.query(models.Assignment).filter(
        models.Assignment.status == models.AssignmentStatus.EVALUATED
    ).count()

    recent_submissions = (
        db.query(models.Submission)
        .order_by(models.Submission.created_at.desc())
        .limit(5)
        .all()
    )
    recent = []
    for s in recent_submissions:
        recent.append({
            "submission_id": s.id,
            "assignment_id": s.assignment_id,
            "question_id": s.question_id,
            "language": s.language,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {
        "total_assessments": total_assessments,
        "published_assessments": published_assessments,
        "total_candidates": total_candidates,
        "total_submissions": total_submissions,
        "total_assignments": total_assignments,
        "evaluated_assignments": evaluated,
        "recent_submissions": recent,
    }

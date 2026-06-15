"""
Feedback routes: interviewers (or admins) leave a score and comments on a
candidate's submission. Candidates can view feedback on their own work.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user, require_staff

router = APIRouter(prefix="/submissions/{submission_id}/feedback", tags=["Feedback"])


def _get_submission_or_404(db: Session, submission_id: int) -> models.Submission:
    submission = (
        db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


def _ensure_access(
    db: Session, submission: models.Submission, current_user: models.User
) -> None:
    is_staff = current_user.role in (models.GlobalRole.ADMIN, models.GlobalRole.INTERVIEWER)
    is_owner = submission.assignment.candidate_id == current_user.id
    if not (is_staff or is_owner):
        raise HTTPException(status_code=403, detail="You do not have access to this submission")


@router.post("/", response_model=schemas.FeedbackOut, status_code=status.HTTP_201_CREATED)
def add_feedback(
    submission_id: int,
    feedback_in: schemas.FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    submission = _get_submission_or_404(db, submission_id)
    feedback = models.Feedback(
        submission_id=submission.id,
        interviewer_id=current_user.id,
        score=feedback_in.score,
        comments=feedback_in.comments,
    )
    db.add(feedback)

    # Mark the assignment as evaluated once feedback is given.
    submission.assignment.status = models.AssignmentStatus.EVALUATED

    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/", response_model=List[schemas.FeedbackOut])
def list_feedback(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    submission = _get_submission_or_404(db, submission_id)
    _ensure_access(db, submission, current_user)
    return (
        db.query(models.Feedback)
        .filter(models.Feedback.submission_id == submission_id)
        .all()
    )

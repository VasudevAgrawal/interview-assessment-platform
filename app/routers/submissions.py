"""
Submission routes: candidates submit their code for a question within
an assigned assessment; staff and the owning candidate can view them.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import require_assignment_access

router = APIRouter(prefix="/assignments/{assignment_id}/submissions", tags=["Submissions"])


@router.post("/", response_model=schemas.SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    submission_in: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    assignment: models.Assignment = Depends(require_assignment_access),
):
    question = (
        db.query(models.Question)
        .filter(
            models.Question.id == submission_in.question_id,
            models.Question.assessment_id == assignment.assessment_id,
        )
        .first()
    )
    if not question:
        raise HTTPException(
            status_code=404, detail="Question not found for this assessment"
        )

    submission = models.Submission(
        assignment_id=assignment.id,
        question_id=submission_in.question_id,
        code=submission_in.code,
        language=submission_in.language,
    )
    db.add(submission)

    # Move the assignment forward automatically once work is submitted.
    if assignment.status == models.AssignmentStatus.ASSIGNED:
        assignment.status = models.AssignmentStatus.IN_PROGRESS

    db.commit()
    db.refresh(submission)
    return submission


@router.get("/", response_model=List[schemas.SubmissionOut])
def list_submissions(
    db: Session = Depends(get_db),
    assignment: models.Assignment = Depends(require_assignment_access),
):
    return (
        db.query(models.Submission)
        .filter(models.Submission.assignment_id == assignment.id)
        .all()
    )

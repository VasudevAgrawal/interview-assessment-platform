"""
Assignment routes: link candidates to assessments and track their
progress (assigned -> in_progress -> submitted -> evaluated).
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import (
    get_assessment_or_404,
    get_current_user,
    require_assignment_access,
    require_staff,
)

router = APIRouter(tags=["Assignments"])


@router.post(
    "/assessments/{assessment_id}/assignments",
    response_model=schemas.AssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_candidate(
    assessment_id: int,
    assignment_in: schemas.AssignmentCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_staff),
):
    get_assessment_or_404(assessment_id, db)

    candidate = (
        db.query(models.User)
        .filter(
            models.User.id == assignment_in.candidate_id,
            models.User.role == models.GlobalRole.CANDIDATE,
        )
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    existing = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.assessment_id == assessment_id,
            models.Assignment.candidate_id == assignment_in.candidate_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Candidate is already assigned")

    assignment = models.Assignment(
        assessment_id=assessment_id, candidate_id=assignment_in.candidate_id
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get(
    "/assessments/{assessment_id}/assignments",
    response_model=List[schemas.AssignmentOut],
)
def list_assignments_for_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_staff),
):
    get_assessment_or_404(assessment_id, db)
    return (
        db.query(models.Assignment)
        .filter(models.Assignment.assessment_id == assessment_id)
        .all()
    )


@router.get("/assignments/me", response_model=List[schemas.AssignmentOut])
def my_assignments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Candidates use this to see the assessments assigned to them."""
    return (
        db.query(models.Assignment)
        .filter(models.Assignment.candidate_id == current_user.id)
        .all()
    )


@router.get("/assignments/{assignment_id}", response_model=schemas.AssignmentOut)
def get_assignment(
    assignment: models.Assignment = Depends(require_assignment_access),
):
    return assignment


@router.patch("/assignments/{assignment_id}/status", response_model=schemas.AssignmentOut)
def update_assignment_status(
    update: schemas.AssignmentStatusUpdate,
    db: Session = Depends(get_db),
    assignment: models.Assignment = Depends(require_assignment_access),
):
    assignment.status = update.status
    db.commit()
    db.refresh(assignment)
    return assignment

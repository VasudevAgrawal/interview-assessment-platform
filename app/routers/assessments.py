"""
Assessment routes: create and manage coding assessments and their
questions. Creating/editing is restricted to staff (admin/interviewer);
candidates can only view assessments they've been assigned to.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_assessment_or_404, get_current_user, require_staff

router = APIRouter(prefix="/assessments", tags=["Assessments"])


@router.post("/", response_model=schemas.AssessmentOut, status_code=status.HTTP_201_CREATED)
def create_assessment(
    assessment_in: schemas.AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    assessment = models.Assessment(
        title=assessment_in.title,
        description=assessment_in.description,
        duration_minutes=assessment_in.duration_minutes,
        created_by_id=current_user.id,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/", response_model=List[schemas.AssessmentOut])
def list_assessments(
    search: Optional[str] = Query(None, description="Search by title"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Staff (admin/interviewer) see every assessment.
    Candidates only see assessments they've been assigned to.
    """
    query = db.query(models.Assessment)

    if current_user.role == models.GlobalRole.CANDIDATE:
        query = query.join(models.Assignment).filter(
            models.Assignment.candidate_id == current_user.id
        )

    if search:
        query = query.filter(models.Assessment.title.ilike(f"%{search}%"))

    return query.offset(skip).limit(limit).all()


@router.get("/{assessment_id}", response_model=schemas.AssessmentOut)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assessment = get_assessment_or_404(assessment_id, db)

    if current_user.role == models.GlobalRole.CANDIDATE:
        is_assigned = (
            db.query(models.Assignment)
            .filter(
                models.Assignment.assessment_id == assessment_id,
                models.Assignment.candidate_id == current_user.id,
            )
            .first()
        )
        if not is_assigned:
            raise HTTPException(status_code=403, detail="You are not assigned to this assessment")

    return assessment


@router.patch("/{assessment_id}", response_model=schemas.AssessmentOut)
def update_assessment(
    assessment_id: int,
    update: schemas.AssessmentUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_staff),
):
    assessment = get_assessment_or_404(assessment_id, db)
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(assessment, field, value)
    db.commit()
    db.refresh(assessment)
    return assessment


# ---------------- Questions (nested under an assessment) ----------------


@router.post(
    "/{assessment_id}/questions",
    response_model=schemas.QuestionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_question(
    assessment_id: int,
    question_in: schemas.QuestionCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_staff),
):
    get_assessment_or_404(assessment_id, db)
    question = models.Question(
        assessment_id=assessment_id,
        title=question_in.title,
        description=question_in.description,
        difficulty=question_in.difficulty,
        max_score=question_in.max_score,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.get("/{assessment_id}/questions", response_model=List[schemas.QuestionOut])
def list_questions(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Reuses the same visibility rules as get_assessment.
    get_assessment(assessment_id, db, current_user)
    return (
        db.query(models.Question)
        .filter(models.Question.assessment_id == assessment_id)
        .all()
    )


@router.patch("/{assessment_id}/questions/{question_id}", response_model=schemas.QuestionOut)
def update_question(
    assessment_id: int,
    question_id: int,
    update: schemas.QuestionUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_staff),
):
    question = (
        db.query(models.Question)
        .filter(models.Question.id == question_id, models.Question.assessment_id == assessment_id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    db.commit()
    db.refresh(question)
    return question

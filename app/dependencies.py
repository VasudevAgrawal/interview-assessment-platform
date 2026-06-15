"""
Reusable FastAPI dependencies for authentication and
role-based access control (RBAC).

Three global roles exist: admin, interviewer, candidate.
- Admins and interviewers can create/manage assessments, questions,
  assignments, and feedback.
- Candidates can only view their own assignments and submit their own work.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from . import models
from .auth import decode_access_token
from .database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_staff(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Admins and interviewers can manage assessments, questions, and feedback."""
    if current_user.role not in (models.GlobalRole.ADMIN, models.GlobalRole.INTERVIEWER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Interviewer or admin privileges required",
        )
    return current_user


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != models.GlobalRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


def get_assessment_or_404(assessment_id: int, db: Session) -> models.Assessment:
    assessment = (
        db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


def get_assignment_or_404(assignment_id: int, db: Session) -> models.Assignment:
    assignment = (
        db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


def require_assignment_access(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Assignment:
    """
    Allows access if the user is staff (admin/interviewer) or the candidate
    that the assignment belongs to.
    """
    assignment = get_assignment_or_404(assignment_id, db)
    is_staff = current_user.role in (models.GlobalRole.ADMIN, models.GlobalRole.INTERVIEWER)
    is_owner = assignment.candidate_id == current_user.id
    if not (is_staff or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this assignment",
        )
    return assignment

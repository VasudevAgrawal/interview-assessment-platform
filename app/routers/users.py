"""
User-related routes: current user profile and staff user listing.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user, require_staff

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

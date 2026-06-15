"""
Interview Assessment Platform
--------------------------------
A REST API for managing coding assessments, candidate submissions, and
interviewer feedback, built with FastAPI and SQLAlchemy.

Run with:
    uvicorn app.main:app --reload

Then open http://127.0.0.1:8000 for the web UI, or
http://127.0.0.1:8000/docs for interactive API docs.
"""

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import models
from .database import Base, engine
from .routers import assessments, assignments, auth, feedback, submissions, users

# Create all database tables on startup (for demo/dev purposes).
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Interview Assessment Platform",
    description=(
        "A platform for managing coding assessments, candidate submissions, "
        "and interviewer feedback, with role-based access control "
        "(admin / interviewer / candidate)."
    ),
    version="1.0.0",
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assessments.router)
app.include_router(assignments.router)
app.include_router(submissions.router)
app.include_router(feedback.router)

# Serve the frontend's CSS/JS assets.
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/", tags=["Frontend"])
def serve_frontend():
    """Serve the single-page frontend application."""
    return FileResponse("app/static/index.html")


@app.get("/api", tags=["Health"])
def api_status():
    return {"status": "ok", "message": "Interview Assessment Platform API"}

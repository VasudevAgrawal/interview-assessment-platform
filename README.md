# Interview Assessment Platform

A REST API (with a built-in web UI) for managing coding assessments,
candidate submissions, and interviewer feedback — built with **FastAPI**,
**SQLAlchemy**, and **JWT authentication**. The design follows
Object-Oriented principles (clear entity classes, a shared timestamp mixin,
separation between ORM models and API schemas) and implements
**role-based access control (RBAC)** with three roles: `admin`,
`interviewer`, and `candidate`.

## Features

- **Frontend UI** — a single-page web app (HTML/CSS/vanilla JS) with
  role-based views: staff manage assessments and give feedback; candidates
  view their assigned assessments and submit solutions
- **Authentication** — JWT-based registration and login (`passlib` + `python-jose`)
- **Assessments** — admins/interviewers create coding assessments with a
  title, description, duration, and status (`draft` / `published` / `closed`)
- **Questions** — each assessment contains one or more coding questions with
  a difficulty level (`easy` / `medium` / `hard`) and max score
- **Assignments** — link candidates to assessments; status automatically
  progresses (`assigned` → `in_progress` → `evaluated`) as work is submitted
  and reviewed
- **Submissions** — candidates submit code (with a language tag) for each
  question in their assigned assessment
- **Feedback** — interviewers/admins leave a score and comments on each
  submission
- **Search & Pagination** — `GET /assessments/` supports `search`, `skip`,
  and `limit`

## Role-Based Access Control

| Action                                  | Admin | Interviewer | Candidate |
|------------------------------------------|:-----:|:-----------:|:---------:|
| Create/edit assessments & questions       |  ✅   |     ✅      |    ❌     |
| Assign candidates to assessments          |  ✅   |     ✅      |    ❌     |
| View all assessments                      |  ✅   |     ✅      |    ❌     |
| View own assigned assessments             |  ✅   |     ✅      |    ✅     |
| Submit code for an assigned question      |  ❌   |     ❌      |    ✅     |
| Leave feedback/score on a submission      |  ✅   |     ✅      |    ❌     |
| View feedback on own submissions          |  ❌   |     ❌      |    ✅     |

The **first registered user becomes an admin**; subsequent users choose
`candidate` or `interviewer` at registration.

## Project Structure

```
interview_assessment_platform/
├── app/
│   ├── main.py            # FastAPI app, router registration, serves frontend
│   ├── database.py         # SQLAlchemy engine/session setup
│   ├── models.py           # ORM models (User, Assessment, Question, Assignment, Submission, Feedback)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # Password hashing & JWT helpers
│   ├── dependencies.py      # Auth & RBAC dependencies
│   ├── static/               # Frontend (HTML/CSS/JS)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   └── routers/
│       ├── auth.py          # /auth/register, /auth/login
│       ├── users.py         # /users/me, /users (staff)
│       ├── assessments.py   # /assessments, nested /questions
│       ├── assignments.py   # /assessments/{id}/assignments, /assignments/me
│       ├── submissions.py   # /assignments/{id}/submissions
│       └── feedback.py      # /submissions/{id}/feedback
├── requirements.txt
└── README.md
```

## Setup & Run

```bash
# 1. Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the development server
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000** for the web frontend, or
**http://127.0.0.1:8000/docs** for the interactive Swagger UI / API reference.

## Typical Workflow

**Via the web UI (http://127.0.0.1:8000):**
1. Register the first account (becomes admin) and log in
2. As admin/interviewer: create an assessment, add questions, and assign candidates by their User ID
3. Register a second account as a "Candidate" and log in
4. The candidate sees their assigned assessment under "My Assessments" and can submit code for each question
5. The interviewer reviews submissions and leaves a score/comments — the assignment status becomes "Evaluated"

**Via the API (http://127.0.0.1:8000/docs):**
1. `POST /auth/register` / `POST /auth/login`
2. `POST /assessments/` — create an assessment (staff)
3. `POST /assessments/{id}/questions` — add questions (staff)
4. `POST /assessments/{id}/assignments` — assign a candidate (staff)
5. `GET /assignments/me` — candidate views their assignments
6. `POST /assignments/{id}/submissions/` — candidate submits code
7. `POST /submissions/{id}/feedback/` — staff leaves feedback

## Notes

- Uses SQLite by default (`interview_assessment_platform.db`); change
  `SQLALCHEMY_DATABASE_URL` in `database.py` to use PostgreSQL/MySQL.
- `SECRET_KEY` in `auth.py` should be replaced with a secure,
  environment-based secret before any real deployment.

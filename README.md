# Interview Assessment Platform

A REST API with a built-in web UI for managing coding assessments,
candidate submissions, and interviewer feedback — built with **FastAPI**,
**SQLAlchemy**, and **JWT authentication**. The design follows
Object-Oriented principles (clear entity classes, a shared timestamp mixin,
separation between ORM models and API schemas) and implements
**role-based access control (RBAC)** with three roles: `admin`,
`interviewer`, and `candidate`.

## Features

- **Dashboard** — staff landing page with live stats (total assessments, candidates, submissions) and a recent activity feed
- **Assessment Timer** — candidates see a live countdown while taking an assessment; timer persists across page refreshes via `localStorage`
- **Score Leaderboard** — per-assessment ranked table of candidates by total score, with 🥇🥈🥉 medals for the top three
- **CSV Export** — download full assessment results (candidate names, per-question scores, totals) as a `.csv` file in one click
- **Dark / Light mode** — toggle in the topbar; preference saved across sessions
- **Frontend UI** — single-page web app (HTML/CSS/vanilla JS) with role-based views: staff manage assessments and give feedback; candidates view assigned assessments and submit solutions
- **Authentication** — JWT-based registration and login (`passlib` + `python-jose`)
- **Assessments** — admins/interviewers create coding assessments with a title, description, duration, and status (`draft` / `published` / `closed`)
- **Questions** — each assessment contains one or more coding questions with a difficulty level (`easy` / `medium` / `hard`) and max score
- **Assignments** — link candidates to assessments; status progresses (`assigned` → `in_progress` → `submitted` → `evaluated`) as work is submitted and reviewed
- **Submissions** — candidates submit code (with a language tag) for each question in their assigned assessment
- **Feedback** — interviewers/admins leave a score and comments on each submission
- **Search & Pagination** — `GET /assessments/` supports `search`, `skip`, and `limit`

## Role-Based Access Control

| Action                                    | Admin | Interviewer | Candidate |
|--------------------------------------------|:-----:|:-----------:|:---------:|
| Create/edit assessments & questions         |  ✅   |     ✅      |    ❌     |
| Assign candidates to assessments            |  ✅   |     ✅      |    ❌     |
| View dashboard stats                        |  ✅   |     ✅      |    ❌     |
| View leaderboard                            |  ✅   |     ✅      |    ✅*    |
| Export results as CSV                       |  ✅   |     ✅      |    ❌     |
| View all assessments                        |  ✅   |     ✅      |    ❌     |
| View own assigned assessments               |  ✅   |     ✅      |    ✅     |
| Submit code for an assigned question        |  ❌   |     ❌      |    ✅     |
| Leave feedback/score on a submission        |  ✅   |     ✅      |    ❌     |
| View feedback on own submissions            |  ❌   |     ❌      |    ✅     |

\* Candidates see anonymised ranks (no names), staff see full names.

The **first registered user becomes an admin**; subsequent users choose `candidate` or `interviewer` at registration.

## Project Structure

```
interview_assessment_platform/
├── app/
│   ├── main.py             # FastAPI app, router registration, serves frontend
│   ├── database.py          # SQLAlchemy engine/session setup
│   ├── models.py            # ORM models (User, Assessment, Question, Assignment, Submission, Feedback)
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── auth.py               # Password hashing & JWT helpers
│   ├── dependencies.py       # Auth & RBAC dependencies
│   ├── static/                # Frontend (HTML/CSS/JS)
│   │   ├── index.html         # SPA shell with all views
│   │   ├── style.css          # Dark/light theme, all component styles
│   │   └── app.js             # All frontend logic (auth, views, timer, export)
│   └── routers/
│       ├── auth.py            # POST /auth/register, POST /auth/login
│       ├── users.py           # GET /users/me, GET /users, GET /users/stats
│       ├── assessments.py     # /assessments CRUD, /questions, /leaderboard, /export
│       ├── assignments.py     # /assessments/{id}/assignments, GET /assignments/me
│       ├── submissions.py     # /assignments/{id}/submissions
│       └── feedback.py        # /submissions/{id}/feedback
├── requirements.txt
└── README.md
```

## Setup & Run

```bash
# 1. Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the development server
python -m uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000** for the web frontend, or
**http://127.0.0.1:8000/docs** for the interactive Swagger UI / API reference.

## Typical Workflow

**Via the web UI (http://127.0.0.1:8000):**

1. Register the first account (becomes admin) and log in
2. Admin/interviewer lands on the **Dashboard** — see platform stats at a glance
3. Go to **Assessments** → create an assessment, add questions, assign candidates by User ID
4. Register a second account as **Candidate** and log in
5. Candidate sees their assigned assessment under "My Assessments" with a **live countdown timer**
6. Candidate submits code solutions for each question
7. Interviewer opens the assessment → Candidates tab → reviews submissions and leaves scores/comments
8. Check the **Leaderboard** tab to see ranked results, or click **Export CSV** to download a spreadsheet

**Via the API (http://127.0.0.1:8000/docs):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Log in, receive JWT |
| GET | `/users/stats` | Dashboard stats (staff only) |
| POST | `/assessments/` | Create an assessment (staff) |
| POST | `/assessments/{id}/questions` | Add a question (staff) |
| POST | `/assessments/{id}/assignments` | Assign a candidate (staff) |
| GET | `/assessments/{id}/leaderboard` | Ranked scores for an assessment |
| GET | `/assessments/{id}/export` | Download results as CSV (staff) |
| GET | `/assignments/me` | Candidate: view assigned assessments |
| POST | `/assignments/{id}/submissions/` | Candidate: submit code |
| POST | `/submissions/{id}/feedback/` | Staff: leave score + comments |

## Notes

- Uses **SQLite** by default (`interview_assessment_platform.db`); change `SQLALCHEMY_DATABASE_URL` in `database.py` to switch to PostgreSQL or MySQL.
- `SECRET_KEY` in `auth.py` should be replaced with a secure, environment-based secret before any real deployment.
- The assessment timer uses `localStorage` keyed by assignment ID, so it survives page refreshes but resets if the browser data is cleared.

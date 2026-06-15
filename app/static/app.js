/* ============================================================
   Interview Assessment Platform - Frontend Logic
   Features: Dashboard, Timer, Leaderboard, CSV Export, Dark/Light Mode
   ============================================================ */

const ASSESSMENT_STATUS_LABELS = { draft: "Draft", published: "Published", closed: "Closed" };
const ASSIGNMENT_STATUS_LABELS = {
  assigned: "Assigned",
  in_progress: "In Progress",
  submitted: "Submitted",
  evaluated: "Evaluated",
};
const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };

let currentUser = null;
let currentAssessment = null;
let currentAssignment = null;
let timerInterval = null;

/* ---------------- Theme toggle ---------------- */

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.getElementById("themeToggle").textContent = theme === "light" ? "🌙" : "☀️";
  localStorage.setItem("theme", theme);
}

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = document.body.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
});

(function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  applyTheme(saved);
})();

/* ---------------- API helper ---------------- */

async function api(path, { method = "GET", body = null, form = false } = {}) {
  const headers = {};
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let fetchBody = body;
  if (body && !form) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: fetchBody });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      if (data.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch (_) {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ---------------- Toast ---------------- */

function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("toast-error", isError);
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 3000);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isStaff() {
  return currentUser && ["admin", "interviewer"].includes(currentUser.role);
}

/* ---------------- View switching ---------------- */

function showView(viewId) {
  document.querySelectorAll("#app > section").forEach((s) => s.classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");
}

function setupTabs(container) {
  const tabBtns = container.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      container.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const panels = container.parentElement.querySelectorAll(".tab-panel");
      panels.forEach((p) => p.classList.remove("active"));

      const target =
        document.getElementById(`${tabName}Form`) || document.getElementById(`panel-${tabName}`);
      if (target) {
        target.classList.add("active");
        if (tabName === "candidates") loadAssignments();
        if (tabName === "questions") loadQuestions();
        if (tabName === "leaderboard") loadLeaderboard();
      }
    });
  });
}

/* ---------------- Auth ---------------- */

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";
  try {
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);
    const data = await api("/auth/login", { method: "POST", body, form: true });
    localStorage.setItem("token", data.access_token);
    await loadCurrentUser();
    await enterApp();
  } catch (err) {
    errEl.textContent = err.message || "Login failed";
  }
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("registerError");
  const okEl = document.getElementById("registerSuccess");
  errEl.textContent = "";
  okEl.textContent = "";
  const payload = {
    username: document.getElementById("regUsername").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    full_name: document.getElementById("regFullName").value.trim() || null,
    password: document.getElementById("regPassword").value,
    role: document.getElementById("regRole").value,
  };
  try {
    const user = await api("/auth/register", { method: "POST", body: payload });
    okEl.textContent = `Account created (ID: ${user.id})! You can now log in.`;
    document.querySelector('.tab-btn[data-tab="login"]').click();
    document.getElementById("loginUsername").value = payload.username;
  } catch (err) {
    errEl.textContent = err.message || "Registration failed";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("token");
  currentUser = null;
  currentAssessment = null;
  currentAssignment = null;
  stopTimer();
  document.getElementById("userBox").classList.add("hidden");
  showView("authView");
});

async function loadCurrentUser() {
  currentUser = await api("/users/me");
  document.getElementById("userLabel").textContent =
    `${currentUser.username} (${currentUser.role}, ID: ${currentUser.id})`;
  document.getElementById("userBox").classList.remove("hidden");
}

async function enterApp() {
  if (isStaff()) {
    showView("dashboardView");
    await loadDashboard();
  } else {
    showView("myAssignmentsView");
    await loadMyAssignments();
  }
}

/* ================= FEATURE 1: Dashboard ================= */

document.getElementById("goToAssessmentsBtn").addEventListener("click", () => {
  showView("assessmentsView");
  loadAssessments();
});

async function loadDashboard() {
  try {
    const stats = await api("/users/stats");

    document.getElementById("statsGrid").innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.total_assessments}</div>
        <div class="stat-label">Total Assessments</div>
        <div class="stat-sub">${stats.published_assessments} published</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.total_candidates}</div>
        <div class="stat-label">Candidates</div>
        <div class="stat-sub">${stats.total_assignments} assigned</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.total_submissions}</div>
        <div class="stat-label">Submissions</div>
        <div class="stat-sub">${stats.evaluated_assignments} evaluated</div>
      </div>
    `;

    const actEl = document.getElementById("recentActivity");
    if (!stats.recent_submissions.length) {
      actEl.innerHTML = `<div class="empty-state">No submissions yet.</div>`;
      return;
    }
    actEl.innerHTML = stats.recent_submissions.map((s) => `
      <div class="list-item">
        <div class="list-item-header">
          <h4>Submission #${s.submission_id}</h4>
          <span class="badge badge-medium">${escapeHtml(s.language)}</span>
        </div>
        <div class="list-item-meta">Assignment #${s.assignment_id} &middot; Question #${s.question_id} &middot; ${s.created_at ? new Date(s.created_at).toLocaleString() : ""}</div>
      </div>`).join("");
  } catch (err) {
    toast(err.message || "Could not load dashboard", true);
  }
}

/* ================= STAFF: Assessments ================= */

document.getElementById("newAssessmentBtn").addEventListener("click", () => {
  document.getElementById("newAssessmentForm").classList.toggle("hidden");
});

document.getElementById("newAssessmentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("newAssessmentError");
  errEl.textContent = "";
  const payload = {
    title: document.getElementById("newAssessmentTitle").value.trim(),
    description: document.getElementById("newAssessmentDescription").value.trim() || null,
    duration_minutes: Number(document.getElementById("newAssessmentDuration").value) || 60,
  };
  try {
    await api("/assessments/", { method: "POST", body: payload });
    document.getElementById("newAssessmentForm").reset();
    document.getElementById("newAssessmentDuration").value = 60;
    document.getElementById("newAssessmentForm").classList.add("hidden");
    toast("Assessment created");
    await loadAssessments();
  } catch (err) {
    errEl.textContent = err.message || "Could not create assessment";
  }
});

let assessmentSearchTimer;
document.getElementById("assessmentSearch").addEventListener("input", () => {
  clearTimeout(assessmentSearchTimer);
  assessmentSearchTimer = setTimeout(loadAssessments, 300);
});

async function loadAssessments() {
  const search = document.getElementById("assessmentSearch").value.trim();
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", "50");

  const listEl = document.getElementById("assessmentsList");
  try {
    const assessments = await api(`/assessments/?${params.toString()}`);
    if (!assessments.length) {
      listEl.innerHTML = `<div class="empty-state">No assessments yet. Create your first one!</div>`;
      return;
    }
    listEl.innerHTML = assessments.map((a) => `
      <div class="project-card" data-id="${a.id}">
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.description || "No description")}</p>
        <div class="list-item-meta">
          <span class="badge badge-${a.status}">${ASSESSMENT_STATUS_LABELS[a.status]}</span>
          &middot; ${a.duration_minutes} min &middot; ${a.questions.length} question(s)
        </div>
      </div>`).join("");
    listEl.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("click", () => openAssessment(Number(card.dataset.id)));
    });
  } catch (err) {
    toast(err.message || "Could not load assessments", true);
  }
}

document.querySelectorAll(".back-to-assessments").forEach((btn) => {
  btn.addEventListener("click", () => {
    showView("assessmentsView");
    loadAssessments();
  });
});

/* ================= STAFF: Assessment Detail ================= */

async function openAssessment(assessmentId) {
  try {
    currentAssessment = await api(`/assessments/${assessmentId}`);
  } catch (err) {
    toast(err.message || "Could not load assessment", true);
    return;
  }

  document.getElementById("assessmentTitle").textContent = currentAssessment.title;
  document.getElementById("assessmentDescription").textContent =
    currentAssessment.description || "No description provided.";
  document.getElementById("assessmentStatusSelect").value = currentAssessment.status;

  const tabsContainer = document.getElementById("assessmentTabs");
  tabsContainer.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  tabsContainer.querySelector('.tab-btn[data-tab="questions"]').classList.add("active");
  document.querySelectorAll("#assessmentDetailView .tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById("panel-questions").classList.add("active");

  showView("assessmentDetailView");
  await loadQuestions();
}

document.getElementById("assessmentStatusSelect").addEventListener("change", async (e) => {
  try {
    currentAssessment = await api(`/assessments/${currentAssessment.id}`, {
      method: "PATCH",
      body: { status: e.target.value },
    });
    toast("Assessment status updated");
  } catch (err) {
    toast(err.message || "Could not update status", true);
  }
});

/* ================= FEATURE 4: CSV Export ================= */

document.getElementById("exportCsvBtn").addEventListener("click", async () => {
  if (!currentAssessment) return;
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/assessments/${currentAssessment.id}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assessment_${currentAssessment.id}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV downloaded");
  } catch (err) {
    toast(err.message || "Could not export", true);
  }
});

/* ---------------- Questions ---------------- */

document.getElementById("newQuestionBtn").addEventListener("click", () => {
  document.getElementById("newQuestionForm").classList.toggle("hidden");
});

document.getElementById("newQuestionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("newQuestionError");
  errEl.textContent = "";
  const payload = {
    title: document.getElementById("questionTitle").value.trim(),
    description: document.getElementById("questionDescription").value.trim() || null,
    difficulty: document.getElementById("questionDifficulty").value,
    max_score: Number(document.getElementById("questionMaxScore").value) || 10,
  };
  try {
    await api(`/assessments/${currentAssessment.id}/questions`, { method: "POST", body: payload });
    document.getElementById("newQuestionForm").reset();
    document.getElementById("questionMaxScore").value = 10;
    document.getElementById("newQuestionForm").classList.add("hidden");
    toast("Question added");
    await loadQuestions();
  } catch (err) {
    errEl.textContent = err.message || "Could not add question";
  }
});

async function loadQuestions() {
  if (!currentAssessment) return;
  const listEl = document.getElementById("questionsList");
  try {
    const questions = await api(`/assessments/${currentAssessment.id}/questions`);
    if (!questions.length) {
      listEl.innerHTML = `<div class="empty-state">No questions added yet.</div>`;
      return;
    }
    listEl.innerHTML = questions.map((q) => `
      <div class="list-item">
        <div class="list-item-header">
          <h4>${escapeHtml(q.title)}</h4>
          <span class="badge badge-${q.difficulty}">${DIFFICULTY_LABELS[q.difficulty]}</span>
        </div>
        ${q.description ? `<p>${escapeHtml(q.description)}</p>` : ""}
        <div class="list-item-meta">Max score: ${q.max_score}</div>
      </div>`).join("");
  } catch (err) {
    toast(err.message || "Could not load questions", true);
  }
}

/* ---------------- Candidates / Assignments (staff) ---------------- */

document.getElementById("newAssignmentBtn").addEventListener("click", () => {
  document.getElementById("newAssignmentForm").classList.toggle("hidden");
});

document.getElementById("newAssignmentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("newAssignmentError");
  errEl.textContent = "";
  const payload = { candidate_id: Number(document.getElementById("assignCandidateId").value) };
  try {
    await api(`/assessments/${currentAssessment.id}/assignments`, { method: "POST", body: payload });
    document.getElementById("newAssignmentForm").reset();
    document.getElementById("newAssignmentForm").classList.add("hidden");
    toast("Candidate assigned");
    await loadAssignments();
  } catch (err) {
    errEl.textContent = err.message || "Could not assign candidate";
  }
});

async function loadAssignments() {
  if (!currentAssessment) return;
  const listEl = document.getElementById("assignmentsList");
  try {
    const assignments = await api(`/assessments/${currentAssessment.id}/assignments`);
    if (!assignments.length) {
      listEl.innerHTML = `<div class="empty-state">No candidates assigned yet.</div>`;
      return;
    }
    listEl.innerHTML = assignments.map((a) => `
      <div class="list-item assignment-row" data-id="${a.id}">
        <div class="list-item-header">
          <h4>Candidate #${a.candidate_id}</h4>
          <span class="badge badge-${a.status}">${ASSIGNMENT_STATUS_LABELS[a.status]}</span>
        </div>
        <div class="list-item-meta">Click to review submissions &amp; give feedback</div>
      </div>`).join("");
    listEl.querySelectorAll(".assignment-row").forEach((row) => {
      row.addEventListener("click", () => openAssignmentReview(Number(row.dataset.id)));
    });
  } catch (err) {
    toast(err.message || "Could not load assignments", true);
  }
}

/* ================= FEATURE 3: Leaderboard ================= */

async function loadLeaderboard() {
  if (!currentAssessment) return;
  const listEl = document.getElementById("leaderboardList");
  listEl.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const results = await api(`/assessments/${currentAssessment.id}/leaderboard`);
    if (!results.length) {
      listEl.innerHTML = `<div class="empty-state">No evaluated submissions yet.</div>`;
      return;
    }
    const medals = ["🥇", "🥈", "🥉"];
    listEl.innerHTML = results.map((r) => `
      <div class="list-item leaderboard-row rank-${r.rank}">
        <div class="list-item-header">
          <h4>${medals[r.rank - 1] || `#${r.rank}`} &nbsp;${escapeHtml(r.candidate_name)}</h4>
          <span class="stat-score">${r.total_score} pts</span>
        </div>
        <div class="list-item-meta">
          ${r.scored_questions} question(s) scored &middot;
          <span class="badge badge-${r.status}">${ASSIGNMENT_STATUS_LABELS[r.status]}</span>
        </div>
      </div>`).join("");
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Could not load leaderboard.</div>`;
  }
}

/* ---------------- Assignment review (staff) ---------------- */

document.querySelectorAll(".back-to-assessment-detail").forEach((btn) => {
  btn.addEventListener("click", () => {
    showView("assessmentDetailView");
    loadAssignments();
  });
});

async function openAssignmentReview(assignmentId) {
  try {
    currentAssignment = await api(`/assignments/${assignmentId}`);
  } catch (err) {
    toast(err.message || "Could not load assignment", true);
    return;
  }
  document.getElementById("assignmentMeta").textContent =
    `Candidate #${currentAssignment.candidate_id} \u2022 Status: ${ASSIGNMENT_STATUS_LABELS[currentAssignment.status]}`;
  showView("assignmentReviewView");
  await loadSubmissionsForReview();
}

async function loadSubmissionsForReview() {
  const listEl = document.getElementById("submissionsReviewList");
  try {
    const [submissions, questions] = await Promise.all([
      api(`/assignments/${currentAssignment.id}/submissions/`),
      api(`/assessments/${currentAssessment.id}/questions`),
    ]);
    if (!submissions.length) {
      listEl.innerHTML = `<div class="empty-state">This candidate hasn't submitted anything yet.</div>`;
      return;
    }
    const questionMap = {};
    questions.forEach((q) => (questionMap[q.id] = q));

    listEl.innerHTML = submissions.map((s) => {
      const q = questionMap[s.question_id];
      const feedback = (s.feedback_entries || []).map((f) => `
        <div class="feedback-box">
          <div class="comment-meta">Interviewer #${f.interviewer_id}${f.score != null ? ` &middot; Score: ${f.score}` : ""}</div>
          ${escapeHtml(f.comments || "")}
        </div>`).join("");
      return `
        <div class="list-item">
          <div class="list-item-header">
            <h4>${escapeHtml(q ? q.title : `Question #${s.question_id}`)}</h4>
            <span class="badge badge-medium">${escapeHtml(s.language)}</span>
          </div>
          <div class="code-block">${escapeHtml(s.code)}</div>
          <div class="comments">
            ${feedback}
            <form class="comment-form feedback-form" data-submission-id="${s.id}">
              <input type="number" step="0.5" placeholder="Score" class="feedback-score" style="max-width:90px;" />
              <input type="text" placeholder="Comments..." class="feedback-comments" />
              <button type="submit" class="btn btn-secondary btn-sm">Submit Feedback</button>
            </form>
          </div>
        </div>`;
    }).join("");

    document.querySelectorAll(".feedback-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submissionId = form.dataset.submissionId;
        const scoreVal = form.querySelector(".feedback-score").value;
        const payload = {
          score: scoreVal === "" ? null : Number(scoreVal),
          comments: form.querySelector(".feedback-comments").value.trim() || null,
        };
        try {
          await api(`/submissions/${submissionId}/feedback/`, { method: "POST", body: payload });
          toast("Feedback submitted");
          await loadSubmissionsForReview();
        } catch (err) {
          toast(err.message || "Could not submit feedback", true);
        }
      });
    });
  } catch (err) {
    toast(err.message || "Could not load submissions", true);
  }
}

/* ================= CANDIDATE: My Assignments ================= */

async function loadMyAssignments() {
  const listEl = document.getElementById("myAssignmentsList");
  try {
    const assignments = await api("/assignments/me");
    if (!assignments.length) {
      listEl.innerHTML = `<div class="empty-state">You haven't been assigned any assessments yet.</div>`;
      return;
    }
    const withAssessments = await Promise.all(
      assignments.map(async (a) => {
        try {
          const assessment = await api(`/assessments/${a.assessment_id}`);
          return { assignment: a, assessment };
        } catch (_) {
          return { assignment: a, assessment: null };
        }
      })
    );
    listEl.innerHTML = withAssessments.map(({ assignment, assessment }) => `
      <div class="project-card" data-assignment-id="${assignment.id}" data-assessment-id="${assignment.assessment_id}">
        <h3>${escapeHtml(assessment ? assessment.title : `Assessment #${assignment.assessment_id}`)}</h3>
        <p>${escapeHtml(assessment ? assessment.description || "No description" : "")}</p>
        <div class="list-item-meta">
          <span class="badge badge-${assignment.status}">${ASSIGNMENT_STATUS_LABELS[assignment.status]}</span>
          ${assessment ? ` &middot; ${assessment.duration_minutes} min` : ""}
        </div>
      </div>`).join("");
    listEl.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("click", () =>
        openMyAssignment(Number(card.dataset.assignmentId), Number(card.dataset.assessmentId))
      );
    });
  } catch (err) {
    toast(err.message || "Could not load your assignments", true);
  }
}

document.querySelectorAll(".back-to-my-assignments").forEach((btn) => {
  btn.addEventListener("click", () => {
    stopTimer();
    showView("myAssignmentsView");
    loadMyAssignments();
  });
});

/* ================= CANDIDATE: Assignment Detail ================= */

async function openMyAssignment(assignmentId, assessmentId) {
  try {
    const [assignment, assessment] = await Promise.all([
      api(`/assignments/${assignmentId}`),
      api(`/assessments/${assessmentId}`),
    ]);
    currentAssignment = assignment;
    currentAssessment = assessment;
  } catch (err) {
    toast(err.message || "Could not load assignment", true);
    return;
  }

  document.getElementById("myAssessmentTitle").textContent = currentAssessment.title;
  document.getElementById("myAssessmentDescription").textContent =
    currentAssessment.description || "No description provided.";
  document.getElementById("myAssessmentMeta").textContent =
    `Duration: ${currentAssessment.duration_minutes} min \u2022 Status: ${ASSIGNMENT_STATUS_LABELS[currentAssignment.status]}`;

  showView("myAssignmentDetailView");
  startTimer(currentAssessment.duration_minutes, currentAssignment.id);
  await loadMyQuestions();
}

/* ================= FEATURE 2: Timer ================= */

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  document.getElementById("timerBar").classList.add("hidden");
}

function startTimer(durationMinutes, assignmentId) {
  stopTimer();
  const timerBar = document.getElementById("timerBar");
  const timerDisplay = document.getElementById("timerDisplay");
  timerBar.classList.remove("hidden");
  timerBar.classList.remove("timer-warning");

  const storageKey = `timer_start_${assignmentId}`;
  let startTime = localStorage.getItem(storageKey);
  if (!startTime) {
    startTime = Date.now();
    localStorage.setItem(storageKey, startTime);
  } else {
    startTime = Number(startTime);
  }

  const totalMs = durationMinutes * 60 * 1000;

  function tick() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, totalMs - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerDisplay.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    if (remaining <= 5 * 60 * 1000) {
      timerBar.classList.add("timer-warning");
    }
    if (remaining === 0) {
      clearInterval(timerInterval);
      toast("Time is up! Please submit your answers.", true);
    }
  }

  tick();
  timerInterval = setInterval(tick, 1000);
}

/* ================= CANDIDATE: Questions ================= */

async function loadMyQuestions() {
  const listEl = document.getElementById("myQuestionsList");
  try {
    const [questions, submissions] = await Promise.all([
      api(`/assessments/${currentAssessment.id}/questions`),
      api(`/assignments/${currentAssignment.id}/submissions/`),
    ]);
    if (!questions.length) {
      listEl.innerHTML = `<div class="empty-state">No questions in this assessment yet.</div>`;
      return;
    }
    listEl.innerHTML = questions.map((q) => {
      const mySubmissions = submissions.filter((s) => s.question_id === q.id);
      const submissionsHtml = mySubmissions.map((s) => {
        const feedback = (s.feedback_entries || []).map((f) => `
          <div class="feedback-box">
            <div class="comment-meta">Feedback${f.score != null ? ` &middot; Score: ${f.score}` : ""}</div>
            ${escapeHtml(f.comments || "")}
          </div>`).join("");
        return `<div class="code-block">${escapeHtml(s.code)}</div>${feedback}`;
      }).join("");

      return `
        <div class="list-item">
          <div class="list-item-header">
            <h4>${escapeHtml(q.title)}</h4>
            <span class="badge badge-${q.difficulty}">${DIFFICULTY_LABELS[q.difficulty]}</span>
          </div>
          ${q.description ? `<p>${escapeHtml(q.description)}</p>` : ""}
          <div class="list-item-meta">Max score: ${q.max_score}</div>
          ${submissionsHtml ? `<div class="comments">${submissionsHtml}</div>` : ""}
          <form class="submission-form" data-question-id="${q.id}" style="margin-top:10px;">
            <label style="margin-bottom:6px;">Language
              <select class="submission-language">
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label style="margin-bottom:6px;">Your code
              <textarea class="submission-code" rows="5" placeholder="Paste your solution here..." required></textarea>
            </label>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary btn-sm">Submit Solution</button>
            </div>
          </form>
        </div>`;
    }).join("");

    document.querySelectorAll(".submission-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
          question_id: Number(form.dataset.questionId),
          code: form.querySelector(".submission-code").value,
          language: form.querySelector(".submission-language").value,
        };
        try {
          await api(`/assignments/${currentAssignment.id}/submissions/`, {
            method: "POST",
            body: payload,
          });
          toast("Solution submitted");
          await loadMyQuestions();
        } catch (err) {
          toast(err.message || "Could not submit solution", true);
        }
      });
    });
  } catch (err) {
    toast(err.message || "Could not load questions", true);
  }
}

/* ---------------- Init ---------------- */

setupTabs(document.querySelector("#authView .tabs"));
setupTabs(document.getElementById("assessmentTabs"));

document.querySelectorAll(".cancel-form").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest("form").classList.add("hidden");
    btn.closest("form").reset();
  });
});

(async function init() {
  const token = localStorage.getItem("token");
  if (!token) { showView("authView"); return; }
  try {
    await loadCurrentUser();
    await enterApp();
  } catch (_) {
    localStorage.removeItem("token");
    showView("authView");
  }
})();

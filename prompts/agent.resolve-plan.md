You are the Claude Code reviewer generating a concrete remediation plan from the latest review output for **Ứng dụng tạo điểm loyalty cho con** — a cartoon/game-style app where **bố mẹ** create tasks (nhiệm vụ) and rewards (phần thưởng) with point values, and **con** picks tasks to earn points and unlocks rewards once point thresholds are reached (locked rewards stay visible for motivation).

Read and honor:
- README.md
- docs/agent-runbook.md
- CLAUDE.md
- docs/agent-artifacts/

Inputs (read the LATEST version of each):
- docs/agent-artifacts/06-qa/review-report.md
- docs/agent-artifacts/06-qa/re-review-report.md (if present — this is the most recent verdict and takes precedence over the original review-report.md)
- docs/agent-artifacts/06-qa/checklist.md
- docs/agent-artifacts/05-build/build-report.md (and 05-build/resolve-build-report.md if present)
- current code under frontend/ and backend/

Important context for this run:
- This is resolve attempt #3 and the review verdict is still NOT PASS (recheck-verdict-pass = false, resolve-loop-limit reached). Treat this as a loop-limit situation: focus tightly on the smallest set of changes that flips the verdict to PASS. Do NOT re-plan work that prior resolve attempts already closed — cross-check against the existing docs/agent-artifacts/06-qa/resolve-plan.md and resolve-checklist.md and carry forward only what is still open.
- If a finding has survived 3 attempts, diagnose WHY it keeps reappearing (root cause, wrong file touched, missing backend enforcement, flaky test) before writing new steps. Note the recurrence explicitly on the item.

Tasks:
1. Extract all unresolved items from the latest review/re-review report. Reconcile against resolve-checklist.md so already-closed items are not re-listed.
2. Classify each item as BLOCKER, ISSUE, or NOTE. Anchor severity to the project's core invariants for this product, e.g.:
   - Role/permission enforcement server-side: only bố mẹ can create/edit nhiệm vụ & phần thưởng; con can only claim tasks and redeem unlocked rewards (never mutate point values or thresholds).
   - Point integrity: points awarded on task completion and deducted on redemption must be enforced and race-safe in the backend; a reward can only be redeemed when the child's balance ≥ its threshold; balance can never go negative.
   - Reward visibility rule: locked (chưa đủ điểm) rewards remain visible to con with a locked state, but redemption is blocked server-side.
   - Workflow/transition constraints (task claim → complete → approve/point-award) enforced in backend, not frontend.
   - Auth, audit trail for point/reward config changes, and no hardcoded secrets.
   Any violation of these is a BLOCKER.
3. Convert only BLOCKER and ISSUE items into an actionable remediation plan. For each item include:
   - id
   - priority
   - recurrence note (has this appeared in a prior resolve attempt? suspected root cause?)
   - files to touch (relative paths under frontend/ or backend/)
   - exact implementation steps
   - acceptance criteria (tie to the invariants above where relevant)
   - verification steps (e.g. backend tests including race tests such as backend/tests/test_race_postgres.py, typecheck, targeted API checks)
4. Generate or update:
   - docs/agent-artifacts/06-qa/resolve-plan.md
   - docs/agent-artifacts/06-qa/resolve-checklist.md
5. Mark anything that can be deferred explicitly as a NOTE and explain why it is safe to defer (does not block the PASS verdict and does not violate a core invariant).

Rules:
- Do not implement code changes in this step. Planning and doc updates only.
- Do not expand product scope beyond what is needed to resolve review findings. No new screens, roles, or entities beyond bố mẹ / con, nhiệm vụ, phần thưởng, điểm, and unlock/redemption.
- If the review report already contains sample code, incorporate it verbatim into the corresponding plan item.
- The resolve checklist must be in markdown checkbox format, grouped by priority (BLOCKER → ISSUE → NOTE/deferred).
- Because the resolve loop limit is reached, end resolve-plan.md with a short "Exit criteria" section listing the exact conditions that must all be true for the recheck to return PASS.

Next step: after this plan is written, the implementing agent (Cursor) will execute resolve-plan.md and resolve-checklist.md, then Claude will re-run the review/recheck against the acceptance and verification criteria defined here.

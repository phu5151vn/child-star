You are running inside Cursor Agent to resolve review findings for **Ứng dụng tạo điểm loyalty cho con** — a playful, cartoon-styled reward app where **bố mẹ (parent)** create tasks and rewards, and **con (child)** picks tasks to earn points and unlocks rewards once point thresholds are reached (locked rewards stay visible to motivate the child).

Read and honor:
- README.md
- docs/agent-runbook.md
- .cursor/rules/
- docs/agent-artifacts/

Inputs:
- docs/agent-artifacts/06-qa/review-report.md
- docs/agent-artifacts/06-qa/resolve-plan.md
- docs/agent-artifacts/06-qa/resolve-checklist.md
- docs/agent-artifacts/05-build/build-report.md
- current code under frontend/backend

Context you must respect while fixing:
- Two roles only — **parent** and **child**. Role, permission, and any workflow transition constraints are enforced in the **backend**, never decided by the frontend.
- Core entities/flows: parent creates/edits **Task** (with point value) and **Reward** (with point-threshold milestones); child **selects/completes tasks** to accrue points; child **redeems** an unlocked reward by spending points; **locked rewards remain visible** with their required threshold shown.
- Point balance changes (earning from tasks, spending on redemption, unlock state) must be consistent and non-negative; enforce transactional integrity and guard against race/double-spend on the backend.
- Data access keeps the layering router -> service/domain -> repository; API contract stays traceable to the PRD.
- This is resolve attempt #3 (loop limit reached) and the prior recheck verdict did not pass — prioritize closing genuine BLOCKERs over cosmetic changes.

Tasks:
1. Resolve all BLOCKER items first (e.g. role/permission enforcement gaps, point-balance or redemption integrity, threshold/unlock logic errors, auth issues).
2. Resolve ISSUE items that are marked in-scope in resolve-plan.md.
3. Update the implementation and only the minimum related artifacts needed by the fixes.
4. Update docs/agent-artifacts/05-build/resolve-build-report.md with:
   - items fixed
   - files changed
   - remaining blockers or risks
   - runtime or lint/typecheck verification run
5. Update docs/agent-artifacts/06-qa/resolve-checklist.md by checking off completed items.

Rules:
- Do not rewrite the PRD or redesign the app (keep the cartoon/game-style UX and the parent/child model as specified).
- Do not add unrelated features.
- Respect frontend/backend boundaries and API contracts.
- If an item cannot be completed, record the blocker clearly in resolve-build-report.md.
- Stop after remediation work is complete.

Next step: Claude re-checks the resolved build against docs/agent-artifacts/06-qa/review-report.md and issues a recheck verdict.

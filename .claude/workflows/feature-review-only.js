export const meta = {
  name: 'feature-review-only',
  description: 'Review-only: đọc artifacts + code Cursor đã build → review đa chiều → verify đối kháng → ghi review-report + resolve-plan. KHÔNG build, KHÔNG sửa code (Cursor giữ vai builder/fixer).',
  whenToUse:
    'Chạy SAU khi Cursor đã build/fix xong một feature. Truyền args: "<ten-feature>" cho review lần đầu, hoặc args: { feature: "<ten-feature>", rereview: true } cho re-review sau khi Cursor đã resolve. Workflow chỉ đọc code + ghi artifact dưới 06-qa, không mutate source.',
  phases: [
    { title: 'Đọc artifacts', detail: 'Đọc stage docs + build-report để biết Cursor đã build gì, chốt acceptance criteria & rules' },
    { title: 'Review', detail: 'Review song song: backend-rules, contract-trace, data-schema, frontend-states, tests-dod' },
    { title: 'Verify', detail: 'Kiểm định đối kháng từng finding để loại false positive' },
    { title: 'Report', detail: 'Tổng hợp verdict, ghi review-report/re-review-report + resolve-plan' },
  ],
}

// ---- Tham số ----
const feature = typeof args === 'string' ? args : args && args.feature
if (!feature) {
  throw new Error(
    'Thiếu tên feature. Chạy lại với args: "<ten-feature>" hoặc args: { feature: "<ten-feature>", rereview: true }. ' +
      'Ví dụ feature hiện có: recurring-and-progression',
  )
}
const rereview = typeof args === 'object' && args ? !!args.rereview : false
const base = `docs/agent-artifacts/features/${feature}`
const reportFile = rereview ? `${base}/06-qa/re-review-report.md` : `${base}/06-qa/review-report.md`

log(`Feature: ${feature} · chế độ: ${rereview ? 're-review' : 'review lần đầu'}`)
log(`Report đích: ${reportFile}`)

// ---- Schemas ----
const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    acceptance_criteria: { type: 'array', items: { type: 'string' } },
    backend_rules: { type: 'array', items: { type: 'string' } },
    built_files: { type: 'array', items: { type: 'string' }, description: 'File Cursor đã build/đổi (từ build-report + git nếu có)' },
    test_strategy: { type: 'array', items: { type: 'string' } },
    dod: { type: 'array', items: { type: 'string' } },
    reported_tests_status: { type: 'string', description: 'Trạng thái test theo build-report (chưa tự chạy lại)' },
    open_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'acceptance_criteria', 'backend_rules', 'dod'],
  additionalProperties: false,
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          detail: { type: 'string' },
          suggested_fix: { type: 'string' },
        },
        required: ['title', 'severity', 'file', 'detail'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    confirmed: { type: 'boolean' },
    severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
    reason: { type: 'string' },
  },
  required: ['confirmed', 'severity', 'reason'],
  additionalProperties: false,
}

// ---- Các chiều review, bám CLAUDE.md + build-ready §3/§4/§5 ----
const DIMENSIONS = [
  {
    key: 'backend-rules',
    prompt:
      'Chiều BACKEND-RULES: kiểm business rule nhạy cảm có enforce ở backend không (role/permission/step-transition/no-skip/attachment); ' +
      'layering router→service/domain→repository có bị vi phạm; access control server-side (RLS hoặc tương đương) cho bảng nghiệp vụ; ' +
      'idempotency (unique award, ledger append-only), advisory lock, isolation theo family_id; audit trail cho thay đổi config/rule.',
  },
  {
    key: 'contract-trace',
    prompt:
      'Chiều CONTRACT-TRACE: API contract & hành vi có truy vết đúng PRD và acceptance criteria không; ' +
      'response shape khớp architecture; thiếu/thừa endpoint; sai role matrix so với PRD.',
  },
  {
    key: 'data-schema',
    prompt:
      'Chiều DATA-SCHEMA: migration/DDL có khớp schema.md; CHECK/UNIQUE/constraint đúng; ledger append-only; ' +
      'seed đúng; dữ liệu cũ vẫn hợp lệ sau migration; không có counter nguồn khi rule là derive-first.',
  },
  {
    key: 'frontend-states',
    prompt:
      'Chiều FRONTEND-STATES: mọi màn có đủ loading/empty/error; phân biệt earned vs locked; không hardcode secret ở FE; ' +
      'guard FE chỉ ẩn/hiện chứ không thay quyền backend; type-safe & contract-first; query key/invalidate hợp lý.',
  },
  {
    key: 'tests-dod',
    prompt:
      'Chiều TESTS-DOD: test coverage có khớp test strategy (unit rules, unit service idempotent, integration + quyền, race condition, migration); ' +
      'DoD đã thỏa (pytest/typecheck/lint xanh); có ca test thiếu cho rule quan trọng. ' +
      'Được phép CHẠY pytest/typecheck/lint ở chế độ đọc để xác nhận, nhưng TUYỆT ĐỐI KHÔNG sửa source.',
  },
]

// ================= Phase 1: Đọc artifacts =================
phase('Đọc artifacts')
const brief = await agent(
  `Bạn chuẩn bị ngữ cảnh cho một lượt REVIEW (không build) feature "${feature}" theo flow docs-first repo "Bé Ngoan".\n\n` +
    `Đọc TẤT CẢ artifacts theo thứ tự và build-report để biết Cursor đã build gì:\n` +
    `- ${base}/00-intake/request.md\n` +
    `- ${base}/01-product/prd.md\n` +
    `- ${base}/03-architecture/architecture.md\n` +
    `- ${base}/04-data/schema.md\n` +
    `- ${base}/05-build/build-ready.md\n` +
    `- ${base}/05-build/build-report.md (nếu có)\n` +
    (rereview ? `- ${base}/06-qa/review-report.md và ${base}/06-qa/resolve-plan.md (bản review trước để đối chiếu đã fix chưa)\n` : '') +
    `Đọc thêm CLAUDE.md, docs/agent-runbook.md và khảo sát code hiện hành (backend/app, frontend/src). Có thể dùng git để biết file đã đổi.\n\n` +
    `Trả brief đủ để reviewer làm việc: acceptance_criteria, backend_rules bắt buộc, built_files, test_strategy, dod, reported_tests_status, open_issues. KHÔNG sửa bất kỳ file nào.`,
  { schema: BRIEF_SCHEMA, phase: 'Đọc artifacts' },
)
const briefStr = JSON.stringify(brief, null, 2)
log(`Brief xong · ${(brief.acceptance_criteria || []).length} acceptance criteria · ${(brief.built_files || []).length} file đã build`)

// ================= Phase 2: Review song song =================
phase('Review')
const reviews = await parallel(
  DIMENSIONS.map((d) => () =>
    agent(
      `Review feature "${feature}"${rereview ? ' (RE-REVIEW: tập trung xác nhận các finding vòng trước đã fix chưa, và tìm regression)' : ''}, chỉ đúng chiều được giao.\n\n` +
        `BRIEF (acceptance criteria + rules + dod):\n${briefStr}\n\n` +
        `${d.prompt}\n\n` +
        `Đọc code THẬT liên quan (backend/app, frontend/src) và artifacts nếu cần. KHÔNG sửa source. ` +
        `Chỉ báo finding THẬT, có bằng chứng ở file:line. severity: blocker (sai rule bảo mật/nghiệp vụ, mất tiền/điểm, quyền sai) / major (lệch contract, thiếu state, thiếu test quan trọng) / minor / nit.`,
      { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA, effort: 'high' },
    ),
  ),
)

const raw = reviews.filter(Boolean).flatMap((r) => r.findings || [])
const seen = new Set()
const deduped = raw.filter((f) => {
  const k = `${(f.file || '').trim()}::${(f.title || '').trim().toLowerCase()}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
})
log(`${raw.length} finding thô → ${deduped.length} sau dedupe`)

// ================= Phase 3: Verify đối kháng =================
phase('Verify')
const verified = await parallel(
  deduped.map((f) => () =>
    agent(
      `Kiểm định đối kháng finding sau. Mặc định HOÀI NGHI: nếu không có bằng chứng rõ ở code, đánh confirmed=false.\n\n` +
        `Finding: ${JSON.stringify(f)}\n\n` +
        `BRIEF:\n${briefStr}\n\n` +
        `Đọc đúng file:line được nêu, xác minh có thật không, chốt lại severity cho đúng. Nếu false positive hoặc đã xử lý nơi khác → confirmed=false kèm lý do. KHÔNG sửa source.`,
      { label: `verify:${(f.file || '?').split('/').pop()}`, phase: 'Verify', schema: VERDICT_SCHEMA },
    ).then((v) => (v ? { ...f, severity: v.severity, confirmed: v.confirmed, verify_reason: v.reason } : null)),
  ),
)

const confirmed = verified.filter(Boolean).filter((f) => f.confirmed)
const blocking = confirmed.filter((f) => f.severity === 'blocker' || f.severity === 'major')
const verdict = blocking.length === 0 ? 'PASS' : 'FAIL'
log(`${confirmed.length} finding confirmed · ${blocking.length} blocking · verdict=${verdict}`)

// ================= Phase 4: Report =================
phase('Report')
await agent(
  `Ghi/cập nhật report review cho feature "${feature}" vào file: ${reportFile}. CHỈ ghi file report/resolve-plan, KHÔNG sửa source.\n\n` +
    `Verdict: ${verdict}.\n` +
    `Findings đã confirmed (đã verify):\n${JSON.stringify(confirmed, null, 2)}\n\n` +
    `Report cần: tóm tắt verdict + số finding theo severity; bảng finding kèm file:line, mô tả, hướng sửa; checklist DoD (${JSON.stringify(brief.dod)}); ` +
    `và mục "cho Cursor" liệt kê hành động resolve rõ ràng.\n` +
    (rereview ? `Vì là RE-REVIEW: nêu rõ finding nào ở vòng trước đã fix, finding nào còn, regression mới (nếu có).\n` : '') +
    (blocking.length > 0
      ? `Còn ${blocking.length} finding blocking → ghi/cập nhật resolve-plan cho Cursor tại ${base}/06-qa/resolve-plan.md, mỗi finding một mục hành động (file, thay đổi mong muốn, tiêu chí done).`
      : `Không còn blocking → ghi rõ trong report rằng feature đạt verdict PASS theo review; nếu resolve-plan cũ tồn tại thì đánh dấu đã hoàn tất.`),
  { label: `report:${rereview ? 're-review' : 'review'}`, phase: 'Report' },
)

return {
  feature,
  mode: rereview ? 're-review' : 'review',
  verdict,
  total_findings: confirmed.length,
  blocking: blocking.length,
  by_severity: {
    blocker: confirmed.filter((f) => f.severity === 'blocker').length,
    major: confirmed.filter((f) => f.severity === 'major').length,
    minor: confirmed.filter((f) => f.severity === 'minor').length,
    nit: confirmed.filter((f) => f.severity === 'nit').length,
  },
  reports: [reportFile, `${base}/06-qa/resolve-plan.md`],
  next_step: verdict === 'PASS' ? 'Chốt verdict PASS' : 'Cursor resolve theo resolve-plan, rồi chạy lại với rereview:true',
}

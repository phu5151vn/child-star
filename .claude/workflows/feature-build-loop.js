export const meta = {
  name: 'feature-build-loop',
  description: 'Đọc artifacts của một feature → build theo build-ready → review đa chiều → fix → re-review (loop tới khi PASS hoặc hết vòng)',
  whenToUse:
    'Khi một feature đã có đủ artifacts (intake/prd/architecture/schema/build-ready) và muốn chạy trọn chu trình build→review→fix→re-review có kiểm soát. Truyền tên feature qua args, ví dụ args: "recurring-and-progression" hoặc args: { feature: "recurring-and-progression", maxRounds: 3 }.',
  phases: [
    { title: 'Đọc artifacts', detail: 'Đọc toàn bộ stage docs + khảo sát code, chốt acceptance criteria & rules' },
    { title: 'Build', detail: 'Implement theo build-ready slices, chạy test/typecheck, cập nhật build-report' },
    { title: 'Review', detail: 'Review song song theo các chiều: backend-rules, contract-trace, data-schema, frontend-states, tests-dod' },
    { title: 'Verify', detail: 'Kiểm định đối kháng từng finding để loại false positive' },
    { title: 'Fix & Re-review', detail: 'Sửa các finding blocking/major rồi review lại, lặp tới khi hết vòng' },
  ],
}

// ---- Tham số ----
const feature = typeof args === 'string' ? args : args && args.feature
if (!feature) {
  throw new Error(
    'Thiếu tên feature. Chạy lại với args: "<ten-feature>" hoặc args: { feature: "<ten-feature>", maxRounds: 3 }. ' +
      'Ví dụ feature hiện có: recurring-and-progression',
  )
}
const maxRounds = (typeof args === 'object' && args && args.maxRounds) || 3
const base = `docs/agent-artifacts/features/${feature}`

log(`Feature: ${feature} · maxRounds: ${maxRounds}`)
log(`Artifacts base: ${base}`)

// ---- Schemas ----
const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    acceptance_criteria: { type: 'array', items: { type: 'string' } },
    backend_rules: { type: 'array', items: { type: 'string' } },
    files_to_touch: { type: 'array', items: { type: 'string' } },
    test_strategy: { type: 'array', items: { type: 'string' } },
    dod: { type: 'array', items: { type: 'string' } },
    open_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'acceptance_criteria', 'backend_rules', 'dod'],
  additionalProperties: false,
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    changed_files: { type: 'array', items: { type: 'string' } },
    slices_done: { type: 'array', items: { type: 'string' } },
    tests_status: { type: 'string', description: 'Kết quả pytest/typecheck/lint thực tế đã chạy' },
    tests_passed: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['changed_files', 'tests_status', 'tests_passed'],
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
      'DoD đã thỏa (pytest/typecheck/lint xanh); có ca test thiếu cho rule quan trọng.',
  },
]

// ================= Phase 1: Đọc artifacts =================
phase('Đọc artifacts')
const brief = await agent(
  `Bạn đang chuẩn bị ngữ cảnh cho một chu trình build feature theo flow docs-first của repo "Bé Ngoan".\n\n` +
    `Đọc TẤT CẢ artifacts của feature "${feature}" theo thứ tự và tổng hợp thành brief:\n` +
    `- ${base}/00-intake/request.md\n` +
    `- ${base}/01-product/prd.md\n` +
    `- ${base}/03-architecture/architecture.md\n` +
    `- ${base}/04-data/schema.md\n` +
    `- ${base}/05-build/build-ready.md\n` +
    `Đồng thời đọc CLAUDE.md, docs/agent-runbook.md và khảo sát nhanh code hiện hành (backend/app, frontend/src) đủ để biết cần đụng file nào.\n\n` +
    `Trả về brief cô đọng nhưng đủ để builder và reviewer làm việc mà không cần đọc lại toàn bộ: ` +
    `acceptance_criteria (từ PRD), backend_rules bắt buộc enforce, files_to_touch dự kiến, test_strategy, dod, open_issues.`,
  { schema: BRIEF_SCHEMA, phase: 'Đọc artifacts' },
)
const briefStr = JSON.stringify(brief, null, 2)
log(`Brief xong · ${(brief.acceptance_criteria || []).length} acceptance criteria · ${(brief.files_to_touch || []).length} file dự kiến`)

// ================= Phase 2: Build =================
phase('Build')
const build = await agent(
  `Bạn là dev implement feature "${feature}" theo build-ready plan. ĐÂY LÀ AGENT DUY NHẤT mutate code ở phase này.\n\n` +
    `BRIEF:\n${briefStr}\n\n` +
    `YÊU CẦU:\n` +
    `- Đọc kỹ ${base}/05-build/build-ready.md và implement theo đúng thứ tự vertical slices (0→N). Slice sau phụ thuộc slice trước — build tuần tự.\n` +
    `- Tuân thủ Architecture Rules & Data/Security Rules trong CLAUDE.md: rule nhạy cảm enforce ở backend, layering router→service→repository, ledger append-only, idempotency, isolation family_id, không hardcode secret ở FE.\n` +
    `- Frontend phải có đủ loading/empty/error states.\n` +
    `- Sau khi implement, CHẠY test/typecheck/lint thực tế (pytest cho backend, typecheck/lint cho frontend). Không được bịa kết quả.\n` +
    `- Cập nhật ${base}/05-build/build-report.md với những gì đã build, kết quả test, và deviation (nếu có).\n` +
    `- KHÔNG mở rộng scope ngoài artifacts đã approved.\n\n` +
    `Trả về: changed_files, slices_done, tests_status (output thật), tests_passed, notes.`,
  { schema: BUILD_SCHEMA, phase: 'Build' },
)
log(`Build xong · ${build.changed_files.length} file · tests_passed=${build.tests_passed}`)
if (!build.tests_passed) log(`⚠️ Test build chưa xanh: ${build.tests_status}`)

// ---- helper dedupe theo file+title ----
function keyOf(f) {
  return `${(f.file || '').trim()}::${(f.title || '').trim().toLowerCase()}`
}

// ================= Phase 3-5: Review → Verify → Fix (loop) =================
const rounds = []
let verdict = 'FAIL'

for (let round = 1; round <= maxRounds; round++) {
  const isFirst = round === 1
  phase('Review')
  log(`── Vòng ${round}/${maxRounds}: review ──`)

  // Review song song theo từng chiều
  const reviews = await parallel(
    DIMENSIONS.map((d) => () =>
      agent(
        `Review vòng ${round} cho feature "${feature}", chỉ tập trung đúng chiều được giao.\n\n` +
          `BRIEF (acceptance criteria + rules + dod):\n${briefStr}\n\n` +
          `File đã thay đổi ở build: ${JSON.stringify(build.changed_files)}\n\n` +
          `${d.prompt}\n\n` +
          `Đọc code thật liên quan (backend/app, frontend/src) và artifacts nếu cần. ` +
          `Chỉ báo finding THẬT, có bằng chứng ở file:line. severity: blocker (sai rule bảo mật/nghiệp vụ, mất tiền/điểm, quyền sai) / major (lệch contract, thiếu state, thiếu test quan trọng) / minor / nit.`,
        { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA, effort: 'high' },
      ),
    ),
  )

  const raw = reviews.filter(Boolean).flatMap((r) => r.findings || [])
  // dedupe theo file+title
  const seen = new Set()
  const deduped = raw.filter((f) => {
    const k = keyOf(f)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  log(`Vòng ${round}: ${raw.length} finding thô → ${deduped.length} sau dedupe`)

  // Verify đối kháng từng finding (barrier: cần toàn bộ verdict trước khi quyết fix)
  phase('Verify')
  const verified = await parallel(
    deduped.map((f) => () =>
      agent(
        `Kiểm định đối kháng finding sau. Mặc định HOÀI NGHI: nếu không có bằng chứng rõ ở code, đánh confirmed=false.\n\n` +
          `Finding: ${JSON.stringify(f)}\n\n` +
          `BRIEF:\n${briefStr}\n\n` +
          `Đọc đúng file:line được nêu, xác minh có thật không, và chốt lại severity cho đúng. ` +
          `Nếu là false positive hoặc đã được xử lý ở nơi khác → confirmed=false, nêu lý do.`,
        { label: `verify:${(f.file || '?').split('/').pop()}`, phase: 'Verify', schema: VERDICT_SCHEMA },
      ).then((v) => (v ? { ...f, severity: v.severity, confirmed: v.confirmed, verify_reason: v.reason } : null)),
    ),
  )

  const confirmed = verified.filter(Boolean).filter((f) => f.confirmed)
  const blocking = confirmed.filter((f) => f.severity === 'blocker' || f.severity === 'major')
  log(`Vòng ${round}: ${confirmed.length} finding confirmed · ${blocking.length} blocking(blocker/major)`)

  // Ghi report artifact cho vòng này
  const reportFile = isFirst ? `${base}/06-qa/review-report.md` : `${base}/06-qa/re-review-report.md`
  const passThisRound = blocking.length === 0 && build.tests_passed
  await agent(
    `Ghi/cập nhật report review vòng ${round} cho feature "${feature}" vào file: ${reportFile}.\n\n` +
      `Verdict vòng này: ${passThisRound ? 'PASS' : 'FAIL'} (build tests_passed=${build.tests_passed}).\n` +
      `Findings đã confirmed (đã verify): ${JSON.stringify(confirmed, null, 2)}\n\n` +
      `Report cần: tóm tắt verdict, bảng findings theo severity kèm file:line + hướng sửa, và checklist DoD (${JSON.stringify(brief.dod)}). ` +
      `Nếu còn blocking, viết thêm resolve-plan ngắn vào ${base}/06-qa/resolve-plan.md (mỗi finding một mục hành động). ` +
      `Chỉ ghi file, không sửa code.`,
    { label: `report:round-${round}`, phase: 'Verify' },
  )

  if (passThisRound) {
    verdict = 'PASS'
    rounds.push({ round, confirmed: confirmed.length, blocking: 0, action: 'pass' })
    log(`✅ Vòng ${round}: PASS — không còn finding blocking và test xanh.`)
    break
  }

  rounds.push({ round, confirmed: confirmed.length, blocking: blocking.length, action: round < maxRounds ? 'fix' : 'stop' })

  if (round === maxRounds) {
    log(`⛔ Hết ${maxRounds} vòng mà vẫn còn ${blocking.length} finding blocking — dừng, cần người xử lý.`)
    break
  }

  // Fix: 1 agent duy nhất mutate code theo resolve plan
  phase('Fix & Re-review')
  const fix = await agent(
    `Bạn là dev sửa lỗi theo resolve plan cho feature "${feature}". ĐÂY LÀ AGENT DUY NHẤT mutate code ở vòng fix này.\n\n` +
      `Các finding BLOCKING cần sửa (blocker/major đã verify):\n${JSON.stringify(blocking, null, 2)}\n\n` +
      `Nếu còn thời gian, xử lý luôn các finding minor confirmed: ${JSON.stringify(confirmed.filter((f) => f.severity === 'minor'))}\n\n` +
      `BRIEF:\n${briefStr}\n\n` +
      `YÊU CẦU: sửa đúng gốc rễ (không che triệu chứng), giữ layering & rule enforce ở backend, không mở rộng scope. ` +
      `Sau khi sửa CHẠY LẠI test/typecheck/lint thật và cập nhật ${base}/05-build/build-report.md. Trả về changed_files, tests_status, tests_passed, notes.`,
    { schema: BUILD_SCHEMA, phase: 'Fix & Re-review', effort: 'high' },
  )
  // cập nhật trạng thái build cho vòng review kế tiếp
  build.changed_files = Array.from(new Set([...(build.changed_files || []), ...(fix.changed_files || [])]))
  build.tests_status = fix.tests_status
  build.tests_passed = fix.tests_passed
  log(`Vòng ${round}: fix xong · tests_passed=${fix.tests_passed} · sang vòng ${round + 1}`)
}

return {
  feature,
  verdict,
  maxRounds,
  roundsRun: rounds.length,
  rounds,
  final_tests_passed: build.tests_passed,
  reports: [`${base}/06-qa/review-report.md`, `${base}/06-qa/re-review-report.md`, `${base}/06-qa/resolve-plan.md`],
}

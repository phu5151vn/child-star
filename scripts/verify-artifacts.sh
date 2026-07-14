#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-plan}"

common_required=(
  "$ROOT_DIR/docs/agent-artifacts/00-intake/request.md"
  "$ROOT_DIR/docs/agent-artifacts/01-product/prd.md"
)

plan_required=(
  "$ROOT_DIR/docs/agent-artifacts/02-design/ui-flow-spec.md"
  "$ROOT_DIR/docs/agent-artifacts/02-design/screen-inventory.md"
  "$ROOT_DIR/docs/agent-artifacts/02-design/navigation.json"
  "$ROOT_DIR/docs/agent-artifacts/02-design/states.md"
  "$ROOT_DIR/docs/agent-artifacts/02-design/component-inventory.md"
)

build_required=(
  "$ROOT_DIR/docs/agent-artifacts/02-design/ui-flow-spec.md"
  "$ROOT_DIR/docs/agent-artifacts/02-design/screen-inventory.md"
  "$ROOT_DIR/docs/agent-artifacts/02-design/navigation.json"
  "$ROOT_DIR/docs/agent-artifacts/02-design/states.md"
  "$ROOT_DIR/docs/agent-artifacts/02-design/component-inventory.md"
  "$ROOT_DIR/docs/agent-artifacts/03-architecture/architecture.md"
  "$ROOT_DIR/docs/agent-artifacts/04-data/schema.md"
  "$ROOT_DIR/docs/agent-artifacts/05-build/implementation-plan.md"
  "$ROOT_DIR/docs/agent-artifacts/05-build/build-ready.md"
)

review_required=(
  "$ROOT_DIR/docs/agent-artifacts/05-build/build-report.md"
)

required=("${common_required[@]}")
case "$MODE" in
  plan)
    required+=("${plan_required[@]}")
    ;;
  build)
    required+=("${build_required[@]}")
    ;;
  review)
    required+=("${build_required[@]}")
    required+=("${review_required[@]}")
    ;;
  *)
    echo "Mode không hợp lệ: $MODE"
    echo "Dùng: plan | build | review"
    exit 2
    ;;
esac

missing=0
for file in "${required[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Thiếu artifact bắt buộc: $file"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  exit 1
fi

case "$MODE" in
  plan)
    echo "Đủ artifact tối thiểu để chốt flow/product trước readiness kỹ thuật."
    ;;
  build)
    echo "Đủ artifact flow/architecture/data/build-ready để Cursor bắt đầu Stage Build."
    ;;
  review)
    echo "Đủ artifact để Claude bắt đầu Stage Review."
    ;;
esac

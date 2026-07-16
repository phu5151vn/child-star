from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import advisory_lock_child
from app.core.deps import AuthContext, require_owner_child
from app.core.exceptions import (
    InsufficientPointsError,
    InvalidTransitionError,
    NotFoundError,
    ProofRequiredError,
)
from app.core.integrity import is_unique_violation
from app.core.timeutil import is_completed_current_period
from app.models import Media, PointsLedger, Task, TaskAssignment, User
from app.repositories.base import (
    AuditRepository,
    PointsRepository,
    get_assignment_in_family,
    get_task_in_family,
)
from app.schemas import AssignmentResponse, LedgerEntry, SubmitAssignmentRequest, TaskResponse
from app.services.media_service import MediaService
from app.services.weekly_service import WeeklyService


def _discard_proof(db: Session, assignment: TaskAssignment) -> None:
    """Xóa ảnh minh chứng sau khi đã quyết định (approve/reject) — không còn giá trị xem lại.

    Gỡ tham chiếu FK trước rồi xóa object + dòng media (best-effort, không chặn nghiệp vụ).
    """
    proof_id = assignment.proof_media_id
    if not proof_id:
        return
    assignment.proof_media_id = None
    db.commit()
    MediaService.delete_media(db, proof_id)


def _child_assignment_state(task: Task, assignment: "TaskAssignment | None") -> tuple[str, "UUID | None"]:
    """Trạng thái nhiệm vụ hiển thị cho con dựa trên assignment mới nhất + kiểu lặp lại."""
    if not assignment:
        return "available", None
    if assignment.status in ("in_progress", "submitted"):
        return assignment.status, assignment.id
    if assignment.status == "approved":
        if is_completed_current_period(task.recurrence, assignment.decided_at):
            return "approved", assignment.id
        # Nhiệm vụ lặp lại đã sang chu kỳ mới -> mở lại cho con nhận tiếp
        return "available", None
    # rejected: cho phép làm lại
    return "available", None

ASSIGNMENT_TRANSITIONS = {
    "in_progress": {"submitted"},
    "submitted": {"approved", "rejected"},
    "rejected": {"in_progress"},
}


def assert_transition(current: str, target: str) -> None:
    allowed = ASSIGNMENT_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidTransitionError()


class TaskService:
    @staticmethod
    def list_tasks(db: Session, ctx: AuthContext) -> list[TaskResponse]:
        tasks = db.scalars(
            select(Task).where(Task.family_id == ctx.family_id).order_by(Task.created_at.desc())
        ).all()
        result = []
        for task in tasks:
            assignment_status = None
            assignment_id = None
            if ctx.role == "child" and ctx.child_id:
                if not task.is_active:
                    continue
                assignment = db.scalar(
                    select(TaskAssignment).where(
                        TaskAssignment.task_id == task.id,
                        TaskAssignment.child_id == ctx.child_id,
                    ).order_by(TaskAssignment.created_at.desc())
                )
                assignment_status, assignment_id = _child_assignment_state(task, assignment)
            result.append(
                TaskResponse(
                    id=task.id,
                    title=task.title,
                    description=task.description,
                    points=task.points,
                    icon_media_id=task.icon_media_id,
                    icon_emoji=task.icon_emoji,
                    recurrence=task.recurrence,
                    require_proof=task.require_proof,
                    is_active=task.is_active,
                    assignment_status=assignment_status,
                    assignment_id=assignment_id,
                )
            )
        return result

    @staticmethod
    def get_task(db: Session, ctx: AuthContext, task_id: UUID) -> TaskResponse:
        task = get_task_in_family(db, task_id, ctx.family_id)
        if not task:
            raise NotFoundError()
        assignment_status = None
        assignment_id = None
        if ctx.role == "child" and ctx.child_id:
            assignment = db.scalar(
                select(TaskAssignment).where(
                    TaskAssignment.task_id == task.id,
                    TaskAssignment.child_id == ctx.child_id,
                ).order_by(TaskAssignment.created_at.desc())
            )
            assignment_status, assignment_id = _child_assignment_state(task, assignment)
        return TaskResponse(
            id=task.id,
            title=task.title,
            description=task.description,
            points=task.points,
            icon_media_id=task.icon_media_id,
            icon_emoji=task.icon_emoji,
            recurrence=task.recurrence,
            require_proof=task.require_proof,
            is_active=task.is_active,
            assignment_status=assignment_status,
            assignment_id=assignment_id,
        )

    @staticmethod
    def create_task(db: Session, ctx: AuthContext, data) -> TaskResponse:
        task = Task(
            family_id=ctx.family_id,
            title=data.title,
            description=data.description,
            points=data.points,
            icon_media_id=data.icon_media_id,
            icon_emoji=data.icon_emoji,
            recurrence=data.recurrence,
            require_proof=data.require_proof,
            is_active=data.is_active,
            created_by=ctx.user_id,
        )
        db.add(task)
        db.flush()
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="task.create", entity_type="task", entity_id=task.id,
            changes={"title": task.title, "points": task.points},
        )
        db.commit()
        return TaskResponse.model_validate(task)

    @staticmethod
    def update_task(db: Session, ctx: AuthContext, task_id: UUID, data) -> TaskResponse:
        task = get_task_in_family(db, task_id, ctx.family_id)
        if not task:
            raise NotFoundError()
        before = {"title": task.title, "points": task.points, "is_active": task.is_active}
        for field in ("title", "description", "points", "icon_media_id", "icon_emoji", "recurrence", "require_proof", "is_active"):
            val = getattr(data, field, None)
            if val is not None:
                setattr(task, field, val)
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="task.update", entity_type="task", entity_id=task.id,
            changes={"before": before},
        )
        db.commit()
        return TaskResponse.model_validate(task)

    @staticmethod
    def delete_task(db: Session, ctx: AuthContext, task_id: UUID) -> None:
        task = get_task_in_family(db, task_id, ctx.family_id)
        if not task:
            raise NotFoundError()
        task.is_active = False
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="task.delete", entity_type="task", entity_id=task.id, changes={},
        )
        db.commit()


class AssignmentService:
    @staticmethod
    def list_assignments(
        db: Session, ctx: AuthContext, child_id: UUID | None = None, status: str | None = None
    ) -> list[AssignmentResponse]:
        q = select(TaskAssignment).where(TaskAssignment.family_id == ctx.family_id)
        if ctx.role == "child":
            q = q.where(TaskAssignment.child_id == ctx.child_id)
        elif child_id:
            q = q.where(TaskAssignment.child_id == child_id)
        if status:
            q = q.where(TaskAssignment.status == status)
        assignments = db.scalars(q.order_by(TaskAssignment.created_at.desc())).all()
        result = []
        for a in assignments:
            task = db.get(Task, a.task_id) if a.task_id else None
            child = db.get(User, a.child_id)
            result.append(
                AssignmentResponse(
                    id=a.id,
                    task_id=a.task_id,
                    child_id=a.child_id,
                    status=a.status,
                    task_title=task.title if task else a.custom_title,
                    task_points=task.points if task else None,
                    task_emoji=task.icon_emoji if task else "✨",
                    child_name=child.display_name if child else None,
                    child_gender=child.gender if child else None,
                    proof_media_id=a.proof_media_id,
                    reject_reason=a.reject_reason,
                    submitted_at=a.submitted_at,
                    decided_at=a.decided_at,
                    is_custom=a.task_id is None,
                )
            )
        return result

    @staticmethod
    def claim(db: Session, ctx: AuthContext, task_id: UUID) -> AssignmentResponse:
        task = get_task_in_family(db, task_id, ctx.family_id)
        if not task or not task.is_active:
            raise NotFoundError("Nhiệm vụ không khả dụng")
        if not ctx.child_id:
            raise InvalidTransitionError()
        existing = db.scalar(
            select(TaskAssignment).where(
                TaskAssignment.task_id == task_id,
                TaskAssignment.child_id == ctx.child_id,
                TaskAssignment.status.in_(("in_progress", "submitted")),
            )
        )
        if existing:
            raise InvalidTransitionError("Đã nhận nhiệm vụ này rồi")
        approved = db.scalar(
            select(TaskAssignment).where(
                TaskAssignment.task_id == task_id,
                TaskAssignment.child_id == ctx.child_id,
                TaskAssignment.status == "approved",
            ).order_by(TaskAssignment.decided_at.desc())
        )
        if approved and is_completed_current_period(task.recurrence, approved.decided_at):
            messages = {
                "once": "Nhiệm vụ đã hoàn thành",
                "daily": "Hôm nay con đã hoàn thành rồi, mai làm tiếp nhé!",
                "weekly": "Tuần này con đã hoàn thành nhiệm vụ này rồi!",
            }
            raise InvalidTransitionError(messages.get(task.recurrence, "Nhiệm vụ đã hoàn thành"))
        assignment = TaskAssignment(
            family_id=ctx.family_id,
            task_id=task_id,
            child_id=ctx.child_id,
            status="in_progress",
        )
        try:
            db.add(assignment)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_assignment_active"):
                raise InvalidTransitionError("Đã nhận nhiệm vụ này rồi") from exc
            raise
        return AssignmentResponse(
            id=assignment.id,
            task_id=assignment.task_id,
            child_id=assignment.child_id,
            status=assignment.status,
            task_title=task.title,
            task_points=task.points,
        )

    @staticmethod
    def submit(db: Session, ctx: AuthContext, assignment_id: UUID, data: SubmitAssignmentRequest) -> AssignmentResponse:
        assignment = get_assignment_in_family(db, assignment_id, ctx.family_id)
        if not assignment or assignment.child_id != ctx.child_id:
            raise NotFoundError()
        if assignment.status != "in_progress":
            raise InvalidTransitionError()
        assert_transition(assignment.status, "submitted")
        task = db.get(Task, assignment.task_id)
        if task and task.require_proof and not data.proof_media_id:
            raise ProofRequiredError()
        if data.proof_media_id is not None:
            media = db.get(Media, data.proof_media_id)
            if (
                not media
                or media.family_id != ctx.family_id
                or media.kind != "proof"
                or media.uploaded_by != ctx.user_id
            ):
                raise NotFoundError("Ảnh minh chứng không hợp lệ")
        assignment.status = "submitted"
        assignment.proof_media_id = data.proof_media_id
        assignment.submitted_at = datetime.now(timezone.utc)
        db.commit()
        return AssignmentService._to_response(db, assignment)

    @staticmethod
    def approve(
        db: Session, ctx: AuthContext, assignment_id: UUID, points: int | None = None
    ) -> AssignmentResponse:
        assignment = get_assignment_in_family(db, assignment_id, ctx.family_id)
        if not assignment:
            raise NotFoundError()

        advisory_lock_child(db, assignment.child_id)

        if assignment.status == "approved" or PointsRepository.has_ledger_for_assignment(db, assignment.id):
            if assignment.status != "approved":
                assignment.status = "approved"
                assignment.decided_at = datetime.now(timezone.utc)
                assignment.decided_by = ctx.user_id
                db.commit()
            return AssignmentService._to_response(db, assignment)

        if assignment.status != "submitted":
            raise InvalidTransitionError()
        assert_transition(assignment.status, "approved")

        task = db.get(Task, assignment.task_id) if assignment.task_id else None
        if assignment.task_id is None:
            # Nhiệm vụ tự do: bố mẹ phải nhập số sao thưởng (> 0).
            if not points or points <= 0:
                raise InvalidTransitionError("Cần nhập số sao để duyệt nhiệm vụ này")
            points_delta = points
        else:
            points_delta = task.points if task else 0
        assignment.status = "approved"
        assignment.decided_at = datetime.now(timezone.utc)
        assignment.decided_by = ctx.user_id

        try:
            db.add(
                PointsLedger(
                    family_id=ctx.family_id,
                    child_id=assignment.child_id,
                    delta=points_delta,
                    kind="task_approved",
                    task_assignment_id=assignment.id,
                    created_by=ctx.user_id,
                )
            )
            AuditRepository.log(
                db,
                family_id=ctx.family_id,
                actor_id=ctx.user_id,
                action="assignment.approve",
                entity_type="assignment",
                entity_id=assignment.id,
                changes={"points_delta": points_delta},
            )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_ledger_task_approved"):
                db.refresh(assignment)
                return AssignmentService._to_response(db, assignment)
            raise

        # Sau khi cộng điểm nhiệm vụ, kiểm tra mục tiêu tuần để trao bonus nếu đạt.
        WeeklyService.maybe_award_bonus(db, ctx.family_id, ctx.user_id, assignment.child_id)

        # Ảnh minh chứng đã dùng xong để duyệt -> xóa để tiết kiệm lưu trữ.
        _discard_proof(db, assignment)

        return AssignmentService._to_response(db, assignment)

    @staticmethod
    def reject(db: Session, ctx: AuthContext, assignment_id: UUID, reason: str | None) -> AssignmentResponse:
        assignment = get_assignment_in_family(db, assignment_id, ctx.family_id)
        if not assignment:
            raise NotFoundError()
        if assignment.status != "submitted":
            raise InvalidTransitionError()
        assert_transition(assignment.status, "rejected")
        assignment.status = "rejected"
        assignment.reject_reason = reason
        assignment.decided_at = datetime.now(timezone.utc)
        assignment.decided_by = ctx.user_id
        AuditRepository.log(
            db,
            family_id=ctx.family_id,
            actor_id=ctx.user_id,
            action="assignment.reject",
            entity_type="assignment",
            entity_id=assignment.id,
            changes={"reason": reason},
        )
        db.commit()
        # Create new in_progress for retry
        new_assignment = TaskAssignment(
            family_id=ctx.family_id,
            task_id=assignment.task_id,
            child_id=assignment.child_id,
            status="in_progress",
        )
        db.add(new_assignment)
        db.commit()
        # Ảnh minh chứng của lần bị từ chối không cần giữ (con sẽ gửi ảnh mới khi làm lại).
        _discard_proof(db, assignment)
        return AssignmentService._to_response(db, assignment)

    @staticmethod
    def create_custom(
        db: Session, ctx: AuthContext, title: str, proof_media_id: UUID | None = None
    ) -> AssignmentResponse:
        """Con đề xuất nhiệm vụ ngoài danh sách (task_id=NULL), vào thẳng 'submitted' chờ duyệt.

        Bố mẹ nhập số sao thưởng khi duyệt.
        """
        if not ctx.child_id:
            raise InvalidTransitionError()
        if proof_media_id is not None:
            media = db.get(Media, proof_media_id)
            if not media or media.family_id != ctx.family_id or media.kind != "proof" or media.uploaded_by != ctx.user_id:
                raise NotFoundError("Ảnh minh chứng không hợp lệ")
        assignment = TaskAssignment(
            family_id=ctx.family_id,
            task_id=None,
            custom_title=title.strip(),
            child_id=ctx.child_id,
            status="submitted",
            proof_media_id=proof_media_id,
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(assignment)
        db.commit()
        return AssignmentService._to_response(db, assignment)

    @staticmethod
    def _to_response(db: Session, assignment: TaskAssignment) -> AssignmentResponse:
        task = db.get(Task, assignment.task_id) if assignment.task_id else None
        child = db.get(User, assignment.child_id)
        return AssignmentResponse(
            id=assignment.id,
            task_id=assignment.task_id,
            child_id=assignment.child_id,
            status=assignment.status,
            task_title=task.title if task else assignment.custom_title,
            task_points=task.points if task else None,
            task_emoji=task.icon_emoji if task else "✨",
            child_name=child.display_name if child else None,
            child_gender=child.gender if child else None,
            proof_media_id=assignment.proof_media_id,
            reject_reason=assignment.reject_reason,
            submitted_at=assignment.submitted_at,
            decided_at=assignment.decided_at,
            is_custom=assignment.task_id is None,
        )


class PointsService:
    @staticmethod
    def get_balance(db: Session, ctx: AuthContext, child_id: UUID) -> int:
        require_owner_child(child_id, ctx)
        child = db.scalar(
            select(User).where(User.id == child_id, User.family_id == ctx.family_id, User.role == "child")
        )
        if not child:
            raise NotFoundError()
        return PointsRepository.get_balance(db, child_id)

    @staticmethod
    def get_ledger(db: Session, ctx: AuthContext, child_id: UUID, limit: int = 50) -> list[LedgerEntry]:
        require_owner_child(child_id, ctx)
        entries = db.scalars(
            select(PointsLedger)
            .where(PointsLedger.child_id == child_id, PointsLedger.family_id == ctx.family_id)
            .order_by(PointsLedger.created_at.desc())
            .limit(limit)
        ).all()
        return [LedgerEntry.model_validate(e) for e in entries]

    @staticmethod
    def manual_adjust(db: Session, ctx: AuthContext, child_id: UUID, delta: int, reason: str) -> int:
        child = db.scalar(
            select(User).where(User.id == child_id, User.family_id == ctx.family_id, User.role == "child")
        )
        if not child:
            raise NotFoundError()
        if delta < 0:
            advisory_lock_child(db, child_id)
            balance = PointsRepository.get_balance(db, child_id)
            if balance + delta < 0:
                raise InsufficientPointsError()
        db.add(
            PointsLedger(
                family_id=ctx.family_id,
                child_id=child_id,
                delta=delta,
                kind="manual_adjust",
                reason=reason,
                created_by=ctx.user_id,
            )
        )
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="points.manual_adjust", entity_type="child", entity_id=child_id,
            changes={"delta": delta, "reason": reason},
        )
        db.commit()
        return PointsRepository.get_balance(db, child_id)

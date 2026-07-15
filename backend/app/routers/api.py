from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.db import get_db
from app.core.deps import AuthContext, get_auth_context, require_role
from app.core.exceptions import DomainError, NotFoundError
from app.core.rate_limit import check_login_rate_limit
from app.schemas import (
    AssignmentResponse,
    BalanceResponse,
    ChildCreate,
    ChildLoginRequest,
    ChildProfile,
    ChildResponse,
    ChildUpdate,
    FamilyResponse,
    GameCreateRequest,
    GameMatchResponse,
    GameMoveRequest,
    GameOfferRequest,
    GameOfferRespondRequest,
    GameSummaryResponse,
    LedgerEntry,
    ManualAdjustRequest,
    MeResponse,
    ParentLoginRequest,
    RedemptionResponse,
    RegisterRequest,
    RejectAssignmentRequest,
    RejectRedemptionRequest,
    RewardCreate,
    RewardResponse,
    RewardUpdate,
    SubmitAssignmentRequest,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    TokenResponse,
    WeeklyGoalResponse,
    WeeklyGoalUpsert,
    WeeklyProgressResponse,
)
from app.services.auth_service import AuthService, ChildrenService
from app.services.game_service import GameService
from app.services.media_service import MediaService
from app.services.reward_service import RedemptionService, RewardService
from app.services.task_service import AssignmentService, PointsService, TaskService
from app.services.weekly_service import WeeklyService

router = APIRouter()


def _handle_domain(exc: DomainError):
    from fastapi import HTTPException

    raise HTTPException(
        status_code=exc.status_code,
        detail={"error_code": exc.error_code, "message": exc.message},
    )


# Auth
@router.post("/auth/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    token, code = AuthService.register(db, data)
    return TokenResponse(access_token=token, family_code=code)


@router.post("/auth/parent/login", response_model=TokenResponse)
def parent_login(data: ParentLoginRequest, request: Request, db: Session = Depends(get_db)):
    check_login_rate_limit(request, f"parent:{data.email.lower()}")
    try:
        token = AuthService.parent_login(db, data.email, data.password)
        return TokenResponse(access_token=token)
    except DomainError as e:
        _handle_domain(e)


@router.get("/auth/child/profiles", response_model=list[ChildProfile])
def child_profiles(family_code: str = Query(...), db: Session = Depends(get_db)):
    try:
        return AuthService.child_profiles(db, family_code)
    except DomainError as e:
        _handle_domain(e)


@router.post("/auth/child/login", response_model=TokenResponse)
def child_login(data: ChildLoginRequest, request: Request, db: Session = Depends(get_db)):
    check_login_rate_limit(request, f"child:{data.family_code.upper()}:{data.child_id}")
    try:
        token = AuthService.child_login(db, data.family_code, data.child_id, data.pin)
        return TokenResponse(access_token=token)
    except DomainError as e:
        _handle_domain(e)


@router.get("/me", response_model=MeResponse)
def me(ctx: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)):
    return AuthService.me(db, ctx)


# Family & children
@router.get("/family", response_model=FamilyResponse)
def get_family(ctx: AuthContext = Depends(require_role("parent")), db: Session = Depends(get_db)):
    return ChildrenService.get_family(db, ctx)


@router.get("/children", response_model=list[ChildResponse])
def list_children(ctx: AuthContext = Depends(require_role("parent")), db: Session = Depends(get_db)):
    return ChildrenService.list_children(db, ctx)


@router.post("/children", response_model=ChildResponse)
def create_child(
    data: ChildCreate,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    return ChildrenService.create_child(db, ctx, data)


@router.patch("/children/{child_id}", response_model=ChildResponse)
def update_child(
    child_id: UUID,
    data: ChildUpdate,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    return ChildrenService.update_child(db, ctx, child_id, data)


@router.get("/children/{child_id}/balance", response_model=BalanceResponse)
def get_balance(
    child_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        balance = PointsService.get_balance(db, ctx, child_id)
        return BalanceResponse(child_id=child_id, balance=balance)
    except DomainError as e:
        _handle_domain(e)


@router.get("/children/{child_id}/ledger", response_model=list[LedgerEntry])
def get_ledger(
    child_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return PointsService.get_ledger(db, ctx, child_id)
    except DomainError as e:
        _handle_domain(e)


@router.post("/children/{child_id}/adjust")
def manual_adjust(
    child_id: UUID,
    data: ManualAdjustRequest,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        balance = PointsService.manual_adjust(db, ctx, child_id, data.delta, data.reason)
        return {"child_id": child_id, "balance": balance}
    except DomainError as e:
        _handle_domain(e)


# Weekly goal & progress
@router.get("/weekly-goal", response_model=WeeklyGoalResponse)
def get_weekly_goal(ctx: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)):
    return WeeklyService.get_goal(db, ctx.family_id)


@router.put("/weekly-goal", response_model=WeeklyGoalResponse)
def upsert_weekly_goal(
    data: WeeklyGoalUpsert,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    return WeeklyService.upsert_goal(db, ctx, data)


@router.get("/weekly-progress", response_model=WeeklyProgressResponse)
def get_weekly_progress(
    child_id: UUID | None = None,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    target = child_id or ctx.child_id
    if not target:
        _handle_domain(NotFoundError("Thiếu child_id"))
    try:
        return WeeklyService.get_progress(db, ctx, target)
    except DomainError as e:
        _handle_domain(e)


# Tasks
@router.get("/tasks", response_model=list[TaskResponse])
def list_tasks(ctx: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)):
    return TaskService.list_tasks(db, ctx)


@router.post("/tasks", response_model=TaskResponse)
def create_task(
    data: TaskCreate,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    return TaskService.create_task(db, ctx, data)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return TaskService.get_task(db, ctx, task_id)
    except DomainError as e:
        _handle_domain(e)


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: UUID,
    data: TaskUpdate,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        return TaskService.update_task(db, ctx, task_id, data)
    except DomainError as e:
        _handle_domain(e)


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: UUID,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        TaskService.delete_task(db, ctx, task_id)
        return {"ok": True}
    except DomainError as e:
        _handle_domain(e)


@router.post("/tasks/{task_id}/claim", response_model=AssignmentResponse)
def claim_task(
    task_id: UUID,
    ctx: AuthContext = Depends(require_role("child")),
    db: Session = Depends(get_db),
):
    try:
        return AssignmentService.claim(db, ctx, task_id)
    except DomainError as e:
        _handle_domain(e)


# Assignments
@router.get("/assignments", response_model=list[AssignmentResponse])
def list_assignments(
    child_id: UUID | None = None,
    status: str | None = None,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    return AssignmentService.list_assignments(db, ctx, child_id, status)


@router.post("/assignments/{assignment_id}/submit", response_model=AssignmentResponse)
def submit_assignment(
    assignment_id: UUID,
    data: SubmitAssignmentRequest,
    ctx: AuthContext = Depends(require_role("child")),
    db: Session = Depends(get_db),
):
    try:
        return AssignmentService.submit(db, ctx, assignment_id, data)
    except DomainError as e:
        _handle_domain(e)


@router.post("/assignments/{assignment_id}/approve", response_model=AssignmentResponse)
def approve_assignment(
    assignment_id: UUID,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        return AssignmentService.approve(db, ctx, assignment_id)
    except DomainError as e:
        _handle_domain(e)


@router.post("/assignments/{assignment_id}/reject", response_model=AssignmentResponse)
def reject_assignment(
    assignment_id: UUID,
    data: RejectAssignmentRequest,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        return AssignmentService.reject(db, ctx, assignment_id, data.reason)
    except DomainError as e:
        _handle_domain(e)


# Rewards
@router.get("/rewards", response_model=list[RewardResponse])
def list_rewards(ctx: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)):
    return RewardService.list_rewards(db, ctx)


@router.post("/rewards", response_model=RewardResponse)
def create_reward(
    data: RewardCreate,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    return RewardService.create_reward(db, ctx, data)


@router.get("/rewards/{reward_id}", response_model=RewardResponse)
def get_reward(
    reward_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return RewardService.get_reward(db, ctx, reward_id)
    except DomainError as e:
        _handle_domain(e)


@router.put("/rewards/{reward_id}", response_model=RewardResponse)
def update_reward(
    reward_id: UUID,
    data: RewardUpdate,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        return RewardService.update_reward(db, ctx, reward_id, data)
    except DomainError as e:
        _handle_domain(e)


@router.delete("/rewards/{reward_id}")
def delete_reward(
    reward_id: UUID,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        RewardService.delete_reward(db, ctx, reward_id)
        return {"ok": True}
    except DomainError as e:
        _handle_domain(e)


@router.post("/rewards/{reward_id}/redeem", response_model=RedemptionResponse)
def redeem_reward(
    reward_id: UUID,
    ctx: AuthContext = Depends(require_role("child")),
    db: Session = Depends(get_db),
):
    try:
        return RedemptionService.redeem(db, ctx, reward_id)
    except DomainError as e:
        _handle_domain(e)


# Redemptions
@router.get("/redemptions", response_model=list[RedemptionResponse])
def list_redemptions(
    child_id: UUID | None = None,
    status: str | None = None,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    return RedemptionService.list_redemptions(db, ctx, child_id, status)


@router.post("/redemptions/{redemption_id}/approve", response_model=RedemptionResponse)
def approve_redemption(
    redemption_id: UUID,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        return RedemptionService.approve(db, ctx, redemption_id)
    except DomainError as e:
        _handle_domain(e)


@router.post("/redemptions/{redemption_id}/reject", response_model=RedemptionResponse)
def reject_redemption(
    redemption_id: UUID,
    data: RejectRedemptionRequest,
    ctx: AuthContext = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    try:
        return RedemptionService.reject(db, ctx, redemption_id, data.reason)
    except DomainError as e:
        _handle_domain(e)


@router.post("/redemptions/{redemption_id}/cancel", response_model=RedemptionResponse)
def cancel_redemption(
    redemption_id: UUID,
    ctx: AuthContext = Depends(require_role("child")),
    db: Session = Depends(get_db),
):
    try:
        return RedemptionService.cancel(db, ctx, redemption_id)
    except DomainError as e:
        _handle_domain(e)


# Games (cờ caro & cờ vua) — cả 2 role đều chơi được
@router.post("/games", response_model=GameMatchResponse)
def create_game(
    data: GameCreateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return GameService.create_match(db, ctx, data)
    except DomainError as e:
        _handle_domain(e)


@router.get("/games", response_model=list[GameSummaryResponse])
def list_games(
    status: str | None = None,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    return GameService.list_matches(db, ctx, status)


@router.get("/games/{match_id}", response_model=GameMatchResponse)
def get_game(
    match_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return GameService.get_match(db, ctx, match_id)
    except DomainError as e:
        _handle_domain(e)


@router.post("/games/{match_id}/join", response_model=GameMatchResponse)
def join_game(
    match_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return GameService.join_match(db, ctx, match_id)
    except DomainError as e:
        _handle_domain(e)


@router.post("/games/{match_id}/move", response_model=GameMatchResponse)
def move_game(
    match_id: UUID,
    data: GameMoveRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return GameService.make_move(db, ctx, match_id, data)
    except DomainError as e:
        _handle_domain(e)


@router.post("/games/{match_id}/resign", response_model=GameMatchResponse)
def resign_game(
    match_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return GameService.resign(db, ctx, match_id)
    except DomainError as e:
        _handle_domain(e)


@router.post("/games/{match_id}/offer", response_model=GameMatchResponse)
def offer_game(
    match_id: UUID,
    data: GameOfferRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return GameService.offer_action(db, ctx, match_id, data.kind)
    except DomainError as e:
        _handle_domain(e)


@router.post("/games/{match_id}/offer/respond", response_model=GameMatchResponse)
def respond_offer_game(
    match_id: UUID,
    data: GameOfferRespondRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        return GameService.respond_offer(db, ctx, match_id, data.accept)
    except DomainError as e:
        _handle_domain(e)


# Media
@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    kind: str = Form(...),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        media_id = await MediaService.upload(db, ctx, file, kind)
        return {"media_id": media_id}
    except ValueError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=str(e))


@router.get("/media/{media_id}")
def get_media(
    media_id: UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    try:
        path, mime = MediaService.get_media_path(db, ctx, media_id)
        return FileResponse(path, media_type=mime)
    except DomainError as e:
        _handle_domain(e)

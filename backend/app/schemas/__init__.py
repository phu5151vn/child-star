from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ErrorResponse(BaseModel):
    error_code: str
    message: str


# Auth
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    family_name: str = Field(min_length=1)
    display_name: str = Field(min_length=1)


class ParentLoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChildLoginRequest(BaseModel):
    family_code: str
    child_id: UUID
    pin: str = Field(min_length=4, max_length=4)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    family_code: str | None = None


class ChildProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    avatar_media_id: UUID | None = None
    gender: str | None = None


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    display_name: str
    gender: str | None = None
    family_id: UUID
    family_code: str | None = None
    child_id: UUID | None = None
    balance: int | None = None


# Children
class ChildCreate(BaseModel):
    display_name: str = Field(min_length=1)
    pin: str = Field(min_length=4, max_length=4)
    avatar_media_id: UUID | None = None
    gender: str | None = None

    @field_validator("gender")
    @classmethod
    def valid_gender(cls, v: str | None) -> str | None:
        if v is not None and v not in ("male", "female"):
            raise ValueError("gender phải là 'male' hoặc 'female'")
        return v


class ChildUpdate(BaseModel):
    display_name: str | None = None
    pin: str | None = Field(default=None, min_length=4, max_length=4)
    avatar_media_id: UUID | None = None
    gender: str | None = None
    is_active: bool | None = None

    @field_validator("gender")
    @classmethod
    def valid_gender(cls, v: str | None) -> str | None:
        if v is not None and v not in ("male", "female"):
            raise ValueError("gender phải là 'male' hoặc 'female'")
        return v


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    avatar_media_id: UUID | None = None
    gender: str | None = None
    is_active: bool
    balance: int = 0
    weekly_completed: int = 0


class BalanceResponse(BaseModel):
    child_id: UUID
    balance: int


class ManualAdjustRequest(BaseModel):
    delta: int
    reason: str = Field(min_length=1)

    @field_validator("delta")
    @classmethod
    def delta_nonzero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("delta phải khác 0")
        return v


# Tasks
_RECURRENCE_VALUES = ("once", "daily", "weekly")


def _validate_recurrence(v: str | None) -> str | None:
    if v is not None and v not in _RECURRENCE_VALUES:
        raise ValueError("recurrence phải là 'once', 'daily' hoặc 'weekly'")
    return v


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str | None = None
    points: int = Field(gt=0)
    icon_media_id: UUID | None = None
    icon_emoji: str | None = Field(default=None, max_length=16)
    recurrence: str = "once"
    require_proof: bool = False
    is_active: bool = True

    @field_validator("recurrence")
    @classmethod
    def _v_rec(cls, v: str | None) -> str | None:
        return _validate_recurrence(v)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    points: int | None = Field(default=None, gt=0)
    icon_media_id: UUID | None = None
    icon_emoji: str | None = Field(default=None, max_length=16)
    recurrence: str | None = None
    require_proof: bool | None = None
    is_active: bool | None = None

    @field_validator("recurrence")
    @classmethod
    def _v_rec(cls, v: str | None) -> str | None:
        return _validate_recurrence(v)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    points: int
    icon_media_id: UUID | None = None
    icon_emoji: str | None = None
    recurrence: str = "once"
    require_proof: bool
    is_active: bool
    assignment_status: str | None = None
    assignment_id: UUID | None = None


# Assignments
class SubmitAssignmentRequest(BaseModel):
    proof_media_id: UUID | None = None


class RejectAssignmentRequest(BaseModel):
    reason: str | None = None


class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    child_id: UUID
    status: str
    task_title: str | None = None
    task_points: int | None = None
    task_emoji: str | None = None
    child_name: str | None = None
    child_gender: str | None = None
    proof_media_id: UUID | None = None
    reject_reason: str | None = None
    submitted_at: datetime | None = None
    decided_at: datetime | None = None


# Rewards
class RewardCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    required_points: int = Field(gt=0)
    image_media_id: UUID | None = None
    icon_emoji: str | None = Field(default=None, max_length=16)
    stock: int | None = Field(default=None, ge=0)
    is_active: bool = True


class RewardUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    required_points: int | None = Field(default=None, gt=0)
    image_media_id: UUID | None = None
    icon_emoji: str | None = Field(default=None, max_length=16)
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class RewardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    required_points: int
    image_media_id: UUID | None = None
    icon_emoji: str | None = None
    stock: int | None = None
    is_active: bool
    is_unlocked: bool | None = None
    missing_points: int | None = None
    is_out_of_stock: bool = False


class RejectRedemptionRequest(BaseModel):
    reason: str | None = None


class RedemptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reward_id: UUID
    child_id: UUID
    status: str
    points_spent: int | None = None
    reward_title: str | None = None
    reward_emoji: str | None = None
    child_name: str | None = None
    child_gender: str | None = None
    reject_reason: str | None = None
    requested_at: datetime
    decided_at: datetime | None = None


# Ledger
class LedgerEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delta: int
    kind: str
    reason: str | None = None
    created_at: datetime
    task_assignment_id: UUID | None = None
    reward_redemption_id: UUID | None = None


class FamilyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    family_code: str


# Weekly goal & bonus
class WeeklyGoalUpsert(BaseModel):
    target_count: int = Field(gt=0, le=100)
    bonus_points: int = Field(gt=0, le=1000)
    is_active: bool = True


class WeeklyGoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID | None = None
    target_count: int | None = None
    bonus_points: int | None = None
    is_active: bool = False


class WeeklyProgressResponse(BaseModel):
    child_id: UUID
    enabled: bool = False
    target_count: int = 0
    bonus_points: int = 0
    completed: int = 0
    remaining: int = 0
    achieved: bool = False
    bonus_earned: bool = False
    week_start: datetime | None = None


# Games (cờ caro & cờ vua) — chơi con ↔ bố mẹ
_GAME_TYPES = ("caro", "chess")
_SIDE_CHOICES = ("random", "x", "o", "white", "black")


class GameCreateRequest(BaseModel):
    game_type: str
    side: str = "random"
    caro_block_two_ends: bool = False

    @field_validator("game_type")
    @classmethod
    def _v_type(cls, v: str) -> str:
        if v not in _GAME_TYPES:
            raise ValueError("game_type phải là 'caro' hoặc 'chess'")
        return v

    @field_validator("side")
    @classmethod
    def _v_side(cls, v: str) -> str:
        if v not in _SIDE_CHOICES:
            raise ValueError("side không hợp lệ")
        return v


class GameMoveRequest(BaseModel):
    move: str = Field(min_length=1, max_length=16)
    resulting_fen: str | None = Field(default=None, max_length=120)
    result: str | None = None

    @field_validator("result")
    @classmethod
    def _v_result(cls, v: str | None) -> str | None:
        if v is not None and v not in ("host_win", "guest_win", "draw"):
            raise ValueError("result không hợp lệ")
        return v


class GameOfferRequest(BaseModel):
    kind: str

    @field_validator("kind")
    @classmethod
    def _v_kind(cls, v: str) -> str:
        if v not in ("draw", "takeback"):
            raise ValueError("kind phải là 'draw' hoặc 'takeback'")
        return v


class GameOfferRespondRequest(BaseModel):
    accept: bool


class GamePlayer(BaseModel):
    id: UUID
    display_name: str
    gender: str | None = None


class GameMatchResponse(BaseModel):
    id: UUID
    game_type: str
    status: str
    host: GamePlayer | None = None
    guest: GamePlayer | None = None
    host_side: str
    guest_side: str | None = None
    your_side: str | None = None
    turn_user_id: UUID | None = None
    is_your_turn: bool = False
    state: dict
    result: str | None = None
    winner_id: UUID | None = None
    win_line: dict | None = None
    pending_offer: str | None = None
    pending_by: UUID | None = None
    version: int
    created_at: datetime


class GameSummaryResponse(BaseModel):
    id: UUID
    game_type: str
    status: str
    host_name: str | None = None
    guest_name: str | None = None
    is_yours: bool = False
    created_at: datetime

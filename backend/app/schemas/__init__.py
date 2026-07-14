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


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    display_name: str
    family_id: UUID
    family_code: str | None = None
    child_id: UUID | None = None
    balance: int | None = None


# Children
class ChildCreate(BaseModel):
    display_name: str = Field(min_length=1)
    pin: str = Field(min_length=4, max_length=4)
    avatar_media_id: UUID | None = None


class ChildUpdate(BaseModel):
    display_name: str | None = None
    pin: str | None = Field(default=None, min_length=4, max_length=4)
    avatar_media_id: UUID | None = None
    is_active: bool | None = None


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    avatar_media_id: UUID | None = None
    is_active: bool
    balance: int = 0


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
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str | None = None
    points: int = Field(gt=0)
    icon_media_id: UUID | None = None
    require_proof: bool = False
    is_active: bool = True


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    points: int | None = Field(default=None, gt=0)
    icon_media_id: UUID | None = None
    require_proof: bool | None = None
    is_active: bool | None = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    points: int
    icon_media_id: UUID | None = None
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
    child_name: str | None = None
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
    stock: int | None = Field(default=None, ge=0)
    is_active: bool = True


class RewardUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    required_points: int | None = Field(default=None, gt=0)
    image_media_id: UUID | None = None
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class RewardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    required_points: int
    image_media_id: UUID | None = None
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
    child_name: str | None = None
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

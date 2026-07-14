class DomainError(Exception):
    def __init__(self, error_code: str, message: str, status_code: int = 400):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidTransitionError(DomainError):
    def __init__(self, message: str = "Chuyển trạng thái không hợp lệ"):
        super().__init__("INVALID_TRANSITION", message, 409)


class InsufficientPointsError(DomainError):
    def __init__(self, message: str = "Không đủ điểm"):
        super().__init__("INSUFFICIENT_POINTS", message, 409)


class RewardLockedError(DomainError):
    def __init__(self, message: str = "Phần thưởng chưa được mở khóa"):
        super().__init__("REWARD_LOCKED", message, 409)


class OutOfStockError(DomainError):
    def __init__(self, message: str = "Phần thưởng đã hết hàng"):
        super().__init__("OUT_OF_STOCK", message, 409)


class ForbiddenRoleError(DomainError):
    def __init__(self, message: str = "Không có quyền thực hiện"):
        super().__init__("FORBIDDEN_ROLE", message, 403)


class NotFoundError(DomainError):
    def __init__(self, message: str = "Không tìm thấy"):
        super().__init__("NOT_FOUND", message, 404)


class ProofRequiredError(DomainError):
    def __init__(self, message: str = "Cần ảnh minh chứng"):
        super().__init__("PROOF_REQUIRED", message, 422)


class NotInFamilyError(DomainError):
    def __init__(self, message: str = "Không thuộc gia đình này"):
        super().__init__("NOT_IN_FAMILY", message, 403)


class ConflictError(DomainError):
    def __init__(self, message: str = "Đã tồn tại"):
        super().__init__("CONFLICT", message, 409)

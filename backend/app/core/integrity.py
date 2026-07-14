from sqlalchemy.exc import IntegrityError


def is_unique_violation(exc: IntegrityError, constraint_name: str) -> bool:
    orig = exc.orig
    if orig is not None and hasattr(orig, "diag") and orig.diag is not None:
        name = getattr(orig.diag, "constraint_name", None)
        if name == constraint_name:
            return True
    return constraint_name in str(exc.orig or exc)

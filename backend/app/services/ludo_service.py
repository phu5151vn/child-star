"""Cờ cá ngựa (Ludo) 2–4 người trong gia đình.

Backend là nguồn sự thật: gieo xúc xắc, tính nước đi hợp lệ, ăn quân, thứ tự lượt,
điều kiện thắng và chen ngang giữa ván. Không gắn điểm/thưởng.

Luật (chuẩn cá ngựa):
- Mỗi người 4 quân, bắt đầu trong "chuồng" (progress = -1).
- Ra chuồng khi gieo được 1 hoặc 6.
- Gieo 6 -> được đi thêm lượt (tối đa 3 lần 6 liên tiếp -> mất lượt).
- Đường đi: progress 0..55 trên vòng chung (56 ô), 56..61 là 6 bậc thang #1..#6 (#6 sâu nhất).
- Bậc thang: nhích đúng 1 bậc mỗi lượt (tung đúng số bậc kế); #6 là hết đường, không đi tiếp.
- Đạp trúng quân đối thủ ở ô thường (không phải ô an toàn) -> đá quân đó về chuồng.
- Thắng khi cả 4 quân xếp đủ ở 4 bậc sâu nhất #3,#4,#5,#6 (progress 58,59,60,61).
"""

import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import AuthContext
from app.core.exceptions import ConflictError, InvalidTransitionError, NotFoundError
from app.models import LudoMatch, User
from app.repositories.base import AuditRepository

NUM_COLORS = 4
SEG_LEN = 14  # mỗi đoạn màu 14 ô (đi liền mạch qua khuỷu, không nhảy chéo)
TRACK_LEN = SEG_LEN * NUM_COLORS  # vòng chung 56 ô (4 × 14)
ENTRY = {c: c * SEG_LEN for c in range(NUM_COLORS)}  # ô xuất phát: 0, 14, 28, 42
CUA_ABS = {c: (c * SEG_LEN + TRACK_LEN - 1) % TRACK_LEN for c in range(NUM_COLORS)}  # ô cửa (⭐) SÁT trước ô xuất phát: 55,13,27,41
# 4 ô xuất phát + 4 ô cửa (⭐) đều an toàn.
SAFE_CELLS = set(ENTRY.values()) | set(CUA_ABS.values())
# Progress: -1 chuồng · 0..55 vòng chung (ô 55 = CỬA/⭐, ngay TRƯỚC ô xuất phát, nơi rẽ vào đích)
# · 56..61 = 6 ô bậc thang #1..#6. #6 (61) là SÂU NHẤT — không đi tiếp được (không có ô tâm).
# Quân xếp dần vào #6,#5,#4,#3. THẮNG khi cả 4 quân nằm ở {#6,#5,#4,#3} = {61,60,59,58}.
CUA = TRACK_LEN - 1  # 55, ô cửa
HOME_TOP = CUA + 6  # 61 = ô #6 (bậc sâu nhất, sát tâm)
WIN_CELLS = [HOME_TOP - 3, HOME_TOP - 2, HOME_TOP - 1, HOME_TOP]  # [58,59,60,61] = #3,#4,#5,#6


def _roll_dice() -> int:
    return secrets.randbelow(6) + 1


def _abs_cell(color: int, progress: int) -> int | None:
    """Ô tuyệt đối trên vòng chung (0..55) hoặc None nếu ở chuồng/ô số về đích."""
    if 0 <= progress <= CUA:  # 0..55
        return (ENTRY[color] + progress) % TRACK_LEN
    return None


def _cell_key(color: int, progress: int):
    """Khóa định danh vị trí 1 quân để dò va chạm/chặn.

    - vòng chung (0..55): ("m", ô_tuyệt_đối) — mọi màu dùng chung.
    - bậc thang về đích (56..61 = #1..#6): ("h", màu, progress) — làn riêng từng màu.
    - trong chuồng: None.
    """
    if 0 <= progress <= CUA:
        return ("m", (ENTRY[color] + progress) % TRACK_LEN)
    if CUA < progress <= HOME_TOP:  # 56..61 (#1..#6, làn riêng từng màu)
        return ("h", color, progress)
    return None


def _occupancy(state: dict) -> dict:
    occ: dict = {}
    for p in state["players"]:
        for ti, prog in enumerate(p["tokens"]):
            k = _cell_key(p["color"], prog)
            if k is not None:
                occ.setdefault(k, []).append(p["color"])
    return occ


def _dest_progress(p: int, dice: int) -> int | None:
    """Đích (progress) theo luật DI CHUYỂN (chưa xét chặn/ăn). None = không đi được.

    - Chuồng (-1): ra sân khi 1 hoặc 6 -> ô xuất phát (progress 0).
    - Vòng chung + ô CỬA (0..55): ĐẾM BÌNH THƯỜNG, được bước thẳng vào bậc thang, không quá #6.
    - Trên bậc thang #1..#5 (56..60): NHÍCH ĐÚNG 1 bậc mỗi lượt, cần tung ĐÚNG số của bậc kế
      (bậc #K ở progress 55+K cần tung K). Vd ở #2(57) phải tung 3 mới lên #3(58); #5 tung 6 lên #6.
    - Ở #6 (61 = SÂU NHẤT): KHÔNG đi tiếp được (không có ô tâm).
    """
    if p == -1:
        return 0 if dice in (1, 6) else None
    if p <= CUA:  # 0..55: vòng chung + cửa -> đếm bình thường, không quá #6
        d = p + dice
        return d if d <= HOME_TOP else None
    if p >= HOME_TOP:  # đã ở #6 -> hết đường
        return None
    target = p + 1  # bậc thang: chỉ nhích đúng 1 ô
    return target if dice == target - CUA else None  # bậc kế #K cần tung K


def _can_move_token(state: dict, player: dict, dice: int, ti: int) -> bool:
    """Luật cá ngựa: đi đúng luật về đích; không nhảy qua bất kỳ quân nào ở giữa;
    KHÔNG bao giờ chồng lên quân MÌNH (kể cả ô an toàn); đá đối thủ phải ĐÚNG ô;
    ô an toàn (xuất phát/cửa) chỉ cho đứng chung với ĐỐI THỦ, không đá."""
    color = player["color"]
    p = player["tokens"][ti]
    if p == HOME_TOP:
        return False  # đã ở #6 (sâu nhất) -> không đi nữa
    occ = _occupancy(state)
    # Ra chuồng: cần tung 1/6, VÀ không được ra nếu đã có quân MÌNH đứng ở ô xuất phát
    # (không chồng quân mình). Đối thủ ở ô xuất phát (ô an toàn) thì vẫn được ra, đứng chung.
    if p == -1:
        if dice not in (1, 6):
            return False
        return color not in occ.get(("m", ENTRY[color]), [])
    dest = _dest_progress(p, dice)
    if dest is None:
        return False
    # Không được nhảy qua bất kỳ quân nào ở các ô GIỮA (vòng chung lẫn bậc thang về đích).
    for step in range(p + 1, dest):
        if occ.get(_cell_key(color, step)):
            return False
    # Ô đích của nước đi.
    k = _cell_key(color, dest)
    here = occ.get(k, [])
    if not here:
        return True
    if any(c == color for c in here):
        return False  # KHÔNG chồng lên quân mình (kể cả ô an toàn: xuất phát/cửa/bậc thang)
    is_safe = k[0] == "m" and k[1] in SAFE_CELLS
    if is_safe:
        return True  # ô an toàn: đứng chung với ĐỐI THỦ, không đá
    return True  # ô thường có đối thủ -> được đá


def _movable_tokens(state: dict, player: dict, dice: int) -> list[int]:
    return [ti for ti in range(len(player["tokens"])) if _can_move_token(state, player, dice, ti)]


class LudoService:
    # ---- vòng đời ván ----

    @staticmethod
    def _match(db: Session, ctx: AuthContext, match_id: UUID) -> LudoMatch:
        m = db.scalar(
            select(LudoMatch).where(LudoMatch.id == match_id, LudoMatch.family_id == ctx.family_id)
        )
        if not m:
            raise NotFoundError("Không tìm thấy ván cá ngựa")
        return m

    @staticmethod
    def _used_colors(state: dict) -> set[int]:
        return {p["color"] for p in state["players"]}

    @staticmethod
    def _add_player(state: dict, user: User) -> None:
        free = [c for c in range(NUM_COLORS) if c not in LudoService._used_colors(state)]
        if not free:
            raise InvalidTransitionError("Ván đã đủ 4 người chơi")
        state["players"].append(
            {
                "user_id": str(user.id),
                "name": user.display_name,
                "gender": user.gender,
                "color": free[0],
                "tokens": [-1, -1, -1, -1],
            }
        )

    @staticmethod
    def create(db: Session, ctx: AuthContext) -> dict:
        user = db.get(User, ctx.user_id)
        state = {"players": [], "turn": 0, "dice": None, "six_streak": 0, "last": None}
        LudoService._add_player(state, user)
        match = LudoMatch(family_id=ctx.family_id, created_by=ctx.user_id, state=state)
        db.add(match)
        db.flush()
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="ludo.create", entity_type="game", entity_id=match.id, changes={},
        )
        db.commit()
        return LudoService._to_response(db, ctx, match)

    @staticmethod
    def get(db: Session, ctx: AuthContext, match_id: UUID) -> dict:
        return LudoService._to_response(db, ctx, LudoService._match(db, ctx, match_id))

    @staticmethod
    def list_matches(db: Session, ctx: AuthContext) -> list[dict]:
        matches = db.scalars(
            select(LudoMatch)
            .where(
                LudoMatch.family_id == ctx.family_id,
                or_(LudoMatch.status == "waiting", LudoMatch.status == "active"),
            )
            .order_by(LudoMatch.created_at.desc())
            .limit(50)
        ).all()
        return [LudoService._summary(ctx, m) for m in matches]

    @staticmethod
    def join(db: Session, ctx: AuthContext, match_id: UUID) -> dict:
        match = LudoService._match(db, ctx, match_id)
        if match.status == "finished":
            raise InvalidTransitionError("Ván đã kết thúc")
        state = dict(match.state)
        state["players"] = [dict(p) for p in state["players"]]
        if any(p["user_id"] == str(ctx.user_id) for p in state["players"]):
            return LudoService._to_response(db, ctx, match)  # đã ở trong ván
        # Chen ngang: chỉ được khi còn màu trống (chưa đủ 4 người). Người mới xếp cuối lượt.
        user = db.get(User, ctx.user_id)
        LudoService._add_player(state, user)
        match.state = state
        match.version += 1
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="ludo.join", entity_type="game", entity_id=match.id, changes={},
        )
        db.commit()
        return LudoService._to_response(db, ctx, match)

    @staticmethod
    def start(db: Session, ctx: AuthContext, match_id: UUID) -> dict:
        match = LudoService._match(db, ctx, match_id)
        if match.created_by != ctx.user_id:
            raise InvalidTransitionError("Chỉ người tạo ván mới bắt đầu được")
        if match.status != "waiting":
            raise InvalidTransitionError("Ván đã bắt đầu")
        if len(match.state["players"]) < 2:
            raise InvalidTransitionError("Cần ít nhất 2 người để bắt đầu")
        match.status = "active"
        match.version += 1
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="ludo.start", entity_type="game", entity_id=match.id, changes={},
        )
        db.commit()
        return LudoService._to_response(db, ctx, match)

    # ---- lượt chơi ----

    @staticmethod
    def _current(state: dict) -> dict:
        return state["players"][state["turn"]]

    @staticmethod
    def _advance_turn(state: dict) -> None:
        state["turn"] = (state["turn"] + 1) % len(state["players"])
        state["dice"] = None
        state["six_streak"] = 0
        state["no_move_streak"] = 0

    @staticmethod
    def roll(db: Session, ctx: AuthContext, match_id: UUID) -> dict:
        match = LudoService._match(db, ctx, match_id)
        if match.status != "active":
            raise InvalidTransitionError("Ván chưa bắt đầu hoặc đã kết thúc")
        state = dict(match.state)
        state["players"] = [dict(p) for p in state["players"]]
        cur = LudoService._current(state)
        if cur["user_id"] != str(ctx.user_id):
            raise InvalidTransitionError("Chưa tới lượt của bạn")
        if state["dice"] is not None:
            raise InvalidTransitionError("Bạn đã gieo rồi, hãy đi quân")

        dice = _roll_dice()
        if dice == 6:
            state["six_streak"] = state.get("six_streak", 0) + 1
        else:
            state["six_streak"] = 0

        # 3 lần 6 liên tiếp -> mất lượt.
        if dice == 6 and state["six_streak"] >= 3:
            state["last"] = {"type": "burn_six", "color": cur["color"], "dice": dice}
            LudoService._advance_turn(state)
            match.state = state
            match.version += 1
            db.commit()
            return LudoService._to_response(db, ctx, match)

        movable = _movable_tokens(state, cur, dice)
        if not movable:
            # Không đi được -> BỎ QUA LƯỢT (không tung lại).
            state["last"] = {"type": "no_move", "color": cur["color"], "dice": dice}
            LudoService._advance_turn(state)
            match.state = state
            match.version += 1
            db.commit()
            return LudoService._to_response(db, ctx, match)

        state["dice"] = dice
        state["last"] = {"type": "roll", "color": cur["color"], "dice": dice}
        match.state = state
        match.version += 1
        db.commit()
        return LudoService._to_response(db, ctx, match)

    @staticmethod
    def move(db: Session, ctx: AuthContext, match_id: UUID, token: int) -> dict:
        match = LudoService._match(db, ctx, match_id)
        if match.status != "active":
            raise InvalidTransitionError("Ván không ở trạng thái đang chơi")
        state = dict(match.state)
        state["players"] = [dict(p, tokens=list(p["tokens"])) for p in state["players"]]
        cur = LudoService._current(state)
        if cur["user_id"] != str(ctx.user_id):
            raise InvalidTransitionError("Chưa tới lượt của bạn")
        dice = state["dice"]
        if dice is None:
            raise InvalidTransitionError("Hãy gieo xúc xắc trước")
        if token not in _movable_tokens(state, cur, dice):
            raise InvalidTransitionError("Quân này không đi được")

        tokens = cur["tokens"]
        dest = _dest_progress(tokens[token], dice)
        tokens[token] = dest if dest is not None else tokens[token]
        newp = tokens[token]
        events = []
        # Ăn quân trên vòng chung nếu không phải ô an toàn.
        cell = _abs_cell(cur["color"], newp)
        if cell is not None and cell not in SAFE_CELLS:
            for other in state["players"]:
                if other["user_id"] == cur["user_id"]:
                    continue
                for oj, op_ in enumerate(other["tokens"]):
                    if _abs_cell(other["color"], op_) == cell:
                        other["tokens"][oj] = -1
                        events.append({"color": other["color"], "token": oj})

        won = sorted(tokens) == WIN_CELLS  # cả 4 quân ở #3,#4,#5,#6
        state["last"] = {
            "type": "move",
            "color": cur["color"],
            "token": token,
            "to": newp,
            "dice": dice,
            "captures": events,
        }

        if won:
            match.status = "finished"
            match.winner_id = ctx.user_id
            match.finished_at = datetime.now(timezone.utc)
            state["dice"] = None
        elif dice in (1, 6):
            state["dice"] = None  # tung 1 hoặc 6 -> được đi thêm lượt (gieo lại)
        else:
            LudoService._advance_turn(state)

        match.state = state
        match.version += 1
        if won:
            AuditRepository.log(
                db, family_id=ctx.family_id, actor_id=ctx.user_id,
                action="ludo.finish", entity_type="game", entity_id=match.id, changes={},
            )
        db.commit()
        return LudoService._to_response(db, ctx, match)

    # ---- serialize ----

    @staticmethod
    def _summary(ctx: AuthContext, match: LudoMatch) -> dict:
        players = match.state["players"]
        return {
            "id": str(match.id),
            "status": match.status,
            "player_count": len(players),
            "player_names": [p["name"] for p in players],
            "is_yours": any(p["user_id"] == str(ctx.user_id) for p in players),
            "is_creator": match.created_by == ctx.user_id,
            "created_at": match.created_at.isoformat() if match.created_at else None,
        }

    @staticmethod
    def _to_response(db: Session, ctx: AuthContext, match: LudoMatch) -> dict:
        state = match.state
        players = state["players"]
        turn = state.get("turn", 0)
        current = players[turn] if players else None
        is_your_turn = (
            match.status == "active"
            and current is not None
            and current["user_id"] == str(ctx.user_id)
        )
        dice = state.get("dice")
        movable = (
            _movable_tokens(state, current, dice)
            if (is_your_turn and dice is not None and current)
            else []
        )
        winner = db.get(User, match.winner_id) if match.winner_id else None
        return {
            "id": str(match.id),
            "status": match.status,
            "created_by": str(match.created_by),
            "is_creator": match.created_by == ctx.user_id,
            "you_joined": any(p["user_id"] == str(ctx.user_id) for p in players),
            "players": [
                {
                    "user_id": p["user_id"],
                    "name": p["name"],
                    "gender": p["gender"],
                    "color": p["color"],
                    "tokens": p["tokens"],
                    "is_you": p["user_id"] == str(ctx.user_id),
                    "is_turn": (match.status == "active" and i == turn),
                }
                for i, p in enumerate(players)
            ],
            "turn": turn,
            "turn_color": current["color"] if current else None,
            "turn_user_id": current["user_id"] if current else None,
            "is_your_turn": is_your_turn,
            "dice": dice,
            "can_roll": is_your_turn and dice is None,
            "movable_tokens": movable,
            "free_slots": NUM_COLORS - len(players),
            "winner_id": str(match.winner_id) if match.winner_id else None,
            "winner_name": winner.display_name if winner else None,
            "last": state.get("last"),
            "version": match.version,
        }

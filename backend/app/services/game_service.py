"""Game service — cờ caro & cờ vua chơi con ↔ bố mẹ (online mode).

Trust boundary (có chủ đích): đây là game gia đình, KHÔNG gắn vào điểm/thưởng
(không đụng points_ledger). Backend là nguồn sự thật cho trạng thái ván, lượt đi,
thứ tự ply và kết quả; backend enforce đúng người/đúng lượt/ply tăng dần/ván đang mở.

- Caro: backend validate hoàn toàn (ô trống, trong bàn, đúng lượt, dò 5-liên-tiếp)
  vì luật đơn giản.
- Chess: hợp lệ nước cờ được chess.js tính ở client; backend chỉ enforce turn/ply và
  ghi lại fen/history/kết quả do client gửi lên (không tự tính luật FIDE).
"""

import uuid as uuidlib
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import AuthContext
from app.core.exceptions import ConflictError, InvalidTransitionError, NotFoundError
from app.core.integrity import is_unique_violation
from app.models import GameMatch, GameMove, User
from app.repositories.base import AuditRepository
from app.schemas import (
    GameCreateRequest,
    GameMatchResponse,
    GameMoveRequest,
    GamePlayer,
    GameSummaryResponse,
)

CARO_SIZE = 15
CHESS_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

# Bên đi trước mỗi loại cờ.
FIRST_SIDE = {"caro": "x", "chess": "white"}
OPP_SIDE = {"x": "o", "o": "x", "white": "black", "black": "white"}
SIDES_OF_TYPE = {"caro": ("x", "o"), "chess": ("white", "black")}
_CARO_DIRS = ((0, 1), (1, 0), (1, 1), (1, -1))


def _get_match_in_family(db: Session, match_id: UUID, family_id: UUID) -> GameMatch | None:
    return db.scalar(
        select(GameMatch).where(GameMatch.id == match_id, GameMatch.family_id == family_id)
    )


def _caro_check_win(
    board: list[list[str | None]], r: int, c: int, side: str, size: int, block_two_ends: bool
) -> dict | None:
    """Dò 5-liên-tiếp qua ô (r,c) vừa đặt. Trả về win_line dict hoặc None.

    block_two_ends: nếu bật, một dãy ĐÚNG 5 mà cả hai ô đầu-cuối liền kề đều bị chặn
    (quân đối thủ hoặc chạm biên) thì KHÔNG tính thắng. Dãy > 5 (overline) vẫn thắng.
    """

    def blocked(rr: int, cc: int) -> bool:
        if not (0 <= rr < size and 0 <= cc < size):
            return True  # chạm biên
        return board[rr][cc] is not None and board[rr][cc] != side  # quân đối thủ

    for dr, dc in _CARO_DIRS:
        cells = [(r, c)]
        rr, cc = r + dr, c + dc
        while 0 <= rr < size and 0 <= cc < size and board[rr][cc] == side:
            cells.append((rr, cc))
            rr, cc = rr + dr, cc + dc
        fwd_end = (rr, cc)
        rr, cc = r - dr, c - dc
        while 0 <= rr < size and 0 <= cc < size and board[rr][cc] == side:
            cells.insert(0, (rr, cc))
            rr, cc = rr - dr, cc - dc
        bwd_end = (rr, cc)

        count = len(cells)
        if count < 5:
            continue
        win_line = {"cells": [[a, b] for a, b in cells], "dir": [dr, dc]}
        if not block_two_ends or count > 5:
            return win_line
        # count == 5 và bật chặn-2-đầu: thua nếu cả hai đầu bị chặn.
        if blocked(*fwd_end) and blocked(*bwd_end):
            continue
        return win_line
    return None


class GameService:
    @staticmethod
    def create_match(db: Session, ctx: AuthContext, data: GameCreateRequest) -> GameMatchResponse:
        gt = data.game_type
        mid = uuidlib.uuid4()
        # Xác định phe của host.
        valid_sides = SIDES_OF_TYPE[gt]
        if data.side in valid_sides:
            host_side = data.side
        else:
            # 'random' (hoặc side không hợp loại): chọn xác định theo id ván (không mock random).
            host_side = FIRST_SIDE[gt] if (mid.int % 2 == 0) else OPP_SIDE[FIRST_SIDE[gt]]
        match = GameMatch(
            id=mid, family_id=ctx.family_id, game_type=gt, host_id=ctx.user_id, host_side=host_side
        )

        if gt == "caro":
            match.state = {
                "size": CARO_SIZE,
                "block_two_ends": bool(data.caro_block_two_ends),
                "board": [[None] * CARO_SIZE for _ in range(CARO_SIZE)],
                "moves": [],
            }
        else:
            match.state = {"fen": CHESS_START_FEN, "last_move": None, "history": []}

        db.add(match)
        db.flush()
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="game.create", entity_type="game", entity_id=match.id,
            changes={"game_type": gt, "host_side": host_side},
        )
        db.commit()
        return GameService._to_response(db, ctx, match)

    @staticmethod
    def list_matches(db: Session, ctx: AuthContext, status: str | None = None) -> list[GameSummaryResponse]:
        q = select(GameMatch).where(GameMatch.family_id == ctx.family_id)
        if status:
            q = q.where(GameMatch.status == status)
        else:
            # Mặc định: ván đang chờ ghép + ván active của mình.
            q = q.where(
                or_(
                    GameMatch.status == "waiting",
                    (GameMatch.status == "active")
                    & or_(GameMatch.host_id == ctx.user_id, GameMatch.guest_id == ctx.user_id),
                )
            )
        matches = db.scalars(q.order_by(GameMatch.created_at.desc()).limit(50)).all()
        result = []
        for m in matches:
            host = db.get(User, m.host_id)
            guest = db.get(User, m.guest_id) if m.guest_id else None
            result.append(
                GameSummaryResponse(
                    id=m.id,
                    game_type=m.game_type,
                    status=m.status,
                    host_name=host.display_name if host else None,
                    guest_name=guest.display_name if guest else None,
                    is_yours=ctx.user_id in (m.host_id, m.guest_id),
                    created_at=m.created_at,
                )
            )
        return result

    @staticmethod
    def join_match(db: Session, ctx: AuthContext, match_id: UUID) -> GameMatchResponse:
        match = _get_match_in_family(db, match_id, ctx.family_id)
        if not match:
            raise NotFoundError("Không tìm thấy ván")
        if match.host_id == ctx.user_id:
            raise InvalidTransitionError("Không thể tự tham gia ván của mình")
        if match.status != "waiting" or match.guest_id is not None:
            raise InvalidTransitionError("Ván đã đủ người chơi")

        match.guest_id = ctx.user_id
        match.guest_side = OPP_SIDE[match.host_side]
        match.status = "active"
        first_side = FIRST_SIDE[match.game_type]
        match.turn_user_id = match.host_id if match.host_side == first_side else match.guest_id
        match.version += 1
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="game.join", entity_type="game", entity_id=match.id, changes={},
        )
        db.commit()
        return GameService._to_response(db, ctx, match)

    @staticmethod
    def get_match(db: Session, ctx: AuthContext, match_id: UUID) -> GameMatchResponse:
        match = _get_match_in_family(db, match_id, ctx.family_id)
        if not match:
            raise NotFoundError("Không tìm thấy ván")
        return GameService._to_response(db, ctx, match)

    @staticmethod
    def make_move(db: Session, ctx: AuthContext, match_id: UUID, data: GameMoveRequest) -> GameMatchResponse:
        match = _get_match_in_family(db, match_id, ctx.family_id)
        if not match:
            raise NotFoundError("Không tìm thấy ván")
        if match.status != "active":
            raise InvalidTransitionError("Ván không ở trạng thái đang chơi")
        if ctx.user_id != match.turn_user_id:
            raise InvalidTransitionError("Chưa tới lượt của bạn")

        my_side = match.host_side if ctx.user_id == match.host_id else match.guest_side
        ply = db.scalar(select(func.count(GameMove.id)).where(GameMove.match_id == match.id)) or 0

        finished = False
        if match.game_type == "caro":
            GameService._apply_caro(match, data.move, my_side)
            win_line = match.win_line
            finished = match.status == "finished"
        else:
            GameService._apply_chess(match, ctx, data)
            finished = match.status == "finished"

        db.add(
            GameMove(
                match_id=match.id,
                ply=ply,
                by_user_id=ctx.user_id,
                move=data.move,
                resulting_fen=data.resulting_fen if match.game_type == "chess" else None,
            )
        )
        if finished:
            match.turn_user_id = None
        else:
            match.turn_user_id = match.guest_id if ctx.user_id == match.host_id else match.host_id
        # Nước đi mới làm mọi lời mời cầu hòa/xin đi lại cũ hết hiệu lực.
        match.pending_offer = None
        match.pending_by = None
        match.version += 1

        try:
            if finished:
                AuditRepository.log(
                    db, family_id=ctx.family_id, actor_id=ctx.user_id,
                    action="game.finish", entity_type="game", entity_id=match.id,
                    changes={"result": match.result},
                )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_gamemove_ply"):
                raise ConflictError("Đối thủ vừa đi trước, hãy tải lại ván") from exc
            raise
        return GameService._to_response(db, ctx, match)

    @staticmethod
    def resign(db: Session, ctx: AuthContext, match_id: UUID) -> GameMatchResponse:
        match = _get_match_in_family(db, match_id, ctx.family_id)
        if not match:
            raise NotFoundError("Không tìm thấy ván")
        if ctx.user_id not in (match.host_id, match.guest_id):
            raise NotFoundError("Không tìm thấy ván")
        if match.status != "active":
            raise InvalidTransitionError("Ván không ở trạng thái đang chơi")

        winner_id = match.guest_id if ctx.user_id == match.host_id else match.host_id
        match.result = "guest_win" if ctx.user_id == match.host_id else "host_win"
        match.winner_id = winner_id
        match.status = "finished"
        match.turn_user_id = None
        match.finished_at = datetime.now(timezone.utc)
        match.version += 1
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="game.resign", entity_type="game", entity_id=match.id, changes={},
        )
        db.commit()
        return GameService._to_response(db, ctx, match)

    @staticmethod
    def offer_action(db: Session, ctx: AuthContext, match_id: UUID, kind: str) -> GameMatchResponse:
        """Gửi lời mời 'draw' (cầu hòa) hoặc 'takeback' (xin đi lại)."""
        match = _get_match_in_family(db, match_id, ctx.family_id)
        if not match:
            raise NotFoundError("Không tìm thấy ván")
        if ctx.user_id not in (match.host_id, match.guest_id):
            raise NotFoundError("Không tìm thấy ván")
        if match.status != "active":
            raise InvalidTransitionError("Ván không ở trạng thái đang chơi")
        if match.pending_offer:
            raise InvalidTransitionError("Đang có một lời mời chờ phản hồi")
        if kind == "takeback":
            last = db.scalar(
                select(GameMove).where(GameMove.match_id == match.id).order_by(GameMove.ply.desc()).limit(1)
            )
            if not last:
                raise InvalidTransitionError("Chưa có nước nào để đi lại")
            if last.by_user_id != ctx.user_id:
                raise InvalidTransitionError("Chỉ người vừa đi mới xin đi lại được")

        match.pending_offer = kind
        match.pending_by = ctx.user_id
        match.version += 1
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action=f"game.offer.{kind}", entity_type="game", entity_id=match.id, changes={},
        )
        db.commit()
        return GameService._to_response(db, ctx, match)

    @staticmethod
    def respond_offer(db: Session, ctx: AuthContext, match_id: UUID, accept: bool) -> GameMatchResponse:
        """Phản hồi lời mời. Người mời gọi -> hủy lời mời; đối thủ gọi -> đồng ý/từ chối."""
        match = _get_match_in_family(db, match_id, ctx.family_id)
        if not match:
            raise NotFoundError("Không tìm thấy ván")
        if ctx.user_id not in (match.host_id, match.guest_id):
            raise NotFoundError("Không tìm thấy ván")
        if not match.pending_offer:
            raise InvalidTransitionError("Không có lời mời nào")

        kind = match.pending_offer
        # Người mời tự gọi -> coi như hủy lời mời.
        if ctx.user_id == match.pending_by:
            match.pending_offer = None
            match.pending_by = None
            match.version += 1
            db.commit()
            return GameService._to_response(db, ctx, match)

        if not accept:
            match.pending_offer = None
            match.pending_by = None
            match.version += 1
            db.commit()
            return GameService._to_response(db, ctx, match)

        if kind == "draw":
            match.result = "draw"
            match.winner_id = None
            match.status = "finished"
            match.turn_user_id = None
            match.finished_at = datetime.now(timezone.utc)
        elif kind == "takeback":
            GameService._revert_last_move(db, match)

        match.pending_offer = None
        match.pending_by = None
        match.version += 1
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action=f"game.accept.{kind}", entity_type="game", entity_id=match.id, changes={},
        )
        db.commit()
        return GameService._to_response(db, ctx, match)

    @staticmethod
    def _revert_last_move(db: Session, match: GameMatch) -> None:
        """Hoàn nước cuối: xóa GameMove cuối, phục hồi state, trả lượt cho người xin đi lại."""
        moves = db.scalars(
            select(GameMove).where(GameMove.match_id == match.id).order_by(GameMove.ply.desc())
        ).all()
        if not moves:
            return
        last = moves[0]
        requester = match.pending_by

        if match.game_type == "caro":
            state = dict(match.state)
            board = [list(row) for row in state["board"]]
            hist = list(state["moves"])
            if hist:
                popped = hist.pop()
                board[popped["r"]][popped["c"]] = None
            state["board"] = board
            state["moves"] = hist
            match.state = state
        else:
            prev_fen = moves[1].resulting_fen if len(moves) > 1 else CHESS_START_FEN
            state = dict(match.state)
            hist = list(state.get("history", []))
            if hist:
                hist.pop()
            state["fen"] = prev_fen
            state["history"] = hist
            state["last_move"] = hist[-1] if hist else None
            match.state = state

        db.delete(last)
        match.turn_user_id = requester

    # --- helpers cụ thể từng loại ---

    @staticmethod
    def _apply_caro(match: GameMatch, move: str, my_side: str) -> None:
        state = dict(match.state)
        size = state["size"]
        board = [list(row) for row in state["board"]]
        try:
            r_str, c_str = move.split(",")
            r, c = int(r_str), int(c_str)
        except (ValueError, AttributeError) as exc:
            raise InvalidTransitionError("Nước đi không hợp lệ") from exc
        if not (0 <= r < size and 0 <= c < size):
            raise InvalidTransitionError("Ô nằm ngoài bàn cờ")
        if board[r][c] is not None:
            raise InvalidTransitionError("Ô đã có quân")

        board[r][c] = my_side
        moves = list(state["moves"])
        moves.append({"r": r, "c": c, "by": my_side})
        state["board"] = board
        state["moves"] = moves
        match.state = state

        win = _caro_check_win(board, r, c, my_side, size, bool(state.get("block_two_ends")))
        if win:
            match.win_line = win
            match.result = "host_win" if my_side == match.host_side else "guest_win"
            match.winner_id = match.host_id if my_side == match.host_side else match.guest_id
            match.status = "finished"
            match.finished_at = datetime.now(timezone.utc)
        elif all(cell is not None for row in board for cell in row):
            match.result = "draw"
            match.status = "finished"
            match.finished_at = datetime.now(timezone.utc)

    @staticmethod
    def _apply_chess(match: GameMatch, ctx: AuthContext, data: GameMoveRequest) -> None:
        if not data.resulting_fen:
            raise InvalidTransitionError("Thiếu trạng thái bàn cờ (fen)")
        state = dict(match.state)
        history = list(state.get("history", []))
        history.append(data.move)
        state["fen"] = data.resulting_fen
        state["last_move"] = data.move
        state["history"] = history
        match.state = state
        if data.result:
            match.result = data.result
            if data.result == "host_win":
                match.winner_id = match.host_id
            elif data.result == "guest_win":
                match.winner_id = match.guest_id
            match.status = "finished"
            match.finished_at = datetime.now(timezone.utc)

    @staticmethod
    def _to_response(db: Session, ctx: AuthContext, match: GameMatch) -> GameMatchResponse:
        host = db.get(User, match.host_id)
        guest = db.get(User, match.guest_id) if match.guest_id else None
        your_side = None
        if ctx.user_id == match.host_id:
            your_side = match.host_side
        elif ctx.user_id == match.guest_id:
            your_side = match.guest_side
        return GameMatchResponse(
            id=match.id,
            game_type=match.game_type,
            status=match.status,
            host=GamePlayer(id=host.id, display_name=host.display_name, gender=host.gender) if host else None,
            guest=GamePlayer(id=guest.id, display_name=guest.display_name, gender=guest.gender) if guest else None,
            host_side=match.host_side,
            guest_side=match.guest_side,
            your_side=your_side,
            turn_user_id=match.turn_user_id,
            is_your_turn=match.turn_user_id == ctx.user_id,
            state=match.state,
            result=match.result,
            winner_id=match.winner_id,
            win_line=match.win_line,
            pending_offer=match.pending_offer,
            pending_by=match.pending_by,
            version=match.version,
            created_at=match.created_at,
        )

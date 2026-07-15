import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base, get_db
from app.main import app
from app.models import GameMove
from app.services.game_service import _caro_check_win

SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---- helpers ----

def _empty_board(size: int):
    return [[None] * size for _ in range(size)]


def _register_parent(client, email="p@x.com", family="Fam"):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secret12", "family_name": family, "display_name": "Parent"},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"], res.json()["family_code"]


def _two_players(client, email="p@x.com", family="Fam"):
    """Parent + 1 con trong cùng gia đình -> (parent_headers, child_headers, child_id)."""
    ptoken, code = _register_parent(client, email, family)
    ph = {"Authorization": f"Bearer {ptoken}"}
    child = client.post("/api/v1/children", headers=ph, json={"display_name": "Kid", "pin": "1234"}).json()
    login = client.post(
        "/api/v1/auth/child/login",
        json={"family_code": code, "child_id": child["id"], "pin": "1234"},
    ).json()
    ch = {"Authorization": f"Bearer {login['access_token']}"}
    return ph, ch, child["id"], code


# ---- unit: caro win detection ----

def test_caro_horizontal_win():
    b = _empty_board(9)
    for c in range(5):
        b[3][c] = "x"
    assert _caro_check_win(b, 3, 4, "x", 9, False) is not None


def test_caro_vertical_and_diagonal_win():
    b = _empty_board(9)
    for r in range(5):
        b[r][2] = "o"
    assert _caro_check_win(b, 4, 2, "o", 9, False) is not None

    b2 = _empty_board(9)
    for i in range(5):
        b2[i][i] = "x"
    assert _caro_check_win(b2, 4, 4, "x", 9, False) is not None


def test_caro_block_two_ends_rule():
    # Dãy 5 bị chặn cả hai đầu (o ở hai bên) -> KHÔNG thắng khi bật luật.
    b = _empty_board(9)
    for c in range(2, 7):
        b[0][c] = "x"
    b[0][1] = "o"
    b[0][7] = "o"
    assert _caro_check_win(b, 0, 4, "x", 9, True) is None
    # Tắt luật -> vẫn thắng.
    assert _caro_check_win(b, 0, 4, "x", 9, False) is not None


def test_caro_block_two_ends_one_open_wins():
    # Một đầu mở -> thắng dù bật luật.
    b = _empty_board(9)
    for c in range(2, 7):
        b[0][c] = "x"
    b[0][1] = "o"  # chặn 1 đầu, đầu (0,7) còn trống
    assert _caro_check_win(b, 0, 4, "x", 9, True) is not None


def test_caro_overline_wins_even_with_block_rule():
    # 6 quân liên tiếp (overline) -> luôn thắng.
    b = _empty_board(9)
    for c in range(2, 8):
        b[0][c] = "x"
    b[0][1] = "o"
    b[0][8] = "o"
    assert _caro_check_win(b, 0, 4, "x", 9, True) is not None


# ---- integration: caro flow ----

def _create_caro(client, headers, side="x", block=False):
    res = client.post(
        "/api/v1/games",
        headers=headers,
        json={"game_type": "caro", "side": side, "caro_block_two_ends": block},
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_caro_full_win_flow(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    assert match["status"] == "waiting"

    joined = client.post(f"/api/v1/games/{mid}/join", headers=ch).json()
    assert joined["status"] == "active"
    assert joined["turn_user_id"] == match["host"]["id"]  # x đi trước = parent

    host_moves = ["7,0", "7,1", "7,2", "7,3", "7,4"]
    guest_moves = ["0,0", "0,1", "0,2", "0,3"]
    for i, hm in enumerate(host_moves):
        r = client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": hm})
        assert r.status_code == 200, r.text
        if i < len(guest_moves):
            body = r.json()
            if body["status"] == "finished":
                break
            gr = client.post(f"/api/v1/games/{mid}/move", headers=ch, json={"move": guest_moves[i]})
            assert gr.status_code == 200, gr.text

    final = client.get(f"/api/v1/games/{mid}", headers=ph).json()
    assert final["status"] == "finished"
    assert final["result"] == "host_win"
    assert final["winner_id"] == match["host"]["id"]
    assert final["win_line"] is not None


def test_caro_reject_wrong_turn(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    # Guest cố đi khi tới lượt host -> 409
    r = client.post(f"/api/v1/games/{mid}/move", headers=ch, json={"move": "5,5"})
    assert r.status_code == 409


def test_caro_reject_occupied_cell(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": "5,5"})
    client.post(f"/api/v1/games/{mid}/move", headers=ch, json={"move": "6,6"})
    # Host đặt lại ô đã có quân
    r = client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": "6,6"})
    assert r.status_code == 409


def test_cannot_join_own_match(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph)
    r = client.post(f"/api/v1/games/{match['id']}/join", headers=ph)
    assert r.status_code == 409


def test_cannot_join_full_match(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph)
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    # Con thứ 2 thử join lại ván đã đủ người
    child2 = client.post("/api/v1/children", headers=ph, json={"display_name": "Kid2", "pin": "2222"}).json()
    code = client.get("/api/v1/family", headers=ph).json()["family_code"]
    t2 = client.post(
        "/api/v1/auth/child/login",
        json={"family_code": code, "child_id": child2["id"], "pin": "2222"},
    ).json()["access_token"]
    r = client.post(f"/api/v1/games/{mid}/join", headers={"Authorization": f"Bearer {t2}"})
    assert r.status_code == 409


def test_cannot_join_other_family_match(client):
    ph1, ch1, _, _ = _two_players(client, email="a@x.com", family="A")
    match = _create_caro(client, ph1)
    # Người chơi ở gia đình khác
    ph2, ch2, _, _ = _two_players(client, email="b@x.com", family="B")
    r = client.post(f"/api/v1/games/{match['id']}/join", headers=ph2)
    assert r.status_code == 404


def test_double_move_blocked_by_unique_ply(client):
    """Unique (match_id, ply) chống double-move do race."""
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph)
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    # Chèn thủ công 2 nước cùng ply -> vi phạm unique.
    import uuid as _uuid

    db = TestingSessionLocal()
    try:
        host_id = _uuid.UUID(match["host"]["id"])
        mid_uuid = _uuid.UUID(mid)
        db.add(GameMove(match_id=mid_uuid, ply=0, by_user_id=host_id, move="1,1"))
        db.commit()
        db.add(GameMove(match_id=mid_uuid, ply=0, by_user_id=host_id, move="2,2"))
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()


# ---- integration: chess flow + resign ----

def test_chess_move_recording_and_resign(client):
    ph, ch, _, _ = _two_players(client)
    res = client.post(
        "/api/v1/games", headers=ph, json={"game_type": "chess", "side": "white"}
    )
    match = res.json()
    mid = match["id"]
    assert match["state"]["fen"].startswith("rnbqkbnr")
    client.post(f"/api/v1/games/{mid}/join", headers=ch)

    new_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    r = client.post(
        f"/api/v1/games/{mid}/move",
        headers=ph,
        json={"move": "e2e4", "resulting_fen": new_fen},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"]["fen"] == new_fen
    assert body["state"]["last_move"] == "e2e4"
    assert body["turn_user_id"] == match["host"]["id"] or body["is_your_turn"] is False

    # Con đầu hàng -> parent (host) thắng
    rr = client.post(f"/api/v1/games/{mid}/resign", headers=ch)
    assert rr.status_code == 200, rr.text
    fin = rr.json()
    assert fin["status"] == "finished"
    assert fin["result"] == "host_win"
    assert fin["winner_id"] == match["host"]["id"]


# ---- integration: cầu hòa & xin đi lại ----

def test_draw_offer_accept(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": "7,7"})

    off = client.post(f"/api/v1/games/{mid}/offer", headers=ch, json={"kind": "draw"})
    assert off.status_code == 200, off.text
    assert off.json()["pending_offer"] == "draw"

    res = client.post(f"/api/v1/games/{mid}/offer/respond", headers=ph, json={"accept": True})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "finished"
    assert body["result"] == "draw"
    assert body["pending_offer"] is None


def test_draw_offer_decline(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)

    client.post(f"/api/v1/games/{mid}/offer", headers=ph, json={"kind": "draw"})
    res = client.post(f"/api/v1/games/{mid}/offer/respond", headers=ch, json={"accept": False})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "active"
    assert body["pending_offer"] is None


def test_offerer_can_cancel(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    client.post(f"/api/v1/games/{mid}/offer", headers=ph, json={"kind": "draw"})
    # Chính người mời gọi respond -> hủy lời mời.
    res = client.post(f"/api/v1/games/{mid}/offer/respond", headers=ph, json={"accept": True})
    assert res.status_code == 200
    assert res.json()["pending_offer"] is None
    assert res.json()["status"] == "active"


def test_takeback_accept_reverts_caro(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    host_id = match["host"]["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": "7,7"})

    # Host vừa đi -> host xin đi lại, guest đồng ý.
    off = client.post(f"/api/v1/games/{mid}/offer", headers=ph, json={"kind": "takeback"})
    assert off.status_code == 200, off.text
    res = client.post(f"/api/v1/games/{mid}/offer/respond", headers=ch, json={"accept": True})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["state"]["board"][7][7] is None
    assert len(body["state"]["moves"]) == 0
    assert body["turn_user_id"] == host_id  # trả lượt về người xin đi lại
    assert body["pending_offer"] is None


def test_takeback_only_by_last_mover(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": "7,7"})
    # Guest (đang tới lượt, chưa đi nước nào) xin đi lại -> bị từ chối.
    r = client.post(f"/api/v1/games/{mid}/offer", headers=ch, json={"kind": "takeback"})
    assert r.status_code == 409


def test_offer_cleared_after_new_move(client):
    ph, ch, _, _ = _two_players(client)
    match = _create_caro(client, ph, side="x")
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": "7,7"})
    client.post(f"/api/v1/games/{mid}/offer", headers=ph, json={"kind": "draw"})
    # Guest phớt lờ lời mời và đi nước của mình -> lời mời bị xóa.
    body = client.post(f"/api/v1/games/{mid}/move", headers=ch, json={"move": "8,8"}).json()
    assert body["pending_offer"] is None


def test_chess_move_requires_fen(client):
    ph, ch, _, _ = _two_players(client)
    match = client.post("/api/v1/games", headers=ph, json={"game_type": "chess", "side": "white"}).json()
    mid = match["id"]
    client.post(f"/api/v1/games/{mid}/join", headers=ch)
    r = client.post(f"/api/v1/games/{mid}/move", headers=ph, json={"move": "e2e4"})
    assert r.status_code == 409

from fastapi.testclient import TestClient
from app.main import create_app


class FakeEngine:
    def best_move(self, board):
        move = next(iter(board.legal_moves))
        return {
            "best_move": move.uci(),
            "best_move_san": board.san(move),
            "evaluation_cp": 25,
            "depth": 12,
            "principal_variation": [move.uci()],
        }


def test_health():
    with TestClient(create_app(engine=FakeEngine())) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_analyze_start_position():
    with TestClient(create_app(engine=FakeEngine())) as client:
        response = client.post("/api/analyze", json={"moves": []})
        assert response.status_code == 200
        data = response.json()
        assert len(data["best_move"]) in (4, 5)
        assert data["best_move_san"]
        assert data["turn"] == "white"


def test_analyze_after_moves():
    with TestClient(create_app(engine=FakeEngine())) as client:
        response = client.post("/api/analyze", json={"moves": ["e2e4", "e7e5"]})
        assert response.status_code == 200
        assert response.json()["turn"] == "white"


def test_reject_illegal_move():
    with TestClient(create_app(engine=FakeEngine())) as client:
        response = client.post("/api/analyze", json={"moves": ["e2e5"]})
        assert response.status_code == 422

from contextlib import asynccontextmanager
from pathlib import Path
import chess
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .engine import StockfishEngine

BASE_DIR = Path(__file__).resolve().parent


class AnalyzeRequest(BaseModel):
    moves: list[str] = Field(default_factory=list, description="Chronological UCI moves, e.g. e2e4")
    fen: str | None = None


def create_app(engine=None):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if engine is None:
            app.state.engine = StockfishEngine().start()
        else:
            app.state.engine = engine
        yield
        if engine is None:
            app.state.engine.close()

    api = FastAPI(
        title="Chess Best Move API",
        version="1.0.0",
        description="Validates a chess position and returns Stockfish's strongest move.",
        lifespan=lifespan,
    )

    @api.get("/api/health")
    def health():
        return {"status": "ok", "engine": "Stockfish"}

    @api.post("/api/analyze")
    def analyze(payload: AnalyzeRequest):
        try:
            board = chess.Board(payload.fen) if payload.fen else chess.Board()
            if not board.is_valid():
                raise ValueError("Die FEN beschreibt keine gültige Schachstellung.")
            for index, raw_move in enumerate(payload.moves):
                move = chess.Move.from_uci(raw_move)
                if move not in board.legal_moves:
                    raise ValueError(f"Ungültiger Zug an Position {index + 1}: {raw_move}")
                board.push(move)
        except (ValueError, chess.InvalidMoveError, chess.IllegalMoveError, chess.AmbiguousMoveError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        if board.is_game_over():
            raise HTTPException(status_code=409, detail="Die Partie ist bereits beendet.")

        try:
            result = api.state.engine.best_move(board)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Schach-Engine nicht verfügbar: {exc}") from exc

        return {
            **result,
            "fen": board.fen(),
            "turn": "white" if board.turn else "black",
            "game_status": "in_progress",
        }

    @api.get("/")
    def index():
        return FileResponse(BASE_DIR / "static" / "index.html")

    api.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
    return api


app = create_app()

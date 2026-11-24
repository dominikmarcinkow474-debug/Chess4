
from pathlib import Path
import re
from contextlib import asynccontextmanager

import chess
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.engine import StockfishEngine

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INDEX_FILE = STATIC_DIR / "index.html"

engine = None


class AnalyzeRequest(BaseModel):
    moves: list[str] = Field(default_factory=list, max_length=500)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    engine = StockfishEngine()
    engine.start()
    try:
        yield
    finally:
        if engine:
            engine.close()
            engine = None


app = FastAPI(
    title="Chess Best Move",
    lifespan=lifespan
)

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static"
)


@app.get("/")
def home():
    return FileResponse(
        str(INDEX_FILE),
        media_type="text/html",
        headers={"Cache-Control": "no-store"}
    )


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "engine": engine is not None and engine.ready
    }


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest):
    if engine is None or not engine.ready:
        raise HTTPException(
            status_code=503,
            detail="Stockfish ist nicht verfügbar."
        )

    board = chess.Board()

    try:
        for move in request.moves:
            if not re.fullmatch(r"[a-h][1-8][a-h][1-8][qrbn]?", move):
                raise ValueError("Ungültiges Zugformat")

            board.push_uci(move)

    except (ValueError, chess.InvalidMoveError,
            chess.IllegalMoveError, chess.AmbiguousMoveError):
        raise HTTPException(
            status_code=400,
            detail="Ungültige Schachzüge."
        )

    if board.is_game_over():
        raise HTTPException(
            status_code=400,
            detail="Die Partie ist beendet."
        )

    try:
        result = engine.analyze(board)
        return result

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Engine-Fehler: {str(error)}"
        )

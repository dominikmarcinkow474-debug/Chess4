
import os
import re
from contextlib import asynccontextmanager

import chess
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.engine import StockfishEngine


class AnalyzeRequest(BaseModel):
    moves: list[str] = Field(default_factory=list, max_length=500)


engine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine

    engine = StockfishEngine()
    engine.start()

    yield

    if engine:
        engine.close()


app = FastAPI(
    title="CART3R.JAILBREAK CHESS",
    lifespan=lifespan
)

app.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static"
)


@app.get("/")
def home():
    return FileResponse("app/static/index.html")


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
            detail="Stockfish ist momentan nicht verfügbar."
        )

    board = chess.Board()

    try:
        for move in request.moves:
            if not re.fullmatch(r"[a-h][1-8][a-h][1-8][qrbn]?", move):
                raise ValueError("Ungültiges Zugformat.")

            board.push_uci(move)

    except (ValueError, chess.InvalidMoveError,
            chess.IllegalMoveError, chess.AmbiguousMoveError):
        raise HTTPException(
            status_code=400,
            detail="Die übermittelten Züge sind ungültig."
        )

    if board.is_game_over():
        raise HTTPException(
            status_code=400,
            detail="Die Partie ist bereits beendet."
        )

    try:
        result = engine.analyze(board)

        return {
            "best_move": result["best_move"],
            "evaluation": result["evaluation"],
            "depth": result["depth"]
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Engine-Fehler: {str(error)}"
        )
